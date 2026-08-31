import {
  ROOT_OF_TRUST,
  VLEI_SCHEMAS,
  parseCesrStream,
  verifyChain,
} from '../public/update-trust/said.js';

export const MAX_VLEI_CESR_BYTES = 128 * 1024;

export const OFFICIAL_VLEI_FIXTURE = {
  source: '/update-trust/credential.cesr',
  upstream: 'https://raw.githubusercontent.com/GLEIF-IT/vlei-verifier/5850051b52dce24ed59eae486af76e7c73f6012c/tests/data/credential/credential.cesr',
  pinnedCommit: '5850051b52dce24ed59eae486af76e7c73f6012c',
  sha256: 'daa4bf2dae79a8ae6d9548f2c158144af648fecd7aea49ca46a203c906cca643',
} as const;

export type VleiTrustDomain = 'production' | 'fixture';

export type VleiVerificationErrorCode =
  | 'VLEI_INPUT_INVALID'
  | 'VLEI_INPUT_TOO_LARGE'
  | 'VLEI_TRUST_DOMAIN_REQUIRED'
  | 'VLEI_UNSAFE_OPTION_REJECTED'
  | 'VLEI_CRYPTO_UNAVAILABLE'
  | 'VLEI_FIXTURE_FETCH_UNAVAILABLE'
  | 'VLEI_FIXTURE_HTTP_ERROR'
  | 'VLEI_FIXTURE_INTEGRITY_ERROR';

export class VleiVerificationError extends Error {
  readonly code: VleiVerificationErrorCode;
  readonly status?: number;

  constructor(code: VleiVerificationErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'VleiVerificationError';
    this.code = code;
    this.status = status;
  }
}

export interface VleiVerificationOptions {
  /** Required: test fixture trust and production GLEIF trust can never be mixed. */
  trustDomain: VleiTrustDomain;
}

export interface VleiVerificationCheck {
  id: string;
  ok: boolean;
  label: string;
  detail: string;
  level: string;
  anchored?: boolean;
}

export interface VleiCredentialSummary {
  said: string;
  schema: string;
  schemaKey: string;
  schemaTitle: string;
  issuer?: string;
  issuee?: string;
  lei?: string;
  registry?: string;
  edges: Record<string, { n?: string; s?: string; o?: string }>;
  checks: VleiVerificationCheck[];
  status: string;
  statusScope: string;
  valid: boolean;
  chainValid: boolean;
}

export interface VleiVerificationResult {
  decision: {
    code: string;
    toolExecution: boolean;
    leaf: string | null;
  };
  checks: VleiVerificationCheck[];
  credentials: VleiCredentialSummary[];
  sourceDigest: `sha256:${string}`;
  root: {
    aid: string;
    label: string;
    trustDomain: VleiTrustDomain;
  };
  stats: {
    bytes: number;
    messages: number;
    credentials: number;
    aids: number;
    registries: number;
    officialSchemaCredentials: number;
    rejectedSchemaCredentials: number;
    signaturesUnverifiable: boolean;
  };
  verifiedAt: string;
  limitations: string[];
}

export type VleiRepresentedEntityResolution =
  | {
    status: 'RESOLVED';
    lei: string;
    credentialSaid: string;
    credentialSchemaKey: string;
  }
  | {
    status: 'UNRESOLVED' | 'AMBIGUOUS_CHAIN';
    lei?: undefined;
    credentialSaid?: undefined;
    credentialSchemaKey?: undefined;
  };

export interface OfficialVleiFixture {
  raw: string;
  source: string;
  upstream: string;
  pinnedCommit: string;
  sourceDigest: `sha256:${string}`;
  bytes: number;
}

type UnknownRecord = Record<string, unknown>;

const encoder = new TextEncoder();
const CESR_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const OFFICIAL_SCHEMA_SAIDS = new Set(
  Object.values(VLEI_SCHEMAS).map((schema: { said: string }) => schema.said),
);
const ENTERPRISE_SUPPORTED_KERI_TYPES = new Set(['icp', 'rot', 'ixn', 'vcp', 'iss', 'rev']);

