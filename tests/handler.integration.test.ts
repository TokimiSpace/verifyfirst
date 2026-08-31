import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @google/genai BEFORE importing the handler, so the handler picks up the mock.
const mockGenerateContent = vi.fn();
const { mockIffVerify } = vi.hoisted(() => ({ mockIffVerify: vi.fn() }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
  },
}));

vi.mock('@ifandonlyif/x402-preflight', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ifandonlyif/x402-preflight')>();
  return { ...actual, verify: mockIffVerify };
});

// Mock DNS so the SSRF resolved-IP check never makes a real lookup. Default:
// resolution "fails", so resolvesToPrivateIP returns false and the literal
// string guard is what does the blocking in these tests.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn().mockRejectedValue(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' })),
}));

// Mock global fetch so we don't hit RDAP/DNS/VT/Cofacts during tests.
// Each call returns a benign "empty" response so fact-gathering produces no data.
beforeEach(() => {
  mockGenerateContent.mockReset();
  mockIffVerify.mockReset();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({}), { status: 200 })
  ));
  process.env.GEMINI_API_KEY = 'test-key';
  delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  delete process.env.MEMORY_CACHE_MAX_ENTRIES;
});

// Minimal res mock that captures status and JSON payload.
const makeRes = () => {
  const res: any = {
    statusCode: 200,
    jsonBody: null,
    headers: {} as Record<string, unknown>,
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res.jsonBody = body; return res; },
    setHeader(k: string, v: unknown) { res.headers[k] = v; },
  };
  return res;
};

// Each test that reaches the rate-limited path consumes budget for its IP.
// Pass a distinct `ip` to isolate a test from the shared 127.0.0.1 bucket.
const makeReq = (body: Record<string, unknown>, ip = '127.0.0.1') => ({
  method: 'POST',
  headers: { 'x-forwarded-for': ip },
  body,
});

describe('POST /api/analyze — error classification', () => {
  it('returns errorCode=LLM_QUOTA / status=503 when Gemini throws a 429', async () => {
    const { default: handler } = await import('../api/analyze');

    mockGenerateContent.mockRejectedValueOnce(
      Object.assign(new Error('Too Many Requests'), { status: 429 })
    );

    const res = makeRes();
    await handler(
      makeReq({ input: 'guaranteed 30% monthly returns', inputType: 'SMS_TEXT', language: 'en' }),
      res
    );

    expect(res.statusCode).toBe(503);
    expect(res.jsonBody).toMatchObject({
      errorCode: 'LLM_QUOTA',
      retryAfter: '1 hour',
    });
    // Plan: L4 when Gemini fails and side services are OK
    expect(res.jsonBody.degradation?.level).toBe('L4');
  });

  it('returns errorCode=LLM_FAILED when Gemini throws 401', async () => {
    const { default: handler } = await import('../api/analyze');

    mockGenerateContent.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 })
    );

    const res = makeRes();
    await handler(
      makeReq({ input: 'hi there', inputType: 'SMS_TEXT', language: 'en' }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.jsonBody.errorCode).toBe('LLM_FAILED');
  });

  it('does NOT misclassify a non-quota error that has "429" in the stack trace', async () => {
    const { default: handler } = await import('../api/analyze');

    // This is the exact regression the original bug exhibited —
    // an unrelated error whose message happened to contain "429".
    mockGenerateContent.mockRejectedValueOnce(
      new Error('at Line 4299: JSON.parse failed')
    );

    const res = makeRes();
    await handler(
      makeReq({ input: 'hi', inputType: 'SMS_TEXT', language: 'en' }),
      res
    );

    expect(res.jsonBody.errorCode).not.toBe('LLM_QUOTA');
    expect(res.jsonBody.errorCode).toBe('SERVER_ERROR');
  });

  it('returns 400 with errorCode=INVALID_INPUT when body is missing', async () => {
    const { default: handler } = await import('../api/analyze');

    const res = makeRes();
    await handler(
      makeReq({ input: '', inputType: 'SMS_TEXT', language: 'en' }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody.errorCode).toBe('INVALID_INPUT');
  });
});

