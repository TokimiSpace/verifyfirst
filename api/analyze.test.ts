import { describe, it, expect } from 'vitest';
import { classifyError, computeDegradation } from './analyze';

describe('classifyError', () => {
  it('classifies Gemini error.status=429 as LLM_QUOTA/503', () => {
    const err = { status: 429, message: 'Too Many Requests' };
    expect(classifyError(err)).toEqual({
      errorCode: 'LLM_QUOTA',
      status: 503,
      message: 'AI analysis service temporarily at capacity',
    });
  });

  it('classifies error.code=RESOURCE_EXHAUSTED as LLM_QUOTA', () => {
    const err = { code: 'RESOURCE_EXHAUSTED', message: 'Gemini ran out' };
    expect(classifyError(err).errorCode).toBe('LLM_QUOTA');
  });

  it('classifies "quota exceeded" message as LLM_QUOTA', () => {
    const err = { message: 'quota exceeded for project' };
    expect(classifyError(err).errorCode).toBe('LLM_QUOTA');
  });

  it('classifies 401 as LLM_FAILED', () => {
    const err = { status: 401, message: 'Unauthorized' };
    expect(classifyError(err)).toEqual({
      errorCode: 'LLM_FAILED',
      status: 500,
      message: 'AI service authentication error',
    });
  });

  it('classifies "API key invalid" as LLM_FAILED', () => {
    const err = { message: 'API key is invalid' };
    expect(classifyError(err).errorCode).toBe('LLM_FAILED');
  });

  it('does NOT flag an error with "429" buried in a stack trace', () => {
    // This is the regression test for the original bug: the old catch used
    // message.includes('429') which falsely matched stack traces and timestamps.
    const err = { message: 'at Function.runAt (line 4299: undefined is not iterable)' };
    expect(classifyError(err).errorCode).toBe('SERVER_ERROR');
  });

  it('falls back to SERVER_ERROR for unknown errors', () => {
    const err = new Error('Something weird broke');
    expect(classifyError(err)).toEqual({
      errorCode: 'SERVER_ERROR',
      status: 500,
      message: 'Something weird broke',
    });
  });

  it('handles null/undefined gracefully', () => {
    expect(classifyError(null).errorCode).toBe('SERVER_ERROR');
    expect(classifyError(undefined).errorCode).toBe('SERVER_ERROR');
  });
});

describe('computeDegradation', () => {
  it('L0 when no services failed', () => {
    expect(computeDegradation([])).toEqual({ level: 'L0', score: 0, services: [] });
  });

  it('L1 when one side service failed (score=1)', () => {
    const d = computeDegradation(['VirusTotal']);
    expect(d.level).toBe('L1');
    expect(d.score).toBe(1);
  });

  it('L1 when Blob failed alone (weight=2)', () => {
    const d = computeDegradation(['Vercel Blob']);
    expect(d.level).toBe('L1');
    expect(d.score).toBe(2);
  });

  it('L2 when three side services failed (score=3)', () => {
    const d = computeDegradation(['VirusTotal', 'RDAP', 'DNS']);
    expect(d.level).toBe('L2');
    expect(d.score).toBe(3);
  });

  it('L2 when Blob + two side services failed (score=4)', () => {
    const d = computeDegradation(['Vercel Blob', 'VirusTotal', 'RDAP']);
    expect(d.level).toBe('L2');
    expect(d.score).toBe(4);
  });

  it('L3 when five side services failed (score=5)', () => {
    const d = computeDegradation(['VirusTotal', 'RDAP', 'DNS', 'Cofacts', 'ScamSniffer']);
    expect(d.level).toBe('L3');
    expect(d.score).toBe(5);
  });

  it('L4 when Gemini failed and side services OK', () => {
    const d = computeDegradation(['Gemini'], true);
    expect(d.level).toBe('L4');
  });

  it('L4 when Gemini failed and one or two side services failed', () => {
    expect(computeDegradation(['Gemini', 'VirusTotal'], true).level).toBe('L4');
    expect(computeDegradation(['Gemini', 'VirusTotal', 'RDAP'], true).level).toBe('L4');
  });

  it('L5 when Gemini + 3 or more side services failed', () => {
    const d = computeDegradation(['Gemini', 'VirusTotal', 'RDAP', 'DNS'], true);
    expect(d.level).toBe('L5');
  });

  it('deduplicates services', () => {
    const d = computeDegradation(['VirusTotal', 'VirusTotal', 'RDAP']);
    expect(d.services).toEqual(['VirusTotal', 'RDAP']);
    expect(d.score).toBe(2);
  });

  it('treats unknown services with weight 1', () => {
    const d = computeDegradation(['SomeNewService']);
    expect(d.score).toBe(1);
    expect(d.level).toBe('L1');
  });
});