const digestSha256 = async (bytes: Uint8Array): Promise<`sha256:${string}`> => {
  if (!globalThis.crypto?.subtle) {
    throw new VleiVerificationError('VLEI_CRYPTO_UNAVAILABLE', 'WebCrypto SHA-256 is required.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
};

const boundedText = async (response: Response): Promise<{ raw: string; bytes: Uint8Array }> => {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_VLEI_CESR_BYTES) {
    throw new VleiVerificationError('VLEI_INPUT_TOO_LARGE', 'CESR input exceeds the 128 KiB limit.');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const raw = await response.text();
    const bytes = encoder.encode(raw);
    if (bytes.byteLength > MAX_VLEI_CESR_BYTES) {
      throw new VleiVerificationError('VLEI_INPUT_TOO_LARGE', 'CESR input exceeds the 128 KiB limit.');
    }
    return { raw, bytes };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_VLEI_CESR_BYTES) {
      void reader.cancel().catch(() => undefined);
      throw new VleiVerificationError('VLEI_INPUT_TOO_LARGE', 'CESR input exceeds the 128 KiB limit.');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { raw: new TextDecoder().decode(bytes), bytes };
};

const cleanText = (value: unknown, maxLength = 2_048): string => (
  typeof value === 'string' ? value.slice(0, maxLength) : ''
);

const cleanCheck = (check: UnknownRecord): VleiVerificationCheck => ({
  id: cleanText(check.id, 160),
  ok: check.ok === true,
  label: cleanText(check.label, 512),
  detail: cleanText(check.detail),
  level: cleanText(check.level, 80) || 'BROWSER',
  ...(typeof check.anchored === 'boolean' ? { anchored: check.anchored } : {}),
});

const cleanEdges = (value: unknown): VleiCredentialSummary['edges'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as UnknownRecord).map(([name, edge]) => {
      const record = edge && typeof edge === 'object' && !Array.isArray(edge)
        ? edge as UnknownRecord
        : {};
      return [cleanText(name, 80), {
        ...(typeof record.n === 'string' ? { n: cleanText(record.n, 160) } : {}),
        ...(typeof record.s === 'string' ? { s: cleanText(record.s, 160) } : {}),
        ...(typeof record.o === 'string' ? { o: cleanText(record.o, 40) } : {}),
      }];
    }),
  );
};

const cleanCredential = (credential: UnknownRecord): VleiCredentialSummary => ({
  said: cleanText(credential.said, 160),
  schema: cleanText(credential.schema, 160),
  schemaKey: cleanText(credential.schemaKey, 80),
  schemaTitle: cleanText(credential.schemaTitle, 320),
  ...(typeof credential.issuer === 'string' ? { issuer: cleanText(credential.issuer, 160) } : {}),
  ...(typeof credential.issuee === 'string' ? { issuee: cleanText(credential.issuee, 160) } : {}),
  ...(typeof credential.lei === 'string' ? { lei: cleanText(credential.lei, 40) } : {}),
  ...(typeof credential.registry === 'string' ? { registry: cleanText(credential.registry, 160) } : {}),
  edges: cleanEdges(credential.edges),
  checks: Array.isArray(credential.checks)
    ? credential.checks.map(check => cleanCheck(check as UnknownRecord))
    : [],
  status: cleanText(credential.status, 80) || 'UNKNOWN',
  statusScope: cleanText(credential.statusScope, 80) || 'SUPPLIED_STREAM_SNAPSHOT_ONLY',
  valid: credential.valid === true,
  chainValid: credential.chainValid === true,
});

const rootFor = (trustDomain: VleiTrustDomain) => ROOT_OF_TRUST[trustDomain] as {
  aid: string;
  label: string;
};

