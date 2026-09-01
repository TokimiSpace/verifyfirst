import type { IffX402Preflight } from '../types.js';
import { verifyX402Requirement } from '../services/iffX402.js';
import {
  evaluateX402Policy,
  parseX402Requirement,
  X402PolicyValidationError,
  type X402IffState,
  type X402PolicyEvaluation,
  type X402SandboxPolicy,
} from '../services/x402Policy.js';

const MAX_PAYLOAD_BYTES = 96 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const MAX_RATE_LIMIT_ENTRIES = 5_000;
let rateLimitSalt: Uint8Array | null = null;
const rateLimits = new Map<string, { windowStart: number; count: number }>();
export const X402_RESPONSE_SCHEMA = 'verifyfirst.x402-preflight-response.v1' as const;
export const X402_EVIDENCE_SCHEMA = 'verifyfirst.x402-preflight.v1' as const;
export const X402_POLICY_VERSION = 'verifyfirst.x402-enterprise-policy.v1' as const;
export const X402_IFF_SDK = '@ifandonlyif/x402-preflight@0.2.0' as const;

export interface EnterpriseX402PreflightInput {
  endpointUrl: string;
  paymentRequired: unknown;
  policy: X402SandboxPolicy;
}

export interface EnterpriseX402PreflightResponse {
  schema: typeof X402_RESPONSE_SCHEMA;
  checkedAt: string;
  endpoint: string;
  source: {
    requirement: 'CALLER_SUPPLIED';
    externalEvidence: 'IFF_PUBLIC_API' | 'IFF_CUSTOM_API' | 'IFF_UNAVAILABLE' | 'NOT_QUERIED_POLICY_MISMATCH' | 'SIMULATED';
    merchantEndpointFetched: false;
  };
  iff: IffX402Preflight | null;
  policy: X402PolicyEvaluation;
  verifier: {
    policyVersion: typeof X402_POLICY_VERSION;
    iffSdk: typeof X402_IFF_SDK;
  };
  execution: {
    status: 'NOT_EXECUTED';
    payment: 'NOT_EXECUTED';
    selectedOption: 'NOT_BOUND';
  };
  limitations: string[];
}

type VerifyRequirement = typeof verifyX402Requirement;

const firstHeader = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value.split(',')[0]?.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].split(',')[0]?.trim();
  return undefined;
};

const singleHeader = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    if (value.length !== 1) return undefined;
    return singleHeader(value[0]);
  }
  if (typeof value !== 'string' || value.includes(',')) return undefined;
  return value.trim() || undefined;
};

const parseOrigin = (value: string | undefined, httpsOnly = false): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((httpsOnly ? url.protocol !== 'https:' : !['https:', 'http:'].includes(url.protocol))
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
};

const requestOrigin = (req: any): string | null => {
  const host = firstHeader(req.headers?.['x-forwarded-host']) ?? firstHeader(req.headers?.host);
  if (!host) return null;
  const forwardedProtocol = firstHeader(req.headers?.['x-forwarded-proto']);
  const protocol = ['https', 'http'].includes(String(forwardedProtocol))
    ? forwardedProtocol
    : req.socket?.encrypted ? 'https' : 'http';
  return parseOrigin(`${protocol}://${host}`);
};

const applyCors = (req: any, res: any): boolean => {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  const supplied = singleHeader(req.headers?.origin);
  if (!supplied) return true; // Server-to-server requests do not need CORS.
  const origin = parseOrigin(supplied);
  if (!origin) return false;
  const explicit = parseOrigin(process.env.X402_ALLOWED_ORIGIN, true);
  if (origin !== requestOrigin(req) && origin !== explicit) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  return true;
};

const sha256 = async (value: string | Uint8Array): Promise<Uint8Array | null> => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return new Uint8Array(await subtle.digest('SHA-256', bytes));
};

const constantTimeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
};

const botKeyMatches = async (req: any): Promise<boolean> => {
  const expected = process.env.BOT_API_KEY;
  const supplied = singleHeader(req.headers?.['x-bot-key']);
  if (!expected || !supplied) return false;
  const [expectedDigest, suppliedDigest] = await Promise.all([sha256(expected), sha256(supplied)]);
  return Boolean(expectedDigest && suppliedDigest && constantTimeEqual(expectedDigest, suppliedDigest));
};

