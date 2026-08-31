import { describe, expect, it, vi } from 'vitest';
import {
  GleifLookupError,
  isValidLei,
  lookupLeiRecord,
} from '../services/gleif';

const LEI = '506700GE1G29325QX363';

const gleifPayload = {
  data: {
    type: 'lei-records',
    id: LEI,
    attributes: {
      lei: LEI,
      entity: {
        legalName: { name: 'Example Legal Entity', language: 'en' },
        status: 'ACTIVE',
        jurisdiction: 'TW',
        legalAddress: { country: 'TW' },
      },
      registration: {
        status: 'ISSUED',
        managingLou: '529900T8BM49AURSDO55',
        corroborationLevel: 'FULLY_CORROBORATED',
        initialRegistrationDate: '2024-01-01T00:00:00Z',
        lastUpdateDate: '2026-08-30T00:00:00Z',
        nextRenewalDate: '2027-01-01T00:00:00Z',
      },
    },
  },
  meta: { goldenCopy: { publishDate: '2026-08-31T00:00:00Z' } },
};

describe('GLEIF LEI service', () => {
  it('validates a 20-character LEI locally and normalizes the official record', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(gleifPayload), {
      status: 200,
      headers: { 'Content-Type': 'application/vnd.api+json' },
    }));

    expect(isValidLei(`  ${LEI.toLowerCase()} `)).toBe(true);
    expect(isValidLei('506700GE1G29325QX36')).toBe(false);

    const record = await lookupLeiRecord(` ${LEI.toLowerCase()} `, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0]).toBe(`https://api.gleif.org/api/v1/lei-records/${LEI}`);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      headers: { Accept: 'application/vnd.api+json' },
    });
    expect(record).toMatchObject({
      lei: LEI,
      legalName: 'Example Legal Entity',
      entityStatus: 'ACTIVE',
      registrationStatus: 'ISSUED',
      jurisdiction: 'TW',
      corroborationLevel: 'FULLY_CORROBORATED',
      goldenCopyPublishDate: '2026-08-31T00:00:00Z',
    });
    expect(record.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rejects invalid input without making a network request', async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(lookupLeiRecord('not-an-lei', { fetchImpl })).rejects.toMatchObject({
      code: 'INVALID_LEI',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed for missing and mismatched GLEIF records', async () => {
    const notFound = vi.fn<typeof fetch>(async () => new Response('', { status: 404 }));
    await expect(lookupLeiRecord(LEI, { fetchImpl: notFound })).rejects.toMatchObject({
      code: 'LEI_NOT_FOUND',
      status: 404,
    });

    const mismatched = structuredClone(gleifPayload);
    mismatched.data.id = '5493001KJTIIGC8Y1R12';
    const invalidResponse = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(mismatched)));
    await expect(lookupLeiRecord(LEI, { fetchImpl: invalidResponse })).rejects.toMatchObject({
      code: 'INVALID_GLEIF_RESPONSE',
    });
  });

  it('aborts and rejects instead of substituting fixture data after a timeout', async () => {
    const fetchImpl = vi.fn<typeof fetch>((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }));

    const error = await lookupLeiRecord(LEI, { fetchImpl, timeoutMs: 5 }).catch(value => value);
    expect(error).toBeInstanceOf(GleifLookupError);
    expect(error).toMatchObject({ code: 'GLEIF_TIMEOUT' });
    expect(fetchImpl.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});