const assertNoDuplicateJsonObjectKeys = (json: string): void => {
  const stack: Array<{ type: 'object'; keys: Set<string> } | { type: 'array' }> = [];
  for (let index = 0; index < json.length; index += 1) {
    const character = json[index];
    if (character === '{') {
      stack.push({ type: 'object', keys: new Set() });
      continue;
    }
    if (character === '[') {
      stack.push({ type: 'array' });
      continue;
    }
    if (character === '}' || character === ']') {
      stack.pop();
      continue;
    }
    if (character !== '"') continue;

    const start = index;
    let escaped = false;
    for (index += 1; index < json.length; index += 1) {
      const valueCharacter = json[index];
      if (escaped) escaped = false;
      else if (valueCharacter === '\\') escaped = true;
      else if (valueCharacter === '"') break;
    }
    if (index >= json.length) throw new Error('UNTERMINATED_JSON_STRING');
    let next = index + 1;
    while (next < json.length && /\s/.test(json[next])) next += 1;
    if (json[next] !== ':') continue;
    const frame = stack.at(-1);
    if (!frame || frame.type !== 'object') throw new Error('JSON_KEY_OUTSIDE_OBJECT');
    const key = JSON.parse(json.slice(start, index + 1)) as string;
    if (frame.keys.has(key)) throw new Error(`DUPLICATE_JSON_KEY_${key.slice(0, 40)}`);
    frame.keys.add(key);
  }
};

/**
 * The canonical demo parser is intentionally tolerant so it can visualize
 * partially pasted streams. Enterprise verification must be stricter: every
 * non-whitespace byte must belong to a balanced JSON message or to a complete
 * CESR versioned attachment-group frame (`-V` + two base64 count digits).
 */
const assertStrictCesrFraming = (raw: string): void => {
  let cursor = 0;
  let messageCount = 0;
  const skipWhitespace = () => {
    while (cursor < raw.length && /\s/.test(raw[cursor])) cursor += 1;
  };

  while (cursor < raw.length) {
    skipWhitespace();
    if (cursor >= raw.length) break;
    if (raw[cursor] !== '{') throw new Error('UNEXPECTED_BYTES_OUTSIDE_CESR_MESSAGE');

    const start = cursor;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let index = start; index < raw.length; index += 1) {
      const character = raw[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') {
        inString = true;
        continue;
      }
      if (character === '{') depth += 1;
      if (character === '}' && --depth === 0) {
        end = index + 1;
        break;
      }
    }
    if (end < 0) throw new Error('UNTERMINATED_CESR_JSON_MESSAGE');
    const jsonMessage = raw.slice(start, end);
    JSON.parse(jsonMessage);
    assertNoDuplicateJsonObjectKeys(jsonMessage);
    messageCount += 1;

    const nextMessage = raw.indexOf('{', end);
    const attachment = raw.slice(end, nextMessage < 0 ? raw.length : nextMessage).trim();
    let attachmentCursor = 0;
    while (attachmentCursor < attachment.length) {
      if (attachment.slice(attachmentCursor, attachmentCursor + 2) !== '-V') {
        throw new Error('UNSUPPORTED_OR_MALFORMED_CESR_ATTACHMENT');
      }
      const high = CESR_B64.indexOf(attachment[attachmentCursor + 2]);
      const low = CESR_B64.indexOf(attachment[attachmentCursor + 3]);
      if (high < 0 || low < 0) throw new Error('INVALID_CESR_ATTACHMENT_COUNTER');
      const quadlets = high * 64 + low;
      const frameLength = 4 + quadlets * 4;
      if (quadlets === 0 || attachmentCursor + frameLength > attachment.length) {
        throw new Error('TRUNCATED_CESR_ATTACHMENT');
      }
      attachmentCursor += frameLength;
    }
    if (attachmentCursor !== attachment.length) throw new Error('CESR_ATTACHMENT_LENGTH_MISMATCH');
    cursor = nextMessage < 0 ? raw.length : nextMessage;
  }

  if (messageCount === 0) throw new Error('NO_CESR_MESSAGES');
};

