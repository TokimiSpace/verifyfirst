const GLEIF_LEI_RECORDS_URL = 'https://api.gleif.org/api/v1/lei-records/';
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 512 * 1024;

export type GleifLookupErrorCode =
  | 'INVALID_LEI'
  | 'GLEIF_FETCH_UNAVAILABLE'
  | 'GLEIF_TIMEOUT'
  | 'LEI_NOT_FOUND'
  | 'GLEIF_HTTP_ERROR'
  | 'GLEIF_RESPONSE_TOO_LARGE'
  | 'INVALID_GLEIF_RESPONSE'
  | 'GLEIF_REQUEST_FAILED';

export class GleifLookupError extends Error {
  readonly code: GleifLookupErrorCode;
  readonly status?: number;

  constructor(code: GleifLookupErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'GleifLookupError';
    this.code = code;
    this.status = status;
  }
}

export interface GleifLeiRecord {
  lei: string;
  legalName: string;
  entityStatus: string;
  registrationStatus: string;
  jurisdiction: string;
  legalAddressCountry?: string;
  managingLou?: string;
  corroborationLevel?: string;
  initialRegistrationDate?: string;
  lastUpdateDate?: string;
  nextRenewalDate?: string;
  goldenCopyPublishDate?: string;
  sourceUrl: string;
  checkedAt: string;
}

export interface GleifLookupOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null
);

const asNonEmptyString = (value: unknown): string | undefined => (
  typeof value === 'string' && value.trim() ? value.trim() : undefined
);

/** Structural ISO 17442 validation. Record existence remains authoritative at GLEIF. */
export const isValidLei = (input: string): boolean => (
  typeof input === 'string' && /^[A-Z0-9]{20}$/.test(input.trim().toUpperCase())
);

const readJsonBounded = async (response: Response): Promise<unknown> => {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new GleifLookupError('GLEIF_RESPONSE_TOO_LARGE', 'GLEIF response exceeded the 512 KiB safety limit.');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    try {
      return await response.json();
    } catch {
      throw new GleifLookupError('INVALID_GLEIF_RESPONSE', 'GLEIF returned malformed JSON.');
    }
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      void reader.cancel().catch(() => undefined);
      throw new GleifLookupError('GLEIF_RESPONSE_TOO_LARGE', 'GLEIF response exceeded the 512 KiB safety limit.');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new GleifLookupError('INVALID_GLEIF_RESPONSE', 'GLEIF returned malformed JSON.');
  }
};

const normalizeRecord = (payload: unknown, requestedLei: string, checkedAt: string): GleifLeiRecord => {
  const document = asRecord(payload);
  const data = asRecord(document?.data);
  const attributes = asRecord(data?.attributes);
  const entity = asRecord(attributes?.entity);
  const legalName = asRecord(entity?.legalName);
  const legalAddress = asRecord(entity?.legalAddress);
  const registration = asRecord(attributes?.registration);
  const meta = asRecord(document?.meta);
  const goldenCopy = asRecord(meta?.goldenCopy);

  const recordLei = asNonEmptyString(attributes?.lei)?.toUpperCase();
  const recordId = asNonEmptyString(data?.id)?.toUpperCase();
  const name = asNonEmptyString(legalName?.name);
  const entityStatus = asNonEmptyString(entity?.status);
  const registrationStatus = asNonEmptyString(registration?.status);
  const legalAddressCountry = asNonEmptyString(legalAddress?.country);
  const jurisdiction = asNonEmptyString(entity?.jurisdiction) ?? legalAddressCountry;

  if (
    recordId !== requestedLei
    || recordLei !== requestedLei
    || !name
    || !entityStatus
    || !registrationStatus
    || !jurisdiction
  ) {
    throw new GleifLookupError(
      'INVALID_GLEIF_RESPONSE',
      'GLEIF response was missing required fields or did not match the requested LEI.',
    );
  }

  return {
    lei: requestedLei,
    legalName: name,
    entityStatus,
    registrationStatus,
    jurisdiction,
    legalAddressCountry,
    managingLou: asNonEmptyString(registration?.managingLou),
    corroborationLevel: asNonEmptyString(registration?.corroborationLevel),
    initialRegistrationDate: asNonEmptyString(registration?.initialRegistrationDate),
    lastUpdateDate: asNonEmptyString(registration?.lastUpdateDate),
    nextRenewalDate: asNonEmptyString(registration?.nextRenewalDate),
    goldenCopyPublishDate: asNonEmptyString(goldenCopy?.publishDate),
    sourceUrl: `${GLEIF_LEI_RECORDS_URL}${encodeURIComponent(requestedLei)}`,
    checkedAt,
  };
};

/**
 * Resolve one LEI directly against the GLEIF API. Any validation, timeout,
 * transport, HTTP, or shape error rejects; this service never returns fixture
 * data as a fallback.
 */
export const lookupLeiRecord = async (
  input: string,
  options: GleifLookupOptions = {},
): Promise<GleifLeiRecord> => {
  const lei = typeof input === 'string' ? input.trim().toUpperCase() : '';
  if (!isValidLei(lei)) {
    throw new GleifLookupError('INVALID_LEI', 'LEI must contain exactly 20 ASCII letters or digits.');
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new GleifLookupError('GLEIF_FETCH_UNAVAILABLE', 'No fetch implementation is available.');
  }

  const requestedTimeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutMs = Number.isFinite(requestedTimeout) && requestedTimeout > 0
    ? Math.min(requestedTimeout, MAX_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let didTimeout = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        didTimeout = true;
        controller.abort();
        reject(new GleifLookupError('GLEIF_TIMEOUT', `GLEIF did not respond within ${timeoutMs} ms.`));
      }, timeoutMs);
    });
    const request = fetchImpl(`${GLEIF_LEI_RECORDS_URL}${encodeURIComponent(lei)}`, {
      headers: { Accept: 'application/vnd.api+json' },
      signal: controller.signal,
    });
    const response = await Promise.race([request, timeout]);

    if (!response.ok) {
      if (response.status === 404) {
        throw new GleifLookupError('LEI_NOT_FOUND', `GLEIF has no record for ${lei}.`, 404);
      }
      throw new GleifLookupError(
        'GLEIF_HTTP_ERROR',
        `GLEIF lookup failed with HTTP ${response.status}.`,
        response.status,
      );
    }

    const payload = await Promise.race([readJsonBounded(response), timeout]);
    return normalizeRecord(payload, lei, new Date().toISOString());
  } catch (error) {
    if (error instanceof GleifLookupError) throw error;
    if (didTimeout || (error as Error)?.name === 'AbortError') {
      throw new GleifLookupError('GLEIF_TIMEOUT', `GLEIF did not respond within ${timeoutMs} ms.`);
    }
    throw new GleifLookupError('GLEIF_REQUEST_FAILED', 'GLEIF lookup could not be completed.');
  } finally {
    if (timer) clearTimeout(timer);
  }
};
