import { GoogleGenAI } from "@google/genai";
import { list, put } from "@vercel/blob";
import { isExampleInput, getExampleResponse } from "./example-responses.js";
import { isKnownSafeUrl, getSafeResponse } from "./safe-domains.js";

// =============================================================================
// SAFE BLOB WRAPPERS — never throw; fall back to in-memory state on failure
// =============================================================================

interface SafeBlob { url: string; uploadedAt: string | Date }
const inMemoryBlobs = new Map<string, { data: string; uploadedAt: Date; url: string }>();
let blobDegraded = false;

const safeList = async (prefix: string): Promise<{ blobs: SafeBlob[]; degraded: boolean }> => {
  try {
    const res = await list({ prefix });
    return { blobs: res.blobs, degraded: false };
  } catch (err) {
    console.error('[Blob] list failed:', (err as Error).message);
    blobDegraded = true;
    const mem = inMemoryBlobs.get(prefix);
    return { blobs: mem ? [{ url: mem.url, uploadedAt: mem.uploadedAt }] : [], degraded: true };
  }
};

const safePut = async (path: string, body: string): Promise<{ degraded: boolean }> => {
  try {
    await put(path, body, { access: 'public', addRandomSuffix: false, contentType: 'application/json' });
    return { degraded: false };
  } catch (err) {
    console.error('[Blob] put failed:', (err as Error).message);
    blobDegraded = true;
    inMemoryBlobs.set(path, {
      data: body,
      uploadedAt: new Date(),
      url: `mem://${path}`,
    });
    return { degraded: true };
  }
};

const safeFetchBlob = async (url: string): Promise<Response | null> => {
  if (url.startsWith('mem://')) {
    const mem = inMemoryBlobs.get(url.slice('mem://'.length));
    if (!mem) return null;
    return new Response(mem.data, { status: 200 });
  }
  try {
    return await fetch(url);
  } catch (err) {
    console.error('[Blob] fetch failed:', (err as Error).message);
    blobDegraded = true;
    return null;
  }
};

const isBlobDegraded = () => blobDegraded;
const resetBlobHealth = () => { blobDegraded = false; };

/**
 * Mask phone numbers and LINE IDs to protect PII before caching.
 */
const maskPII = (text: string): string => {
  if (!text) return text;
  let t = text;
  // Taiwan mobile: 09xxxxxxxx → 09xx-***-***
  t = t.replace(/0[9]\d{8}/g, m => m.slice(0, 4) + '-***-***');
  // International +886: +886-9xx-xxx-xxx
  t = t.replace(/\+886[-\s]?9\d{2}[-\s]?\d{3}[-\s]?\d{3}/g, '+886-9xx-***-***');
  return t;
};

// Configuration
const CACHE_DURATION_MS = 72 * 60 * 60 * 1000; // 72 hours
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 API calls per IP per hour
const MAX_INPUT_LENGTH = 2000; // Max length for URL or SMS text
const ALLOWED_LANGUAGES = ['en', 'zh-TW', 'vi'];
const ALLOWED_INPUT_TYPES = ['URL', 'SMS_TEXT', 'PHONE'];

// =============================================================================
// DEGRADATION TRACKING — classify per-service failures and compute severity
// =============================================================================

type ErrorCode =
  | 'LLM_QUOTA'
  | 'LLM_FAILED'
  | 'LOCAL_RATE_LIMIT'
  | 'STORAGE_DEGRADED'
  | 'INVALID_INPUT'
  | 'TOTAL_OUTAGE'
  | 'SERVER_ERROR';

type DegradationLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

interface Degradation {
  level: DegradationLevel;
  score: number;
  services: string[];
}

// Service weights — see plan: Gemini=10 (critical), Blob=2, side-sources=1
const SERVICE_WEIGHT: Record<string, number> = {
  Gemini: 10,
  'Vercel Blob': 2,
  'Safe Browsing': 1,
  VirusTotal: 1,
  Cofacts: 1,
  ScamSniffer: 1,
  RDAP: 1,
  DNS: 1,
};

export function computeDegradation(services: string[], geminiFailed = false): Degradation {
  const unique = [...new Set(services)];
  const score = unique.reduce((sum, s) => sum + (SERVICE_WEIGHT[s] ?? 1), 0);

  let level: DegradationLevel;
  if (geminiFailed) {
    const sideFailures = unique.filter(s => s !== 'Gemini').length;
    level = sideFailures >= 3 ? 'L5' : 'L4';
  } else if (score === 0) {
    level = 'L0';
  } else if (score <= 2) {
    level = 'L1';
  } else if (score <= 4) {
    level = 'L2';
  } else {
    level = 'L3';
  }

  return { level, score, services: unique };
}

// Classify a caught error into a code. Uses multiple signals — SDK error.status,
// error.code (Gemini sets RESOURCE_EXHAUSTED), and message regex as fallback.
// Avoid the loose `message.includes('429')` match that caused the original bug.
export function classifyError(err: any): { errorCode: ErrorCode; status: number; message: string } {
  const msg = typeof err?.message === 'string' ? err.message : '';
  const code = err?.code ?? err?.error?.code;
  const status = err?.status ?? err?.response?.status;

  const isQuota =
    status === 429 ||
    code === 'RESOURCE_EXHAUSTED' ||
    /resource[_ ]exhausted|quota exceeded|quota_exceeded/i.test(msg);

  if (isQuota) {
    return {
      errorCode: 'LLM_QUOTA',
      status: 503,
      message: 'AI analysis service temporarily at capacity',
    };
  }

  if (status === 401 || status === 403 || /api[_ ]?key|unauthenticated|unauthorized/i.test(msg)) {
    return {
      errorCode: 'LLM_FAILED',
      status: 500,
      message: 'AI service authentication error',
    };
  }

  return {
    errorCode: 'SERVER_ERROR',
    status: 500,
    message: msg || 'An unexpected error occurred',
  };
}

// Inflation Maps for minified schema
const HISTORY_TYPE_MAP: Record<number, string> = {
  0: "PREDICTION_WIN", 1: "PREDICTION_LOSS", 2: "CONTROVERSY",
  3: "NEUTRAL_NEWS", 4: "SCAM_ALLEGATION", 5: "INVESTIGATION"
};
const SENTIMENT_MAP: Record<number, string> = { 0: "POSITIVE", 1: "NEGATIVE", 2: "NEUTRAL" };
const ENGAGEMENT_MAP: Record<number, string> = { 0: "ORGANIC", 1: "MIXED", 2: "SUSPICIOUS", 3: "BOT_HEAVY" };
const IDENTITY_MAP: Record<number, string> = { 0: "UNKNOWN_ENTITY", 1: "VERIFIED_INFLUENCER", 2: "IMPERSONATOR", 3: "OFFICIAL_PROJECT" };
const RISK_LEVEL_MAP: Record<number, string> = { 0: "CRITICAL", 1: "WARNING", 2: "INFO" };
const ACTION_TYPE_MAP: Record<number, string> = { 0: "CALL_165", 1: "BLOCK", 2: "OFFICIAL_CHANNEL", 3: "REPORT", 4: "VERIFY", 5: "IGNORE" };

/**
 * Detect input type from content
 */
const detectInputType = (input: string): 'URL' | 'SMS_TEXT' | 'PHONE' => {
  const trimmed = input.trim();

  // Check if it's a URL
  if (/^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed)) {
    return 'URL';
  }

  // Check if it looks like a phone number (E.164 international or Taiwan local 09xx)
  if (/^\+\d{7,15}$/.test(trimmed.replace(/[\s\-().]/g, '')) || /^0[89]\d{8}$/.test(trimmed.replace(/[\s\-]/g, ''))) {
    return 'PHONE';
  }

  // Otherwise, treat as SMS/text content
  return 'SMS_TEXT';
};

/**
 * Sanitize and validate input based on type
 */
const sanitizeInput = (input: string, inputType: 'URL' | 'SMS_TEXT' | 'PHONE'): string | null => {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();

  switch (inputType) {
    case 'URL':
      // Basic URL validation
      if (trimmed.length > MAX_INPUT_LENGTH) return null;
      try {
        const urlStr = trimmed.startsWith('www.') ? `https://${trimmed}` : trimmed;
        new URL(urlStr);
        return urlStr;
      } catch {
        return null;
      }

    case 'SMS_TEXT':
      // Validate text length and sanitize
      if (trimmed.length === 0 || trimmed.length > MAX_INPUT_LENGTH) return null;
      // Basic sanitization - remove control characters
      return trimmed.replace(/[\x00-\x1F\x7F]/g, '');

    case 'PHONE': {
      // Normalize phone number: strip spaces, dashes, parens
      const digits = trimmed.replace(/[\s\-().]/g, '');
      // E.164 international format: +[1-3 digit country code][number]
      if (/^\+\d{7,15}$/.test(digits)) return digits;
      // Taiwan local mobile 09xxxxxxxx → +8869xxxxxxxx
      if (/^09\d{8}$/.test(digits)) return `+886${digits.slice(1)}`;
      // Taiwan local landline 0x-xxxxxxxx
      if (/^0[2-8]\d{7,8}$/.test(digits)) return `+886${digits.slice(1)}`;
      return null;
    }

    default:
      return null;
  }
};

/**
 * Generate cache key for different input types
 */
const generateCacheKey = (input: string, inputType: string): string => {
  // Create a short hash for URLs and SMS text
  if (inputType === 'URL' || inputType === 'SMS_TEXT') {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `${inputType.toLowerCase()}-${Math.abs(hash).toString(36)}`;
  }
  // For phone numbers, use the normalized E.164 number as key
  if (inputType === 'PHONE') {
    return `phone-${input.replace(/\+/g, '')}`;
  }
  return input;
};

const logToGoogleSheets = async (webhookUrl: string, payload: string) => {
  try {
    const r1 = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      redirect: 'manual',
    });
    const redirectUrl = r1.headers.get('location');
    if (!redirectUrl) return;
    await fetch(redirectUrl, { method: 'GET' });
  } catch {
    // Fire-and-forget logging must never break the main API response.
  }
};

/**
 * Generate suggested actions based on risk score and signals
 */
const generateActions = (scamProbability: number, riskSignals: any[], language: string): any[] => {
  const actions: any[] = [];

  if (scamProbability >= 70) {
    // High risk - recommend calling 165 and blocking
    actions.push({
      label: language === 'zh-TW' ? '📞 撥打 165 反詐騙專線' : '📞 Call 165 Anti-Fraud Hotline',
      actionUrl: 'tel:165',
      type: 'CALL_165',
      priority: 1
    });
    actions.push({
      label: language === 'zh-TW' ? '🚫 封鎖此聯絡人' : '🚫 Block This Contact',
      type: 'BLOCK',
      priority: 2
    });
    actions.push({
      label: language === 'zh-TW' ? '📋 向警政署檢舉' : '📋 Report to Police',
      actionUrl: 'https://165.npa.gov.tw/#/report/call/02',
      type: 'REPORT',
      priority: 3
    });
  } else if (scamProbability >= 40) {
    // Medium risk - recommend verification
    actions.push({
      label: language === 'zh-TW' ? '✅ 透過官方管道驗證' : '✅ Verify via Official Channel',
      type: 'OFFICIAL_CHANNEL',
      priority: 1
    });
    actions.push({
      label: language === 'zh-TW' ? '📋 回報可疑訊息' : '📋 Report Suspicious Message',
      actionUrl: 'https://165.npa.gov.tw/#/report/call/02',
      type: 'REPORT',
      priority: 2
    });
  } else {
    // Low risk
    actions.push({
      label: language === 'zh-TW' ? '✅ 看起來安全，但請保持警覺' : '✅ Appears Safe, Stay Vigilant',
      type: 'VERIFY',
      priority: 1
    });
  }

  return actions;
};