/**
 * Resolve the represented legal entity from the single terminal credential,
 * never from an arbitrary upstream issuer (for example the QVI credential).
 */
export const resolveVleiRepresentedEntity = (
  result: VleiVerificationResult,
): VleiRepresentedEntityResolution => {
  const referencedSaids = new Set(
    result.credentials.flatMap(credential => (
      Object.values(credential.edges)
        .map(edge => edge.n)
        .filter((said): said is string => typeof said === 'string' && said.length > 0)
    )),
  );
  const leaves = result.credentials.filter(credential => !referencedSaids.has(credential.said));
  if (
    leaves.length !== 1
    || !result.decision.leaf
    || leaves[0].said !== result.decision.leaf
  ) {
    return { status: 'AMBIGUOUS_CHAIN' };
  }

  const lei = leaves[0].lei?.trim().toUpperCase();
  if (!lei || !/^[A-Z0-9]{20}$/.test(lei)) return { status: 'UNRESOLVED' };
  return {
    status: 'RESOLVED',
    lei,
    credentialSaid: leaves[0].said,
    credentialSchemaKey: leaves[0].schemaKey,
  };
};

/**
 * Verify a bounded CESR stream with the canonical Update Trust verifier.
 * The wrapper deliberately exposes no root override, signature bypass,
 * additional ACDCs, or unanchored allow-list.
 */
