import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_VLEI_CESR_BYTES,
  OFFICIAL_VLEI_FIXTURE,
  VleiVerificationError,
  loadOfficialVleiFixture,
  resolveVleiRepresentedEntity,
  verifyVleiCesr,
} from '../services/vleiClient';
import {
  buildRegistryInception,
  buildRevocation,
  parseCesrStream,
  saidify,
  schemaBySaid,
} from '../public/update-trust/said.js';

const fixtureText = fs.readFileSync(path.resolve('public/update-trust/credential.cesr'), 'utf8');

const collectKeys = (value: unknown, keys: string[] = []): string[] => {
  if (!value || typeof value !== 'object') return keys;
  for (const [key, child] of Object.entries(value)) {
    keys.push(key);
    collectKeys(child, keys);
  }
  return keys;
};

describe('enterprise vLEI verifier wrapper', () => {
  it('loads the pinned official fixture with a bounded, integrity-checked request', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(fixtureText, { status: 200 }));
    const fixture = await loadOfficialVleiFixture(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith('/update-trust/credential.cesr', {
      cache: 'no-store',
      headers: { Accept: 'application/json+cesr, text/plain;q=0.9' },
    });
    expect(fixture).toMatchObject({
      raw: fixtureText,
      source: OFFICIAL_VLEI_FIXTURE.source,
      pinnedCommit: OFFICIAL_VLEI_FIXTURE.pinnedCommit,
      sourceDigest: `sha256:${OFFICIAL_VLEI_FIXTURE.sha256}`,
    });
    expect(fixture.bytes).toBeLessThan(MAX_VLEI_CESR_BYTES);
  });

  it('verifies the official chain in the isolated fixture trust domain', async () => {
    const result = await verifyVleiCesr(fixtureText, { trustDomain: 'fixture' });

    expect(result.decision).toMatchObject({
      code: 'ALLOW_CHAIN_VERIFIED',
      toolExecution: true,
    });
    expect(result.root).toMatchObject({
      trustDomain: 'fixture',
      aid: 'EHOuGiHMxJShXHgSb6k_9pqxmRb8H-LT0R2hQouHp8pW',
    });
    expect(result.stats).toMatchObject({
      messages: 38,
      credentials: 4,
      officialSchemaCredentials: 4,
      rejectedSchemaCredentials: 0,
    });
    expect(result.credentials.map(credential => credential.schemaKey)).toEqual([
      'QVI',
      'LE',
      'ECR_AUTH',
      'ECR',
    ]);
    expect(resolveVleiRepresentedEntity(result)).toEqual({
      status: 'RESOLVED',
      lei: '9845004CC7884BN85018',
      credentialSaid: result.decision.leaf,
      credentialSchemaKey: 'ECR',
    });
    expect(result.sourceDigest).toBe(`sha256:${OFFICIAL_VLEI_FIXTURE.sha256}`);
    expect(collectKeys(result)).not.toContain('raw');
  });

  it.each(['not-cesr', '\n{'])('rejects unconsumed or malformed trailing bytes (%s)', async (suffix) => {
    const result = await verifyVleiCesr(`${fixtureText}${suffix}`, { trustDomain: 'fixture' });

    expect(result.decision).toEqual({
      code: 'DENY_STREAM_CORRUPT',
      toolExecution: false,
      leaf: null,
    });
    expect(result.checks).toContainEqual(expect.objectContaining({
      id: 'parse',
      ok: false,
    }));
  });

  it('rejects non-whitespace bytes before the first CESR message', async () => {
    const result = await verifyVleiCesr(`not-cesr${fixtureText}`, { trustDomain: 'fixture' });
    expect(result.decision.code).toBe('DENY_STREAM_CORRUPT');
    expect(result.decision.toolExecution).toBe(false);
  });

  it('rejects duplicate JSON member names before last-wins parsing can normalize them', async () => {
    const originalAid = 'EHOuGiHMxJShXHgSb6k_9pqxmRb8H-LT0R2hQouHp8pW';
    const duplicateKey = fixtureText.replace(
      `"i": "${originalAid}",`,
      `"i": "EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "i": "${originalAid}",`,
    );
    const result = await verifyVleiCesr(duplicateKey, { trustDomain: 'fixture' });

    expect(result.decision.code).toBe('DENY_STREAM_CORRUPT');
    expect(result.decision.toolExecution).toBe(false);
    expect(result.checks).toContainEqual(expect.objectContaining({ id: 'parse', ok: false }));
  });

  it.each([
    ['unsupported protocol version', 'KERI99JSON0001b7_'],
    ['incorrect declared message size', 'KERI10JSON000000_'],
  ])('rejects %s even when the normalized SAID and signature would otherwise match', async (_label, replacement) => {
    const changedVersion = fixtureText.replace('KERI10JSON0001b7_', replacement);
    const result = await verifyVleiCesr(changedVersion, { trustDomain: 'fixture' });

    expect(result.decision.code).toBe('DENY_SAID_MISMATCH');
    expect(result.decision.toolExecution).toBe(false);
  });

  it('fails closed when the fixture is challenged against the production root', async () => {
    const result = await verifyVleiCesr(fixtureText, { trustDomain: 'production' });

    expect(result.decision.code).toBe('DENY_ROOT_MISMATCH');
    expect(result.decision.toolExecution).toBe(false);
    expect(result.root.trustDomain).toBe('production');
    expect(result.root.aid).toBe('EINmHd5g7iV-UldkkkKyBIH052bIyxZNBn9pq-zNrYoS');
  });

  it('rejects unsupported event types at both the canonical and enterprise boundaries', async () => {
    const unsupported = saidify({
      v: 'KERI10JSON000000_', t: 'vrt', d: '#'.repeat(44),
      i: 'EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      s: '1', p: '#'.repeat(44), bt: '0', br: [], ba: [],
    }).obj;
    const result = await verifyVleiCesr(`${fixtureText}${JSON.stringify(unsupported)}`, {
      trustDomain: 'fixture',
    });

    expect(result.decision.code).toBe('DENY_UNSUPPORTED_EVENT_TYPE');
    expect(result.decision.toolExecution).toBe(false);
    expect(result.checks).toContainEqual(expect.objectContaining({
      id: 'enterprise-message-type-boundary',
      ok: false,
    }));
  });

  it('never ignores an invalid disconnected official credential', async () => {
    const messages = parseCesrStream(fixtureText);
    const qvi = messages.map(message => message.ked).find(ked => (
      ked?.v?.startsWith('ACDC') && schemaBySaid(ked.s)?.key === 'QVI'
    ));
    const disconnected = saidify({
      ...structuredClone(qvi),
      d: '#'.repeat(44),
      ri: 'EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    }).obj;
    const result = await verifyVleiCesr(`${fixtureText}${JSON.stringify(disconnected)}`, {
      trustDomain: 'fixture',
    });

    expect(result.decision.code).toBe('DENY_CREDENTIAL_GRAPH_INVALID');
    expect(result.decision.toolExecution).toBe(false);
    expect(result.checks).toContainEqual(expect.objectContaining({
      id: 'enterprise-credential-graph-boundary',
      ok: false,
    }));
  });

  it('rejects a supplied TEL registry that is unused or not exact-KEL-anchored', async () => {
    const extraRegistry = buildRegistryInception(
      'EHOuGiHMxJShXHgSb6k_9pqxmRb8H-LT0R2hQouHp8pW',
      'EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    const result = await verifyVleiCesr(`${fixtureText}${JSON.stringify(extraRegistry)}`, {
      trustDomain: 'fixture',
    });

    expect(result.decision.code).toBe('DENY_REGISTRY_COVERAGE_INVALID');
    expect(result.decision.toolExecution).toBe(false);
    expect(result.checks).toContainEqual(expect.objectContaining({
      id: 'enterprise-registry-boundary',
      ok: false,
    }));
  });

  it('treats TEL evidence as a supplied-stream snapshot and rejects an unanchored rev', async () => {
    const messages = parseCesrStream(fixtureText);
    const ecr = messages.map(message => message.ked).find(ked => schemaBySaid(ked?.s)?.key === 'ECR');
    const issuance = messages.map(message => message.ked).find(ked => ked?.t === 'iss' && ked.i === ecr.d);
    const rev = buildRevocation(ecr.d, ecr.ri, issuance.d, '2026-08-28T10:05:00.000Z');
    const result = await verifyVleiCesr(`${fixtureText}${JSON.stringify(rev)}`, {
      trustDomain: 'fixture',
    });
    const credential = result.credentials.find(item => item.said === ecr.d);

    expect(result.decision.code).toBe('DENY_TEL_EVENT_UNANCHORED');
    expect(result.decision.toolExecution).toBe(false);
    expect(credential?.status).toBe('UNKNOWN');
    expect(credential?.statusScope).toBe('SUPPLIED_STREAM_SNAPSHOT_ONLY');
    expect(credential?.checks).toContainEqual(expect.objectContaining({ id: 'rev-anchor', ok: false, anchored: false }));
    expect(result.limitations.join(' ')).toContain('point-in-time snapshot');
  });

  it('rejects non-official schemas and production anchoring bypass attempts', async () => {
    const unknownSchemaAcdc = JSON.stringify({
      v: 'ACDC10JSON000000_',
      d: 'EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      i: 'EISSUERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      ri: 'EREGISTRYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      s: 'ENOTANOFFICIALGLEIFSCHEMAAAAAAAAAAAAAAAAAAAAA',
      a: { i: 'EISSUEEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
    });
    const schemaResult = await verifyVleiCesr(unknownSchemaAcdc, { trustDomain: 'fixture' });
    expect(schemaResult.decision).toEqual({
      code: 'DENY_NON_OFFICIAL_SCHEMA',
      toolExecution: false,
      leaf: 'EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    });
    expect(schemaResult.stats.rejectedSchemaCredentials).toBe(1);
    expect(schemaResult.checks[0]).toMatchObject({
      id: 'official-schema-boundary',
      ok: false,
    });

    await expect(verifyVleiCesr(fixtureText, {
      trustDomain: 'production',
      unanchoredOk: new Set(['unsafe']),
    } as never)).rejects.toMatchObject({ code: 'VLEI_UNSAFE_OPTION_REJECTED' });
  });

  it('returns a bounded denial when a malformed KERI version is supplied', async () => {
    const malformed = JSON.stringify({
      v: 'not-a-version-string',
      d: 'EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    });
    const result = await verifyVleiCesr(malformed, { trustDomain: 'fixture' });

    expect(result.decision).toEqual({
      code: 'DENY_SAID_MISMATCH',
      toolExecution: false,
      leaf: null,
    });
    expect(result.checks).toContainEqual(expect.objectContaining({
      id: 'said',
      ok: false,
    }));
    expect(JSON.stringify(result)).not.toContain('not-a-version-string');
  });

  it('rejects CESR and fixture responses larger than 128 KiB', async () => {
    const oversized = 'x'.repeat(MAX_VLEI_CESR_BYTES + 1);
    await expect(verifyVleiCesr(oversized, { trustDomain: 'fixture' })).rejects.toMatchObject({
      code: 'VLEI_INPUT_TOO_LARGE',
    });

    const oversizedFetch = vi.fn<typeof fetch>(async () => new Response('', {
      status: 200,
      headers: { 'Content-Length': String(MAX_VLEI_CESR_BYTES + 1) },
    }));
    const error = await loadOfficialVleiFixture(oversizedFetch).catch(value => value);
    expect(error).toBeInstanceOf(VleiVerificationError);
    expect(error).toMatchObject({ code: 'VLEI_INPUT_TOO_LARGE' });
  });

  it('fails fixture loading when the pinned content digest changes', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(`${fixtureText}\nchanged`, { status: 200 }));
    await expect(loadOfficialVleiFixture(fetchImpl)).rejects.toMatchObject({
      code: 'VLEI_FIXTURE_INTEGRITY_ERROR',
    });
  });
});
