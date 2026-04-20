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
    const { default: handler } = await import('./analyze');

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
    const { default: handler } = await import('./analyze');

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
    const { default: handler } = await import('./analyze');

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
    const { default: handler } = await import('./analyze');

    const res = makeRes();
    await handler(
      makeReq({ input: '', inputType: 'SMS_TEXT', language: 'en' }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody.errorCode).toBe('INVALID_INPUT');
  });
});

describe('POST /api/analyze — happy-path degradation', () => {
  it('returns degradation.level=L0 when Gemini succeeds and no side services failed', async () => {
    const { default: handler } = await import('./analyze');

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
