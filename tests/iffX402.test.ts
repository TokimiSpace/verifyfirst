import { describe, expect, it, vi } from 'vitest';
import { VerifyRequestError, type PaymentRequiredEnvelope, type VerifyResult } from '@ifandonlyif/x402-preflight';
import { preflightX402Response, verifyX402Requirement } from '../services/iffX402';

const paymentRequired: PaymentRequiredEnvelope = {
  x402Version: 2,
  accepts: [{
    scheme: 'exact',
    network: 'eip155:8453',
    asset: '0x0000000000000000000000000000000000000000',
    amount: '1000',
    payTo: '0x1111111111111111111111111111111111111111',
  }],
};

const verifyResult = (verdict: VerifyResult['verdict']): VerifyResult => ({
  url: 'https://merchant.example/quote',
  verdict,
  received: { set_fingerprint: 'received-set', option_fingerprints: ['received-option'] },
  observed: {
    set_fingerprint: 'observed-set',
    option_fingerprints: ['observed-option'],
    observation_id: 'observation-id',
    observed_at: '2026-08-29T06:00:00.000Z',
    probe_type: 'scheduled',
    monitor_id: 'iff-monitor-1',
    monitor_public_key: 'public-key',
    report_hash: 'report-hash',
    monitor_signature: 'signature',
  },
  history: [],
  unmatched_received_options: [],
  ownership: { status: 'verified' },
  inclusion: {
    tree_size: 7,
    log_index: 6,
    audit_path: [],
    sth: {
      log_id: 'iff-log',
      tree_size: 7,
      timestamp: '2026-08-29T06:00:01.000Z',
      root_hash: 'root-hash',
      signature: 'sth-signature',
      public_key: 'sth-public-key',
    },
  },
  disclaimer: 'Requirement consistency is not a payment-safety guarantee.',
});

const encodedRequirement = () => Buffer.from(JSON.stringify(paymentRequired), 'utf8').toString('base64');

