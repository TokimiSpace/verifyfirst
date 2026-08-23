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

/**
 * Deterministic policy gate for Agent actions. This deliberately runs before
 * any model call: AI may describe risk, but it cannot override authorization.
 */
export const evaluateAgentAction = (
  grant: AgentGrant,
  request: AgentActionRequest,
  now = new Date(),
): AgentPolicyResult => {
  if (request.grantId !== grant.id) {
    return result('DENY', 'GRANT_MISMATCH', 'This action is not covered by the supplied authorization.', 'grant.id == request.grantId', now);
  }

  if (grant.status === 'REVOKED') {
    return result('DENY', 'GRANT_REVOKED', 'The user has revoked this Agent authorization.', 'grant.status != REVOKED', now);
  }

  if (grant.status === 'EXPIRED' || Date.parse(grant.expiresAt) <= now.getTime()) {
    return result('DENY', 'GRANT_EXPIRED', 'This Agent authorization has expired.', 'now < grant.expiresAt', now);
  }

  if (grant.deniedActions.includes(request.action)) {
    return result('DENY', 'ACTION_FORBIDDEN', 'This action is outside the Agent boundary and cannot be approved.', `deny:${request.action}`, now);
  }

  if (grant.confirmationActions.includes(request.action)) {
    return result('REQUIRE_CONFIRMATION', 'HUMAN_REQUIRED', 'This action can expose personal data and needs a human decision.', `confirm:${request.action}`, now);
  }

  if (grant.allowedActions.includes(request.action)) {
    return result('ALLOW', 'WITHIN_SCOPE', 'The action is read-only and within the active authorization.', `allow:${request.action}`, now);
  }

  return result('DENY', 'SCOPE_NOT_GRANTED', 'No permission was granted for this action.', 'default:deny', now);
};
