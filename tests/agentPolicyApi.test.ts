import { describe, expect, it } from 'vitest';
import handler from '../api/agent-policy';

const grant = {
  id: 'grant_api', agentId: 'agent_api', agentName: 'API Agent', agentPurpose: 'Inspect a URL', userName: 'Owner',
  status: 'ACTIVE', issuedAt: '2026-08-30T00:00:00.000Z', expiresAt: '2099-08-31T00:00:00.000Z',
  allowedTargets: ['https://example.com'], allowedActions: ['OBSERVE_URL'], confirmationActions: ['SUBMIT_PERSONAL_DATA'],
  deniedActions: ['LOGIN', 'PAYMENT', 'REQUEST_OTP', 'DOWNLOAD_APP', 'CHECK_IDENTITY', 'READ_PUBLIC_DATA'],
};

const makeRes = () => {
  const res: any = {
    statusCode: 200, body: undefined, headers: {},
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res.body = body; return res; },
    setHeader(key: string, value: string) { res.headers[key] = value; },
    end() { return res; },
  };
  return res;
};

describe('/api/agent-policy', () => {
  it('returns a real deterministic decision and sealed evidence', async () => {
    const res = makeRes();
    await handler({ method: 'POST', body: { grant, request: { id: 'req', grantId: grant.id, action: 'OBSERVE_URL', target: 'https://example.com/path', purpose: 'Inspect a URL' } } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.result.decision).toBe('ALLOW');
    expect(res.body.evidence.id).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(res.body.execution.status).toBe('NOT_EXECUTED');
    expect(res.body.trust.authorization).toBe('CALLER_SUPPLIED_SANDBOX_GRANT');
  });

  it('rejects malformed policy input', async () => {
    const res = makeRes();
    await handler({ method: 'POST', body: { grant: {}, request: {} } }, res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects field values before they can enter evidence', async () => {
    const res = makeRes();
    await handler({ method: 'POST', body: { grant, request: { id: 'req', grantId: grant.id, action: 'OBSERVE_URL', target: 'https://example.com', purpose: 'Inspect a URL', dataFields: ['token=secret-value'] } } }, res);
    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('secret-value');
  });
});
