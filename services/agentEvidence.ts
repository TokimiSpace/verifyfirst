import {
  AgentActionRequest,
  AgentEvidencePacket,
  AgentGrant,
  AgentPolicyResult,
} from '../types';

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .filter(key => object[key] !== undefined)
    .map(key => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
    .join(',')}}`;
};

const sha256 = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Creates a portable, tamper-evident record of a sandbox policy decision.
 * The packet deliberately contains field names only; callers must never place
 * passwords, tokens, OTPs, or personal-data values in AgentActionRequest.
 */
export const createAgentEvidencePacket = async (
  grant: AgentGrant,
  request: AgentActionRequest,
  result: AgentPolicyResult,
  parentEvidenceId?: string,
): Promise<AgentEvidencePacket> => {
  const safeRequest: AgentActionRequest = request.dataFields
    ? {
      ...request,
      dataFields: request.dataFields.map(field => /^[a-z][a-z0-9_.-]{0,63}$/i.test(field) ? field : '[REDACTED_INVALID_FIELD_NAME]'),
    }
    : request;
  const body = {
    schema: 'verifyfirst.agent-decision.v1' as const,
    createdAt: result.evaluatedAt,
    policyVersion: 'verifyfirst.sandbox-policy.v1' as const,
    grant,
    request: safeRequest,
    result,
    ...(parentEvidenceId ? { parentEvidenceId } : {}),
  };
  const digest = await sha256(stableStringify(body));

  return {
    ...body,
    id: `sha256:${digest}`,
    integrity: { algorithm: 'SHA-256', digest },
  };
};

export const verifyAgentEvidencePacket = async (packet: AgentEvidencePacket): Promise<boolean> => {
  const { id: _id, integrity: _integrity, ...body } = packet;
  const digest = await sha256(stableStringify(body));
  return packet.id === `sha256:${digest}` && packet.integrity.digest === digest;
};
