import type { AgentActionRequest, AgentGrant } from '../types.js';
import { createAgentEvidencePacket } from '../services/agentEvidence.js';
import { evaluateAgentAction, resolveAgentConfirmation } from '../services/agentPolicy.js';

const ACTIONS = new Set([
  'OBSERVE_URL', 'CHECK_IDENTITY', 'READ_PUBLIC_DATA', 'SUBMIT_PERSONAL_DATA',
  'LOGIN', 'PAYMENT', 'REQUEST_OTP', 'DOWNLOAD_APP',
]);

const isStringArray = (value: unknown, maxItems = 32): value is string[] =>
  Array.isArray(value) && value.length <= maxItems && value.every(item => typeof item === 'string' && item.length <= 300);
const isDataFieldNames = (value: unknown): value is string[] =>
  isStringArray(value) && value.every(item => /^[a-z][a-z0-9_.-]{0,63}$/i.test(item));

const isGrant = (value: unknown): value is AgentGrant => {
  if (!value || typeof value !== 'object') return false;
  const grant = value as Partial<AgentGrant>;
  return [grant.id, grant.agentId, grant.agentName, grant.agentPurpose, grant.userName, grant.issuedAt, grant.expiresAt]
    .every(item => typeof item === 'string' && item.length > 0 && item.length <= 500)
    && ['ACTIVE', 'EXPIRED', 'REVOKED'].includes(String(grant.status))
    && isStringArray(grant.allowedTargets)
    && isStringArray(grant.allowedActions)
    && isStringArray(grant.confirmationActions)
    && isStringArray(grant.deniedActions)
    && [...grant.allowedActions, ...grant.confirmationActions, ...grant.deniedActions].every(action => ACTIONS.has(action));
};

const isRequest = (value: unknown): value is AgentActionRequest => {
  if (!value || typeof value !== 'object') return false;
  const request = value as Partial<AgentActionRequest>;
  return [request.id, request.grantId, request.target, request.purpose]
    .every(item => typeof item === 'string' && item.length > 0 && item.length <= 2000)
    && ACTIONS.has(String(request.action))
    && (request.dataFields === undefined || isDataFieldNames(request.dataFields));
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end?.();
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  const serialized = JSON.stringify(req.body ?? {});
  if (serialized.length > 32_000) return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });

  const { grant, request, humanDecision } = req.body ?? {};
  if (!isGrant(grant) || !isRequest(request)) {
    return res.status(400).json({ error: 'INVALID_AGENT_POLICY_REQUEST' });
  }

  const initial = evaluateAgentAction(grant, request);
  const hasHumanDecision = humanDecision && typeof humanDecision.approved === 'boolean';
  const actor = typeof humanDecision?.actor === 'string' && humanDecision.actor.trim()
    ? humanDecision.actor.trim().slice(0, 200)
    : grant.userName;
  const result = hasHumanDecision
    ? resolveAgentConfirmation(grant, request, humanDecision.approved, actor)
    : initial;
  const parentEvidenceId = typeof humanDecision?.parentEvidenceId === 'string'
    ? humanDecision.parentEvidenceId.slice(0, 100)
    : undefined;
  const evidence = await createAgentEvidencePacket(grant, request, result, parentEvidenceId);

  return res.status(200).json({
    result,
    evidence,
    execution: { status: 'NOT_EXECUTED', boundary: 'POLICY_DECISION_ONLY' },
    trust: {
      authorization: 'CALLER_SUPPLIED_SANDBOX_GRANT',
      notice: 'Cryptographic vLEI or mandate verification must be completed before using this decision in production.',
    },
  });
}
