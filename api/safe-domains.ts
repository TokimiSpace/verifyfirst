// Self + known-safe-domain short-circuit.
//
// Why: keyword-based detectors in the pipeline (agent sandbox, risk-signal
// regex, VirusTotal false-positives) can flag legitimate sites that discuss
// scam terminology for educational purposes. Most critically, verify1st.tw
// itself contains words like "付款", "投資", "LINE" in its copy — and so the
// analyzer classifies its own site as high-risk.
//
// This module hard-codes a minimal allowlist of known-safe domains and
// returns a canned verified response for them, bypassing Gemini + side
// services entirely.

import type { Language } from '../types';

const SAFE_DOMAINS: Array<{
  domain: string;
  aliases?: string[];
  label: Record<Language, string>;
  description: Record<Language, string>;
}> = [
  {
    domain: 'verify1st.tw',
    aliases: ['www.verify1st.tw'],
    label: {
      en: 'VerifyFirst AI — Official Site',
      'zh-TW': 'VerifyFirst AI — 官方網站',
      vi: 'VerifyFirst AI — Trang chính thức',
    },
    description: {
      en: 'This is the official VerifyFirst AI site — the very tool you are using to check suspicious content. It is safe to use.',
      'zh-TW': '這是 VerifyFirst AI 的官方網站 — 也就是您正在使用的安全驗證工具本身,可以安心使用。',
      vi: 'Đây là trang chính thức của VerifyFirst AI — chính là công cụ bạn đang dùng để kiểm tra nội dung đáng ngờ. An toàn để sử dụng.',
    },
  },
  {
    domain: 'tokimi.space',
    aliases: ['www.tokimi.space'],
    label: {
      en: 'tokimi.space — Creator Site',
      'zh-TW': 'tokimi.space — 開發者網站',
      vi: 'tokimi.space — Trang của nhà phát triển',
    },
    description: {
      en: 'The personal site of tokimi, the creator of VerifyFirst AI.',
      'zh-TW': 'VerifyFirst AI 開發者 tokimi 的個人網站。',
      vi: 'Trang cá nhân của tokimi, người tạo ra VerifyFirst AI.',
    },
  },
];

const DOMAIN_MAP: Map<string, typeof SAFE_DOMAINS[number]> = new Map();
for (const entry of SAFE_DOMAINS) {
  DOMAIN_MAP.set(entry.domain.toLowerCase(), entry);
  for (const alias of entry.aliases ?? []) {
    DOMAIN_MAP.set(alias.toLowerCase(), entry);
  }
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// Resolve the hostname from either a full URL (https://verify1st.tw/...) or a
// bare domain string pasted without a protocol (verify1st.tw). Anything with
// whitespace or non-domain characters returns null.
function resolveHost(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const direct = hostnameOf(trimmed);
  if (direct) return direct;
  // Only retry if the input looks like a single token that could be a bare domain.
  if (/\s/.test(trimmed)) return null;
  return hostnameOf(`https://${trimmed}`);
}

function matchAllowlist(host: string): typeof SAFE_DOMAINS[number] | undefined {
  if (DOMAIN_MAP.has(host)) return DOMAIN_MAP.get(host);
  const parts = host.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const suffix = parts.slice(i).join('.');
    if (DOMAIN_MAP.has(suffix)) return DOMAIN_MAP.get(suffix);
  }
  return undefined;
}

export function isKnownSafeUrl(url: string): boolean {
  const host = resolveHost(url);
  if (!host) return false;
  return !!matchAllowlist(host);
}

export function getSafeResponse(url: string, language: string): any | null {
  const host = resolveHost(url);
  if (!host) return null;
  const entry = matchAllowlist(host);
  if (!entry) return null;

  // Normalize to a canonical URL for display so bare-domain and with-protocol
  // inputs produce identical output.
  const canonicalUrl = url.startsWith('http://') || url.startsWith('https://')
    ? url
    : `https://${host}`;

  const lang = (['en', 'zh-TW', 'vi'] as const).includes(language as Language)
    ? (language as Language)
    : 'en';

  return {
    handle: '',
    displayName: entry.label[lang],
    bioSummary: entry.description[lang],
    identityStatus: 'OFFICIAL_PROJECT',
    trustScore: 98,
    verdict: entry.description[lang],
    engagementQuality: 'ORGANIC',
    credibilityStrengths: [
      lang === 'zh-TW' ? '已驗證的官方網站' : lang === 'vi' ? 'Trang chính thức đã xác minh' : 'Verified official site',
    ],
    riskFactors: [],
    history: [],
    inputType: 'URL',
    originalInput: url,
    normalizedInput: { url: canonicalUrl, domain: host.replace(/^www\./, '') },
    scamProbability: 2,
    riskSignals: [],
    suggestedActions: [{
      label: lang === 'zh-TW' ? '✅ 可以安心使用' : lang === 'vi' ? '✅ An toàn để sử dụng' : '✅ Safe to Use',
      type: 'VERIFY',
      priority: 1,
    }],
    seniorModeVerdict: lang === 'zh-TW'
      ? '✅ 這是官方認證的網站,可以安心使用。'
      : lang === 'vi'
      ? '✅ Đây là trang chính thức đã xác minh, an toàn để sử dụng.'
      : '✅ This is a verified official site. Safe to use.',
    agentVerification: {
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
    officialRoute: {
      status: 'OFFICIAL_CONFIRMED',
      label: entry.domain,
      url: `https://${entry.domain}`,
      rationale: entry.description[lang],
      lane: 'CORROBORATED',
    },
    primaryActions: [],
    likelyLosses: [],
    trustSummary: [{
      label: lang === 'zh-TW' ? '官方入口' : lang === 'vi' ? 'Kênh chính thức' : 'Official site',
      value: 'OFFICIAL_CONFIRMED',
      lane: 'CORROBORATED',
    }],
    groundedSearch: false,
    finalVerdict: 'A_MARKETING',
    conclusion: entry.description[lang],
    lastAnalyzed: new Date().toISOString(),
    source: 'verified_safe',
    degradation: { level: 'L0', score: 0, services: [] },
  };
}
