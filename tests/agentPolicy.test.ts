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
  allowedTargets: ['https://recruit.example'],
  allowedActions: ['OBSERVE_URL', 'CHECK_IDENTITY', 'READ_PUBLIC_DATA'],
  confirmationActions: ['SUBMIT_PERSONAL_DATA'],
  deniedActions: ['LOGIN', 'PAYMENT', 'REQUEST_OTP', 'DOWNLOAD_APP'],
};

const request = (action: AgentActionRequest['action']): AgentActionRequest => ({
  id: `request_${action}`,
  grantId: grant.id,
  action,
  target: 'https://recruit.example',
  purpose: grant.agentPurpose,
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

  it('fails closed when the target is outside the mandate', () => {
    const outside = { ...request('OBSERVE_URL'), target: 'https://attacker.example' };
    expect(evaluateAgentAction(grant, outside, now).reasonCode).toBe('TARGET_NOT_GRANTED');
  });

  it('fails closed when the purpose differs from the mandate', () => {
    const outside = { ...request('OBSERVE_URL'), purpose: 'Transfer company funds' };
    expect(evaluateAgentAction(grant, outside, now).reasonCode).toBe('PURPOSE_MISMATCH');
  });

  it('never auto-allows payment even if a malformed grant puts it in ALLOW', () => {
    const malformed = { ...grant, allowedActions: [...grant.allowedActions, 'PAYMENT' as const], deniedActions: grant.deniedActions.filter(action => action !== 'PAYMENT') };
    expect(evaluateAgentAction(malformed, request('PAYMENT'), now).reasonCode).toBe('PAYMENT_EXECUTION_DISABLED');
  });

  it('caps privileged actions at human confirmation', () => {
    const malformed = { ...grant, allowedActions: [...grant.allowedActions, 'LOGIN' as const], deniedActions: grant.deniedActions.filter(action => action !== 'LOGIN') };
    expect(evaluateAgentAction(malformed, request('LOGIN'), now).decision).toBe('REQUIRE_CONFIRMATION');
  });

  it('rejects values or secrets disguised as data field names', () => {
    const unsafe = { ...request('SUBMIT_PERSONAL_DATA'), dataFields: ['phone=0912345678'] };
    expect(evaluateAgentAction(grant, unsafe, now).reasonCode).toBe('INVALID_DATA_FIELD_NAMES');
  });
});
