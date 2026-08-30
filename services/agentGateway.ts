import type {
  AgentActionRequest,
  AgentEvidencePacket,
  AgentGrant,
  AgentPolicyResult,
} from '../types';
import { createAgentEvidencePacket } from './agentEvidence';
import { evaluateAgentAction, resolveAgentConfirmation } from './agentPolicy';

export interface AgentGatewayDecision {
  result: AgentPolicyResult;
  evidence: AgentEvidencePacket;
  source: 'SERVER_GATE' | 'LOCAL_GATE' | 'FAIL_CLOSED';
}

interface HumanDecision {
  approved: boolean;
  actor: string;
  parentEvidenceId?: string;
}

export const submitAgentAction = async (
  grant: AgentGrant,
  request: AgentActionRequest,
  humanDecision?: HumanDecision,
): Promise<AgentGatewayDecision> => {
  try {
    const response = await fetch('/api/agent-policy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant, request, humanDecision }),
    });
    if (response.ok) {
      const data = await response.json();
      if (data?.result?.decision && data?.evidence?.integrity?.digest) {
        return { result: data.result, evidence: data.evidence, source: 'SERVER_GATE' };
      }
    }
    throw new Error(`Agent policy gate returned HTTP ${response.status}`);
  } catch {
    const isLocalDevelopment = typeof window !== 'undefined'
      && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
    if (!isLocalDevelopment) {
      const result: AgentPolicyResult = {
        decision: 'DENY',
        reasonCode: 'GATE_UNAVAILABLE',
        reason: 'The server policy gate is unavailable, so the request failed closed.',
        matchedRule: 'fail-closed:server-gate',
        evaluatedAt: new Date().toISOString(),
      };
      const evidence = await createAgentEvidencePacket(grant, request, result, humanDecision?.parentEvidenceId);
      return { result, evidence, source: 'FAIL_CLOSED' };
    }

    // Local Vite does not expose Vercel functions. Development uses the exact
    // same deterministic policy locally; production failures never fall back.
  }

  const result = humanDecision
    ? resolveAgentConfirmation(grant, request, humanDecision.approved, humanDecision.actor)
    : evaluateAgentAction(grant, request);
  const evidence = await createAgentEvidencePacket(grant, request, result, humanDecision?.parentEvidenceId);
  return { result, evidence, source: 'LOCAL_GATE' };
};
