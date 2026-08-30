import { describe, expect, it } from 'vitest';
import type { AgentActionRequest, AgentGrant } from '../types';
import { createAgentEvidencePacket, verifyAgentEvidencePacket } from '../services/agentEvidence';
import { evaluateAgentAction, resolveAgentConfirmation } from '../services/agentPolicy';

const grant: AgentGrant = {
  id: 'grant_real_test', agentId: 'agent_01', agentName: 'Test Agent', agentPurpose: 'Read public records', userName: 'Owner',
  status: 'ACTIVE', issuedAt: '2026-08-30T00:00:00.000Z', expiresAt: '2026-08-31T00:00:00.000Z',
  allowedTargets: ['*.example.com'], allowedActions: ['OBSERVE_URL'], confirmationActions: ['SUBMIT_PERSONAL_DATA'],
  deniedActions: ['LOGIN', 'PAYMENT', 'REQUEST_OTP', 'DOWNLOAD_APP', 'CHECK_IDENTITY', 'READ_PUBLIC_DATA'],
};

const request: AgentActionRequest = {
  id: 'req_01', grantId: grant.id, action: 'SUBMIT_PERSONAL_DATA', target: 'https://api.example.com/form',
  purpose: 'Read public records', dataFields: ['legal_name'],
};

describe('Agent evidence packets', () => {
  it('seals a policy result and detects tampering', async () => {
    const result = evaluateAgentAction(grant, request, new Date('2026-08-30T01:00:00.000Z'));
    const packet = await createAgentEvidencePacket(grant, request, result);
    expect(packet.id).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(await verifyAgentEvidencePacket(packet)).toBe(true);
    expect(await verifyAgentEvidencePacket({ ...packet, request: { ...packet.request, target: 'https://evil.example.net' } })).toBe(false);
  });

  it('links a human confirmation to the preceding evidence packet', async () => {
    const firstResult = evaluateAgentAction(grant, request, new Date('2026-08-30T01:00:00.000Z'));
    const first = await createAgentEvidencePacket(grant, request, firstResult);
    const approved = resolveAgentConfirmation(grant, request, true, 'Owner', new Date('2026-08-30T01:01:00.000Z'));
    const second = await createAgentEvidencePacket(grant, request, approved, first.id);
    expect(second.result.reasonCode).toBe('HUMAN_APPROVED');
    expect(second.parentEvidenceId).toBe(first.id);
    expect(await verifyAgentEvidencePacket(second)).toBe(true);
  });

  it('redacts invalid field entries before creating evidence', async () => {
    const unsafeRequest = { ...request, dataFields: ['phone=0912345678'] };
    const result = evaluateAgentAction(grant, unsafeRequest, new Date('2026-08-30T01:00:00.000Z'));
    const packet = await createAgentEvidencePacket(grant, unsafeRequest, result);
    expect(packet.request.dataFields).toEqual(['[REDACTED_INVALID_FIELD_NAME]']);
    expect(JSON.stringify(packet)).not.toContain('0912345678');
  });
});
