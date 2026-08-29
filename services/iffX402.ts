import {
  decodePaymentRequiredHeader,
  verify,
  VerifyRequestError,
  type PaymentRequiredEnvelope,
  type VerifyOptions,
  type VerifyResult,
} from '@ifandonlyif/x402-preflight';
import type { IffX402Preflight } from '../types';

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_REQUIREMENT_BODY_BYTES = 64 * 1024;
const MAX_REQUIREMENT_HEADER_CHARS = 32 * 1024;

type VerifyFn = (
  url: string,
  paymentRequired: PaymentRequiredEnvelope,
  options?: VerifyOptions,
) => Promise<VerifyResult>;

interface PreflightOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  verifyFn?: VerifyFn;
}

const isPaymentRequiredEnvelope = (value: unknown): value is PaymentRequiredEnvelope => {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Record<string, unknown>;
  return envelope.x402Version === 2 && Array.isArray(envelope.accepts);
};

const readPaymentRequired = async (response: Response): Promise<PaymentRequiredEnvelope | null> => {
  const encoded = response.headers.get('payment-required');
  if (encoded && encoded.length <= MAX_REQUIREMENT_HEADER_CHARS) {
    try {
      const decoded = decodePaymentRequiredHeader(encoded);
      if (isPaymentRequiredEnvelope(decoded)) return decoded;
    } catch {
      // Some implementations send a malformed header but a valid JSON body.
    }
  }

  try {
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUIREMENT_BODY_BYTES) return null;

    const reader = response.clone().body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUIREMENT_BODY_BYTES) {
        // A cloned/tee'd Response stream may wait for its unread sibling when
        // cancel resolves. Do not let an oversized attacker-controlled body
        // hold the serverless request open while we discard it.
        void reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    return isPaymentRequiredEnvelope(body) ? body : null;
  } catch {
    return null;
  }
};

const timeoutFetch = (fetchImpl: typeof fetch, timeoutMs: number): typeof fetch => (
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const upstreamSignal = init?.signal;
    const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
    upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });

    try {
      return await fetchImpl(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    }
  }
) as typeof fetch;

const unavailable = (errorCode: string): IffX402Preflight => ({
  provider: 'ifandonlyif.io',
  status: 'UNAVAILABLE',
  inclusionAvailable: false,
  errorCode,
});

/**
 * Preflight an x402 v2 HTTP 402 response with IFF's public evidence service.
 * This only compares the advertised requirement with an independent
 * observation. It never holds a wallet key, authorizes, or executes payment.
 */
export const preflightX402Response = async (
  url: string,
  response: Response,
  options: PreflightOptions = {},
): Promise<IffX402Preflight | null> => {
  if (response.status !== 402) return null;

  const paymentRequired = await readPaymentRequired(response);
  if (!paymentRequired) {
    return {
      provider: 'ifandonlyif.io',
      status: 'INVALID_REQUIREMENT',
      inclusionAvailable: false,
      errorCode: 'INVALID_X402_REQUIREMENT',
    };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) return unavailable('IFF_FETCH_UNAVAILABLE');

  try {
    const endpointUrl = new URL(url);
    endpointUrl.username = '';
    endpointUrl.password = '';
    endpointUrl.search = '';
    endpointUrl.hash = '';

    const result = await (options.verifyFn ?? verify)(endpointUrl.toString(), paymentRequired, {
      baseUrl: options.baseUrl ?? process.env.IFF_BASE_URL,
      fetch: timeoutFetch(fetchImpl, options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });

    return {
      provider: 'ifandonlyif.io',
      status: 'VERIFIED',
      verdict: result.verdict,
      divergenceKind: result.divergence_kind,
      matchesLastObserved: result.matches_last_observed,
      known: result.known,
      ownershipStatus: result.ownership?.status,
      observedAt: result.observed?.observed_at,
      stableSince: result.stable_since,
      monitorId: result.observed?.monitor_id,
      reportHash: result.observed?.report_hash,
      inclusionAvailable: Boolean(result.inclusion),
      disclaimer: result.disclaimer,
    };
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') return unavailable('IFF_TIMEOUT');
    if (error instanceof VerifyRequestError) return unavailable(`IFF_HTTP_${error.status}`);
    return unavailable('IFF_REQUEST_FAILED');
  }
};
