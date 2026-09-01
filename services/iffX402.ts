import {
  computeFingerprint,
  computePayeeFingerprint,
  DEFAULT_BASE_URL,
  decodePaymentRequiredHeader,
  FINGERPRINT_VERSION,
  verify,
  VerifyRequestError,
  type PaymentOption,
  type PaymentRequiredEnvelope,
  type VerifyOptions,
  type VerifyResult,
} from '@ifandonlyif/x402-preflight';
import type { IffX402Preflight } from '../types';

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_REQUIREMENT_BODY_BYTES = 64 * 1024;
const MAX_REQUIREMENT_HEADER_CHARS = 32 * 1024;
const MAX_IFF_RESPONSE_BYTES = 256 * 1024;
const MAX_IFF_ARRAY_ITEMS = 4_096;

type VerifyFn = (
  url: string,
  paymentRequired: PaymentRequiredEnvelope,
  options?: VerifyOptions,
) => Promise<VerifyResult>;

export interface X402PreflightOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  verifyFn?: VerifyFn;
}

interface EvidenceEndpoint {
  baseUrl: string;
  source: 'IFF_PUBLIC_API' | 'IFF_CUSTOM_API';
}

class IffTransportError extends Error {
  readonly code: 'IFF_RESPONSE_TOO_LARGE';

  constructor(code: IffTransportError['code']) {
    super(code);
    this.name = 'IffTransportError';
    this.code = code;
  }
}