const clientIpHash = async (req: any): Promise<string> => {
  const ip = firstHeader(req.headers?.['x-forwarded-for'])
    ?? firstHeader(req.headers?.['x-real-ip'])
    ?? req.socket?.remoteAddress
    ?? 'unknown';
  if (!rateLimitSalt) {
    rateLimitSalt = new Uint8Array(32);
    globalThis.crypto?.getRandomValues(rateLimitSalt);
  }
  const encodedIp = new TextEncoder().encode(String(ip));
  const saltedIp = new Uint8Array(rateLimitSalt.length + encodedIp.length);
  saltedIp.set(rateLimitSalt);
  saltedIp.set(encodedIp, rateLimitSalt.length);
  const digest = await sha256(saltedIp);
  if (!digest) {
    // This branch is for legacy runtimes without Web Crypto. It keeps the raw IP
    // out of memory keys, while the BOT_API_KEY bypass remains disabled above.
    let fallback = 0x811c9dc5;
    for (const byte of saltedIp) fallback = Math.imul(fallback ^ byte, 0x01000193) >>> 0;
    return fallback.toString(16).padStart(8, '0');
  }
  return Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const consumeWarmInstanceBudget = async (req: any, now = Date.now()): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> => {
  const key = await clientIpHash(req);
  const current = rateLimits.get(key);
  if (!current || now - current.windowStart >= RATE_LIMIT_WINDOW_MS) {
    for (const [candidate, entry] of rateLimits) {
      if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) rateLimits.delete(candidate);
    }
    while (rateLimits.size >= MAX_RATE_LIMIT_ENTRIES) {
      const oldest = rateLimits.keys().next().value;
      if (!oldest) break;
      rateLimits.delete(oldest);
    }
    rateLimits.delete(key);
    rateLimits.set(key, { windowStart: now, count: 1 });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - current.windowStart)) / 1_000));
  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    rateLimits.delete(key);
    rateLimits.set(key, current);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  current.count += 1;
  rateLimits.delete(key);
  rateLimits.set(key, current);
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - current.count, retryAfterSeconds: 0 };
};

const sanitizeEndpoint = (value: unknown): string => {
  if (typeof value !== 'string' || value.length > 2_048) throw new Error('INVALID_ENDPOINT_URL');
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('INVALID_ENDPOINT_URL');
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    throw new Error('INVALID_ENDPOINT_URL');
  }
};

const iffState = (result: IffX402Preflight): X402IffState => (
  result.status === 'VERIFIED' && result.verdict ? result.verdict : 'unavailable'
);

const externalEvidenceSource = (
  result: IffX402Preflight | null,
): EnterpriseX402PreflightResponse['source']['externalEvidence'] => {
  if (!result) return 'NOT_QUERIED_POLICY_MISMATCH';
  if (result.evidenceSource === 'IFF_PUBLIC_API') return 'IFF_PUBLIC_API';
  if (result.evidenceSource === 'IFF_CUSTOM_API') return 'IFF_CUSTOM_API';
  if (result.evidenceSource === 'SIMULATED') return 'SIMULATED';
  return 'IFF_UNAVAILABLE';
};

export const runEnterpriseX402Preflight = async (
  input: EnterpriseX402PreflightInput,
  options: { verifyRequirement?: VerifyRequirement } = {},
): Promise<EnterpriseX402PreflightResponse> => {
  const endpoint = sanitizeEndpoint(input?.endpointUrl);
  const requirement = parseX402Requirement(input?.paymentRequired);
  const precheck = evaluateX402Policy(requirement, input?.policy, 'unavailable');
  const iff = precheck.localPolicyMatched
    ? await (options.verifyRequirement ?? verifyX402Requirement)(endpoint, requirement)
    : null;
  const policy = evaluateX402Policy(requirement, input.policy, iff ? iffState(iff) : 'unavailable');

  return {
    schema: X402_RESPONSE_SCHEMA,
    checkedAt: new Date().toISOString(),
    endpoint,
    source: {
      requirement: 'CALLER_SUPPLIED',
      externalEvidence: externalEvidenceSource(iff),
      merchantEndpointFetched: false,
    },
    iff,
    policy,
    verifier: { policyVersion: X402_POLICY_VERSION, iffSdk: X402_IFF_SDK },
    execution: { status: 'NOT_EXECUTED', payment: 'NOT_EXECUTED', selectedOption: 'NOT_BOUND' },
    limitations: [
      'A consistent requirement is not proof that a merchant is safe or will deliver.',
      'VerifyFirst does not hold wallet keys, sign a payment, or execute settlement.',
      'The supplied merchant endpoint is not fetched by this preflight endpoint.',
    ],
  };
};

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (!applyCors(req, res)) return res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
  if (req.method === 'OPTIONS') return res.status(204).end?.();
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  if (!(await botKeyMatches(req))) {
    const rateLimit = await consumeWarmInstanceBudget(req);
    res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS_PER_WINDOW));
    res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
      return res.status(429).json({
        error: 'RATE_LIMITED',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        scope: 'WARM_INSTANCE_BEST_EFFORT',
      });
    }
  }

  let serialized = '';
  try {
    serialized = JSON.stringify(req.body ?? {});
  } catch {
    return res.status(400).json({ error: 'INVALID_JSON_BODY' });
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });

  try {
    const result = await runEnterpriseX402Preflight(req.body as EnterpriseX402PreflightInput);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof X402PolicyValidationError) {
      return res.status(400).json({ error: error.code, issues: error.issues });
    }
    if ((error as Error)?.message === 'INVALID_ENDPOINT_URL') {
      return res.status(400).json({ error: 'INVALID_ENDPOINT_URL' });
    }
    return res.status(503).json({ error: 'X402_PREFLIGHT_FAILED' });
  }
}