export const verifyVleiCesr = async (
  raw: string,
  options: VleiVerificationOptions,
): Promise<VleiVerificationResult> => {
  if (typeof raw !== 'string') {
    throw new VleiVerificationError('VLEI_INPUT_INVALID', 'CESR input must be text.');
  }
  if (!options || (options.trustDomain !== 'production' && options.trustDomain !== 'fixture')) {
    throw new VleiVerificationError(
      'VLEI_TRUST_DOMAIN_REQUIRED',
      'Choose the production or fixture trust domain explicitly.',
    );
  }
  if (
    options.trustDomain === 'production'
    && Object.prototype.hasOwnProperty.call(options, 'unanchoredOk')
  ) {
    throw new VleiVerificationError(
      'VLEI_UNSAFE_OPTION_REJECTED',
      'Production verification cannot bypass KEL/TEL anchoring.',
    );
  }

  const bytes = encoder.encode(raw);
  if (bytes.byteLength > MAX_VLEI_CESR_BYTES) {
    throw new VleiVerificationError('VLEI_INPUT_TOO_LARGE', 'CESR input exceeds the 128 KiB limit.');
  }

  const root = rootFor(options.trustDomain);
  let parserFailed = false;
  let parserFailureDetail = '';
  let messages: ReturnType<typeof parseCesrStream> = [];
  try {
    assertStrictCesrFraming(raw);
    messages = parseCesrStream(raw);
    if (messages.length === 0 || messages.some(message => !message.ked)) {
      throw new Error('CESR_MESSAGE_PARSE_FAILED');
    }
  } catch (error) {
    parserFailed = true;
    parserFailureDetail = cleanText((error as Error)?.message, 240) || 'CESR framing validation failed.';
  }
  const acdcs = messages
    .map((message: { ked?: UnknownRecord | null }) => message.ked)
    .filter((ked: UnknownRecord | null | undefined): ked is UnknownRecord => (
      Boolean(ked) && typeof ked?.v === 'string' && ked.v.startsWith('ACDC')
    ));
  const rejectedSchemas = acdcs.filter(acdc => (
    typeof acdc.s !== 'string' || !OFFICIAL_SCHEMA_SAIDS.has(acdc.s)
  ));
  const unsupportedMessages = messages.filter((message: { ked?: UnknownRecord | null }) => {
    const ked = message.ked;
    if (!ked || typeof ked.v !== 'string') return false;
    if (ked.v.startsWith('ACDC')) return Object.prototype.hasOwnProperty.call(ked, 't');
    if (!ked.v.startsWith('KERI')) return false;
    return typeof ked.t !== 'string' || !ENTERPRISE_SUPPORTED_KERI_TYPES.has(ked.t);
  });

  let report: UnknownRecord;
  if (parserFailed) {
    report = {
      checks: [{
        id: 'parse',
        ok: false,
        label: 'CESR stream framing rejected',
        detail: parserFailureDetail,
        level: 'BROWSER',
      }],
      credentials: [],
      aids: {},
      registries: {},
      decision: { code: 'DENY_STREAM_CORRUPT', leaf: null, tool_execution: false },
    };
  } else try {
    report = await verifyChain(messages, {
      rootAid: root.aid,
      verifySignatures: true,
    }) as UnknownRecord;
  } catch {
    // Canonical verifier primitives intentionally throw on structurally invalid
    // KERI objects. Convert that into a bounded fail-closed result for the UI.
    report = {
      checks: [{
        id: 'verifier',
        ok: false,
        label: 'CESR verifier rejected the input',
        detail: 'The stream could not be evaluated as a valid KERI/ACDC structure.',
        level: 'BROWSER',
      }],
      credentials: [],
      aids: {},
      registries: {},
      decision: { code: 'DENY_VERIFIER_ERROR', leaf: null, tool_execution: false },
    };
  }
  const reportChecks = Array.isArray(report.checks)
    ? report.checks.map(check => cleanCheck(check as UnknownRecord))
    : [];
  const schemaBoundaryCheck: VleiVerificationCheck = {
    id: 'official-schema-boundary',
    ok: rejectedSchemas.length === 0,
    label: rejectedSchemas.length === 0
      ? `Official GLEIF schema pins · ${acdcs.length}/${acdcs.length}`
      : `Non-official schema rejected · ${rejectedSchemas.length}`,
    detail: rejectedSchemas.length === 0
      ? 'Every ACDC schema SAID is pinned in the bundled GLEIF vLEI schema allow-list.'
      : 'Enterprise verification accepts official GLEIF vLEI schema SAIDs only.',
    level: 'POLICY',
  };
  const messageTypeBoundaryCheck: VleiVerificationCheck = {
    id: 'enterprise-message-type-boundary',
    ok: unsupportedMessages.length === 0,
    label: unsupportedMessages.length === 0
      ? `Supported enterprise message types · ${messages.length}/${messages.length}`
      : `Unsupported KERI/TEL event rejected · ${unsupportedMessages.length}`,
    detail: unsupportedMessages.length === 0
      ? 'Every message is covered by the browser preflight state machines.'
      : 'Enterprise preflight fails closed for event families it does not fully validate.',
    level: 'POLICY',
  };
  const credentials = Array.isArray(report.credentials)
    ? report.credentials.map(credential => cleanCredential(credential as UnknownRecord))
    : [];
  const canonicalDecision = report.decision && typeof report.decision === 'object'
    ? report.decision as UnknownRecord
    : {};
  const aids = report.aids && typeof report.aids === 'object' ? report.aids as UnknownRecord : {};
  const registries = report.registries && typeof report.registries === 'object'
    ? report.registries as UnknownRecord
    : {};
  const referencedSaids = new Set(credentials.flatMap(credential => (
    Object.values(credential.edges)
      .map(edge => edge.n)
      .filter((said): said is string => typeof said === 'string' && said.length > 0)
  )));
  const leaves = credentials.filter(credential => !referencedSaids.has(credential.said));
  const reachable = new Set<string>();
  const credentialsBySaid = new Map(credentials.map(credential => [credential.said, credential]));
  const visitCredential = (credential: VleiCredentialSummary | undefined): void => {
    if (!credential || reachable.has(credential.said)) return;
    reachable.add(credential.said);
    for (const edge of Object.values(credential.edges)) visitCredential(edge.n ? credentialsBySaid.get(edge.n) : undefined);
  };
  if (leaves.length === 1) visitCredential(leaves[0]);
  const credentialGraphOk = credentials.length > 0
    && credentials.length === acdcs.length
    && leaves.length === 1
    && canonicalDecision.leaf === leaves[0].said
    && reachable.size === credentials.length
    && credentials.every(credential => credential.valid && credential.chainValid);
  const credentialGraphBoundaryCheck: VleiVerificationCheck = {
    id: 'enterprise-credential-graph-boundary',
    ok: credentialGraphOk,
    label: credentialGraphOk
      ? `One complete credential graph · ${credentials.length}/${credentials.length}`
      : 'Credential graph rejected',
    detail: credentialGraphOk
      ? 'Every supplied ACDC is valid and reachable from the single terminal credential.'
      : 'Enterprise mode never ignores an invalid, disconnected, duplicate, or ambiguous credential.',
    level: 'POLICY',
  };
  const suppliedRegistryIds = Object.keys(registries);
  const credentialRegistryIds = new Set(
    credentials.map(credential => credential.registry).filter((id): id is string => Boolean(id)),
  );
  const registryBoundaryOk = suppliedRegistryIds.length === credentialRegistryIds.size
    && suppliedRegistryIds.every(id => credentialRegistryIds.has(id))
    && Object.values(registries).every(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const registry = value as UnknownRecord;
      return registry.valid === true && registry.anchored === true;
    });
  const registryBoundaryCheck: VleiVerificationCheck = {
    id: 'enterprise-registry-boundary',
    ok: registryBoundaryOk,
    label: registryBoundaryOk
      ? `Consumed, anchored TEL registries · ${suppliedRegistryIds.length}/${suppliedRegistryIds.length}`
      : 'TEL registry set rejected',
    detail: registryBoundaryOk
      ? 'Every supplied vcp registry is exact-KEL-anchored and referenced by at least one supplied credential.'
      : 'Enterprise mode rejects unanchored, unused, missing, or extra TEL registries.',
    level: 'POLICY',
  };
  const credentialAids = new Set(credentials.flatMap(credential => (
    [credential.issuer, credential.issuee].filter((aid): aid is string => Boolean(aid))
  )));
  const aidBoundaryOk = Object.keys(aids).every(aid => credentialAids.has(aid));
  const aidBoundaryCheck: VleiVerificationCheck = {
    id: 'enterprise-aid-boundary',
    ok: aidBoundaryOk,
    label: aidBoundaryOk ? `Consumed AID key logs · ${Object.keys(aids).length}/${Object.keys(aids).length}` : 'Unrelated AID key log rejected',
    detail: aidBoundaryOk
      ? 'Every supplied KEL controls an issuer or issuee in the credential graph.'
      : 'Enterprise mode never ignores a valid but unrelated KEL.',
    level: 'POLICY',
  };
  const rawCanonicalCode = cleanText(canonicalDecision.code, 160) || 'DENY_VERIFICATION_FAILED';
  const canonicalCode = rejectedSchemas.length > 0
    ? 'DENY_NON_OFFICIAL_SCHEMA'
    : unsupportedMessages.length > 0
      ? 'DENY_UNSUPPORTED_EVENT_TYPE'
      : rawCanonicalCode.startsWith('ALLOW') && !credentialGraphOk
        ? 'DENY_CREDENTIAL_GRAPH_INVALID'
        : rawCanonicalCode.startsWith('ALLOW') && !registryBoundaryOk
          ? 'DENY_REGISTRY_COVERAGE_INVALID'
          : rawCanonicalCode.startsWith('ALLOW') && !aidBoundaryOk
            ? 'DENY_UNCONSUMED_AID'
            : rawCanonicalCode;
  const locallyAllows = rejectedSchemas.length === 0
    && unsupportedMessages.length === 0
    && credentialGraphOk
    && registryBoundaryOk
    && aidBoundaryOk
    && reportChecks.every(check => check.ok)
    && canonicalDecision.tool_execution === true
    && canonicalCode.startsWith('ALLOW');
  // Browser verification cannot establish current witness/OOBI state. Keep the
  // production trust domain useful as a cryptographic preflight, but never let
  // this client-side service produce executable production authority.
  const backendVerificationRequired = options.trustDomain === 'production' && locallyAllows;
  const code = backendVerificationRequired
    ? 'DENY_BACKEND_VERIFICATION_REQUIRED'
    : canonicalCode;
  const toolExecution = locallyAllows && !backendVerificationRequired;

  return {
    decision: {
      code,
      toolExecution,
      leaf: typeof canonicalDecision.leaf === 'string' ? cleanText(canonicalDecision.leaf, 160) : null,
    },
    checks: [schemaBoundaryCheck, messageTypeBoundaryCheck, credentialGraphBoundaryCheck, registryBoundaryCheck, aidBoundaryCheck, ...reportChecks],
    credentials,
    sourceDigest: await digestSha256(bytes),
    root: {
      aid: root.aid,
      label: root.label,
      trustDomain: options.trustDomain,
    },
    stats: {
      bytes: bytes.byteLength,
      messages: messages.length,
      credentials: credentials.length,
      aids: Object.keys(aids).length,
      registries: Object.keys(registries).length,
      officialSchemaCredentials: acdcs.length - rejectedSchemas.length,
      rejectedSchemaCredentials: rejectedSchemas.length,
      signaturesUnverifiable: report.signaturesUnverifiable === true,
    },
    verifiedAt: new Date().toISOString(),
    limitations: [
      'Browser verification does not fetch live OOBI key state or witness receipts.',
      'Watcher-based duplicity detection is outside this local verification result.',
      'Production mode pins the configured GLEIF root AID; full governance validation remains a backend verifier responsibility.',
      'Enterprise mode rejects unconsumed bytes and unsupported CESR attachment framing.',
      'Weighted KERI signing thresholds are not implemented by the browser preflight and fail closed.',
      'TEL issuance and revocation are evaluated only from events and exact KEL seals in the supplied CESR stream; this is a point-in-time snapshot, not a live revocation query.',
    ],
  };
};