describe('IFF x402 preflight integration', () => {
  it('accepts a validated requirement directly for enterprise intake', async () => {
    const verifyFn = vi.fn(async () => verifyResult('unobserved'));
    const result = await verifyX402Requirement(
      'https://merchant.example/quote?private=session',
      paymentRequired,
      { verifyFn },
    );

    expect(result).toMatchObject({ status: 'VERIFIED', verdict: 'unobserved' });
    expect(verifyFn).toHaveBeenCalledWith(
      'https://merchant.example/quote',
      paymentRequired,
      expect.any(Object),
    );
  });

  it('ignores non-402 responses without calling IFF', async () => {
    const verifyFn = vi.fn();
    const result = await preflightX402Response(
      'https://merchant.example/quote',
      new Response('ok', { status: 200 }),
      { verifyFn },
    );

    expect(result).toBeNull();
    expect(verifyFn).not.toHaveBeenCalled();
  });

  it('decodes the PAYMENT-REQUIRED header and preserves the IFF verdict', async () => {
    const verifyFn = vi.fn(async (url: string, requirement: PaymentRequiredEnvelope) => {
      expect(url).toBe('https://merchant.example/quote');
      expect(requirement).toEqual(paymentRequired);
      return verifyResult('consistent');
    });

    const result = await preflightX402Response(
      'https://merchant.example/quote?session=private#fragment',
      new Response('', { status: 402, headers: { 'payment-required': encodedRequirement() } }),
      { verifyFn },
    );

    expect(result).toMatchObject({
      provider: 'ifandonlyif.io',
      evidenceBaseUrl: 'https://ifandonlyif.io',
      evidenceSource: 'IFF_PUBLIC_API',
      status: 'VERIFIED',
      verdict: 'consistent',
      ownershipStatus: 'verified',
      monitorId: 'iff-monitor-1',
      monitorPublicKey: 'public-key',
      monitorSignature: 'signature',
      reportHash: 'report-hash',
      inclusionAvailable: true,
      inclusionSignedTreeHead: {
        logId: 'iff-log',
        treeSize: 7,
        timestamp: '2026-08-29T06:00:01.000Z',
        rootHash: 'root-hash',
        signature: 'sth-signature',
        publicKey: 'sth-public-key',
      },
    });
    expect(verifyFn).toHaveBeenCalledTimes(1);
  });

  it('falls back to the JSON body when the header is malformed', async () => {
    const verifyFn = vi.fn(async () => ({
      ...verifyResult('diverged'),
      divergence_kind: 'payee' as const,
      unmatched_received_options: ['received-option'],
    }));

    const result = await preflightX402Response(
      'https://merchant.example/quote',
      new Response(JSON.stringify(paymentRequired), {
        status: 402,
        headers: { 'content-type': 'application/json', 'payment-required': 'not-base64-json' },
      }),
      { verifyFn },
    );

    expect(result).toMatchObject({ status: 'VERIFIED', verdict: 'diverged', divergenceKind: 'payee' });
  });

  it('does not send malformed or non-x402 402 responses to IFF', async () => {
    const verifyFn = vi.fn();
    const result = await preflightX402Response(
      'https://merchant.example/quote',
      new Response(JSON.stringify({ message: 'payment required' }), {
        status: 402,
        headers: { 'content-type': 'application/json' },
      }),
      { verifyFn },
    );

    expect(result).toMatchObject({ status: 'INVALID_REQUIREMENT', errorCode: 'INVALID_X402_REQUIREMENT' });
    expect(verifyFn).not.toHaveBeenCalled();
  });

  it('caps an untrusted 402 body before parsing or sending it to IFF', async () => {
    const verifyFn = vi.fn();
    const oversized = JSON.stringify({ ...paymentRequired, padding: 'x'.repeat(70 * 1024) });
    const result = await preflightX402Response(
      'https://merchant.example/quote',
      new Response(oversized, { status: 402, headers: { 'content-type': 'application/json' } }),
      { verifyFn },
    );

    expect(result).toMatchObject({ status: 'INVALID_REQUIREMENT', errorCode: 'INVALID_X402_REQUIREMENT' });
    expect(verifyFn).not.toHaveBeenCalled();
  });

  it('degrades explicitly when the public IFF API rejects the request', async () => {
    const result = await preflightX402Response(
      'https://merchant.example/quote',
      new Response('', { status: 402, headers: { 'payment-required': encodedRequirement() } }),
      { verifyFn: async () => { throw new VerifyRequestError(429, { error: true }); } },
    );

    expect(result).toEqual({
      provider: 'ifandonlyif.io',
      evidenceBaseUrl: 'https://ifandonlyif.io',
      evidenceSource: 'UNAVAILABLE',
      status: 'UNAVAILABLE',
      inclusionAvailable: false,
      errorCode: 'IFF_HTTP_429',
    });
  });

  it('rejects an unrecognized IFF verdict instead of treating untrusted JSON as verified', async () => {
    const result = await verifyX402Requirement(
      'https://merchant.example/quote',
      paymentRequired,
      { verifyFn: async () => ({ ...verifyResult('consistent'), verdict: 'safe' }) as never },
    );

    expect(result).toEqual({
      provider: 'ifandonlyif.io',
      evidenceBaseUrl: 'https://ifandonlyif.io',
      evidenceSource: 'UNAVAILABLE',
      status: 'UNAVAILABLE',
      inclusionAvailable: false,
      errorCode: 'IFF_INVALID_RESPONSE',
    });
  });

  it('rejects an IFF response missing required evidence shapes', async () => {
    const invalid = { ...verifyResult('consistent'), received: { set_fingerprint: 'only-set' } };
    const result = await verifyX402Requirement(
      'https://merchant.example/quote',
      paymentRequired,
      { verifyFn: async () => invalid as never },
    );

    expect(result).toMatchObject({
      status: 'UNAVAILABLE',
      evidenceSource: 'UNAVAILABLE',
      errorCode: 'IFF_INVALID_RESPONSE',
    });
  });

  it('records the resolved custom evidence service instead of labeling it as the public API', async () => {
    const verifyFn = vi.fn(async () => verifyResult('consistent'));
    const result = await verifyX402Requirement(
      'https://merchant.example/quote',
      paymentRequired,
      { baseUrl: 'https://iff.internal.example/', verifyFn },
    );

    expect(result).toMatchObject({
      status: 'VERIFIED',
      evidenceBaseUrl: 'https://iff.internal.example',
      evidenceSource: 'IFF_CUSTOM_API',
    });
    expect(verifyFn).toHaveBeenCalledWith(
      'https://merchant.example/quote',
      paymentRequired,
      expect.objectContaining({ baseUrl: 'https://iff.internal.example' }),
    );
  });

  it('rejects plaintext custom evidence services except explicit loopback development', async () => {
    const remote = await verifyX402Requirement(
      'https://merchant.example/quote',
      paymentRequired,
      { baseUrl: 'http://iff.internal.example', verifyFn: async () => verifyResult('consistent') },
    );
    const local = await verifyX402Requirement(
      'https://merchant.example/quote',
      paymentRequired,
      { baseUrl: 'http://127.0.0.1:8787', verifyFn: async () => verifyResult('consistent') },
    );

    expect(remote).toMatchObject({ status: 'UNAVAILABLE', errorCode: 'IFF_INVALID_BASE_URL' });
    expect(local).toMatchObject({ status: 'VERIFIED', evidenceSource: 'IFF_CUSTOM_API', evidenceBaseUrl: 'http://127.0.0.1:8787' });
  });

  it('keeps the timeout active until the complete IFF response body arrives', async () => {
    const fetchImpl = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"url":"https://merchant.example/quote",'));
        // Deliberately never close: resolving headers must not clear the body deadline.
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const result = await verifyX402Requirement(
      'https://merchant.example/quote',
      paymentRequired,
      { fetchImpl: fetchImpl as typeof fetch, timeoutMs: 5 },
    );

    expect(result).toMatchObject({
      status: 'UNAVAILABLE',
      evidenceSource: 'UNAVAILABLE',
      errorCode: 'IFF_TIMEOUT',
    });
  });

  it('caps a chunked IFF response body at 256 KiB', async () => {
    const oversized = 'x'.repeat(256 * 1024 + 1);
    const fetchImpl = vi.fn(async () => new Response(oversized, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const result = await verifyX402Requirement(
      'https://merchant.example/quote',
      paymentRequired,
      { fetchImpl: fetchImpl as typeof fetch },
    );

    expect(result).toMatchObject({
      status: 'UNAVAILABLE',
      evidenceSource: 'UNAVAILABLE',
      errorCode: 'IFF_RESPONSE_TOO_LARGE',
    });
  });
});