const isPaymentRequiredEnvelope = (value: unknown): value is PaymentRequiredEnvelope => {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Record<string, unknown>;
  return envelope.x402Version === 2 && Array.isArray(envelope.accepts);
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isBoundedString = (value: unknown, maxLength = 4_096): value is string => (
  typeof value === 'string' && value.length > 0 && value.length <= maxLength
);

const asPaymentOptions = (accepts: unknown[]): PaymentOption[] | null => {
  if (!accepts.length || accepts.length > MAX_IFF_ARRAY_ITEMS) return null;
  const options: PaymentOption[] = [];
  for (const candidate of accepts) {
    const maxTimeoutSeconds = isRecord(candidate) ? candidate.maxTimeoutSeconds : undefined;
    if (!isRecord(candidate)
      || !isBoundedString(candidate.scheme, 128)
      || !isBoundedString(candidate.network, 256)
      || !isBoundedString(candidate.asset, 512)
      || !isBoundedString(candidate.amount, 256)
      || !isBoundedString(candidate.payTo, 512)
      || (maxTimeoutSeconds !== undefined && !isNonNegativeInteger(maxTimeoutSeconds))) return null;
    options.push({
      scheme: candidate.scheme,
      network: candidate.network,
      asset: candidate.asset,
      amount: candidate.amount,
      payTo: candidate.payTo,
      ...(typeof maxTimeoutSeconds === 'number' ? { maxTimeoutSeconds } : {}),
    });
  }
  return options;
};

const sameStrings = (left: string[], right: string[]) => (
  left.length === right.length && left.every((value, index) => value === right[index])
);

const isStringArray = (value: unknown): value is string[] => (
  Array.isArray(value)
  && value.length <= MAX_IFF_ARRAY_ITEMS
  && value.every(item => isBoundedString(item))
);

const isNonNegativeInteger = (value: unknown): value is number => (
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
);

const isFingerprintSummary = (value: unknown): boolean => (
  isRecord(value)
  && isBoundedString(value.set_fingerprint)
  && isStringArray(value.option_fingerprints)
);

const isObservedSummary = (value: unknown): boolean => (
  isFingerprintSummary(value)
  && isRecord(value)
  && isBoundedString(value.observation_id)
  && isBoundedString(value.observed_at)
  && isBoundedString(value.probe_type)
  && isBoundedString(value.monitor_id)
  && isBoundedString(value.monitor_public_key, 16_384)
  && isBoundedString(value.report_hash)
  && isBoundedString(value.monitor_signature, 16_384)
);

const isHistory = (value: unknown): boolean => (
  Array.isArray(value)
  && value.length <= MAX_IFF_ARRAY_ITEMS
  && value.every(entry => (
    isRecord(entry)
    && isBoundedString(entry.set_fingerprint)
    && isBoundedString(entry.first_seen)
    && isBoundedString(entry.last_seen)
    && isNonNegativeInteger(entry.observations)
  ))
);

const isOwnership = (value: unknown): boolean => (
  isRecord(value)
  && isBoundedString(value.status)
  && (value.method === undefined || isBoundedString(value.method))
  && (value.verified_at === undefined || isBoundedString(value.verified_at))
  && (value.last_verified_at === undefined || isBoundedString(value.last_verified_at))
);

const isSignedTreeHead = (value: unknown): boolean => (
  isRecord(value)
  && isBoundedString(value.log_id)
  && isNonNegativeInteger(value.tree_size)
  && isBoundedString(value.timestamp)
  && isBoundedString(value.root_hash)
  && isBoundedString(value.signature, 16_384)
  && isBoundedString(value.public_key, 16_384)
);

const isInclusion = (value: unknown): boolean => (
  value === null
  || (
    isRecord(value)
    && isNonNegativeInteger(value.tree_size)
    && isNonNegativeInteger(value.log_index)
    && isStringArray(value.audit_path)
    && isSignedTreeHead(value.sth)
  )
);

const isVerifyResult = (value: unknown): value is VerifyResult => {
  if (!isRecord(value)) return false;
  if (!isBoundedString(value.url, 2_048)) return false;
  if (!['consistent', 'diverged', 'stale', 'unobserved'].includes(String(value.verdict))) return false;
  if (!isFingerprintSummary(value.received)) return false;
  if (value.observed !== undefined && !isObservedSummary(value.observed)) return false;
  if (!isHistory(value.history) || !isStringArray(value.unmatched_received_options)) return false;
  if (!isOwnership(value.ownership) || !isInclusion(value.inclusion)) return false;
  if (!isBoundedString(value.disclaimer, 16_384)) return false;
  if (value.tier !== undefined && !isBoundedString(value.tier)) return false;
  if (value.window_seconds !== undefined && !isNonNegativeInteger(value.window_seconds)) return false;
  if (value.stable_since !== undefined && !isBoundedString(value.stable_since)) return false;
  if (value.matches_last_observed !== undefined && typeof value.matches_last_observed !== 'boolean') return false;
  if (value.known !== undefined && typeof value.known !== 'boolean') return false;
  if (value.divergence_kind !== undefined && !['amount_only', 'payee'].includes(String(value.divergence_kind))) return false;
  return true;
};

const resolveEvidenceEndpoint = (configuredBaseUrl?: string): EvidenceEndpoint | null => {
  const raw = configuredBaseUrl ?? process.env.IFF_BASE_URL ?? DEFAULT_BASE_URL;
  try {
    const url = new URL(raw);
    const loopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
      || url.username || url.password || url.search || url.hash) return null;
    const baseUrl = url.toString().replace(/\/+$/, '');
    const production = new URL(DEFAULT_BASE_URL).toString().replace(/\/+$/, '');
    return { baseUrl, source: baseUrl === production ? 'IFF_PUBLIC_API' : 'IFF_CUSTOM_API' };
  } catch {
    return null;
  }
};

const createAbortError = (): Error => {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
};

const withAbort = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> => new Promise<T>((resolve, reject) => {
  if (signal.aborted) {
    reject(createAbortError());
    return;
  }
  const abort = () => reject(createAbortError());
  signal.addEventListener('abort', abort, { once: true });
  promise.then(
    value => { signal.removeEventListener('abort', abort); resolve(value); },
    error => { signal.removeEventListener('abort', abort); reject(error); },
  );
});