/** Load and integrity-check the repository's copy of the pinned GLEIF fixture. */
export const loadOfficialVleiFixture = async (
  fetchImpl: typeof fetch | undefined = globalThis.fetch,
): Promise<OfficialVleiFixture> => {
  if (typeof fetchImpl !== 'function') {
    throw new VleiVerificationError(
      'VLEI_FIXTURE_FETCH_UNAVAILABLE',
      'No fetch implementation is available for the official fixture.',
    );
  }

  const response = await fetchImpl(OFFICIAL_VLEI_FIXTURE.source, {
    cache: 'no-store',
    headers: { Accept: 'application/json+cesr, text/plain;q=0.9' },
  });
  if (!response.ok) {
    throw new VleiVerificationError(
      'VLEI_FIXTURE_HTTP_ERROR',
      `Official fixture request failed with HTTP ${response.status}.`,
      response.status,
    );
  }

  const { raw, bytes } = await boundedText(response);
  const sourceDigest = await digestSha256(bytes);
  if (sourceDigest !== `sha256:${OFFICIAL_VLEI_FIXTURE.sha256}`) {
    throw new VleiVerificationError(
      'VLEI_FIXTURE_INTEGRITY_ERROR',
      'The local fixture does not match its pinned SHA-256 digest.',
    );
  }

  return {
    raw,
    source: OFFICIAL_VLEI_FIXTURE.source,
    upstream: OFFICIAL_VLEI_FIXTURE.upstream,
    pinnedCommit: OFFICIAL_VLEI_FIXTURE.pinnedCommit,
    sourceDigest,
    bytes: bytes.byteLength,
  };
};