describe('POST /api/analyze — example short-circuit', () => {
  it('returns canned response for a known example chip input without calling Gemini', async () => {
    const { default: handler } = await import('../api/analyze');

    const res = makeRes();
    await handler(
      makeReq({
        input: 'https://bit.ly/tw-sale-event',
        inputType: 'URL',
        language: 'en',
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.source).toBe('example');
    expect(res.jsonBody.scamProbability).toBeGreaterThan(0);
    expect(res.jsonBody.conclusion).toBeTruthy();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('returns localized canned response (zh-TW) for a known SMS_TEXT sample', async () => {
    const { default: handler } = await import('../api/analyze');

    const res = makeRes();
    await handler(
      makeReq({
        input: '您的包裹無法投遞，請點擊更新地址：https://post-tw-delivery.net/verify',
        inputType: 'SMS_TEXT',
        language: 'zh-TW',
      }),
      res
    );

    expect(res.jsonBody.source).toBe('example');
    expect(res.jsonBody.conclusion).toMatch(/包裹|釣魚|詐騙/);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('does NOT short-circuit for inputs that are not known examples', async () => {
    const { default: handler } = await import('../api/analyze');

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ ts: 50, sp: 50, v: 'x', cn: 'x', b: 'x', d: 'x' }),
      candidates: [{ groundingMetadata: {} }],
    });

    const res = makeRes();
    await handler(
      makeReq({ input: 'random new input text', inputType: 'SMS_TEXT', language: 'en' }),
      res
    );

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(res.jsonBody.source).not.toBe('example');
  });
});

describe('POST /api/analyze — self / known-safe-domain short-circuit', () => {
  it('short-circuits "https://verify1st.tw" URL input to verified_safe', async () => {
    const { default: handler } = await import('../api/analyze');
    const res = makeRes();
    await handler(
      makeReq({ input: 'https://verify1st.tw', inputType: 'URL', language: 'zh-TW' }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.source).toBe('verified_safe');
    expect(res.jsonBody.finalVerdict).toBe('A_MARKETING');
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('short-circuits bare domain "verify1st.tw" (no protocol, SMS_TEXT classification)', async () => {
    const { default: handler } = await import('../api/analyze');
    const res = makeRes();
    await handler(
      makeReq({ input: 'verify1st.tw', inputType: 'SMS_TEXT', language: 'zh-TW' }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.source).toBe('verified_safe');
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('does NOT short-circuit SMS_TEXT that contains the domain inside other text', async () => {
    const { default: handler } = await import('../api/analyze');
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ ts: 50, sp: 50, v: 'x', cn: 'x', b: 'x', d: 'x' }),
      candidates: [{ groundingMetadata: {} }],
    });
    const res = makeRes();
    await handler(
      makeReq({ input: 'verify1st.tw 是詐騙嗎', inputType: 'SMS_TEXT', language: 'zh-TW' }),
      res
    );
    expect(res.jsonBody.source).not.toBe('verified_safe');
  });
});

describe('POST /api/analyze — happy-path degradation', () => {
  it('returns degradation.level=L0 when Gemini succeeds and no side services failed', async () => {
    const { default: handler } = await import('../api/analyze');

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ ts: 80, sp: 20, v: 'test verdict', cn: 'safe', b: 'bio', d: 'name' }),
      candidates: [{ groundingMetadata: { groundingChunks: [], webSearchQueries: [] } }],
    });

    const res = makeRes();
    await handler(
      makeReq({ input: 'just a plain message', inputType: 'SMS_TEXT', language: 'en' }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.degradation).toMatchObject({ level: 'L0', score: 0, services: [] });
  });

  it('keeps repeated analyses in memory without a second AI call', async () => {
    const { default: handler } = await import('../api/analyze');

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ ts: 80, sp: 20, v: 'test verdict', cn: 'safe', b: 'bio', d: 'name' }),
      candidates: [{ groundingMetadata: { groundingChunks: [], webSearchQueries: [] } }],
    });

    const firstRes = makeRes();
    await handler(
      makeReq({ input: 'another plain message', inputType: 'SMS_TEXT', language: 'en' }),
      firstRes
    );

    expect(firstRes.jsonBody.source).toBe('api');
    expect(firstRes.headers['X-VerifyFirst-Cache']).toBe('MISS; stored=memory; hits=1');

    const secondRes = makeRes();
    await handler(
      makeReq({ input: 'another plain message', inputType: 'SMS_TEXT', language: 'en' }),
      secondRes
    );

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(secondRes.jsonBody).toMatchObject({ source: 'cache', cacheTier: 'memory' });
    expect(secondRes.headers['X-VerifyFirst-Cache']).toBe('HIT; tier=memory');
  });

  it('forceRefresh replaces a memory entry without external persistence', async () => {
    const { default: handler } = await import('../api/analyze');
    mockGenerateContent
      .mockResolvedValueOnce({
        text: JSON.stringify({ ts: 70, sp: 30, v: 'initial result', cn: 'check', b: 'bio', d: 'name' }),
        candidates: [{ groundingMetadata: { groundingChunks: [], webSearchQueries: [] } }],
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ ts: 80, sp: 20, v: 'fresh result', cn: 'safe', b: 'bio', d: 'name' }),
        candidates: [{ groundingMetadata: { groundingChunks: [], webSearchQueries: [] } }],
      });

    const firstRes = makeRes();
    await handler(
      makeReq({ input: 'refresh this memory entry', inputType: 'SMS_TEXT', language: 'en' }, '198.51.100.78'),
      firstRes
    );

    const refreshRes = makeRes();
    await handler(
      makeReq({
        input: 'refresh this memory entry',
        inputType: 'SMS_TEXT',
        language: 'en',
        forceRefresh: true,
      }, '198.51.100.78'),
      refreshRes
    );

    const cachedRes = makeRes();
    await handler(
      makeReq({ input: 'refresh this memory entry', inputType: 'SMS_TEXT', language: 'en' }, '198.51.100.78'),
      cachedRes
    );

    expect(refreshRes.statusCode).toBe(200);
    expect(refreshRes.headers['X-VerifyFirst-Cache']).toBe('MISS; stored=memory; hits=1');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(cachedRes.jsonBody).toMatchObject({ source: 'cache', cacheTier: 'memory' });
    expect(cachedRes.jsonBody.verdict).toBe(refreshRes.jsonBody.verdict);
  });
});