/**
 * Generate senior-friendly verdict
 */
const generateSeniorVerdict = (scamProbability: number, language: string): string => {
  if (scamProbability >= 70) {
    return language === 'zh-TW'
      ? '⚠️ 這很可能是詐騙！請不要匯款或提供個人資料。建議撥打 165 諮詢。'
      : '⚠️ This is likely a SCAM! Do NOT send money or personal info. Call 165 for help.';
  } else if (scamProbability >= 40) {
    return language === 'zh-TW'
      ? '⚠️ 這有一些可疑跡象。請先向官方確認後再行動。'
      : '⚠️ This has some suspicious signs. Please verify with official sources first.';
  } else {
    return language === 'zh-TW'
      ? '✅ 目前看起來還好，但請繼續保持警覺。'
      : '✅ Looks okay for now, but stay alert.';
  }
};

/**
 * Get client IP from request headers
 */
const getClientIP = (req: any): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
};

/**
 * Hash IP for privacy (simple hash, not cryptographic)
 */
const hashIP = (ip: string): string => {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
};

/**
 * Extract JSON from a potentially markdown-formatted string
 */
const extractJSON = (text: string): string => {
  // Remove markdown code blocks if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  // Extract the JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : cleaned;
};

/**
 * Safely parse JSON from a fetch response, returning null on failure
 */
const safeParseJSON = async (response: Response): Promise<any | null> => {
  try {
    if (!response.ok) {
      return null;
    }
    const text = await response.text();
    // Validate it looks like JSON before parsing
    if (!text || !text.trim().startsWith('{')) {
      return null;
    }
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/**
 * Check and update rate limit for an IP
 */
const checkRateLimit = async (ip: string): Promise<{ allowed: boolean; remaining: number }> => {
  const ipHash = hashIP(ip);
  const rateLimitPath = `ratelimit/${ipHash}.json`;

  const { blobs } = await safeList(rateLimitPath);
  const now = Date.now();

  if (blobs.length > 0) {
    const blob = blobs[0];
    const response = await safeFetchBlob(blob.url);
    const data = response ? await safeParseJSON(response) : null;

    // If parsing failed or data is invalid, treat as no existing rate limit
    if (!data || typeof data.windowStart !== 'number' || typeof data.count !== 'number') {
      await safePut(rateLimitPath, JSON.stringify({ windowStart: now, count: 1 }));
      return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
    }

    // Check if window has expired
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
      await safePut(rateLimitPath, JSON.stringify({ windowStart: now, count: 1 }));
      return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
    }

    // Window still active - check count
    if (data.count >= MAX_REQUESTS_PER_WINDOW) {
      return { allowed: false, remaining: 0 };
    }

    // Increment count
    const newData = { windowStart: data.windowStart, count: data.count + 1 };
    await safePut(rateLimitPath, JSON.stringify(newData));
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - newData.count };
  }

  // No existing rate limit - create new
  await safePut(rateLimitPath, JSON.stringify({ windowStart: now, count: 1 }));
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
};

/**
 * Build cache file path for Vercel Blob
 */
const buildCachePath = (cacheKey: string, language: string): string => {
  return `cache/${cacheKey}-${language}.json`;
};

/**
 * Check if cached data exists and is still valid
 */
const getCachedAnalysis = async (handle: string, language: string) => {
  const cachePath = buildCachePath(handle, language);
  const { blobs } = await safeList(cachePath);

  if (blobs.length === 0) {
    return null;
  }

  const blob = blobs[0];
  const uploadedAt = new Date(blob.uploadedAt).getTime();
  const age = Date.now() - uploadedAt;

  // Check if cache is expired (> 72 hours)
  if (age > CACHE_DURATION_MS) {
    console.log(`Cache expired for ${handle} (age: ${Math.round(age / 1000 / 60)} minutes)`);
    return null;
  }

  // Fetch the cached data
  const response = await safeFetchBlob(blob.url);
  const data = response ? await safeParseJSON(response) : null;

  // If parsing failed, treat as cache miss
  if (!data) {
    console.log(`Cache data invalid for ${handle}, treating as miss`);
    return null;
  }

  console.log(`Cache hit for ${handle} (age: ${Math.round(age / 1000 / 60)} minutes)`);
  return {
    data,
    cachedAt: uploadedAt
  };
};

/**
 * Save analysis result to Vercel Blob cache
 */
const setCachedAnalysis = async (handle: string, language: string, data: any) => {
  const cachePath = buildCachePath(handle, language);
  await safePut(cachePath, JSON.stringify(data));
};


// =============================================================================
// COFACTS COMMUNITY FACT-CHECK — query cofacts.tw for crowd-sourced verification
// =============================================================================

interface CofactsArticle {
  id: string;
  text: string;
  articleType: string;
  replyCount: number;
  createdAt: string;
  replies: Array<{
    text: string;
    type: string; // RUMOR, NOT_RUMOR, OPINIONATED, NOT_ARTICLE
    createdAt: string;
  }>;
}

interface CofactsResult {
  status: 'FOUND' | 'NOT_FOUND' | 'ERROR';
  totalMatches: number;
  articles: CofactsArticle[];
}

async function queryCofacts(inputText: string, degradedOut?: string[]): Promise<CofactsResult> {
  try {
    // Take up to 100 chars for search to avoid overly specific queries
    const searchText = inputText.slice(0, 100).trim();
    if (searchText.length < 10) return { status: 'NOT_FOUND', totalMatches: 0, articles: [] };

    const query = `{
      ListArticles(
        filter: { moreLikeThis: { like: ${JSON.stringify(searchText)}, minimumShouldMatch: "2<70%" } }
        orderBy: [{ _score: DESC }]
        first: 5
      ) {
        totalCount
        edges {
          node {
            id
            text
            articleType
            replyCount
            createdAt
            articleReplies {
              reply {
                text
                type
                createdAt
              }
            }
          }
        }
      }
    }`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const cofactsAppId = process.env.COFACTS_APP_ID || 'VERIFYFIRST_AI';
    const resp = await fetch('https://api.cofacts.tw/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-id': cofactsAppId,
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      degradedOut?.push('Cofacts');
      return { status: 'ERROR', totalMatches: 0, articles: [] };
    }

    const json = await resp.json();
    const list = json?.data?.ListArticles;
    if (!list || list.totalCount === 0) return { status: 'NOT_FOUND', totalMatches: 0, articles: [] };

    const articles: CofactsArticle[] = list.edges.map((edge: any) => ({
      id: edge.node.id,
      text: (edge.node.text || '').slice(0, 300),
      articleType: edge.node.articleType,
      replyCount: edge.node.replyCount || 0,
      createdAt: edge.node.createdAt,
      replies: (edge.node.articleReplies || [])
        .filter((ar: any) => ar.reply)
        .map((ar: any) => ({
          text: (ar.reply.text || '').slice(0, 500),
          type: ar.reply.type,
          createdAt: ar.reply.createdAt,
        })),
    }));

    return { status: 'FOUND', totalMatches: list.totalCount, articles };
  } catch (err) {
    console.error('[Cofacts] failed:', (err as Error).message);
    degradedOut?.push('Cofacts');
    return { status: 'ERROR', totalMatches: 0, articles: [] };
  }
}

function buildCofactsFactsSection(cofacts: CofactsResult): string {
  if (cofacts.status !== 'FOUND' || cofacts.articles.length === 0) return '';

  const lines: string[] = [
    '\n=== COFACTS COMMUNITY FACT-CHECK (cofacts.tw — crowd-sourced verification) ===',
    `Matched ${cofacts.totalMatches} similar report(s) in Cofacts database.`,
  ];

  const withReplies = cofacts.articles.filter(a => a.replyCount > 0);
  for (const article of withReplies.slice(0, 3)) {
    lines.push(`\n[Report] "${article.text.slice(0, 120)}${article.text.length > 120 ? '...' : ''}"`);
    for (const reply of article.replies.slice(0, 2)) {
      const typeLabel = reply.type === 'RUMOR' ? '❌ RUMOR (confirmed false)'
        : reply.type === 'NOT_RUMOR' ? '✅ NOT A RUMOR (confirmed true)'
        : reply.type === 'OPINIONATED' ? '💬 OPINIONATED (contains personal opinion)'
        : '📝 NOT AN ARTICLE';
      lines.push(`  Verdict: ${typeLabel}`);
      lines.push(`  Reply: "${reply.text.slice(0, 200)}${reply.text.length > 200 ? '...' : ''}"`);
    }
  }

  lines.push('=== END COFACTS ===');
  return lines.join('\n');
}

// =============================================================================
// FACT GATHERING — free external checks run before AI analysis
// =============================================================================

const FACT_FETCH_TIMEOUT_MS = 5000;   // external API / DNS / RDAP calls
const OBSERVE_FETCH_TIMEOUT_MS = 10000; // page fetching — allow more for slow infra

// Realistic Chrome 125 browser headers — bypasses most CDN bot filters
const BROWSER_HEADERS: Record<string, string> = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'accept': 'text/html,application/xhtml+xml,application/xhtml+xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  'accept-encoding': 'gzip, deflate, br',
  'cache-control': 'no-cache',
  'pragma': 'no-cache',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
};

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FACT_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchPage(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), OBSERVE_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: 'manual',
      headers: BROWSER_HEADERS,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(id);
  }
}

/** Resolve a Location header value against a base URL */
function resolveRedirect(location: string, base: string): string | null {
  try {
    // Protocol-relative: //example.com/path
    if (location.startsWith('//')) {
      const scheme = new URL(base).protocol;
      return new URL(scheme + location).toString();
    }
    return new URL(location, base).toString();
  } catch {
    return null;
  }
}