const bufferResponse = async (response: Response, signal: AbortSignal): Promise<Response> => {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IFF_RESPONSE_BYTES) {
    throw new IffTransportError('IFF_RESPONSE_TOO_LARGE');
  }

  const reader = response.body?.getReader();
  if (!reader) return new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await withAbort(reader.read(), signal);
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IFF_RESPONSE_BYTES) {
        throw new IffTransportError('IFF_RESPONSE_TOO_LARGE');
      }
      chunks.push(value);
    }
  } catch (error) {
    void reader.cancel(error).catch(() => undefined);
    throw error;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
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
    const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
    const upstreamSignal = init?.signal;
    const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
    upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });

    try {
      const response = await withAbort(
        Promise.resolve(fetchImpl(input, { ...init, signal: controller.signal })),
        controller.signal,
      );
      // Buffer while the same deadline remains active. The SDK reads the
      // returned in-memory Response, so a slow or oversized response body
      // cannot outlive the preflight timeout or consume unbounded memory.
      return await bufferResponse(response, controller.signal);
    } finally {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    }
  }
) as typeof fetch;

const unavailable = (errorCode: string, evidenceBaseUrl?: string): IffX402Preflight => ({
  provider: 'ifandonlyif.io',
  evidenceBaseUrl,
  evidenceSource: 'UNAVAILABLE',
  status: 'UNAVAILABLE',
  inclusionAvailable: false,
  errorCode,
});

/**
 * Compare a supplied x402 v2 requirement with IFF's independent observation.
 * The URL is used as an identifier by the SDK; this function never fetches the
 * merchant endpoint, holds a wallet key, signs, or executes payment.
 */