describe('POST /api/analyze — input hardening', () => {
  it('rejects non-http(s) schemes passed with an explicit URL type', async () => {
    const { default: handler } = await import('../api/analyze');
    const res = makeRes();
    await handler(
      makeReq({ input: 'javascript:alert(1)', inputType: 'URL', language: 'en' }),
      res
    );
    expect(res.statusCode).toBe(400);
    expect(res.jsonBody.errorCode).toBe('INVALID_INPUT');
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('rejects a non-string input body with 400 instead of crashing to 500', async () => {
    const { default: handler } = await import('../api/analyze');
    const res = makeRes();
    await handler(
      makeReq({ input: 12345, inputType: 'SMS_TEXT', language: 'en' }),
      res
    );
    expect(res.statusCode).toBe(400);
    expect(res.jsonBody.errorCode).toBe('INVALID_INPUT');
  });

  it('upgrades a bare-domain SMS_TEXT paste to the URL pipeline', async () => {
    const { default: handler } = await import('../api/analyze');
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ ts: 50, sp: 50, v: 'x', cn: 'x', b: 'x', d: 'x' }),
      candidates: [{ groundingMetadata: {} }],
    });
    const res = makeRes();
    await handler(
      makeReq({ input: 'some-random-shop.tw', inputType: 'SMS_TEXT', language: 'en' }, '198.51.100.1'),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.inputType).toBe('URL');
    expect(res.jsonBody.originalInput).toBe('https://some-random-shop.tw');
  });

  it('refuses to observe private/internal targets (SSRF guard)', async () => {
    const { default: handler } = await import('../api/analyze');
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ ts: 50, sp: 50, v: 'x', cn: 'x', b: 'x', d: 'x' }),
      candidates: [{ groundingMetadata: {} }],
    });
    const res = makeRes();
    await handler(
      makeReq({ input: 'http://169.254.169.254/latest/meta-data/', inputType: 'URL', language: 'en' }, '198.51.100.2'),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.agentVerification.pageStatus).toBe('blocked_private_target');
    expect(res.jsonBody.agentVerification.status).toBe('LIMITED');
  });

  it('blocks a public URL that redirects to a private target (per-hop guard)', async () => {
    const { default: handler } = await import('../api/analyze');
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ ts: 50, sp: 50, v: 'x', cn: 'x', b: 'x', d: 'x' }),
      candidates: [{ groundingMetadata: {} }],
    });
    // Fact-gathering fetches get a benign 200; the observed page 302-redirects
    // to a loopback address.
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: any) => {
      if (String(url).startsWith('https://public-redirector.example')) {
        return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }));

    const res = makeRes();
    await handler(
      makeReq({ input: 'https://public-redirector.example/go', inputType: 'URL', language: 'en' }, '198.51.100.3'),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.agentVerification.pageStatus).toBe('blocked_private_target');
    expect(res.jsonBody.agentVerification.finalLandingPage).toBe('http://127.0.0.1/admin');
  });

  it('preflights an x402 payment requirement with IFF before surfacing the 402', async () => {
    const { default: handler } = await import('../api/analyze');
    const paymentRequired = {
      x402Version: 2,
      accepts: [{
        scheme: 'exact',
        network: 'eip155:8453',
        asset: '0x0000000000000000000000000000000000000000',
        amount: '1000',
        payTo: '0x1111111111111111111111111111111111111111',
      }],
    };
    const encoded = Buffer.from(JSON.stringify(paymentRequired), 'utf8').toString('base64');

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ ts: 45, sp: 55, v: 'Payment required', cn: 'Review before paying', b: 'x', d: 'x' }),
      candidates: [{ groundingMetadata: {} }],
    });
    mockIffVerify.mockResolvedValueOnce({
      url: 'https://merchant.example/pay',
      verdict: 'consistent',
      received: { set_fingerprint: 'received', option_fingerprints: ['option'] },
      observed: {
        set_fingerprint: 'observed', option_fingerprints: ['option'], observation_id: 'observation',
        observed_at: '2026-08-29T06:00:00.000Z', probe_type: 'scheduled', monitor_id: 'iff-monitor',
        monitor_public_key: 'key', report_hash: 'report-hash', monitor_signature: 'signature',
      },
      history: [],
      unmatched_received_options: [],
      ownership: { status: 'verified' },
      inclusion: null,
      disclaimer: 'Requirement consistency only.',
    });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: any) => {
      if (String(url) === 'https://merchant.example/pay') {
        return new Response('', { status: 402, headers: { 'payment-required': encoded } });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }));

    const res = makeRes();
    await handler(
      makeReq({ input: 'https://merchant.example/pay', inputType: 'URL', language: 'en' }, '198.51.100.44'),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(mockIffVerify).toHaveBeenCalledWith(
      'https://merchant.example/pay',
      paymentRequired,
      expect.objectContaining({ fetch: expect.any(Function) }),
    );
    expect(res.jsonBody.agentVerification).toMatchObject({
      httpStatus: 402,
      pageStatus: 'payment_required',
      asksForPayment: true,
      x402Preflight: {
        provider: 'ifandonlyif.io',
        status: 'VERIFIED',
        verdict: 'consistent',
        ownershipStatus: 'verified',
      },
    });
    expect(res.jsonBody.agentVerification.riskObservations).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'IFF x402 preflight', value: 'consistent', lane: 'CORROBORATED' }),
    ]));
  });
});

