export interface EvidenceIntegrity {
  kind: 'SELF_CHECK_ONLY';
  algorithm: 'SHA-256';
  digest: string;
  canonicalization: 'verifyfirst.sorted-json.v1';
  authenticity: 'UNSIGNED';
  provenance: 'VERIFYFIRST_BROWSER_GENERATED';
}

export type EvidenceEnvelope<T extends Record<string, unknown>> = T & {
  id: `sha256:${string}`;
  integrity: EvidenceIntegrity;
};

export const stableStringifyEvidence = (value: unknown): string => {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringifyEvidence).join(',')}]`;

  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .filter(key => object[key] !== undefined)
    .map(key => `${JSON.stringify(key)}:${stableStringifyEvidence(object[key])}`)
    .join(',')}}`;
};

export const sha256EvidenceBody = async (value: unknown): Promise<string> => {
  if (!globalThis.crypto?.subtle) throw new Error('WEBCRYPTO_UNAVAILABLE');
  const bytes = new TextEncoder().encode(stableStringifyEvidence(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const sealEvidenceBody = async <T extends Record<string, unknown>>(
  body: T,
): Promise<EvidenceEnvelope<T>> => {
  const digest = await sha256EvidenceBody(body);
  return {
    ...body,
    id: `sha256:${digest}`,
    integrity: {
      kind: 'SELF_CHECK_ONLY',
      algorithm: 'SHA-256',
      digest,
      canonicalization: 'verifyfirst.sorted-json.v1',
      authenticity: 'UNSIGNED',
      provenance: 'VERIFYFIRST_BROWSER_GENERATED',
    },
  };
};

export const verifyEvidenceEnvelope = async (
  packet: Record<string, unknown>,
): Promise<boolean> => {
  const { id, integrity, ...body } = packet;
  if (
    typeof id !== 'string'
    || !integrity
    || typeof integrity !== 'object'
    || Array.isArray(integrity)
  ) return false;
  const typedIntegrity = integrity as Partial<EvidenceIntegrity>;
  if (
    typedIntegrity.kind !== 'SELF_CHECK_ONLY'
    || typedIntegrity.algorithm !== 'SHA-256'
    || typedIntegrity.canonicalization !== 'verifyfirst.sorted-json.v1'
    || typedIntegrity.authenticity !== 'UNSIGNED'
    || typedIntegrity.provenance !== 'VERIFYFIRST_BROWSER_GENERATED'
    || typeof typedIntegrity.digest !== 'string'
  ) return false;
  const digest = await sha256EvidenceBody(body);
  return id === `sha256:${digest}` && typedIntegrity.digest === digest;
};
