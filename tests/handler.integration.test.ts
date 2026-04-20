import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @google/genai BEFORE importing the handler, so the handler picks up the mock.
const mockGenerateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
  },
}));

// Mock @vercel/blob so tests run without network/auth.
vi.mock('@vercel/blob', () => ({
  list: vi.fn().mockResolvedValue({ blobs: [] }),
  put: vi.fn().mockResolvedValue(undefined),
}));

// Mock global fetch so we don't hit RDAP/DNS/VT/Cofacts during tests.
// Each call returns a benign "empty" response so fact-gathering produces no data.
beforeEach(() => {
  mockGenerateContent.mockReset();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({}), { status: 200 })
  ));
  process.env.GEMINI_API_KEY = 'test-key';
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

const makeReq = (body: Record<string, unknown>) => ({
  method: 'POST',
  headers: { 'x-forwarded-for': '127.0.0.1' },
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
});