describe('POST /api/analyze — hard blocklist floor', () => {
  it('clamps the verdict when ScamSniffer flags the domain, even if the LLM says safe', async () => {
    const { default: handler } = await import('../api/analyze');

    // URL-aware fetch mock: ScamSniffer DB contains our test domain,
    // everything else responds with a benign empty object.
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('scam-database/main/blacklist/domains.json')) {
        return new Response(JSON.stringify(['evil-test-scam.example']), { status: 200 });
      }
      if (u.includes('scam-database/main/blacklist/address.json')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }));

    // Simulates a prompt-injected "everything is fine" LLM response.
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ ts: 95, sp: 5, v: 'Looks perfectly safe', cn: 'Nothing wrong here', b: 'x', d: 'x' }),
      candidates: [{ groundingMetadata: {} }],
    });

    const res = makeRes();
    await handler(
      makeReq({ input: 'https://evil-test-scam.example/login', inputType: 'URL', language: 'en' }, '203.0.113.7'),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.scamProbability).toBeGreaterThanOrEqual(90);
    expect(res.jsonBody.trustScore).toBeLessThanOrEqual(10);
    expect(res.jsonBody.finalVerdict).toBe('D_HIGH_RISK_SCAM');
    expect(res.jsonBody.riskSignals.some((s: any) => s.type === 'BLOCKLIST_HIT' && s.level === 'CRITICAL')).toBe(true);
  });
});
