import { describe, expect, it } from 'vitest';
import {
  sealEvidenceBody,
  verifyEvidenceEnvelope,
} from '../services/evidenceIntegrity';

describe('enterprise evidence integrity envelope', () => {
  it('covers the decision, trust root, checks, and source digest', async () => {
    const packet = await sealEvidenceBody({
      schema: 'verifyfirst.enterprise-verification.v1',
      source: { digest: 'sha256:raw-cesr-digest' },
      root: { aid: 'Eexample', trustDomain: 'production' },
      decision: { code: 'DENY_ROOT_MISMATCH', toolExecution: false },
      checks: [{ id: 'root', ok: false }],
    });

    expect(packet.id).toBe(`sha256:${packet.integrity.digest}`);
    expect(packet.integrity).toMatchObject({
      kind: 'SELF_CHECK_ONLY',
      authenticity: 'UNSIGNED',
      provenance: 'VERIFYFIRST_BROWSER_GENERATED',
    });
    await expect(verifyEvidenceEnvelope(packet)).resolves.toBe(true);

    const tampered = {
      ...packet,
      decision: { code: 'ALLOW_CHAIN_VERIFIED', toolExecution: true },
    };
    await expect(verifyEvidenceEnvelope(tampered)).resolves.toBe(false);
    expect((tampered.source as { digest: string }).digest).toBe('sha256:raw-cesr-digest');
  });

  it('is deterministic across object key order', async () => {
    const first = await sealEvidenceBody({ a: 1, nested: { z: true, b: 'x' } });
    const second = await sealEvidenceBody({ nested: { b: 'x', z: true }, a: 1 });

    expect(first.integrity.digest).toBe(second.integrity.digest);
  });

  it('is an unsigned self-check and does not claim issuer authenticity', async () => {
    const original = await sealEvidenceBody({ decision: 'DENY' });
    const independentlyReplaced = await sealEvidenceBody({ decision: 'ALLOW' });

    await expect(verifyEvidenceEnvelope(original)).resolves.toBe(true);
    await expect(verifyEvidenceEnvelope(independentlyReplaced)).resolves.toBe(true);
    expect(independentlyReplaced.integrity.authenticity).toBe('UNSIGNED');
    expect(independentlyReplaced.integrity.digest).not.toBe(original.integrity.digest);
  });
});