/** Detect meta-refresh or JS redirect in HTML and return target URL */
function extractSoftRedirect(html: string, base: string): string | null {
  // <meta http-equiv="refresh" content="0; url=...">
  const metaMatch = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^;]*;\s*url=([^"'\s>]+)/i)
    ?? html.match(/<meta[^>]+content=["'][^;]*;\s*url=([^"'\s>]+)[^>]*http-equiv=["']?refresh/i);
  if (metaMatch) {
    try { return new URL(metaMatch[1], base).toString(); } catch {}
  }
  // window.location.href = "...", window.location.replace(".."), location.href=
  const jsMatch = html.match(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']{10,}["'])/);
  if (jsMatch) {
    try { return new URL(jsMatch[1].replace(/["']$/, ''), base).toString(); } catch {}
  }
  return null;
}

/** Detect Cloudflare / generic anti-bot challenge pages */
function isBotChallenge(html: string, status: number): boolean {
  if (status === 403 || status === 429) return true;
  const lower = html.slice(0, 4000).toLowerCase();
  return (
    lower.includes('cf-browser-verification') ||
    lower.includes('checking your browser') ||
    lower.includes('just a moment') ||
    lower.includes('enable javascript and cookies') ||
    lower.includes('ddos-guard') ||
    lower.includes('ray id') ||
    (status === 503 && lower.includes('cloudflare'))
  );
}

// --- RDAP: domain registration info (no API key required) ---
async function rdapFacts(hostname: string, degradedOut?: string[]): Promise<Record<string, string>> {
  try {
    const res = await fetchWithTimeout(`https://rdap.org/domain/${encodeURIComponent(hostname)}`);
    if (!res.ok) {
      // 404 is a valid signal (domain not registered) — NOT degradation.
      // Any other non-ok status is an RDAP service failure.
      if (res.status !== 404) degradedOut?.push('RDAP');
      return {};
    }
    const d = await res.json();

    const events: any[] = d.events || [];
    const regEvent = events.find((e: any) => e.eventAction === 'registration');
    const expEvent = events.find((e: any) => e.eventAction === 'expiration');

    const regDate = regEvent?.eventDate ? new Date(regEvent.eventDate) : null;
    const ageDays = regDate ? Math.floor((Date.now() - regDate.getTime()) / 86400000) : null;

    const entities: any[] = d.entities || [];
    const registrar = entities.find((e: any) => (e.roles || []).includes('registrar'));
    const registrarName = registrar?.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[3] ?? null;

    const result: Record<string, string> = {};
    if (regDate) result.registrationDate = regDate.toISOString().split('T')[0];
    if (ageDays !== null) result.domainAgeDays = String(ageDays);
    if (expEvent?.eventDate) result.expiresDate = new Date(expEvent.eventDate).toISOString().split('T')[0];
    if (registrarName) result.registrar = String(registrarName);
    return result;
  } catch (err) {
    console.error('[RDAP] failed:', (err as Error).message);
    degradedOut?.push('RDAP');
    return {};
  }
}

// --- Google Safe Browsing v4 (optional — needs GOOGLE_SAFE_BROWSING_KEY) ---
async function safeBrowsingCheck(url: string, degradedOut?: string[]): Promise<{ status: 'CLEAN' | 'THREAT' | 'SKIP'; threats?: string[] }> {
  const sbKey = process.env.GOOGLE_SAFE_BROWSING_KEY;
  if (!sbKey) return { status: 'SKIP' }; // not configured ≠ degraded
  try {
    const body = {
      client: { clientId: 'verify1st', clientVersion: '1.0' },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url }],
      },
    };
    const res = await fetchWithTimeout(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${sbKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    if (!res.ok) {
      degradedOut?.push('Safe Browsing');
      return { status: 'SKIP' };
    }
    const d = await res.json();
    if (d.matches?.length > 0) {
      return { status: 'THREAT', threats: d.matches.map((m: any) => m.threatType as string) };
    }
    return { status: 'CLEAN' };
  } catch (err) {
    console.error('[SafeBrowsing] failed:', (err as Error).message);
    degradedOut?.push('Safe Browsing');
    return { status: 'SKIP' };
  }
}

// --- DNS via Google DoH (no API key required) ---
async function dnsFacts(hostname: string, degradedOut?: string[]): Promise<{ resolvable: boolean; ips: string[] }> {
  try {
    const res = await fetchWithTimeout(
      `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`
    );
    if (!res.ok) {
      degradedOut?.push('DNS');
      return { resolvable: false, ips: [] };
    }
    const d = await res.json();
    const ips: string[] = (d.Answer || [])
      .filter((a: any) => a.type === 1)
      .map((a: any) => a.data as string)
      .slice(0, 3);
    return { resolvable: ips.length > 0, ips };
  } catch (err) {
    console.error('[DNS] failed:', (err as Error).message);
    degradedOut?.push('DNS');
    return { resolvable: false, ips: [] };
  }
}

// --- ScamSniffer: Web3/crypto phishing blacklist (GitHub open-source DB) ---
// Module-level cache — persists across warm Vercel invocations, re-fetched after 24h.
let _ssCache: { domains: Set<string>; addresses: Set<string>; fetchedAt: number } | null = null;
const SS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SS_DOMAINS_URL = 'https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/domains.json';
const SS_ADDRESSES_URL = 'https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json';

async function getScamSnifferDB(degradedOut?: string[]): Promise<{ domains: Set<string>; addresses: Set<string> } | null> {
  const now = Date.now();
  if (_ssCache && (now - _ssCache.fetchedAt) < SS_CACHE_TTL_MS) return _ssCache;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000); // 10s for larger files
    const [domainsRes, addressesRes] = await Promise.all([
      fetch(SS_DOMAINS_URL, { signal: controller.signal }),
      fetch(SS_ADDRESSES_URL, { signal: controller.signal }),
    ]);
    clearTimeout(id);

    if (!domainsRes.ok || !addressesRes.ok) {
      degradedOut?.push('ScamSniffer');
      return _ssCache;
    }

    const domains: string[] = await domainsRes.json();
    const addresses: string[] = await addressesRes.json();

    _ssCache = {
      domains: new Set(domains.map(d => d.toLowerCase())),
      addresses: new Set(addresses.map(a => a.toLowerCase())),
      fetchedAt: now,
    };
    return _ssCache;
  } catch (err) {
    console.error('[ScamSniffer] fetch failed:', (err as Error).message);
    degradedOut?.push('ScamSniffer');
    return _ssCache; // Return stale cache on fetch failure
  }
}

async function scamSnifferCheck(url: string, degradedOut?: string[]): Promise<{ status: 'BLOCKED' | 'PASSED' | 'SKIP'; source?: string }> {
  let hostname: string;
  try { hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return { status: 'SKIP' }; }

  const db = await getScamSnifferDB(degradedOut);
  if (!db) return { status: 'SKIP' };

  if (db.domains.has(hostname)) return { status: 'BLOCKED', source: 'exact match' };

  // Also check root domain (catches subdomains of blacklisted domains)
  const parts = hostname.split('.');
  if (parts.length > 2) {
    const root = parts.slice(-2).join('.');
    if (db.domains.has(root)) return { status: 'BLOCKED', source: 'parent domain match' };
  }

  return { status: 'PASSED' };
}

async function scamSnifferAddressCheck(address: string, degradedOut?: string[]): Promise<{ status: 'BLOCKED' | 'PASSED' | 'SKIP' }> {
  const db = await getScamSnifferDB(degradedOut);
  if (!db) return { status: 'SKIP' };
  return { status: db.addresses.has(address.toLowerCase()) ? 'BLOCKED' : 'PASSED' };
}

// --- VirusTotal: multi-engine domain reputation (free 4 req/min, 500/day) ---
// Module-level cache to avoid redundant calls across warm invocations
const vtResultCache = new Map<string, { result: VTResult | null; cachedAt: number }>();
const VT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Sliding-window rate limiter: max 3 calls/min (free tier is 4, keep 1 buffer)
const vtCallTimestamps: number[] = [];
const VT_MAX_PER_MINUTE = 3;

function canCallVirusTotal(): boolean {
  const now = Date.now();
  while (vtCallTimestamps.length > 0 && vtCallTimestamps[0] < now - 60_000) {
    vtCallTimestamps.shift();
  }
  return vtCallTimestamps.length < VT_MAX_PER_MINUTE;
}

interface VTResult {
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  reputation: number;  // community reputation score, negative = bad
  categories: string[];
}

async function virusTotalCheck(hostname: string, degradedOut?: string[]): Promise<VTResult | null> {
  const key = process.env.VIRUSTOTAL_API_KEY;
  if (!key) return null; // not configured ≠ degraded

  // Return cached result if still fresh
  const cached = vtResultCache.get(hostname);
  if (cached && Date.now() - cached.cachedAt < VT_CACHE_TTL_MS) {
    return cached.result;
  }

  // Local rate limiter hit — VirusTotal's free tier is tight; treat as soft degradation
  if (!canCallVirusTotal()) {
    degradedOut?.push('VirusTotal');
    return null;
  }
  vtCallTimestamps.push(Date.now());

  try {
    const res = await fetchWithTimeout(
      `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(hostname)}`,
      { headers: { 'x-apikey': key } }
    );
    if (!res.ok) {
      // 404 from VT means "domain not in database" — not a failure
      if (res.status !== 404) degradedOut?.push('VirusTotal');
      return null;
    }
    const d = await res.json();
    const attrs = d.data?.attributes ?? {};
    const stats = attrs.last_analysis_stats ?? {};
    const cats: string[] = Object.values(attrs.categories ?? {}) as string[];
    const result: VTResult = {
      malicious: stats.malicious ?? 0,
      suspicious: stats.suspicious ?? 0,
      harmless: stats.harmless ?? 0,
      undetected: stats.undetected ?? 0,
      reputation: attrs.reputation ?? 0,
      categories: [...new Set(cats)].slice(0, 5),
    };
    vtResultCache.set(hostname, { result, cachedAt: Date.now() });
    return result;
  } catch (err) {
    console.error('[VirusTotal] failed:', (err as Error).message);
    degradedOut?.push('VirusTotal');
    return null;
  }
}

function formatVTResult(vt: VTResult): string {
  const total = vt.malicious + vt.suspicious + vt.harmless + vt.undetected;
  const engines = total > 0 ? `(${total} engines)` : '';

  if (vt.malicious >= 5) {
    return `VirusTotal: 🚨 MALICIOUS — ${vt.malicious} engines flagged ${engines}`;
  } else if (vt.malicious >= 1 || vt.suspicious >= 3) {
    return `VirusTotal: ⚠️ SUSPICIOUS — ${vt.malicious} malicious, ${vt.suspicious} suspicious ${engines}`;
  } else if (vt.reputation < -10) {
    return `VirusTotal: ⚠️ LOW REPUTATION score ${vt.reputation} — community reports negative`;
  } else {
    const label = total > 0 ? `✅ CLEAN — 0/${total} engines flagged` : '✅ CLEAN';
    return `VirusTotal: ${label}${vt.reputation > 0 ? `, reputation +${vt.reputation}` : ''}`;
  }
}

// --- Gather all URL facts and format as prompt section ---
async function buildURLFactsSection(url: string, degradedOut?: string[]): Promise<string> {
  let hostname: string;
  try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }

  const [rdap, sb, dns, ss, vt] = await Promise.allSettled([
    rdapFacts(hostname, degradedOut),
    safeBrowsingCheck(url, degradedOut),
    dnsFacts(hostname, degradedOut),
    scamSnifferCheck(url, degradedOut),
    virusTotalCheck(hostname, degradedOut),
  ]);

  const lines: string[] = ['=== OBJECTIVE PRE-CHECKS (treat as verified ground truth) ==='];
  lines.push(`Domain: ${hostname}`);

  const rd = rdap.status === 'fulfilled' ? rdap.value : {};
  if (rd.domainAgeDays !== undefined) {
    const days = parseInt(rd.domainAgeDays);
    const flag = days < 14 ? ' ⚠️ EXTREMELY NEW — high risk signal'
      : days < 90 ? ' ⚠️ VERY NEW'
      : days < 365 ? ' (less than 1 year old)'
      : ' (established domain)';
    lines.push(`Domain Age: ${days} day(s)${flag}`);
  }
  if (rd.registrationDate) lines.push(`Registered: ${rd.registrationDate}`);
  if (rd.expiresDate) lines.push(`Expires: ${rd.expiresDate}`);
  if (rd.registrar) lines.push(`Registrar: ${rd.registrar}`);

  if (sb.status === 'fulfilled') {
    const s = sb.value;
    if (s.status === 'THREAT') {
      lines.push(`Google Safe Browsing: 🚨 THREAT DETECTED — ${s.threats?.join(', ')}`);
    } else if (s.status === 'CLEAN') {
      lines.push('Google Safe Browsing: ✅ CLEAN (not on any blocklist)');
    }
  }

  if (dns.status === 'fulfilled') {
    const d = dns.value;
    if (d.resolvable) {
      lines.push(`DNS: Resolves → ${d.ips.join(', ')}`);
    } else {
      lines.push('DNS: ❌ Does not resolve — domain may not be active');
    }
  }

  if (ss.status === 'fulfilled' && ss.value.status !== 'SKIP') {
    if (ss.value.status === 'BLOCKED') {
      lines.push('ScamSniffer: 🚨 BLOCKED — confirmed crypto/Web3 phishing domain');
    } else {
      lines.push('ScamSniffer: ✅ Not on crypto phishing blacklist');
    }
  }

  if (vt.status === 'fulfilled' && vt.value) {
    lines.push(formatVTResult(vt.value));
    if (vt.value.categories.length > 0) {
      lines.push(`VirusTotal Categories: ${vt.value.categories.join(', ')}`);
    }
  }

  lines.push('=== END PRE-CHECKS — use the above as authoritative data ===');
  return lines.join('\n');
}

