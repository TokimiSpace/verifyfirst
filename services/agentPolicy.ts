import {
  AgentActionRequest,
  AgentGrant,
  AgentPolicyResult,
} from '../types';

const result = (
  decision: AgentPolicyResult['decision'],
  reasonCode: string,
  reason: string,
  matchedRule: string,
  now: Date,
): AgentPolicyResult => ({
  decision,
  reasonCode,
  reason,
  matchedRule,
  evaluatedAt: now.toISOString(),
});

const normalizeTarget = (target: string): { raw: string; hostname?: string; origin?: string } => {
  const raw = target.trim().toLowerCase();
  try {
    const url = new URL(target);
    return { raw, hostname: url.hostname.toLowerCase(), origin: url.origin.toLowerCase() };
  } catch {
    return { raw };
  }
};

const targetMatches = (target: string, pattern: string): boolean => {
  const normalized = normalizeTarget(target);
  const rule = pattern.trim().toLowerCase();
  if (!rule) return false;
  if (rule === '*') return true;
  if (rule.startsWith('*.') && normalized.hostname) {
    const suffix = rule.slice(1);
    return normalized.hostname.endsWith(suffix) && normalized.hostname !== suffix.slice(1);
  }
  if (rule.includes('://')) return normalized.origin === rule.replace(/\/$/, '');
  return normalized.raw === rule || normalized.hostname === rule;
};

const HUMAN_ONLY_ACTIONS = new Set([
  'SUBMIT_PERSONAL_DATA',
  'LOGIN',
  'REQUEST_OTP',
  'DOWNLOAD_APP',
]);
const DATA_FIELD_NAME = /^[a-z][a-z0-9_.-]{0,63}$/i;

/**
 * Deterministic policy gate for Agent actions. This deliberately runs before
 * any model call: AI may describe risk, but it cannot override authorization.
 */
export const evaluateAgentAction = (
  grant: AgentGrant,
  request: AgentActionRequest,
  now = new Date(),
): AgentPolicyResult => {
  if (!request.id.trim() || !request.target.trim() || !request.purpose.trim()) {
    return result('DENY', 'INVALID_REQUEST', 'The request id, target, and purpose are required.', 'request.required_fields', now);
  }

  if (request.dataFields?.some(field => !DATA_FIELD_NAME.test(field))) {
    return result('DENY', 'INVALID_DATA_FIELD_NAMES', 'Only data field names may be supplied; values and secrets are not accepted.', 'request.dataFields names-only', now);
  }

  if (request.grantId !== grant.id) {
    return result('DENY', 'GRANT_MISMATCH', 'This action is not covered by the supplied authorization.', 'grant.id == request.grantId', now);
  }

  if (grant.status === 'REVOKED') {
    return result('DENY', 'GRANT_REVOKED', 'The user has revoked this Agent authorization.', 'grant.status != REVOKED', now);
  }

  if (grant.status === 'EXPIRED' || Date.parse(grant.expiresAt) <= now.getTime()) {
    return result('DENY', 'GRANT_EXPIRED', 'This Agent authorization has expired.', 'now < grant.expiresAt', now);
  }

  if (!Number.isFinite(Date.parse(grant.expiresAt))) {
    return result('DENY', 'GRANT_INVALID', 'The authorization has an invalid expiration time.', 'grant.expiresAt is ISO-8601', now);
  }

  if (request.purpose.trim().toLowerCase() !== grant.agentPurpose.trim().toLowerCase()) {
    return result('DENY', 'PURPOSE_MISMATCH', 'The request purpose does not match the short-lived mandate.', 'request.purpose == grant.agentPurpose', now);
  }

  if (grant.allowedTargets.length === 0 || !grant.allowedTargets.some(pattern => targetMatches(request.target, pattern))) {
    return result('DENY', 'TARGET_NOT_GRANTED', 'The requested target is outside the authorization boundary.', 'grant.allowedTargets', now);
  }

  if (grant.deniedActions.includes(request.action)) {
    return result('DENY', 'ACTION_FORBIDDEN', 'This action is outside the Agent boundary and cannot be approved.', `deny:${request.action}`, now);
  }


  if (request.action === 'PAYMENT') {
    return result('DENY', 'PAYMENT_EXECUTION_DISABLED', 'This sandbox can inspect x402 payment evidence but never signs or executes payment.', 'hard-boundary:no-payment-execution', now);
  }

  if (HUMAN_ONLY_ACTIONS.has(request.action)) {
    return result('REQUIRE_CONFIRMATION', 'HUMAN_REQUIRED', 'This privileged action cannot run automatically and needs a human decision.', `hard-boundary:human:${request.action}`, now);
  }

  if (grant.confirmationActions.includes(request.action)) {
    return result('REQUIRE_CONFIRMATION', 'HUMAN_REQUIRED', 'This action can expose personal data and needs a human decision.', `confirm:${request.action}`, now);
  }

  if (grant.allowedActions.includes(request.action)) {
    return result('ALLOW', 'WITHIN_SCOPE', 'The action is read-only and within the active authorization.', `allow:${request.action}`, now);
  }

  return result('DENY', 'SCOPE_NOT_GRANTED', 'No permission was granted for this action.', 'default:deny', now);
};

export const resolveAgentConfirmation = (
  grant: AgentGrant,
  request: AgentActionRequest,
  approved: boolean,
  actor: string,
  now = new Date(),
): AgentPolicyResult => {
  const initial = evaluateAgentAction(grant, request, now);
  if (initial.decision !== 'REQUIRE_CONFIRMATION') return initial;

  return approved
    ? result('ALLOW', 'HUMAN_APPROVED', `Approved once by ${actor}.`, `human:approve_once:${request.action}`, now)
    : result('DENY', 'USER_DENIED', `Denied by ${actor}.`, `human:deny:${request.action}`, now);
};