export const verifyX402Requirement = async (
  url: string,
  paymentRequired: PaymentRequiredEnvelope,
  options: X402PreflightOptions = {},
): Promise<IffX402Preflight> => {
  const evidenceEndpoint = resolveEvidenceEndpoint(options.baseUrl);
  if (!evidenceEndpoint) return unavailable('IFF_INVALID_BASE_URL');

  if (!isPaymentRequiredEnvelope(paymentRequired)) {
    return {
      provider: 'ifandonlyif.io',
      evidenceBaseUrl: evidenceEndpoint.baseUrl,
      evidenceSource: 'UNAVAILABLE',
      status: 'INVALID_REQUIREMENT',
      inclusionAvailable: false,
      errorCode: 'INVALID_X402_REQUIREMENT',
    };
  }

  const paymentOptions = asPaymentOptions(paymentRequired.accepts);
  if (!paymentOptions) {
    return {
      provider: 'ifandonlyif.io',
      evidenceBaseUrl: evidenceEndpoint.baseUrl,
      evidenceSource: 'UNAVAILABLE',
      status: 'INVALID_REQUIREMENT',
      inclusionAvailable: false,
      errorCode: 'INVALID_X402_REQUIREMENT',
    };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) return unavailable('IFF_FETCH_UNAVAILABLE', evidenceEndpoint.baseUrl);

  try {
    const endpointUrl = new URL(url);
    if (endpointUrl.protocol !== 'https:' && endpointUrl.protocol !== 'http:') {
      return unavailable('IFF_INVALID_ENDPOINT_URL', evidenceEndpoint.baseUrl);
    }
    endpointUrl.username = '';
    endpointUrl.password = '';
    endpointUrl.search = '';
    endpointUrl.hash = '';

    const [localFingerprint, localPayeeFingerprint] = await Promise.all([
      computeFingerprint(paymentOptions),
      computePayeeFingerprint(paymentOptions),
    ]);
    if (!localFingerprint || !localPayeeFingerprint) {
      return unavailable('IFF_LOCAL_FINGERPRINT_FAILED', evidenceEndpoint.baseUrl);
    }

    const rawResult: unknown = await (options.verifyFn ?? verify)(endpointUrl.toString(), paymentRequired, {
      baseUrl: evidenceEndpoint.baseUrl,
      fetch: timeoutFetch(fetchImpl, options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!isVerifyResult(rawResult)) return unavailable('IFF_INVALID_RESPONSE', evidenceEndpoint.baseUrl);
    const result = rawResult;
    const receivedFingerprintMatchesLocal = result.received.set_fingerprint === localFingerprint.setFingerprint
      && sameStrings(result.received.option_fingerprints, localFingerprint.optionFingerprints);
    if (!receivedFingerprintMatchesLocal) {
      return unavailable('IFF_RECEIVED_FINGERPRINT_MISMATCH', evidenceEndpoint.baseUrl);
    }

    return {
      provider: 'ifandonlyif.io',
      evidenceBaseUrl: evidenceEndpoint.baseUrl,
      evidenceSource: evidenceEndpoint.source,
      status: 'VERIFIED',
      verdict: result.verdict,
      divergenceKind: result.divergence_kind,
      matchesLastObserved: result.matches_last_observed,
      known: result.known,
      ownershipStatus: result.ownership?.status,
      ownershipMethod: result.ownership?.method,
      ownershipVerifiedAt: result.ownership?.last_verified_at ?? result.ownership?.verified_at,
      observedAt: result.observed?.observed_at,
      stableSince: result.stable_since,
      monitorId: result.observed?.monitor_id,
      monitorPublicKey: result.observed?.monitor_public_key,
      monitorSignature: result.observed?.monitor_signature,
      reportHash: result.observed?.report_hash,
      receivedFingerprint: result.received?.set_fingerprint,
      receivedOptionFingerprints: result.received?.option_fingerprints,
      fingerprintVersion: FINGERPRINT_VERSION,
      localReceivedFingerprint: localFingerprint.setFingerprint,
      localReceivedOptionFingerprints: localFingerprint.optionFingerprints,
      localPayeeFingerprint: localPayeeFingerprint.payeeSetFingerprint,
      localPayeeOptionFingerprints: localPayeeFingerprint.payeeFingerprints,
      receivedFingerprintMatchesLocal,
      observedFingerprint: result.observed?.set_fingerprint,
      observedOptionFingerprints: result.observed?.option_fingerprints,
      unmatchedReceivedOptions: result.unmatched_received_options,
      history: result.history.map(entry => ({
        setFingerprint: entry.set_fingerprint,
        firstSeen: entry.first_seen,
        lastSeen: entry.last_seen,
        observations: entry.observations,
      })),
      inclusionAvailable: Boolean(result.inclusion),
      inclusionTreeSize: result.inclusion?.tree_size,
      inclusionLogIndex: result.inclusion?.log_index,
      inclusionAuditPath: result.inclusion?.audit_path,
      inclusionSignedTreeHead: result.inclusion ? {
        logId: result.inclusion.sth.log_id,
        treeSize: result.inclusion.sth.tree_size,
        timestamp: result.inclusion.sth.timestamp,
        rootHash: result.inclusion.sth.root_hash,
        signature: result.inclusion.sth.signature,
        publicKey: result.inclusion.sth.public_key,
      } : undefined,
      disclaimer: result.disclaimer,
    };
  } catch (error) {
    if (error instanceof IffTransportError) return unavailable(error.code, evidenceEndpoint.baseUrl);
    if ((error as Error)?.name === 'AbortError') return unavailable('IFF_TIMEOUT', evidenceEndpoint.baseUrl);
    if (error instanceof VerifyRequestError) return unavailable(`IFF_HTTP_${error.status}`, evidenceEndpoint.baseUrl);
    return unavailable('IFF_REQUEST_FAILED', evidenceEndpoint.baseUrl);
  }
};

/**
 * Preflight an x402 v2 HTTP 402 response with IFF's public evidence service.
 * This only compares the advertised requirement with an independent
 * observation. It never holds a wallet key, authorizes, or executes payment.
 */
export const preflightX402Response = async (
  url: string,
  response: Response,
  options: X402PreflightOptions = {},
): Promise<IffX402Preflight | null> => {
  if (response.status !== 402) return null;

  const paymentRequired = await readPaymentRequired(response);
  if (!paymentRequired) {
    const evidenceEndpoint = resolveEvidenceEndpoint(options.baseUrl);
    return {
      provider: 'ifandonlyif.io',
      evidenceBaseUrl: evidenceEndpoint?.baseUrl,
      evidenceSource: 'UNAVAILABLE',
      status: 'INVALID_REQUIREMENT',
      inclusionAvailable: false,
      errorCode: 'INVALID_X402_REQUIREMENT',
    };
  }

  return verifyX402Requirement(url, paymentRequired, options);
};
