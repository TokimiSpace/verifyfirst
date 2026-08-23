import { describe, expect, it } from 'vitest';
import { AgentActionRequest, AgentGrant } from '../types';
import { evaluateAgentAction } from '../services/agentPolicy';

const grant: AgentGrant = {
  id: 'grant_demo',
  agentId: 'agent_worker_assist',
  agentName: '安心工作 Agent',
  agentPurpose: '協助查驗雇主與招募資訊',
  userName: 'Nguyễn An',
  status: 'ACTIVE',
  issuedAt: '2026-08-24T08:00:00.000Z',
  expiresAt: '2026-08-25T08:00:00.000Z',
  allowedActions: ['OBSERVE_URL', 'CHECK_IDENTITY', 'READ_PUBLIC_DATA'],
  confirmationActions: ['SUBMIT_PERSONAL_DATA'],
  deniedActions: ['LOGIN', 'PAYMENT', 'REQUEST_OTP', 'DOWNLOAD_APP'],
};

const request = (action: AgentActionRequest['action']): AgentActionRequest => ({
  id: `request_${action}`,
  grantId: grant.id,
  action,
  target: 'https://recruit.example',
  purpose: '查驗移工徵才資訊',
});

const now = new Date('2026-08-24T09:00:00.000Z');

describe('evaluateAgentAction', () => {
  it('allows read-only sandbox observation', () => {
    expect(evaluateAgentAction(grant, request('OBSERVE_URL'), now).decision).toBe('ALLOW');
  });

  it('requires a human before personal data is submitted', () => {
    expect(evaluateAgentAction(grant, request('SUBMIT_PERSONAL_DATA'), now).decision).toBe('REQUIRE_CONFIRMATION');
  });

  it.each(['LOGIN', 'PAYMENT', 'REQUEST_OTP', 'DOWNLOAD_APP'] as const)('blocks %s regardless of model output', (action) => {
    expect(evaluateAgentAction(grant, request(action), now).decision).toBe('DENY');
  });

  it('fails immediately after authorization is revoked', () => {
    const revoked = { ...grant, status: 'REVOKED' as const };
    expect(evaluateAgentAction(revoked, request('OBSERVE_URL'), now).reasonCode).toBe('GRANT_REVOKED');
  });

  it('fails when authorization has expired', () => {
    expect(evaluateAgentAction(grant, request('OBSERVE_URL'), new Date('2026-08-26T00:00:00.000Z')).reasonCode).toBe('GRANT_EXPIRED');
  });
});