// --- Phone facts: local parsing, no API key required ---
const COUNTRY_CODE_MAP: Record<string, string> = {
  '886': 'Taiwan', '852': 'Hong Kong', '853': 'Macau', '855': 'Cambodia',
  '856': 'Laos', '880': 'Bangladesh', '65': 'Singapore', '66': 'Thailand',
  '84': 'Vietnam', '62': 'Indonesia', '63': 'Philippines', '60': 'Malaysia',
  '81': 'Japan', '82': 'South Korea', '86': 'China', '91': 'India',
  '1': 'US/Canada', '44': 'UK', '49': 'Germany', '33': 'France',
  '55': 'Brazil', '7': 'Russia',
};

function buildPhoneFactsSection(e164: string): string {
  const digits = e164.startsWith('+') ? e164.slice(1) : e164;
  let country = 'Unknown';
  for (const len of [3, 2, 1]) {
    const cc = digits.slice(0, len);
    if (COUNTRY_CODE_MAP[cc]) { country = COUNTRY_CODE_MAP[cc]; break; }
  }

  let lineType = 'Unknown';
  if (digits.startsWith('886')) {
    const local = digits.slice(3);
    if (local.startsWith('9')) lineType = 'Mobile (Taiwan)';
    else if (local.startsWith('800')) lineType = 'Toll-free (Taiwan)';
    else if (local.startsWith('2')) lineType = 'Landline — Taipei';
    else if (local.startsWith('4')) lineType = 'Landline — Central Taiwan';
    else if (local.startsWith('6')) lineType = 'Landline — Southern Taiwan';
    else if (local.startsWith('7')) lineType = 'Landline — Kaohsiung';
    else lineType = 'Landline (Taiwan)';
  } else if (digits.startsWith('1')) {
    lineType = 'North American number (mobile or landline)';
  } else if (digits.startsWith('86')) {
    lineType = digits.startsWith('861') || digits.startsWith('869') ? 'Mobile (China)' : 'Landline (China)';
  }

  return [
    '=== OBJECTIVE PRE-CHECKS (verified data) ===',
    `Number (E.164): ${e164}`,
    `Country: ${country}`,
    `Line Type: ${lineType}`,
    '=== END PRE-CHECKS ===',
  ].join('\n');
}

