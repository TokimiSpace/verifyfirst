import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { runEnterpriseX402Preflight } from '../api/x402-preflight';

const requirement = {
  x402Version: 2,
  accepts: [{
    scheme: 'exact',
    network: 'eip155:8453',
    asset: '0xasset',
    amount: '1000',
    payTo: '0xpayee',
  }],
};

const policy = {
  allowedNetworks: ['eip155:8453'],
  allowedAssets: ['0xasset'],
  allowedPayees: ['0xpayee'],
  maxAmount: '1000',
};

const makeReq = (
  method: string,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) => ({ method, body, headers, socket: { remoteAddress: headers['x-forwarded-for'] ?? '127.0.0.1' } });

const makeRes = () => {
  const res: any = {
    statusCode: 200,
    body: null,
    ended: false,
    headers: {} as Record<string, unknown>,
    status(code: number) { res.statusCode = code; return res; },
    json(value: unknown) { res.body = value; return res; },
    end() { res.ended = true; return res; },
    setHeader(name: string, value: unknown) { res.headers[name] = value; },
  };
  return res;
};

afterEach(() => {
  delete process.env.X402_ALLOWED_ORIGIN;
  delete process.env.BOT_API_KEY;
});

describe('enterprise x402 preflight', () => {
  it('uses IFF without fetching or retaining private URL parts', async () => {
    const verifyRequirement = vi.fn(async () => ({
      provider: 'ifandonlyif.io' as const,
      evidenceBaseUrl: 'https://ifandonlyif.io',
      evidenceSource: 'IFF_PUBLIC_API' as const,
      status: 'VERIFIED' as const,
      verdict: 'consistent' as const,
      inclusionAvailable: true,
    }));

    const result = await runEnterpriseX402Preflight({
      endpointUrl: 'https://merchant.example/price?token=private#secret',
      paymentRequired: requirement,
      policy,
    }, { verifyRequirement });

    expect(verifyRequirement).toHaveBeenCalledWith('https://merchant.example/price', requirement);
    expect(result.endpoint).toBe('https://merchant.example/price');
    expect(result.source.merchantEndpointFetched).toBe(false);
    expect(result.source.externalEvidence).toBe('IFF_PUBLIC_API');
    expect(result.policy.decision).toBe('READY_FOR_HUMAN_APPROVAL');
    expect(result.execution).toEqual({ status: 'NOT_EXECUTED', payment: 'NOT_EXECUTED', selectedOption: 'NOT_BOUND' });
    expect(result.verifier).toEqual({
      policyVersion: 'verifyfirst.x402-enterprise-policy.v1',
      iffSdk: '@ifandonlyif/x402-preflight@0.2.0',
    });
  });

  it('does not mislabel a configured IFF-compatible service as the public API', async () => {
    const result = await runEnterpriseX402Preflight({
      endpointUrl: 'https://merchant.example/price', paymentRequired: requirement, policy,
    }, { verifyRequirement: async () => ({
      provider: 'ifandonlyif.io',
      evidenceBaseUrl: 'https://iff.internal.example',
      evidenceSource: 'IFF_CUSTOM_API',
      status: 'VERIFIED',
      verdict: 'consistent',
      inclusionAvailable: false,
    }) });

    expect(result.source.externalEvidence).toBe('IFF_CUSTOM_API');
    expect(result.iff?.evidenceBaseUrl).toBe('https://iff.internal.example');
  });

  it('records unavailable IFF evidence without converting it into a pass', async () => {
    const result = await runEnterpriseX402Preflight({
      endpointUrl: 'https://merchant.example/price', paymentRequired: requirement, policy,
    }, { verifyRequirement: async () => ({
      provider: 'ifandonlyif.io',
      evidenceBaseUrl: 'https://ifandonlyif.io',
      evidenceSource: 'UNAVAILABLE',
      status: 'UNAVAILABLE',
      inclusionAvailable: false,
      errorCode: 'IFF_TIMEOUT',
    }) });

    expect(result.source.externalEvidence).toBe('IFF_UNAVAILABLE');
    expect(result.policy.decision).toBe('HOLD_IFF_UNAVAILABLE');
  });

  it('does not call IFF when no option matches enterprise policy', async () => {
    const verifyRequirement = vi.fn();
    const result = await runEnterpriseX402Preflight({
      endpointUrl: 'https://merchant.example/price',
      paymentRequired: requirement,
      policy: { ...policy, maxAmount: '999' },
    }, { verifyRequirement });

    expect(verifyRequirement).not.toHaveBeenCalled();
    expect(result.iff).toBeNull();
    expect(result.policy.decision).toBe('HOLD_POLICY_MISMATCH');
  });

  it('fails closed for non-HTTPS endpoints', async () => {
    await expect(runEnterpriseX402Preflight({
      endpointUrl: 'http://merchant.example/price', paymentRequired: requirement, policy,
    })).rejects.toThrow('INVALID_ENDPOINT_URL');
  });

  it('fails closed for malformed requirements', async () => {
    await expect(runEnterpriseX402Preflight({
      endpointUrl: 'https://merchant.example/price', paymentRequired: { x402Version: 1 }, policy,
    })).rejects.toMatchObject({ code: 'INVALID_PAYMENT_REQUIRED' });
  });

  it('fails closed when enterprise policy is missing', async () => {
    await expect(runEnterpriseX402Preflight({
      endpointUrl: 'https://merchant.example/price', paymentRequired: requirement, policy: undefined as never,
    })).rejects.toMatchObject({ code: 'INVALID_X402_POLICY' });
  });

  it('allows same-origin OPTIONS without using a wildcard', async () => {
    const res = makeRes();
    await handler(makeReq('OPTIONS', {}, {
      origin: 'https://verify1st.tw',
      host: 'verify1st.tw',
      'x-forwarded-proto': 'https',
    }), res);

    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://verify1st.tw');
    expect(res.headers['Access-Control-Allow-Origin']).not.toBe('*');
    expect(res.headers.Vary).toBe('Origin');
  });

  it('allows one explicitly configured HTTPS origin', async () => {
    process.env.X402_ALLOWED_ORIGIN = 'https://payments.example';
    const res = makeRes();
    await handler(makeReq('OPTIONS', {}, {
      origin: 'https://payments.example',
      host: 'verify1st.tw',
      'x-forwarded-proto': 'https',
    }), res);

    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://payments.example');
  });

  it('rejects an unconfigured cross-origin request', async () => {
    const res = makeRes();
    await handler(makeReq('POST', {}, {
      origin: 'https://attacker.example',
      host: 'verify1st.tw',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': '198.51.100.201',
    }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'ORIGIN_NOT_ALLOWED' });
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('limits each hashed IP to 30 POST requests per warm-instance minute', async () => {
    const headers = { 'x-forwarded-for': '198.51.100.202' };
    for (let index = 0; index < 30; index += 1) {
      const allowed = makeRes();
      await handler(makeReq('POST', {}, headers), allowed);
      expect(allowed.statusCode).toBe(400);
    }

    const limited = makeRes();
    await handler(makeReq('POST', {}, headers), limited);
    expect(limited.statusCode).toBe(429);
    expect(limited.body).toMatchObject({ error: 'RATE_LIMITED', scope: 'WARM_INSTANCE_BEST_EFFORT' });
    expect(Number(limited.headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('allows a trusted server caller with the constant-time bot-key bypass', async () => {
    process.env.BOT_API_KEY = 'test-server-key-with-sufficient-entropy';
    const headers = { 'x-forwarded-for': '198.51.100.203', 'x-bot-key': process.env.BOT_API_KEY };
    for (let index = 0; index < 31; index += 1) {
      const res = makeRes();
      await handler(makeReq('POST', {}, headers), res);
      expect(res.statusCode).toBe(400);
    }
  });
});