// --- SMS: extract embedded URLs/wallets/phones and check them ---
async function buildSMSFactsSection(text: string, degradedOut?: string[]): Promise<string> {
  const urlMatches = [...text.matchAll(/https?:\/\/[^\s<>"{}|\\^`[\]]+/gi)].map(m => m[0]);
  const uniqueURLs = [...new Set(urlMatches)].slice(0, 3);
  const phoneMatches = [...text.matchAll(/(?:\+886|886|0)[89]\d{8}|\+\d{8,14}/g)].map(m => m[0]);
  const uniquePhones = [...new Set(phoneMatches)].slice(0, 2);
  // Ethereum/EVM wallet addresses
  const walletMatches = [...text.matchAll(/0x[a-fA-F0-9]{40}/g)].map(m => m[0]);
  const uniqueWallets = [...new Set(walletMatches)].slice(0, 3);

  if (uniqueURLs.length === 0 && uniquePhones.length === 0 && uniqueWallets.length === 0) return '';

  const lines: string[] = ['=== EMBEDDED LINKS/WALLETS/PHONES PRE-CHECKS ==='];

  for (const url of uniqueURLs) {
    let hostname: string;
    try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch { continue; }

    const [rdap, sb, ss, vt] = await Promise.allSettled([
      rdapFacts(hostname, degradedOut),
      safeBrowsingCheck(url, degradedOut),
      scamSnifferCheck(url, degradedOut),
      virusTotalCheck(hostname, degradedOut),
    ]);
    lines.push(`\nURL: ${url}`);
    const rd = rdap.status === 'fulfilled' ? rdap.value : {};
    if (rd.domainAgeDays !== undefined) {
      const days = parseInt(rd.domainAgeDays);
      lines.push(`  Domain Age: ${days} day(s)${days < 30 ? ' ⚠️ VERY NEW' : ''}`);
    }
    if (sb.status === 'fulfilled' && sb.value.status !== 'SKIP') {
      lines.push(`  Safe Browsing: ${sb.value.status === 'THREAT' ? '🚨 THREAT — ' + sb.value.threats?.join(', ') : '✅ CLEAN'}`);
    }
    if (ss.status === 'fulfilled' && ss.value.status !== 'SKIP') {
      lines.push(`  ScamSniffer: ${ss.value.status === 'BLOCKED' ? '🚨 BLOCKED — confirmed crypto phishing domain' : '✅ Not on crypto phishing blacklist'}`);
    }
    if (vt.status === 'fulfilled' && vt.value) {
      lines.push(`  ${formatVTResult(vt.value)}`);
    }
  }

  for (const wallet of uniqueWallets) {
    const result = await scamSnifferAddressCheck(wallet, degradedOut);
    lines.push(`\nWallet Address: ${wallet}`);
    if (result.status !== 'SKIP') {
      lines.push(`  ScamSniffer: ${result.status === 'BLOCKED' ? '🚨 BLOCKED — confirmed scam wallet address' : '✅ Not on scam wallet blacklist'}`);
    }
  }

  if (uniquePhones.length > 0) {
    lines.push(`\nPhone numbers found in message: ${uniquePhones.join(', ')}`);
  }

  lines.push('=== END PRE-CHECKS ===');
  return lines.join('\n');
}

// =============================================================================

const guessPlatform = (value: string): string | undefined => {
  const lower = value.toLowerCase();
  if (lower.includes('line')) return 'LINE';
  if (lower.includes('instagram') || lower.includes('instagr.am')) return 'Instagram';
  if (lower.includes('facebook') || lower.includes('fb.')) return 'Facebook';
  if (lower.includes('telegram') || lower.includes('t.me')) return 'Telegram';
  if (lower.includes('shopee')) return 'Shopee';
  return undefined;
};

const normalizeInput = (input: string, inputType: string) => {
  const normalized: any = {};
  if (inputType === 'URL') {
    normalized.url = input;
    try {
      const url = new URL(input);
      normalized.domain = url.hostname.replace(/^www\./, '');
      normalized.platform = guessPlatform(input);
    } catch {}
    return normalized;
  }

  if (inputType === 'PHONE') {
    normalized.phone = input;
    return normalized;
  }

  normalized.text = input;
  normalized.platform = guessPlatform(input);
  const urlMatch = input.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/i);
  if (urlMatch) {
    normalized.url = urlMatch[0];
    try {
      normalized.domain = new URL(urlMatch[0]).hostname.replace(/^www\./, '');
    } catch {}
  }
  const phoneMatch = input.match(/(?:\+886|886|0)[89]\d{8}|\+\d{8,14}/);
  if (phoneMatch) normalized.phone = phoneMatch[0];
  const handleMatch = input.match(/@([a-zA-Z0-9._]{2,50})/);
  if (handleMatch) normalized.handle = handleMatch[1];
  return normalized;
};

async function observeUrl(targetUrl: string): Promise<any> {
  const chain: string[] = [];
  let current = targetUrl;
  const MAX_HOPS = 8; // more hops to handle multi-step redirect chains

  for (let i = 0; i < MAX_HOPS; i++) {
    if (chain.includes(current)) break; // loop detection
    chain.push(current);

    let res: Response;
    try {
      res = await fetchPage(current);
    } catch (err: any) {
      // Network error or timeout — record and stop
      const reason = err?.name === 'AbortError' ? 'timeout' : 'network_error';
      return {
        redirectChain: chain,
        finalLandingPage: current,
        httpStatus: null,
        pageStatus: reason,
        forms: [],
        ctaButtons: [],
        asksForLogin: false,
        asksForOtp: false,
        asksForPayment: false,
        asksForAppDownload: false,
        asksToAddChat: false,
      };
    }

    const status = res.status;

    // Follow HTTP redirects (3xx)
    if (status >= 300 && status < 400) {
      const location = res.headers.get('location');
      if (!location) break;
      const next = resolveRedirect(location, current);
      if (!next) break;
      current = next;
      continue;
    }

    // Read body (cap at 200KB to avoid memory issues)
    const html = (await res.text()).slice(0, 200000);

    // Detect bot challenge pages — record but don't parse as real content
    if (isBotChallenge(html, status)) {
      return {
        redirectChain: chain,
        finalLandingPage: current,
        httpStatus: status,
        pageStatus: 'bot_challenge',
        forms: [],
        ctaButtons: [],
        asksForLogin: false,
        asksForOtp: false,
        asksForPayment: false,
        asksForAppDownload: false,
        asksToAddChat: false,
      };
    }

    // 4xx / 5xx — record status and stop
    if (status >= 400) {
      return {
        redirectChain: chain,
        finalLandingPage: current,
        httpStatus: status,
        pageStatus: status === 404 ? 'not_found' : status === 403 ? 'forbidden' : 'server_error',
        forms: [],
        ctaButtons: [],
        asksForLogin: false,
        asksForOtp: false,
        asksForPayment: false,
        asksForAppDownload: false,
        asksToAddChat: false,
      };
    }

    // Follow soft redirects (meta-refresh, JS window.location)
    const softNext = extractSoftRedirect(html, current);
    if (softNext && !chain.includes(softNext)) {
      current = softNext;
      continue;
    }

    // === Arrived at final page — analyse content ===
    const pageTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim();

    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 600);

    // Form field detection — look both in <form> blocks and loose <input> elements
    const formBlocks = [...html.matchAll(/<form[\s\S]*?<\/form>/gi)].map(m => m[0]);
    // Also capture stray inputs outside forms
    const allInputs = html.match(/<input[^>]+>/gi)?.join(' ') ?? '';
    const fullFormContext = formBlocks.join(' ') + ' ' + allInputs;

    const formFields = [
      /type=["']?password/i.test(fullFormContext) && 'password',
      /(otp|one.?time|驗證碼|verification.?code)/i.test(fullFormContext) && 'otp',
      /(credit.?card|cardnumber|cvv|付款|支付|card.?number)/i.test(fullFormContext) && 'payment',
      /(email|帳號|username|login|sign.?in)/i.test(fullFormContext) && 'login',
      /(id.?number|身分證|national.?id|passport)/i.test(fullFormContext) && 'id_document',
      /(phone|mobile|手機|電話)/i.test(fullFormContext) && 'phone',
    ].filter(Boolean);

    const forms = formBlocks.slice(0, 3).map((form) => {
      const fields = [
        /type=["']?password/i.test(form) && 'password',
        /(otp|one.?time|驗證碼)/i.test(form) && 'otp',
        /(credit.?card|cardnumber|cvv|付款|支付)/i.test(form) && 'payment',
        /(email|帳號|username|login)/i.test(form) && 'login',
      ].filter(Boolean);
      return fields.length > 0 ? fields.join(', ') : 'generic form';
    });

    // CTA buttons — deduplicated
    const ctaButtons = [...new Set(
      [...html.matchAll(/<(?:button|a)[^>]*>([\s\S]*?)<\/(?:button|a)>/gi)]
        .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
        .filter(s => s.length > 1 && s.length < 80)
    )].slice(0, 10);

    // Signals — use both HTML and body text for broader coverage
    const haystack = html + ' ' + bodyText;
    const asksForLogin = /(登入|login|sign.?in|password|username|email.*required|帳號)/i.test(haystack)
      && formFields.includes('login' as any);
    const asksForOtp = /(otp|驗證碼|one.?time.?code|verification code)/i.test(haystack);
    const asksForPayment = /(付款|支付|credit.?card|card number|gift.?card|crypto|wallet|bank.?transfer|轉帳|匯款)/i.test(haystack);
    const asksForAppDownload = /(download.?app|下載.*app|install.*app|\.apk|apk.?download)/i.test(haystack);
    const asksToAddChat = /(add line|加入 line|加 line|telegram\.me|t\.me\/|whatsapp\.com|line\.me|客服 line)/i.test(haystack);

    const detectedPattern =
      /(物流|delivery|shipping|包裹|快遞|order.*status|訂單)/i.test(haystack) ? 'fake_logistics_candidate'
      : /(客服|customer.?service|support.*center|服務中心)/i.test(haystack) ? 'fake_customer_service_candidate'
      : /(投資|investment|profit|return|獲利|報酬率|earn.*daily|passive.?income)/i.test(haystack) ? 'fake_investment_candidate'
      : /(補貼|退款|refund.*government|financial.*assistance|申請補助)/i.test(haystack) ? 'fake_government_subsidy_candidate'
      : /(中獎|winner|prize|恭喜.*獲得|you.*won)/i.test(haystack) ? 'prize_scam_candidate'
      : undefined;

    return {
      redirectChain: chain,
      finalLandingPage: current,
      httpStatus: status,
      pageStatus: 'observed',
      pageTitle,
      visibleSummary: bodyText || undefined,
      forms,
      formFields,
      ctaButtons,
      asksForLogin,
      asksForOtp,
      asksForPayment,
      asksForAppDownload,
      asksToAddChat,
      detectedPattern,
    };
  }

  // Exceeded max hops without landing on a final page
  return {
    redirectChain: chain,
    finalLandingPage: current,
    httpStatus: null,
    pageStatus: 'redirect_loop_or_too_many_hops',
    forms: [],
    ctaButtons: [],
    asksForLogin: false,
    asksForOtp: false,
    asksForPayment: false,
    asksForAppDownload: false,
    asksToAddChat: false,
  };
}

async function buildAgentVerification(normalizedInput: any, inputType: string): Promise<any> {
  const targetUrl = normalizedInput.url;
  if (!targetUrl) {
    return {
      status: 'NOT_RUN',
      redirectChain: [],
      forms: [],
      ctaButtons: [],
      asksForLogin: false,
      asksForOtp: false,
      asksForPayment: false,
      asksForAppDownload: false,
      asksToAddChat: false,
      screenshots: [],
      riskObservations: [],
    };
  }

  try {
    const observed = await observeUrl(targetUrl);

    // Map pageStatus to human-readable observation
    const pageStatusObs: Record<string, { label: string; value: string; lane: string }> = {
      not_found:                    { label: '頁面狀態', value: '404 頁面不存在', lane: 'OBSERVED' },
      forbidden:                    { label: '頁面狀態', value: '403 存取被拒絕', lane: 'OBSERVED' },
      server_error:                 { label: '頁面狀態', value: `HTTP ${observed.httpStatus} 伺服器錯誤`, lane: 'OBSERVED' },
      bot_challenge:                { label: '頁面狀態', value: '反爬蟲保護（Cloudflare 等）', lane: 'OBSERVED' },
      timeout:                      { label: '頁面狀態', value: '連線逾時', lane: 'UNVERIFIED' },
      network_error:                { label: '頁面狀態', value: '無法連線', lane: 'UNVERIFIED' },
      redirect_loop_or_too_many_hops: { label: '頁面狀態', value: '重定向過多或迴圈', lane: 'OBSERVED' },
    };

    const riskObservations = [
      observed.pageStatus && observed.pageStatus !== 'observed' && pageStatusObs[observed.pageStatus],
      observed.redirectChain?.length > 1 && {
        label: '重定向跳數',
        value: `${observed.redirectChain.length} 跳（${observed.redirectChain[0]} → ${observed.finalLandingPage}）`,
        lane: 'OBSERVED',
      },
      observed.asksForLogin  && { label: '要求登入', value: '是', lane: 'OBSERVED' },
      observed.asksForOtp    && { label: '要求 OTP', value: '是', lane: 'OBSERVED' },
      observed.asksForPayment && { label: '要求付款', value: '是', lane: 'OBSERVED' },
      observed.asksForAppDownload && { label: '要求下載 App', value: '是', lane: 'OBSERVED' },
      observed.asksToAddChat && { label: '要求外部聊天', value: '是', lane: 'OBSERVED' },
      observed.detectedPattern && { label: '頁型判斷', value: observed.detectedPattern, lane: 'MODEL_INFERENCE' },
    ].filter(Boolean);

    const agentStatus =
      observed.pageStatus === 'observed' ? 'OBSERVED_URL'
      : observed.pageStatus === 'bot_challenge' ? 'BOT_BLOCKED'
      : observed.pageStatus === 'not_found' ? 'NOT_FOUND'
      : 'LIMITED';

    return {
      status: agentStatus,
      originalUrl: targetUrl,
      ...observed,
      screenshots: [],
      riskObservations,
    };
  } catch {
    return {
      status: 'LIMITED',
      originalUrl: targetUrl,
      redirectChain: [targetUrl],
      httpStatus: null,
      pageStatus: 'network_error',
      forms: [],
      ctaButtons: [],
      asksForLogin: false,
      asksForOtp: false,
      asksForPayment: false,
      asksForAppDownload: false,
      asksToAddChat: false,
      screenshots: [],
      riskObservations: [{ label: 'Agent', value: '無法完整觀察頁面', lane: 'UNVERIFIED' }],
    };
  }
}

/**
 * Build a concise plain-text summary of what the agent sandbox observed.
 * This is injected into the LLM prompt so it can write natural language descriptions.
 */
function buildAgentSummaryForPrompt(av: any): string {
  if (!av || av.status === 'NOT_RUN') return '';
  const lines: string[] = ['=== AGENT SANDBOX FINDINGS (what our bot observed when accessing the URL) ==='];
  const statusMap: Record<string, string> = {
    OBSERVED_URL:  'Successfully loaded and observed',
    BOT_BLOCKED:   'Blocked by bot/Cloudflare protection (page refused automated access)',
    NOT_FOUND:     'Page returned HTTP 404 — content does not exist at this URL',
    LIMITED:       'Could not fully load page (timeout or network error)',
  };
  lines.push(`Result: ${statusMap[av.status] ?? av.status}`);
  if (av.httpStatus) lines.push(`HTTP status: ${av.httpStatus}`);
  if (av.redirectChain?.length > 1) {
    lines.push(`Redirect chain (${av.redirectChain.length} hops):`);
    av.redirectChain.forEach((url: string, i: number) => lines.push(`  ${i + 1}. ${url}`));
  }
  if (av.finalLandingPage && av.finalLandingPage !== av.originalUrl) {
    lines.push(`Final landing URL: ${av.finalLandingPage}`);
  }
  if (av.pageTitle) lines.push(`Page title: "${av.pageTitle}"`);
  if (av.visibleSummary) lines.push(`Visible page text (first 600 chars): ${av.visibleSummary}`);
  const flags = [
    av.asksForLogin       && 'LOGIN credentials',
    av.asksForOtp         && 'OTP / verification code',
    av.asksForPayment     && 'PAYMENT / credit card / transfer',
    av.asksForAppDownload && 'APP DOWNLOAD (APK or store link)',
    av.asksToAddChat      && 'external chat (LINE/Telegram/WhatsApp)',
  ].filter(Boolean);
  if (flags.length > 0) lines.push(`Page asks user to provide/do: ${flags.join(', ')}`);
  if (av.ctaButtons?.length > 0) lines.push(`CTA buttons found: ${av.ctaButtons.slice(0, 6).join(' | ')}`);
  if (av.detectedPattern) lines.push(`Detected page type pattern: ${av.detectedPattern}`);
  lines.push('=== END AGENT FINDINGS ===');
  return lines.join('\n');
}

function deriveFinalVerdict(scamProbability: number): 'A_MARKETING' | 'B_RISKY_MARKETING' | 'C_SUSPICIOUS_NEEDS_VERIFICATION' | 'D_HIGH_RISK_SCAM' {
  if (scamProbability >= 75) return 'D_HIGH_RISK_SCAM';
  if (scamProbability >= 45) return 'C_SUSPICIOUS_NEEDS_VERIFICATION';
  if (scamProbability >= 20) return 'B_RISKY_MARKETING';
  return 'A_MARKETING';
}

function deriveConclusion(verdict: string, finalVerdict: string, agentVerification: any, normalizedInput: any, language: string): string {
  if (language !== 'zh-TW') return verdict;
  if (finalVerdict === 'D_HIGH_RISK_SCAM') {
    if (agentVerification.asksForLogin || agentVerification.asksForPayment || agentVerification.asksForOtp) {
      return `這不是一般通知。我替你打開後，它會把你帶去要求${agentVerification.asksForPayment ? '付款' : agentVerification.asksForOtp ? '驗證碼' : '登入'}的頁面，建議先不要繼續。`;
    }
    return '這個內容的風險很高，先不要照著做，改走官方入口或直接回報比較安全。';
  }
  if (finalVerdict === 'C_SUSPICIOUS_NEEDS_VERIFICATION') {
    return '這個內容有幾個不太對勁的地方，我先幫你整理出風險與官方替代入口，建議先不要直接照做。';
  }
  if (finalVerdict === 'B_RISKY_MARKETING') {
    return '這比較像高壓促銷，不一定已能直接判成詐騙，但它在催你快點做決定，先改走正規入口比較穩。';
  }
  if (normalizedInput.url) {
    return '目前看起來比較像一般行銷或正常入口，但你還是應該從官方入口進，而不是直接照貼文或轉傳連結操作。';
  }
  return '目前看起來比較像一般訊息，沒有看到足以直接升高風險的明確證據。';
}

function deriveOfficialRoute(normalizedInput: any, identityStatus: string, trustScore: number, agentVerification: any, language: string): any {
  const zh = language === 'zh-TW';
  if (normalizedInput.url) {
    try {
      const parsed = new URL(normalizedInput.url);
      const hostname = parsed.hostname.replace(/^www\./, '');
      const isTrusted = trustScore >= 80 || identityStatus === 'OFFICIAL_PROJECT';
      return isTrusted ? {
        status: 'OFFICIAL_CONFIRMED',
        label: hostname,
        url: `${parsed.protocol}//${hostname}`,
        rationale: zh ? '目前可直接確認這是高可信的官方入口，可改走這個入口重新操作。' : 'This appears to be the official route.',
        lane: 'CORROBORATED',
      } : trustScore >= 55 ? {
        status: 'OFFICIAL_CANDIDATE',
        label: hostname,
        url: `${parsed.protocol}//${hostname}`,
        rationale: zh ? '目前只能確認它是高可信候選，不建議把它當成最強 CTA 直接相信。' : 'This is a high-confidence candidate.',
        lane: 'MODEL_INFERENCE',
      } : {
        status: 'OFFICIAL_UNKNOWN',
        label: zh ? '暫時無法確認官方入口' : 'Official route unknown',
        rationale: zh ? '目前無法高可信確認官方入口，先不要照這個內容繼續。' : 'Could not confidently confirm an official route.',
        lane: 'UNVERIFIED',
      };
    } catch {}
  }

  if (agentVerification.finalLandingPage && trustScore >= 70) {
    return {
      status: 'OFFICIAL_CANDIDATE',
      label: agentVerification.finalLandingPage,
      url: agentVerification.finalLandingPage,
      rationale: zh ? '這是目前最可能的正規入口候選，但仍建議再核對一次。' : 'Most likely official candidate.',
      lane: 'MODEL_INFERENCE',
    };
  }

  return {
    status: 'OFFICIAL_UNKNOWN',
    label: zh ? '暫時無法確認官方入口' : 'Official route unknown',
    rationale: zh ? '這次查核沒有足夠高可信資料可直接提供官方入口。' : 'Not enough high-confidence data.',
    lane: 'UNVERIFIED',
  };
}

function buildPrimaryActions(officialRoute: any, language: string): any[] {
  const zh = language === 'zh-TW';
  return [
    {
      label: zh ? '改走正確官方入口' : 'Go to the correct official entry',
      actionUrl: officialRoute.url,
      kind: 'OFFICIAL_ROUTE',
      emphasis: officialRoute.status === 'OFFICIAL_UNKNOWN' ? 'disabled' : 'primary',
      description: officialRoute.rationale,
    },
    {
      label: zh ? '立即回報這則可疑內容' : 'Report this suspicious content now',
      actionUrl: 'https://165.npa.gov.tw/#/report/call/02',
      kind: 'REPORT',
      emphasis: 'secondary',
      description: zh ? '帶著這次整理好的證據包，直接向 165 或平台檢舉。' : 'Use the evidence pack when reporting.',
    },
  ];
}

function buildLikelyLosses(scamProbability: number, riskSignals: any[], agentVerification: any, language: string): any[] {
  if (scamProbability < 35) return [];
  const zh = language === 'zh-TW';
  const losses = [
    {
      title: zh ? '金錢損失' : 'Financial loss',
      description: zh ? '如果下一步要求付款、匯款、刷卡或轉幣，這是最直接的風險。' : 'Payment requests create direct financial risk.',
      severity: agentVerification.asksForPayment ? 'HIGH' : 'MEDIUM',
    },
    {
      title: zh ? '帳號被盜' : 'Account takeover',
      description: zh ? '只要頁面要求登入或 OTP，就有帳號被接管的可能。' : 'Login or OTP requests increase account takeover risk.',
      severity: (agentVerification.asksForLogin || agentVerification.asksForOtp) ? 'HIGH' : 'LOW',
    },
    {
      title: zh ? '個資外流' : 'Identity exposure',
      description: zh ? '假客服、假物流與假活動頁常會先蒐集姓名、電話、地址與卡號。' : 'Fake service pages often collect personal data first.',
      severity: riskSignals.some((s: any) => s.type === 'IMPERSONATION' || s.type === 'PHISHING_URL') ? 'HIGH' : 'MEDIUM',
    },
  ];
  return losses;
}

function buildTrustSummary(agentVerification: any, officialRoute: any, riskSignals: any[]): any[] {
  return [
    agentVerification.originalUrl && { label: 'Agent 觀察', value: '已檢查頁面流程', lane: 'OBSERVED' },
    officialRoute.status !== 'OFFICIAL_UNKNOWN' && { label: '官方入口', value: officialRoute.status, lane: officialRoute.lane },
    riskSignals.length > 0 && { label: '風險訊號', value: `${riskSignals.length} 個`, lane: 'MODEL_INFERENCE' },
  ].filter(Boolean);
}

// =============================================================================

export default async function handler(req: any, res: any) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check API key configuration
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error: API Key missing' });
  }

  // === BOT AUTHENTICATION ===
  // Requests with a valid X-Bot-Key header bypass per-IP rate limiting.
  const botApiKey = process.env.BOT_API_KEY;
  const requestBotKey = req.headers['x-bot-key'];
  const isBotRequest = botApiKey && requestBotKey === botApiKey;

  // Per-request degraded-service tracking
  resetBlobHealth();
  const degradedServices: string[] = [];

  try {
    const { input: rawInput, inputType: rawInputType, language: rawLanguage, forceRefresh } = req.body;

    // === INPUT VALIDATION ===
    const inputContent = rawInput;
    if (!inputContent) {
      return res.status(400).json({
        errorCode: 'INVALID_INPUT',
        error: 'Missing input. Please provide a URL, phone number, or message.'
      });
    }

    // Detect input type if not provided
    const detectedType = rawInputType && ALLOWED_INPUT_TYPES.includes(rawInputType)
      ? rawInputType
      : detectInputType(inputContent);

    // Sanitize input based on type
    const sanitizedInput = sanitizeInput(inputContent, detectedType);
    if (!sanitizedInput) {
      return res.status(400).json({
        errorCode: 'INVALID_INPUT',
        error: detectedType === 'URL'
          ? 'Invalid URL format. Please provide a valid URL.'
          : detectedType === 'PHONE'
          ? 'Invalid phone number. Use E.164 format (e.g. +886912345678) or Taiwan local format (0912345678).'
          : 'Invalid input. Text must be between 1 and 2000 characters.'
      });
    }

    // Validate language
    const language = ALLOWED_LANGUAGES.includes(rawLanguage) ? rawLanguage : 'en';

    // === EXAMPLE SHORT-CIRCUIT ===
    // Demo chips in SearchInput populate known sample inputs. Serve pre-baked
    // responses for those so clicks burn zero upstream quota (Gemini, Safe
    // Browsing, VirusTotal, agent-sandbox) and so the scam content stays out
    // of the frontend bundle that crawlers can index.
    if (isExampleInput(sanitizedInput, detectedType as any)) {
      const exampleRes = getExampleResponse(sanitizedInput, detectedType as any, language);
      if (exampleRes) {
        return res.status(200).json(exampleRes);
      }
    }

    // === SELF / KNOWN-SAFE SHORT-CIRCUIT ===
    // Prevent the analyzer from flagging its own site (or other known-safe
    // domains) as a scam due to false-positive keyword matches in educational
    // copy ("付款", "投資", "LINE") and a very new domain age.
    if (detectedType === 'URL' && isKnownSafeUrl(sanitizedInput)) {
      const safeRes = getSafeResponse(sanitizedInput, language);
      if (safeRes) {
        return res.status(200).json(safeRes);
      }
    }

    // Generate cache key
    const cacheKey = generateCacheKey(sanitizedInput, detectedType);

    // === CACHE CHECK (no rate limit for cache hits) ===
    if (!forceRefresh) {
      const cached = await getCachedAnalysis(cacheKey, language);
      if (cached) {
        // Normalize old cached data to new schema (backward compatibility)
        const normalizedCache = {
          ...cached.data,
          // Ensure new required fields exist with defaults
          credibilityStrengths: cached.data.credibilityStrengths || [],
          riskFactors: cached.data.riskFactors || [],
          riskSignals: cached.data.riskSignals || [],
          suggestedActions: cached.data.suggestedActions || [],
          inputType: cached.data.inputType || detectedType,
          originalInput: cached.data.originalInput || sanitizedInput,
          scamProbability: cached.data.scamProbability ?? (cached.data.trustScore != null ? (100 - cached.data.trustScore) : 50),
          normalizedInput: cached.data.normalizedInput || normalizeInput(sanitizedInput, detectedType),
          finalVerdict: cached.data.finalVerdict || deriveFinalVerdict(cached.data.scamProbability ?? (100 - (cached.data.trustScore ?? 50))),
          conclusion: cached.data.conclusion || cached.data.verdict || sanitizedInput,
          agentVerification: cached.data.agentVerification || {
            status: 'NOT_RUN',
            redirectChain: [],
            forms: [],
            ctaButtons: [],
            asksForLogin: false,
            asksForOtp: false,
            asksForPayment: false,
            asksForAppDownload: false,
            asksToAddChat: false,
            screenshots: [],
            riskObservations: [],
          },
          officialRoute: cached.data.officialRoute || {
            status: 'OFFICIAL_UNKNOWN',
            label: '',
            rationale: '',
            lane: 'UNVERIFIED',
          },
          primaryActions: cached.data.primaryActions || [],
          likelyLosses: cached.data.likelyLosses || [],
          trustSummary: cached.data.trustSummary || [],
        };
        // Remove deprecated fields from old cache
        delete normalizedCache.totalWins;
        delete normalizedCache.totalLosses;
        delete normalizedCache.sources;

        // If Blob was degraded even on cache read, report it; otherwise L0.
        const cacheDegraded: string[] = isBlobDegraded() ? ['Vercel Blob'] : [];
        return res.status(200).json({
          ...normalizedCache,
          handle: normalizedCache.handle || '',
          source: 'cache',
          cachedAt: cached.cachedAt,
          degradation: computeDegradation(cacheDegraded)
        });
      }
    }

    // === RATE LIMITING (only for API calls, not cache hits; skipped for authenticated bots) ===
    if (!isBotRequest) {
      const clientIP = getClientIP(req);
      const rateLimit = await checkRateLimit(clientIP);

      res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
      res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

      if (!rateLimit.allowed) {
        return res.status(429).json({
          errorCode: 'LOCAL_RATE_LIMIT',
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000 / 60) + ' minutes'
        });
      }
    }

    const normalizedInput = normalizeInput(sanitizedInput, detectedType);

    // === GATHER OBJECTIVE FACTS (parallel, before AI call) ===
    let factsSection = '';
    const factsPromise = (async () => {
      if (detectedType === 'URL') return buildURLFactsSection(sanitizedInput, degradedServices);
      if (detectedType === 'PHONE') return buildPhoneFactsSection(sanitizedInput);
      if (detectedType === 'SMS_TEXT') return buildSMSFactsSection(sanitizedInput, degradedServices);
      return '';
    })();

    // Query Cofacts for SMS_TEXT (most relevant) and URL types
    const cofactsPromise = (detectedType === 'SMS_TEXT' || detectedType === 'URL')
      ? queryCofacts(sanitizedInput, degradedServices)
      : Promise.resolve({ status: 'NOT_FOUND' as const, totalMatches: 0, articles: [] });

    const agentPromise = buildAgentVerification(normalizedInput, detectedType);

    // Run all pre-checks in parallel
    const [factsResult, cofactsResult, agentVerification] = await Promise.all([
      factsPromise,
      cofactsPromise,
      agentPromise,
    ]);
    factsSection = factsResult;

    // Append Cofacts section to facts
    const cofactsSection = buildCofactsFactsSection(cofactsResult);
    if (cofactsSection) {
      factsSection = factsSection + '\n' + cofactsSection;
    }

    // === CALL GEMINI API ===
    const ai = new GoogleGenAI({ apiKey });

    // Build prompt based on input type
    const buildPrompt = () => {
      const langInstruction = language === 'zh-TW'
        ? 'Traditional Chinese (繁體中文). You MUST write ALL output text fields — including "d", "b", "v", "cn", "ag", "c" array items, "r" array items, "rs[].e" evidence strings, and "h[].x" detail strings — entirely in Traditional Chinese (繁體中文). Do not use English in any text field.'
        : language === 'vi'
        ? 'Vietnamese (Tiếng Việt). Write ALL output text fields in Vietnamese.'
        : 'English. Write all output text fields in English.';

      const agentSection = buildAgentSummaryForPrompt(agentVerification);
      const agFieldInstruction = agentSection
        ? `
${agentSection}

AGENT NARRATIVE FIELD ("ag"):
Write 2-3 sentences describing what the agent observed, in plain conversational language addressed directly to the user.
${language === 'zh-TW'
  ? '用「我替你點開了這個連結」作為開頭（或類似的自然句子）。說明頁面把用戶帶到了哪裡、頁面上要求用戶做什麼。如果頁面 404，解釋這可能代表詐騙內容已被檢舉下架或連結本身是假的。如果被 bot 保護攔截，說明這對於正規網站來說是不尋常的。用一般人能理解的語言，不要用技術術語。'
  : language === 'vi'
  ? 'Bắt đầu bằng "Tôi đã mở liên kết này cho bạn..." hoặc tương tự. Mô tả trang đã dẫn người dùng đến đâu và yêu cầu gì. Nếu trang 404, giải thích ý nghĩa. Viết bằng ngôn ngữ bình thường, không dùng thuật ngữ kỹ thuật.'
  : 'Start with "I opened this link for you..." or similar. Describe where the page took the user and what it asked them to do. If the page was 404, explain that this may mean the scam content was taken down or the link was fake. If blocked by bot protection, note that this is unusual for legitimate sites. Write in plain everyday language, no technical jargon.'}
`
        : '';

      const cnFieldInstruction = `
CONCLUSION FIELD ("cn"):
Write 2-3 sentences that serve as the main verdict shown to the user. Incorporate both search findings AND agent observations. Be direct and specific — tell the user exactly what this is and what they should do. Avoid vague hedging. Use the same natural tone as the agent narrative.
`;

      // Common scam detection instructions
      const scamDetectionInstructions = `
SCAM SIGNAL CRITERIA — only flag if directly evidenced:
- 保證獲利/Guaranteed returns: Explicit promises of fixed high returns (e.g., "guaranteed 30% monthly")
- 壓力催促/Pressure tactics: Explicit urgency coercion (e.g., "act NOW or lose forever")
- 冒充官方/Impersonation: Confirmed fake account mimicking a real entity with evidence
- 不明入金/Suspicious payments: Explicit requests for crypto/gift-card payments
- 假冒名人/Celebrity impersonation: Confirmed use of a celebrity's identity fraudulently
- 龐氏特徵/Ponzi signs: Explicit referral-bonus or pyramid recruitment language
- 釣魚連結/Phishing: Domain confirmed on blocklist or is a clear typosquat

IMPORTANT — CALIBRATION RULES:
- Absence of information is NOT a risk signal. Default to LOW risk if nothing suspicious is found.
- Only add an entry to "rs" if you have direct, specific evidence — not general warnings.
- A normal business, legitimate influencer, or ordinary message should score scamProbability 0-25.
- Reserve scamProbability 70+ for cases with multiple concrete red flags confirmed by search results.
- If search results show nothing concerning, set scamProbability ≤ 20 and trustScore ≥ 75.
`;

      if (detectedType === 'URL') {
        return `
TASK: URL Safety Check — objective research, report what you find.
ANALYSIS TARGET: URL "${sanitizedInput}"
LANGUAGE: ${langInstruction}

INSTRUCTIONS:
1. Use Google Search to research this URL/domain's reputation.
2. Search for: "${new URL(sanitizedInput).hostname} scam", "${new URL(sanitizedInput).hostname} phishing", "${new URL(sanitizedInput).hostname} 詐騙", "site:165.npa.gov.tw ${new URL(sanitizedInput).hostname}".
3. Check if this domain is on blocklists, reported as phishing, or associated with scams.
4. Analyze the URL structure for typosquatting or misleading subdomains.
5. Well-known, established domains (e.g., major banks, exchanges, government sites) should score high trust by default.
${scamDetectionInstructions}

CRITICAL RULE FOR RISK SIGNALS:
- Only add a risk signal ("rs") if there is DIRECT evidence that THIS SPECIFIC URL/domain is dangerous.
- Do NOT add risk signals for generic warnings like "scammers may impersonate this brand" — those are not evidence against this URL.
- A risk signal must be something specific about this exact domain (blocklist hit, 165 report, confirmed typosquat).
- If the domain is clearly legitimate and well-established, "rs" MUST be an empty array [].

${factsSection}

SCORING:
- trustScore: 0(Dangerous)-100(Safe). <20: Confirmed Scam Site. 20-40: High Risk. 40-60: Suspicious/Unverified. 60-80: Probably Safe. >80: Established & Trusted.
- scamProbability: Only elevate above 40 if concrete negative evidence exists. A well-known domain with no reports = scamProbability 0-15.
- If PRE-CHECKS above show "Google Safe Browsing: ✅ CLEAN" and domain age > 365 days, scamProbability MUST be ≤ 20 unless search reveals specific reports.
- If PRE-CHECKS show Google Safe Browsing "🚨 THREAT", scamProbability MUST be ≥ 85.
- If PRE-CHECKS show ScamSniffer "🚨 BLOCKED", scamProbability MUST be ≥ 90 — this is a confirmed crypto phishing domain.
- If PRE-CHECKS show VirusTotal "🚨 MALICIOUS" (5+ engines), scamProbability MUST be ≥ 90.
- If PRE-CHECKS show VirusTotal "⚠️ SUSPICIOUS", scamProbability MUST be ≥ 60.
- If PRE-CHECKS show VirusTotal "✅ CLEAN" with 0 detections across many engines, this is strong evidence of safety — weight accordingly.

${agFieldInstruction}
${cnFieldInstruction}

OUTPUT JSON ONLY:
{
  "d": "Website/Service Name",
  "b": "What this URL appears to be (max 15 words)",
  "s": 0-3 (0=Unknown, 1=Legitimate Service, 2=Impersonator/Phishing, 3=Official),
  "ts": Trust Score (0-100),
  "sp": Scam Probability (0-100),
  "v": "One sentence verdict about this URL's safety",
  "cn": "2-3 sentence conclusion incorporating search findings and agent observations",
  "ag": "2-3 sentence plain language description of what the agent observed (empty string if agent did not run)",
  "eq": 0-3 (0=Legitimate, 1=Questionable, 2=Suspicious, 3=Malicious),
  "c": ["Reasons this might be legitimate"],
  "r": ["Warning signs and risks"],
  "rs": [{"t": "Signal Type (e.g., PHISHING_URL, TYPOSQUATTING, KNOWN_SCAM)", "e": "Direct evidence about this specific URL", "l": 0-2}],
  "h": [{"dt": "YYYY-MM-DD", "e": "Report/Incident", "t": 0-5, "tk": null, "s": 0-2, "x": "Details"}]
}
`;
      } else if (detectedType === 'PHONE') {
        return `
TASK: Phone Number Reputation Check — objective research, report what you find.
ANALYSIS TARGET: Phone Number "${sanitizedInput}"
LANGUAGE: ${langInstruction}

INSTRUCTIONS:
1. Use Google Search to research this phone number's reputation.
2. Search for: "${sanitizedInput} 詐騙", "${sanitizedInput} scam", "${sanitizedInput} spam", "165 ${sanitizedInput}", "${sanitizedInput} 評價".
3. Check if this number has been reported to Taiwan's 165 anti-fraud hotline or crowd-sourced scam databases.
4. If no reports are found, the number should be treated as unverified but NOT automatically high-risk.
${scamDetectionInstructions}

PHONE SCAM TYPES — only flag if specifically reported for this number:
- 假冒機構/Institution Impersonation: Confirmed reports of pretending to be police, banks, government
- 假投資/Investment Scam: Confirmed reports of high-return promises
- 一鍵詐騙/One-click fraud: Confirmed reports of prize/debt/package fraud calls
- 假交友/Romance Scam: Confirmed reports of building trust then requesting money

${factsSection}

SCORING:
- trustScore: 0(Confirmed Scam)-100(Legitimate). <20: Confirmed Scam Number. 20-40: High Risk. 40-60: Unverified/Unknown. 60-80: No reports found. >80: Verified Legitimate.
- scamProbability: Only elevate if reports exist. No reports found = scamProbability 10-30, not 50+.

${cnFieldInstruction}

OUTPUT JSON ONLY:
{
  "d": "Caller/Organization Name (if identifiable, else 'Unknown')",
  "b": "Brief description of this number (max 15 words)",
  "s": 0-3 (0=Unknown, 1=Legitimate Business, 2=Scammer, 3=Verified Organization),
  "ts": Trust Score (0-100),
  "sp": Scam Probability (0-100),
  "v": "One sentence verdict about this phone number",
  "cn": "2-3 sentence conclusion about this phone number, incorporating all search findings",
  "ag": "",
  "eq": 0-3 (0=Legitimate, 1=Questionable, 2=Suspicious, 3=Known Scam),
  "c": ["Reasons this might be legitimate"],
  "r": ["Warning signs and risk factors"],
  "rs": [{"t": "Signal Type (e.g., IMPERSONATION, SPAM_CALL, KNOWN_SCAM_NUMBER, PRESSURE_TACTICS)", "e": "Direct evidence", "l": 0-2 (0=CRITICAL, 1=WARNING, 2=INFO)}],
  "h": [{"dt": "YYYY-MM-DD", "e": "Report Title", "t": 0-5, "tk": null, "s": 0-2, "x": "Details"}]
}
`;
      } else {
        // SMS_TEXT
        return `
TASK: Message Safety Check — read carefully, report what is actually present.
ANALYSIS TARGET: Message Content:
"""
${sanitizedInput}
"""
LANGUAGE: ${langInstruction}

INSTRUCTIONS:
1. Read the message carefully. Only flag patterns that are ACTUALLY PRESENT in this exact message.
2. If it contains URLs or phone numbers, research them via Google Search.
3. Do NOT flag a message as scam just because the topic involves money, crypto, or investment — context matters.
4. Normal messages (receipts, OTP codes, appointment reminders, friend chats) should score scamProbability < 20.
${scamDetectionInstructions}

SPECIFIC SCAM PATTERNS — only flag if the EXACT pattern appears in this message:
- 假投資/Fake Investment: Explicit phrases like "老師帶單", "穩賺不賠", "保證獲利", "內線消息" must be present
- 假交友/Romance Scam: Unsolicited intimacy combined with financial request
- 假冒機構/Impersonation: Claims to be a bank/government but uses unofficial contact
- 中獎詐騙/Prize Scam: Claiming unexpected prize AND requiring fee/personal info to claim

${factsSection}

SCORING:
- trustScore: 0(Scam)-100(Legitimate). <20: Confirmed Scam. 20-40: High Risk. 40-60: Suspicious. 60-80: Probably Fine. >80: Normal Message.
- scamProbability: Must be grounded in what is literally written. Ambiguous or neutral messages = 10-30. Only 70+ if multiple explicit scam signals are present.

${agFieldInstruction}
${cnFieldInstruction}

OUTPUT JSON ONLY:
{
  "d": "Sender/Source (if identifiable)",
  "b": "Message type summary (max 15 words)",
  "s": 0-3 (0=Unknown Source, 1=Likely Legitimate, 2=Likely Scammer, 3=Verified Source),
  "ts": Trust Score (0-100),
  "sp": Scam Probability (0-100),
  "v": "One sentence verdict - is this message safe?",
  "cn": "2-3 sentence conclusion incorporating message analysis and any agent URL observations",
  "ag": "2-3 sentence plain language agent observation narrative (empty string if no URL was checked)",
  "eq": 0-3 (0=Normal, 1=Questionable, 2=Suspicious, 3=Scam Pattern),
  "c": ["Reasons this might be legitimate"],
  "r": ["Warning signs found in message"],
  "rs": [{"t": "Signal Type (e.g., GUARANTEED_RETURNS, PRESSURE_TACTICS, IMPERSONATION)", "e": "Exact quote or evidence from message", "l": 0-2}],
  "h": []
}
`;
      }
    };

    const prompt = buildPrompt();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    const minData = JSON.parse(extractJSON(text) || "{}");

    // Extract Grounding Metadata (Citations/Sources)
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .map((chunk: any) => chunk.web ? { title: chunk.web.title, url: chunk.web.uri } : null)
      .filter((s: any) => s !== null);

    // Extract search queries used for grounding (if available)
    const searchQueries = groundingMetadata?.webSearchQueries || [];

    // === INFLATE MINIFIED DATA TO FULL SCHEMA ===
    // Convert minified API response back to full UI-compatible format

    // Calculate scam probability (use sp from response or derive from trustScore)
    const scamProbability = minData.sp ?? (100 - (minData.ts ?? 50));

    // Parse risk signals
    const riskSignals = (minData.rs || []).map((signal: any) => ({
      type: signal.t || 'UNKNOWN',
      evidence: signal.e || '',
      level: RISK_LEVEL_MAP[signal.l] || 'INFO'
    }));

    // Generate actions based on scam probability
    const suggestedActions = generateActions(scamProbability, riskSignals, language);

    const fullData: any = {
      // Legacy handle field for backward compatibility
      handle: '',
      displayName: minData.d || sanitizedInput,
      bioSummary: minData.b || "No bio available",
      identityStatus: IDENTITY_MAP[minData.s] || "UNKNOWN_ENTITY",
      trustScore: minData.ts ?? 50,
      verdict: minData.v || "Insufficient data",
      agentNarrativeDescription: minData.ag || '',
      engagementQuality: ENGAGEMENT_MAP[minData.eq] || "MIXED",
      credibilityStrengths: minData.c || [],
      riskFactors: minData.r || [],
      history: (minData.h || []).map((item: any, index: number) => ({
        id: `evt-${index}`,
        date: item.dt,
        description: item.e,
        type: HISTORY_TYPE_MAP[item.t] || "NEUTRAL_NEWS",
        token: item.tk || undefined,
        sentiment: SENTIMENT_MAP[item.s] || "NEUTRAL",
        details: item.x,
        sourceUrl: undefined
      })),

      // === TruthGuard AI New Fields ===
      inputType: detectedType,
      originalInput: sanitizedInput,
      normalizedInput,
      scamProbability,
      riskSignals,
      suggestedActions,
      seniorModeVerdict: generateSeniorVerdict(scamProbability, language),
      agentVerification,

      // Cofacts community fact-check results
      cofactsResult: cofactsResult.status === 'FOUND' ? cofactsResult : undefined,

      // UI flow compatibility fields
      searchQueries: searchQueries.length > 0 ? searchQueries : undefined,
      groundedSearch: (groundingChunks?.length || 0) > 0,
      lastAnalyzed: new Date().toISOString(),
      followersCount: undefined // Explicitly undefined to respect types
    };

    fullData.finalVerdict = deriveFinalVerdict(fullData.scamProbability);
    fullData.officialRoute = deriveOfficialRoute(normalizedInput, fullData.identityStatus, fullData.trustScore, agentVerification, language);
    fullData.primaryActions = buildPrimaryActions(fullData.officialRoute, language);
    fullData.likelyLosses = buildLikelyLosses(fullData.scamProbability, fullData.riskSignals, agentVerification, language);
    fullData.trustSummary = buildTrustSummary(agentVerification, fullData.officialRoute, fullData.riskSignals);
    // Prefer LLM-written conclusion (cn) over the hardcoded template
    fullData.conclusion = (minData.cn && minData.cn.trim())
      ? minData.cn.trim()
      : deriveConclusion(fullData.verdict, fullData.finalVerdict, agentVerification, normalizedInput, language);

    // === HIGH-TRUST SIGNAL FILTER (URL only) ===
    // For well-established URLs (trustScore > 80), suppress generic risk factors and
    // WARNING/INFO risk signals that are not direct evidence against this URL
    // (e.g. "scammers may impersonate this brand" on google.com).
    if (detectedType === 'URL' && fullData.trustScore > 80) {
      fullData.riskSignals = fullData.riskSignals.filter((s: any) => s.level === 'CRITICAL');
      fullData.riskFactors = fullData.riskFactors.filter((r: string) => {
        const lower = r.toLowerCase();
        // Remove generic impersonation warnings that aren't about this specific URL
        return !lower.includes('scammer') && !lower.includes('phishing email') &&
               !lower.includes('may try') && !lower.includes('may impersonate') &&
               !lower.includes('be wary') && !lower.includes('be cautious');
      });
    }

    // === LOW VISIBILITY PENALTY LOGIC ===
    // If identity status is UNKNOWN_ENTITY (s=0), cap trust score and add risk factor
    if (minData.s === 0) {
      fullData.trustScore = Math.min(fullData.trustScore, 40);
      if (fullData.riskFactors.length === 0) {
        fullData.riskFactors.push(
          language === 'zh-TW' ? "缺乏公眾記錄" : "Low public visibility"
        );
      }
    }

    // === LOW-EVIDENCE FALLBACK NORMALIZATION ===
    // If Gemini returned minimal data and there are no grounded sources,
    // force a standard "insufficient information" response for predictability.
    if (
      sources.length === 0 &&
      (!Array.isArray(fullData.history) || fullData.history.length === 0)
    ) {
      fullData.trustScore = 50;
      fullData.scamProbability = 50;
      fullData.credibilityStrengths = [];
      fullData.riskFactors = [
        language === 'zh-TW'
          ? '缺乏足夠公開資訊進行完整評估'
          : 'Insufficient public information for complete assessment'
      ];

      // Add a generic risk signal for low evidence
      fullData.riskSignals = [{
        type: 'INSUFFICIENT_DATA',
        evidence: language === 'zh-TW'
          ? '無法找到足夠的公開資訊來驗證此內容'
          : 'Unable to find sufficient public information to verify this content',
        level: 'WARNING'
      }];

      // Update suggested actions for uncertain case
      fullData.suggestedActions = generateActions(50, fullData.riskSignals, language);
      fullData.seniorModeVerdict = generateSeniorVerdict(50, language);

      const displayIdentifier = fullData.displayName || sanitizedInput;

      // If model didn't give a meaningful bio, provide a safe default
      if (!fullData.bioSummary || !fullData.bioSummary.trim() || fullData.bioSummary === "No bio available") {
        fullData.bioSummary =
          language === 'zh-TW'
            ? `目前缺乏足夠的公開資訊，無法為 ${displayIdentifier} 建立詳細的介紹。`
            : `There is currently not enough public information to build a detailed profile for ${displayIdentifier}.`;
      }

      fullData.verdict =
        language === 'zh-TW'
          ? '需要更多公開資訊才能進行風險評估。'
          : 'Needs more public information before a fair risk assessment is possible.';
      fullData.finalVerdict = 'C_SUSPICIOUS_NEEDS_VERIFICATION';
      fullData.conclusion =
        language === 'zh-TW'
          ? '我先替你記下來了，但目前公開資訊不足，還不能把它當成安全內容或官方入口。'
          : 'Saved for review, but there is not enough public information yet to call this safe or official.';

      fullData.history = [
        {
          id: 'insufficient-data',
          date: 'Recent',
          description:
            language === 'zh-TW'
              ? `缺乏足夠的公開證據評估 ${displayIdentifier}`
              : `Insufficient public evidence to evaluate ${displayIdentifier}`,
          type: 'NEUTRAL_NEWS',
          token: undefined,
          sentiment: 'NEUTRAL',
          details:
            language === 'zh-TW'
              ? '在主要風險來源中，尚未找到明確關聯的正面或負面報導。建議保持警覺，如有疑慮可撥打 165 諮詢。'
              : 'No strong positive or negative evidence was found in major risk sources. Stay vigilant and call 165 if you have concerns.',
          sourceUrl: undefined,
        },
      ];
    }

    // Apply PII masking before caching and returning (PDF security requirement)
    if (detectedType === 'SMS_TEXT') {
      fullData.bioSummary = maskPII(fullData.bioSummary);
      fullData.verdict = maskPII(fullData.verdict);
      fullData.seniorModeVerdict = maskPII(fullData.seniorModeVerdict);
      fullData.riskSignals = fullData.riskSignals.map((s: any) => ({ ...s, evidence: maskPII(s.evidence) }));
    }

    // Save to cache (async, don't wait)
    setCachedAnalysis(cacheKey, language, fullData);

    // === ML DATA COLLECTION (fire-and-forget, never blocks response) ===
    // Skip: bot requests (bypass rate limit), force refresh (duplicate records), oversized input
    const shouldCollectML = !isBotRequest && !forceRefresh && inputContent.length <= 10000;
    if (!shouldCollectML) {
      if (isBlobDegraded()) degradedServices.push('Vercel Blob');
      return res.status(200).json({
        ...fullData,
        degradation: computeDegradation(degradedServices)
      });
    }

    const submissionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const submissionTs = new Date().toISOString();

    // 1. Save full ML record to Vercel Blob (raw input + complete analysis)
    const mlRecord = {
      id: submissionId,
      timestamp: submissionTs,
      language,
      inputType: detectedType,
      raw: { input: inputContent, sanitized: sanitizedInput },
      analysis: {
        trustScore: fullData.trustScore,
        scamProbability: fullData.scamProbability,
        verdict: fullData.verdict,
        identityStatus: fullData.identityStatus,
        riskSignals: fullData.riskSignals,
        credibilityStrengths: fullData.credibilityStrengths,
        riskFactors: fullData.riskFactors,
        suggestedActions: fullData.suggestedActions,
        groundedSearch: fullData.groundedSearch,
      },
    };
    const blobPath = `ml-data/${submissionTs.slice(0, 7)}/${submissionId}.json`;
    put(blobPath, JSON.stringify(mlRecord), { access: 'public', addRandomSuffix: false })
      .catch(() => { /* silently ignore */ });

    // 2. Log flat summary to Google Sheets for human review & labeling
    // Google Apps Script redirects POST → must follow redirect manually (302 converts POST→GET otherwise)
    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    if (webhookUrl && inputContent.length <= 500) {
      const sheetsPayload = JSON.stringify({
        id: submissionId,
        timestamp: submissionTs,
        language,
        inputType: detectedType,
        input: inputContent,
        sanitizedInput,
        scamProbability: fullData.scamProbability,
        trustScore: fullData.trustScore,
        verdict: fullData.verdict,
        riskSignals: fullData.riskSignals,
      });
      void logToGoogleSheets(webhookUrl, sheetsPayload);
    }

    if (isBlobDegraded()) degradedServices.push('Vercel Blob');
    return res.status(200).json({
      ...fullData,
      source: 'api',
      degradation: computeDegradation(degradedServices)
    });

  } catch (error: any) {
    console.error('API Error:', error?.message, error?.stack);

    // The thrown error is from the critical path (Gemini or unexpected).
    // Side-services already caught their own failures into `degradedServices`.
    const classified = classifyError(error);

    // If Gemini is down, compute severity including side-service state —
    // this determines L4 (AI only) vs L5 (AI + multiple sources down).
    const isLLMFailure = classified.errorCode === 'LLM_QUOTA' || classified.errorCode === 'LLM_FAILED';
    const allFailed = [...degradedServices, 'Gemini'];
    const degradation = isLLMFailure ? computeDegradation(allFailed, true) : undefined;

    return res.status(classified.status).json({
      errorCode: classified.errorCode,
      error: classified.message,
      degradation,
      retryAfter: classified.errorCode === 'LLM_QUOTA' ? '1 hour' : undefined,
      groundedSearch: false,
    });
  }
}
