import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  AGENT_DELEGATION_SCHEMA,
  ROOT_OF_TRUST,
  VLEI_SCHEMAS,
  asMessage,
  CARBON_SCHEMA,
  buildCarbonCredential,
  disclose,
  verifyDisclosure,
  serialize,
  blake3,
  blake3Digest,
  buildAgentDelegation,
  buildInception,
  buildIssuance,
  buildRegistryInception,
  buildRevocation,
  cesrDecode,
  cesrEncode,
  encodeIndexedSig,
  parseCesrStream,
  schemaBySaid,
  saidLabelsFor,
  saidify,
  verifyChain,
  verifyEd25519,
  verifySaid,
} from '../public/update-trust/said.js';

const page = fs.readFileSync(path.resolve('public/update-trust/index.html'), 'utf8');
const fixtureText = fs.readFileSync(path.resolve('public/update-trust/credential.cesr'), 'utf8');
const fixture = parseCesrStream(fixtureText);
const keds = fixture.map(m => m.ked);
const hex = (bytes: Uint8Array) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const publicQb64 = async (key: CryptoKey) => cesrEncode('D', new Uint8Array(await crypto.subtle.exportKey('raw', key)));
const signEvent = async (key: CryptoKey, ked: Record<string, unknown>, index = 0) => encodeIndexedSig(
  new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, key, saidify(ked, saidLabelsFor(ked)).raw)),
  index,
);

const buildMultisigInception = (currentKeys: string[], nextKeys: string[], threshold = currentKeys.length) => saidify({
  v: 'KERI10JSON000000_', t: 'icp', d: '#'.repeat(44), i: '#'.repeat(44), s: '0',
  kt: threshold.toString(16), k: currentKeys, nt: nextKeys.length.toString(16),
  n: nextKeys.map(key => blake3Digest(new TextEncoder().encode(key))),
  bt: '0', b: [], c: [], a: [],
}, ['d', 'i']).obj;

// Official BLAKE3 test vectors (input byte i = i mod 251), first 32 bytes of the extended output.
// Source: https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json
const BLAKE3_VECTORS: Array<[number, string]> = [
  [0, 'af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262'],
  [1, '2d3adedff11b61f14c886e35afa036736dcd87a74d27b5c1510225d0f592e213'],
  [3, 'e1be4d7a8ab5560aa4199eea339849ba8e293d55ca0a81006726d184519e647f'],
  [64, '4eed7141ea4a5cd4b788606bd23f46e212af9cacebacdc7d1f4c6dc7f2511b98'],
  [65, 'de1e5fa0be70df6d2be8fffd0e99ceaa8eb6e8c93a63f2d8d1c30ecb6b263dee'],
  [1023, '10108970eeda3eb932baac1428c7a2163b0e924c9a9e25b35bba72b28f70bd11'],
  [1024, '42214739f095a406f3fc83deb889744ac00df831c10daa55189b5d121c855af7'],
  [1025, 'd00278ae47eb27b34faecf67b4fe263f82d5412916c1ffd97c8cb7fb814b8444'],
  [2048, 'e776b6028c7cd22a4d0ba182a8bf62205d2ef576467e838ed6f2529b85fba24a'],
  [2049, '5f4d72f40d7a5f82b15ca2b2e44b1de3c2ef86c426c95c1af0b6879522563030'],
  [3072, 'b98cb0ff3623be03326b373de6b9095218513e64f1ee2edd2525c7ad1e5cffd2'],
  [3073, '7124b49501012f81cc7f11ca069ec9226cecb8a2c850cfe644e327d22d3e1cd3'],
  [4096, '015094013f57a5277b59d8475c0501042c0b642e531b0a1c8f58d2163229e969'],
  [4097, '9b4052b38f1c5fc8b1f9ff7ac7b27cd242487b3d890d15c96a1c25b8aa0fb995'],
  [5120, '9cadc15fed8b5d854562b26a9536d9707cadeda9b143978f319ab34230535833'],
  [5121, '628bd2cb2004694adaab7bbd778a25df25c47b9d4155a55f8fbd79f2fe154cff'],
  [6144, '3e2e5b74e048f3add6d21faab3f83aa44d3b2278afb83b80b3c35164ebeca205'],
  [6145, 'f1323a8631446cc50536a9f705ee5cb619424d46887f3c376c695b70e0f0507f'],
  [7168, '61da957ec2499a95d6b8023e2b0e604ec7f6b50e80a9678b89d2628e99ada77a'],
  [7169, 'a003fc7a51754a9b3c7fae0367ab3d782dccf28855a03d435f8cfe74605e7817'],
  [8192, 'aae792484c8efe4f19e2ca7d371d8c467ffb10748d8a5a1ae579948f718a2a63'],
  [8193, 'bab6c09cb8ce8cf459261398d2e7aef35700bf488116ceb94a36d0f5f1b7bc3b'],
  [16384, 'f875d6646de28985646f34ee13be9a576fd515f76b5b0a26bb324735041ddde4'],
  [31744, '62b6960e1a44bcc1eb1a611a8d6235b6b4b78f32e7abc4fb4c6cdcce94895c47'],
  [102400, 'bc3e3d41a1146b069abffad3c0d44860cf664390afce4d9661f7902e7943e085'],
];

describe('said.js · BLAKE3 + CESR + SAID primitives', () => {
  it('matches the official BLAKE3 test vectors across chunk and parent boundaries', () => {
    for (const [len, expected] of BLAKE3_VECTORS) {
      const input = new Uint8Array(len);
      for (let i = 0; i < len; i++) input[i] = i % 251;
      expect(hex(blake3(input, 32)), `len=${len}`).toBe(expected);
    }
  });

  it('round-trips CESR one-character codes and indexed signatures', () => {
    const raw = new Uint8Array(32).map((_, i) => i * 7 + 1);
    const qb64 = cesrEncode('E', raw);
    expect(qb64).toHaveLength(44);
    expect(qb64[0]).toBe('E');
    expect(hex(cesrDecode(qb64).raw)).toBe(hex(raw));
    expect(blake3Digest(new Uint8Array(0))).toBe(cesrEncode('E', blake3(new Uint8Array(0))));
    const sig = new Uint8Array(64).map((_, i) => 255 - i);
    expect(encodeIndexedSig(sig, 0)).toHaveLength(88);
    expect(encodeIndexedSig(sig, 0).startsWith('AA')).toBe(true);
  });

  it('recomputes every SAID in the GLEIF-IT/vlei-verifier regression fixture', () => {
    expect(fixture).toHaveLength(38);
    for (const ked of keds) expect(verifySaid(ked, saidLabelsFor(ked)).ok, `${ked.t || 'ACDC'} ${ked.d}`).toBe(true);
    const acdcs = keds.filter(k => k.v.startsWith('ACDC'));
    expect(acdcs.map(a => a.d)).toEqual([
      'EB0ryRNahTtyOudP9Q0V8wLGUskFZ1gxLlciWdhiukXz',
      'EHRFwPbmP81ju2sOBeIXAFbfah1gd7JPfe5hEL0sZPqN',
      'EOG8U0mxCb6fsymPA-EsirOw8ffAYkUCN2--UdjAK-1J',
      'EAPHGLJL1s6N4w1Hje5po6JPHu47R9-UoJqLweAci2LV',
    ]);
    for (const acdc of acdcs) {
      expect(verifySaid(acdc.a).ok).toBe(true);
      if (acdc.e) expect(verifySaid(acdc.e).ok).toBe(true);
    }
  });

  it('requires every self-addressed label to equal the computed SAID', () => {
    const icp = fixture[0].ked;
    const foreignAid = `F${icp.i.slice(1)}`;
    const forged = { ...icp, i: foreignAid };
    const result = verifySaid(forged, ['d', 'i']);
    expect(result.ok).toBe(false);
    expect(result.computed).toBe(icp.d);
    expect(result.mismatchedLabels).toContain('i');

    const vcp = keds.find(ked => ked.t === 'vcp')!;
    expect(verifySaid({ ...vcp, i: foreignAid }, ['d', 'i']).ok).toBe(false);
  });

  it('pins the fixture ACDCs to the official GLEIF-IT/vLEI-schema SAIDs', () => {
    const acdcs = keds.filter(k => k.v.startsWith('ACDC'));
    expect(acdcs.map(a => a.s)).toEqual([
      VLEI_SCHEMAS.EBfdlu8R27Fbx.said,
      VLEI_SCHEMAS.ENPXp1vQzRF6J.said,
      VLEI_SCHEMAS.EH6ekLjSr8V32.said,
      VLEI_SCHEMAS.EEy9PkikFcANV.said,
    ]);
    expect(VLEI_SCHEMAS.EEy9PkikFcANV.said).toBe('EEy9PkikFcANV1l7EHukCeXqrzT1hNZjGlUk7wuMO5jw');
    expect(VLEI_SCHEMAS.EBNaNu_M9P5cg.said).toBe('EBNaNu-M9P5cgrnfl2Fvymy4E_jvxxyjb70PRtiANlJy');
  });

  it('verifies Ed25519 controller signatures on KEL events with WebCrypto', async () => {
    const icp = fixture[0];
    expect(icp.ked.t).toBe('icp');
    expect(icp.sigs).toHaveLength(1);
    const result = await verifyEd25519(icp.ked.k[0], icp.sigs[0], saidify(icp.ked, ['d', 'i']).raw);
    expect(result.ok).toBe(true);
    const forged = await verifyEd25519(icp.ked.k[0], icp.sigs[0], saidify({ ...icp.ked, s: '9' }, ['d', 'i']).raw);
    expect(forged.ok).toBe(false);
  });

  it('verifies rotated key state and enforces the pre-rotation commitment', async () => {
    const k1 = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const k2 = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const k3 = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const pub = async (k: CryptoKey) => cesrEncode('D', new Uint8Array(await crypto.subtle.exportKey('raw', k)));
    const sign = async (k: CryptoKey, raw: Uint8Array) => encodeIndexedSig(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, k, raw)), 0);
    const icp = buildInception(await pub(k1.publicKey), await pub(k2.publicKey));
    const rot = saidify({ v: 'KERI10JSON000000_', t: 'rot', d: '#'.repeat(44), i: icp.i, s: '1', p: icp.d, kt: '1', k: [await pub(k2.publicKey)], nt: '1', n: [blake3Digest(new TextEncoder().encode(await pub(k3.publicKey)))], bt: '0', br: [], ba: [], a: [] }).obj;
    const messages = [asMessage(icp, [await sign(k1.privateKey, saidify(icp, ['d', 'i']).raw)]), asMessage(rot, [await sign(k2.privateKey, saidify(rot).raw)])];
    const report = await verifyChain(messages, {});
    expect(report.aids[icp.i].preRotation).toBe(true);
    expect(report.aids[icp.i].sigs.every(s => s.ok)).toBe(true);
    const badRot = saidify({ ...rot, k: [await pub(k3.publicKey)], d: '#'.repeat(44) }).obj;
    const bad = await verifyChain([messages[0], asMessage(badRot, [await sign(k3.privateKey, saidify(badRot).raw)])], {});
    expect(bad.aids[icp.i].preRotation).toBe(false);
    expect(bad.checks.find(c => c.id === 'sig')?.ok).toBe(false);
  });

  it('inherits kt across ixn events and never counts a signature index twice', async () => {
    const current = await Promise.all([
      crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']),
      crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']),
    ]);
    const next = await Promise.all([
      crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']),
      crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']),
    ]);
    const icp = buildMultisigInception(
      await Promise.all(current.map(key => publicQb64(key.publicKey))),
      await Promise.all(next.map(key => publicQb64(key.publicKey))),
      2,
    );
    const sig0 = await signEvent(current[0].privateKey, icp, 0);
    const sig1 = await signEvent(current[1].privateKey, icp, 1);
    const duplicate = await verifyChain([asMessage(icp, [sig0, sig0])], {});
    expect(duplicate.aids[icp.i].sigs[0]).toMatchObject({ ok: false, valid: 1, reason: 'DUPLICATE_SIGNATURE_INDEX' });

    const ixn = saidify({
      v: 'KERI10JSON000000_', t: 'ixn', d: '#'.repeat(44), i: icp.i,
      s: '1', p: icp.d, a: [],
    }).obj;
    const inherited = await verifyChain([
      asMessage(icp, [sig0, sig1]),
      asMessage(ixn, [await signEvent(current[0].privateKey, ixn, 0)]),
    ], {});
    expect(inherited.aids[icp.i].sigs[1]).toMatchObject({ ok: false, threshold: 2, valid: 1 });
    expect(inherited.decision.code).toBe('DENY_SIGNATURE_INVALID');
  });

  it('rejects duplicate current keys and duplicate next-key commitments', async () => {
    const current = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const next = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const currentPublic = await publicQb64(current.publicKey), nextPublic = await publicQb64(next.publicKey);
    const duplicateKeys = buildMultisigInception([currentPublic, currentPublic], [nextPublic], 2);
    const rawSignature = new Uint8Array(await crypto.subtle.sign(
      { name: 'Ed25519' },
      current.privateKey,
      saidify(duplicateKeys, ['d', 'i']).raw,
    ));
    const duplicateKeyReport = await verifyChain([
      asMessage(duplicateKeys, [encodeIndexedSig(rawSignature, 0), encodeIndexedSig(rawSignature, 1)]),
    ], {});
    expect(duplicateKeyReport.checks.find(check => check.id === 'kel')?.ok).toBe(false);
    expect(duplicateKeyReport.decision.code).toBe('DENY_KEL_INVALID');

    const duplicateNext = buildMultisigInception([currentPublic], [nextPublic, nextPublic], 1);
    const duplicateNextReport = await verifyChain([asMessage(duplicateNext)], { verifySignatures: false });
    expect(duplicateNextReport.checks.find(check => check.id === 'kel')?.ok).toBe(false);
    expect(duplicateNextReport.aids[duplicateNext.i].kelErrors.join(' ')).toContain('DUPLICATE_NEXT_KEY_COMMITMENT');
  });

  it('fails closed on unsupported weighted thresholds and inconsistent nt/n state', async () => {
    const current = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const next = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const currentPublic = await publicQb64(current.publicKey), nextPublic = await publicQb64(next.publicKey);
    const base = buildInception(currentPublic, nextPublic);
    for (const kt of [[null], [], [['1/2']], ['1/2']]) {
      const malformed = saidify({ ...base, d: '#'.repeat(44), i: '#'.repeat(44), kt }, ['d', 'i']).obj;
      const report = await verifyChain([asMessage(malformed)], { verifySignatures: false });
      expect(report.checks.find(check => check.id === 'kel')?.ok).toBe(false);
      expect(report.decision.code).toBe('DENY_KEL_INVALID');
    }

    const zeroNextThreshold = saidify({ ...base, d: '#'.repeat(44), i: '#'.repeat(44), nt: '0' }, ['d', 'i']).obj;
    const zeroNextReport = await verifyChain([asMessage(zeroNextThreshold)], { verifySignatures: false });
    expect(zeroNextReport.checks.find(check => check.id === 'kel')?.ok).toBe(false);

    const later = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const rotation = saidify({
      v: 'KERI10JSON000000_', t: 'rot', d: '#'.repeat(44), i: base.i, s: '1', p: base.d,
      kt: '1', k: [nextPublic], nt: '0', n: [blake3Digest(new TextEncoder().encode(await publicQb64(later.publicKey)))],
      bt: '0', br: [], ba: [], a: [],
    }).obj;
    const rotationReport = await verifyChain([asMessage(base), asMessage(rotation)], { verifySignatures: false });
    expect(rotationReport.checks.find(check => check.id === 'kel')?.ok).toBe(false);
    expect(rotationReport.aids[base.i].kelErrors.join(' ')).toContain('INVALID_NEXT_THRESHOLD');
  });

  it('rejects KEL gaps, wrong prior links, sequence forks, and stale post-rotation keys', async () => {
    const k1 = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const k2 = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const k3 = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const p1 = await publicQb64(k1.publicKey), p2 = await publicQb64(k2.publicKey), p3 = await publicQb64(k3.publicKey);
    const icp = buildInception(p1, p2);
    const validIxn = saidify({ v: 'KERI10JSON000000_', t: 'ixn', d: '#'.repeat(44), i: icp.i, s: '1', p: icp.d, a: [] }).obj;
    const wrongPrior = saidify({ ...validIxn, d: '#'.repeat(44), p: '#'.repeat(44) }).obj;
    const gap = saidify({ ...validIxn, d: '#'.repeat(44), s: '2' }).obj;
    const fork = saidify({ ...validIxn, d: '#'.repeat(44), a: [{ i: '#'.repeat(44), s: '0', d: '#'.repeat(44) }] }).obj;
    for (const events of [[icp, wrongPrior], [icp, gap], [icp, validIxn, fork]]) {
      const report = await verifyChain(events.map(event => asMessage(event)), { verifySignatures: false });
      expect(report.checks.find(check => check.id === 'kel')?.ok).toBe(false);
      expect(report.decision.code).toBe('DENY_KEL_INVALID');
    }

    const rot = saidify({
      v: 'KERI10JSON000000_', t: 'rot', d: '#'.repeat(44), i: icp.i, s: '1', p: icp.d,
      kt: '1', k: [p2], nt: '1', n: [blake3Digest(new TextEncoder().encode(p3))],
      bt: '0', br: [], ba: [], a: [],
    }).obj;
    const afterRotation = saidify({ v: 'KERI10JSON000000_', t: 'ixn', d: '#'.repeat(44), i: icp.i, s: '2', p: rot.d, a: [] }).obj;
    const stale = await verifyChain([
      asMessage(icp, [await signEvent(k1.privateKey, icp)]),
      asMessage(rot, [await signEvent(k2.privateKey, rot)]),
      asMessage(afterRotation, [await signEvent(k1.privateKey, afterRotation)]),
    ], {});
    expect(stale.aids[icp.i].sigs[2].ok).toBe(false);
    expect(stale.decision.code).toBe('DENY_SIGNATURE_INVALID');
  });

  it('validates every key and threshold in a multi-key pre-rotation commitment', async () => {
    const current = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const next = await Promise.all([
      crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']),
      crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']),
    ]);
    const foreign = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const pCurrent = await publicQb64(current.publicKey);
    const nextPublic = await Promise.all(next.map(key => publicQb64(key.publicKey)));
    const icp = buildMultisigInception([pCurrent], nextPublic, 1);
    const makeRotation = (keys: string[], kt = '2') => saidify({
      v: 'KERI10JSON000000_', t: 'rot', d: '#'.repeat(44), i: icp.i, s: '1', p: icp.d,
      kt, k: keys, nt: '0', n: [], bt: '0', br: [], ba: [], a: [],
    }).obj;
    const valid = makeRotation(nextPublic);
    const validReport = await verifyChain([asMessage(icp), asMessage(valid)], { verifySignatures: false });
    expect(validReport.aids[icp.i].preRotation).toBe(true);

    const changed = makeRotation([nextPublic[0], await publicQb64(foreign.publicKey)]);
    const missing = makeRotation([nextPublic[0]], '1');
    const wrongThreshold = makeRotation(nextPublic, '1');
    for (const rotation of [changed, missing, wrongThreshold]) {
      const report = await verifyChain([asMessage(icp), asMessage(rotation)], { verifySignatures: false });
      expect(report.aids[icp.i].preRotation).toBe(false);
      expect(report.decision.code).toBe('DENY_KEL_INVALID');
    }
  });

  it('self-addresses the proposed Agent Delegation schema', () => {
    expect(verifySaid(AGENT_DELEGATION_SCHEMA, ['$id']).ok).toBe(true);
    expect(AGENT_DELEGATION_SCHEMA.title).toContain('NOT a GLEIF vLEI schema');
  });
});

describe('said.js · chain walk over the official fixture', () => {
  const ecr = keds.find(k => k.d === 'EAPHGLJL1s6N4w1Hje5po6JPHu47R9-UoJqLweAci2LV')!;
  const dt = '2026-08-28T10:00:00.000Z';

  async function withDelegation(extra: ReturnType<typeof asMessage>[] = [], opts: Record<string, unknown> = {}) {
    const agentIcp = buildInception('DJCVOtOyP7o_v6gxPrbVHObD_X0NHjc2zhwEJtGnXDlw', 'DJCVOtOyP7o_v6gxPrbVHObD_X0NHjc2zhwEJtGnXDlw');
    const registry = buildRegistryInception(ecr.a.i, 'EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    const delegation = buildAgentDelegation({ roleCredential: ecr, agentAid: agentIcp.i, registry: registry.i, purpose: 'CBAM draft', scope: { allow: ['read:carbon-vc'], deny: ['read:recipe'], confirm: ['submit'] }, expires: '2026-08-28T10:10:00.000Z', dt, ttlMinutes: 10 });
    const iss = buildIssuance(delegation.d, registry.i, dt);
    const messages = [...fixture, asMessage(registry), asMessage(iss), asMessage(delegation), ...extra];
    return { delegation, iss, registry, report: await verifyChain(messages, { rootAid: ROOT_OF_TRUST.fixture.aid, verifySignatures: false, now: new Date('2026-08-28T10:05:00.000Z'), leafSaid: delegation.d, unanchoredOk: new Set([delegation.d]), ...opts }) };
  }

  function replaceTerminalEcr(
    mutate: (credential: Record<string, any>) => Record<string, any>,
  ) {
    const originalIss = keds.find(ked => ked.t === 'iss' && ked.i === ecr.d)!;
    const changed = mutate(structuredClone(ecr));
    if (changed.a && typeof changed.a === 'object') changed.a = saidify({ ...changed.a, d: '#'.repeat(44) }).obj;
    if (changed.e && typeof changed.e === 'object') changed.e = saidify({ ...changed.e, d: '#'.repeat(44) }).obj;
    const credential = saidify({ ...changed, d: '#'.repeat(44) }).obj;
    const issuance = saidify({ ...originalIss, d: '#'.repeat(44), i: credential.d }).obj;
    const originalAnchor = keds.find(ked => ked.t === 'ixn' && ked.a?.some((seal: any) => seal.i === ecr.d && seal.d === originalIss.d))!;
    const anchor = saidify({
      ...originalAnchor,
      d: '#'.repeat(44),
      a: originalAnchor.a.map((seal: any) => seal.i === ecr.d && seal.d === originalIss.d
        ? { ...seal, i: credential.d, d: issuance.d }
        : seal),
    }).obj;
    return {
      credential,
      messages: fixture.map(message => {
        if (message.ked.d === ecr.d) return asMessage(credential);
        if (message.ked.d === originalIss.d) return asMessage(issuance);
        if (message.ked.d === originalAnchor.d) return asMessage(anchor);
        return message;
      }),
    };
  }

  it('walks GLEIF → QVI → LE → ECR AUTH → ECR with I2I edges and TEL issuance', async () => {
    const report = await verifyChain(fixture, { rootAid: ROOT_OF_TRUST.fixture.aid });
    expect(report.decision.code).toBe('ALLOW_CHAIN_VERIFIED');
    expect(report.decision.tool_execution).toBe(true);
    expect(report.credentials.map(c => c.schemaKey)).toEqual(['QVI', 'LE', 'ECR_AUTH', 'ECR']);
    expect(report.credentials.every(c => c.chainValid && c.status === 'ISSUED')).toBe(true);
    expect(report.checks.find(c => c.id === 'sig')?.label).toContain('11/11');
    expect(report.checks.find(c => c.id === 'parse')?.ok).toBe(true);
    expect(Object.values(report.registries).every(r => r.anchored && r.vcpSaidOk)).toBe(true);
  });

  it('accepts exact transport duplicates but rejects conflicting bodies with the same type and SAID', async () => {
    const exact = await verifyChain([...fixture, fixture[0]], { rootAid: ROOT_OF_TRUST.fixture.aid });
    expect(exact.checks.find(check => check.id === 'duplicate-event')?.ok).toBe(true);
    expect(exact.decision.code).toBe('ALLOW_CHAIN_VERIFIED');

    const conflict = {
      ...fixture[0],
      ked: { ...fixture[0].ked, s: 'f' },
    };
    const denied = await verifyChain([...fixture, conflict], { rootAid: ROOT_OF_TRUST.fixture.aid });
    expect(denied.checks.find(check => check.id === 'duplicate-event')?.ok).toBe(false);
    expect(denied.decision.code).toBe('DENY_DUPLICATE_EVENT_CONFLICT');
  });

  it('fails closed instead of silently ignoring unsupported KERI or TEL event families', async () => {
    const unsupported = saidify({
      v: 'KERI10JSON000000_', t: 'vrt', d: '#'.repeat(44),
      i: ecr.ri, s: '1', p: '#'.repeat(44), bt: '0', br: [], ba: [],
    }).obj;
    const report = await verifyChain([...fixture, asMessage(unsupported)], {
      rootAid: ROOT_OF_TRUST.fixture.aid,
    });

    expect(report.checks).toContainEqual(expect.objectContaining({ id: 'message-type', ok: false }));
    expect(report.decision.code).toBe('DENY_UNSUPPORTED_EVENT_TYPE');
    expect(report.decision.tool_execution).toBe(false);
  });

  it('rejects invalid or disconnected credentials even when the intended terminal chain is valid', async () => {
    const qvi = keds.find(ked => ked?.v?.startsWith('ACDC') && schemaBySaid(ked.s)?.key === 'QVI')!;
    const disconnected = saidify({
      ...structuredClone(qvi),
      d: '#'.repeat(44),
      ri: 'EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    }).obj;
    const report = await verifyChain([...fixture, asMessage(disconnected)], {
      rootAid: ROOT_OF_TRUST.fixture.aid,
      leafSaid: ecr.d,
    });

    expect(report.checks).toContainEqual(expect.objectContaining({ id: 'credential-graph', ok: false }));
    expect(report.checks).toContainEqual(expect.objectContaining({ id: 'credential-set', ok: false }));
    expect(report.decision.code).toBe('DENY_CREDENTIAL_GRAPH_INVALID');
    expect(report.decision.tool_execution).toBe(false);
  });

  it('rejects an unused or unanchored extra TEL registry instead of ignoring it', async () => {
    const extraRegistry = buildRegistryInception(
      ROOT_OF_TRUST.fixture.aid,
      'EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    const report = await verifyChain([...fixture, asMessage(extraRegistry)], {
      rootAid: ROOT_OF_TRUST.fixture.aid,
    });

    expect(report.checks).toContainEqual(expect.objectContaining({ id: 'registry-coverage', ok: false }));
    expect(report.decision.code).toBe('DENY_REGISTRY_COVERAGE_INVALID');
    expect(report.decision.tool_execution).toBe(false);
  });

  it('rejects an unrelated but structurally valid KEL instead of ignoring it', async () => {
    const key = fixture[0].ked.k[0];
    const unrelatedAid = buildInception(key, key);
    const report = await verifyChain([...fixture, asMessage(unrelatedAid)], {
      rootAid: ROOT_OF_TRUST.fixture.aid,
      verifySignatures: false,
    });

    expect(report.checks).toContainEqual(expect.objectContaining({ id: 'aid-coverage', ok: false }));
    expect(report.decision.code).toBe('DENY_UNCONSUMED_AID');
    expect(report.decision.tool_execution).toBe(false);
  });

  it('does not treat an unanchored rev as authoritative, but accepts an exact signed-KEL seal as revoked', async () => {
    const iss = keds.find(ked => ked.t === 'iss' && ked.i === ecr.d)!;
    const rev = buildRevocation(ecr.d, ecr.ri, iss.d, dt);
    const unanchored = await verifyChain([...fixture, asMessage(rev)], {
      rootAid: ROOT_OF_TRUST.fixture.aid,
      verifySignatures: false,
    });
    const unanchoredEcr = unanchored.credentials.find(credential => credential.said === ecr.d)!;
    expect(unanchored.decision.code).toBe('DENY_TEL_EVENT_UNANCHORED');
    expect(unanchoredEcr.status).toBe('UNKNOWN');
    expect(unanchoredEcr.checks).toContainEqual(expect.objectContaining({ id: 'rev-anchor', ok: false, anchored: false }));
    expect(unanchoredEcr.checks.find(check => check.id === 'tel')?.anchored).toBe(false);

    const issuerKel = fixture
      .filter(message => message.ked.i === ecr.i && ['icp', 'rot', 'ixn'].includes(message.ked.t))
      .sort((left, right) => Number.parseInt(left.ked.s, 16) - Number.parseInt(right.ked.s, 16));
    const prior = issuerKel.at(-1)!.ked;
    const revAnchor = saidify({
      v: 'KERI10JSON000000_', t: 'ixn', d: '#'.repeat(44), i: ecr.i,
      s: (Number.parseInt(prior.s, 16) + 1).toString(16), p: prior.d,
      a: [{ i: ecr.d, s: rev.s, d: rev.d }],
    }).obj;
    const anchored = await verifyChain([...fixture, asMessage(rev), asMessage(revAnchor)], {
      rootAid: ROOT_OF_TRUST.fixture.aid,
      verifySignatures: false,
    });
    const anchoredEcr = anchored.credentials.find(credential => credential.said === ecr.d)!;
    expect(anchored.decision.code).toBe('DENY_CREDENTIAL_REVOKED');
    expect(anchoredEcr.status).toBe('REVOKED');
    expect(anchoredEcr.checks).toContainEqual(expect.objectContaining({ id: 'rev-anchor', ok: true, anchored: true }));
  });

  it('rejects unknown edge operators even when every affected SAID and TEL seal is refreshed', async () => {
    const { credential, messages } = replaceTerminalEcr(value => ({
      ...value,
      e: { ...value.e, auth: { ...value.e.auth, o: 'UNKNOWN' } },
    }));
    const report = await verifyChain(messages, {
      rootAid: ROOT_OF_TRUST.fixture.aid,
      verifySignatures: false,
      leafSaid: credential.d,
    });
    expect(report.credentials.at(-1)?.checks).toContainEqual(expect.objectContaining({ id: 'schema-shape', ok: false }));
    expect(report.decision.code).toBe('DENY_SCHEMA_CONFORMANCE');
  });

  it('fails closed on missing required and forbidden extra fields in pinned schema invariants', async () => {
    const mutations = [
      (value: Record<string, any>) => {
        const next = { ...value };
        delete next.u;
        return next;
      },
      (value: Record<string, any>) => {
        const next = { ...value };
        delete next.r;
        return next;
      },
      (value: Record<string, any>) => {
        const next = { ...value, a: { ...value.a } };
        delete next.a.personLegalName;
        return next;
      },
      (value: Record<string, any>) => ({ ...value, a: { ...value.a, unexpectedClaim: 'not allowed' } }),
      (value: Record<string, any>) => ({ ...value, unexpectedTopLevel: 'not allowed' }),
      (value: Record<string, any>) => ({
        ...value,
        r: {
          ...value.r,
          privacyDisclaimer: { l: 'This is not the pinned disclaimer constant.' },
        },
      }),
    ];
    for (const mutate of mutations) {
      const { credential, messages } = replaceTerminalEcr(mutate);
      const report = await verifyChain(messages, {
        rootAid: ROOT_OF_TRUST.fixture.aid,
        verifySignatures: false,
        leafSaid: credential.d,
      });
      expect(report.credentials.at(-1)?.checks).toContainEqual(expect.objectContaining({ id: 'schema-shape', ok: false }));
      expect(report.decision.code).toBe('DENY_SCHEMA_CONFORMANCE');
    }
  });

  it('binds role credentials to the authorization subject AID and legal entity LEI', async () => {
    const wrongSubject = replaceTerminalEcr(value => ({
      ...value,
      a: { ...value.a, i: 'EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
    }));
    const subjectReport = await verifyChain(wrongSubject.messages, {
      rootAid: ROOT_OF_TRUST.fixture.aid,
      verifySignatures: false,
      leafSaid: wrongSubject.credential.d,
    });
    expect(subjectReport.credentials.at(-1)?.checks).toContainEqual(expect.objectContaining({ id: 'edge:auth', ok: false }));
    expect(subjectReport.decision.code).toBe('DENY_CHAIN_BROKEN');

    const wrongLei = replaceTerminalEcr(value => ({
      ...value,
      a: { ...value.a, LEI: '5493001KJTIIGC8Y1R12' },
    }));
    const leiReport = await verifyChain(wrongLei.messages, {
      rootAid: ROOT_OF_TRUST.fixture.aid,
      verifySignatures: false,
      leafSaid: wrongLei.credential.d,
    });
    expect(leiReport.credentials.at(-1)?.checks).toContainEqual(expect.objectContaining({ id: 'edge:auth', ok: false }));
    expect(leiReport.decision.code).toBe('DENY_CHAIN_BROKEN');
  });

  it('binds every credential issuer to the controller of its TEL registry', async () => {
    const key = 'DJCVOtOyP7o_v6gxPrbVHObD_X0NHjc2zhwEJtGnXDlw';
    const attackerIcp = buildInception(key, key);
    const registry = buildRegistryInception(attackerIcp.i, 'EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    const attributes = saidify({
      d: '#'.repeat(44),
      i: attackerIcp.i,
      dt,
      LEI: '9845004CC7884BN85018',
    }).obj;
    const forgedQvi = saidify({
      v: 'ACDC10JSON000000_',
      d: '#'.repeat(44),
      // The attacker claims GLEIF as issuer while using an attacker-controlled
      // registry. SAIDs and TEL anchors alone must never make that claim valid.
      i: ROOT_OF_TRUST.fixture.aid,
      ri: registry.i,
      s: VLEI_SCHEMAS.EBfdlu8R27Fbx.said,
      a: attributes,
    }).obj;
    const issuance = buildIssuance(forgedQvi.d, registry.i, dt);
    const registryAnchor = saidify({
      v: 'KERI10JSON000000_', t: 'ixn', d: '#'.repeat(44), i: attackerIcp.i,
      s: '1', p: attackerIcp.d, a: [{ i: registry.i, s: '0', d: registry.d }],
    }).obj;
    const issuanceAnchor = saidify({
      v: 'KERI10JSON000000_', t: 'ixn', d: '#'.repeat(44), i: attackerIcp.i,
      s: '2', p: registryAnchor.d, a: [{ i: forgedQvi.d, s: '0', d: issuance.d }],
    }).obj;

    const report = await verifyChain([
      asMessage(attackerIcp), asMessage(registryAnchor), asMessage(issuanceAnchor),
      asMessage(registry), asMessage(issuance), asMessage(forgedQvi),
    ], { rootAid: ROOT_OF_TRUST.fixture.aid, verifySignatures: false });

    expect(report.decision.code).toBe('DENY_REGISTRY_ISSUER_MISMATCH');
    expect(report.decision.tool_execution).toBe(false);
    expect(report.credentials[0].checks).toContainEqual(expect.objectContaining({
      id: 'registry-issuer',
      ok: false,
    }));
  });

  it('allows a freshly issued delegation chained I2I to the real ECR credential', async () => {
    const { report, delegation } = await withDelegation();
    expect(report.decision.code).toBe('ALLOW_CHAIN_VERIFIED');
    expect(report.decision.leaf).toBe(delegation.d);
    expect(delegation.e.role).toMatchObject({ n: ecr.d, s: ecr.s, o: 'I2I' });
    expect(delegation.i).toBe(ecr.a.i);
    expect(verifySaid(delegation).ok && verifySaid(delegation.a).ok && verifySaid(delegation.e).ok).toBe(true);
  });

  it('denies once the delegation itself is revoked in its TEL', async () => {
    const base = await withDelegation();
    const { report } = await withDelegation([], { revoked: new Set([base.delegation.d]) });
    expect(report.decision.code).toBe('DENY_CREDENTIAL_REVOKED');
    expect(report.decision.tool_execution).toBe(false);
    expect(report.credentials.at(-1)?.statusScope).toBe('DEMO_SIMULATION_ONLY');
  });

  it('cascades upstream ECR and LE revocations down to the agent delegation', async () => {
    const ecrRevoked = await withDelegation([], { revoked: new Set([ecr.d]) });
    expect(ecrRevoked.report.decision.code).toBe('DENY_UPSTREAM_ECR_REVOKED');
    const le = keds.find(k => k.d === 'EHRFwPbmP81ju2sOBeIXAFbfah1gd7JPfe5hEL0sZPqN')!;
    const leRevoked = await withDelegation([], { revoked: new Set([le.d]) });
    expect(leRevoked.report.decision.code).toBe('DENY_UPSTREAM_LE_REVOKED');
  });

  it('fails closed on missing delegation, un-anchored issuance, corrupted stream and unmet kt threshold', async () => {
    const noDelegation = await verifyChain(fixture, { rootAid: ROOT_OF_TRUST.fixture.aid, verifySignatures: false, leafSaid: 'EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });
    expect(noDelegation.decision.code).toBe('DENY_NO_DELEGATION');

    const base = await withDelegation();
    const unanchored = await withDelegation([], { unanchoredOk: new Set() });
    expect(unanchored.report.decision.code).toBe('DENY_TEL_NOT_ANCHORED');
    const unanchoredDelegation = unanchored.report.credentials.find(c => c.said === unanchored.delegation.d)!;
    expect(unanchoredDelegation.status).toBe('UNKNOWN');
    expect(unanchoredDelegation.checks.find(check => check.id === 'tel')).toMatchObject({ ok: false, anchored: false });
    expect(unanchoredDelegation.checks.find(check => check.id === 'tel')?.detail).not.toContain('Anchored iss');
    expect(base.report.credentials.slice(0, 4).every(c => c.checks.find(x => x.id === 'anchor')?.anchored)).toBe(true);

    const corrupted = parseCesrStream(fixtureText.replace('"t": "iss"', '"t": "iss",,'));
    expect(corrupted.filter(m => m.error)).toHaveLength(1);
    const corruptReport = await verifyChain(corrupted, { rootAid: ROOT_OF_TRUST.fixture.aid, verifySignatures: false });
    expect(corruptReport.decision.code).toBe('DENY_STREAM_CORRUPT');

    const icp = fixture[0];
    const multisig = { ...icp, ked: saidify({ ...icp.ked, kt: '2', k: [icp.ked.k[0], icp.ked.k[0]] }, ['d', 'i']).obj };
    const thresholdReport = await verifyChain([multisig], {});
    expect(thresholdReport.aids[multisig.ked.i].sigs[0].reason).toMatch(/THRESHOLD_NOT_MET|SIGNATURE_INVALID|DUPLICATE_CURRENT_KEY/);
    expect(thresholdReport.checks.find(c => c.id === 'kel')?.ok).toBe(false);
    expect(thresholdReport.checks.find(c => c.id === 'sig')?.ok).toBe(false);
  });

  it('denies expired mandates, tampered attributes and a mismatched root of trust', async () => {
    const expired = await withDelegation([], { now: new Date('2026-08-28T11:00:00.000Z') });
    expect(expired.report.decision.code).toBe('DENY_MANDATE_EXPIRED');
    const base0 = await withDelegation();
    const past = buildAgentDelegation({ roleCredential: ecr, agentAid: base0.delegation.a.i, registry: base0.registry.i, purpose: 'stale', scope: { allow: [], deny: [] }, expires: '2020-01-01T00:00:00.000Z', dt, ttlMinutes: 1 });
    const realClock = await verifyChain([...fixture, asMessage(base0.registry), asMessage(buildIssuance(past.d, base0.registry.i, dt)), asMessage(past)], { rootAid: ROOT_OF_TRUST.fixture.aid, verifySignatures: false, leafSaid: past.d, unanchoredOk: new Set([past.d]) });
    expect(realClock.decision.code).toBe('DENY_MANDATE_EXPIRED');
    const unparseable = buildAgentDelegation({ roleCredential: ecr, agentAid: base0.delegation.a.i, registry: base0.registry.i, purpose: 'bad', scope: { allow: [], deny: [] }, expires: 'not-a-date', dt, ttlMinutes: 1 });
    const badExpiry = await verifyChain([...fixture, asMessage(base0.registry), asMessage(buildIssuance(unparseable.d, base0.registry.i, dt)), asMessage(unparseable)], { rootAid: ROOT_OF_TRUST.fixture.aid, verifySignatures: false, now: new Date('2026-08-28T10:05:00.000Z'), leafSaid: unparseable.d, unanchoredOk: new Set([unparseable.d]) });
    expect(badExpiry.decision.code).toBe('DENY_MANDATE_EXPIRED');

    const base = await withDelegation();
    const tampered = { ...base.delegation, a: { ...base.delegation.a, purpose: 'exfiltrate everything' } };
    const messages = [...fixture, asMessage(base.registry), asMessage(base.iss), asMessage(tampered)];
    const tamperReport = await verifyChain(messages, { rootAid: ROOT_OF_TRUST.fixture.aid, verifySignatures: false, now: new Date('2026-08-28T10:05:00.000Z'), leafSaid: tampered.d, unanchoredOk: new Set([tampered.d]) });
    expect(tamperReport.decision.code).toBe('DENY_SAID_MISMATCH');

    const prod = await withDelegation([], { rootAid: ROOT_OF_TRUST.production.aid });
    expect(prod.report.decision.code).toBe('DENY_ROOT_MISMATCH');
    expect(ROOT_OF_TRUST.production.aid).toBe('EINmHd5g7iV-UldkkkKyBIH052bIyxZNBn9pq-zNrYoS');
  });
});

describe('said.js · selective disclosure of the carbon-footprint credential', () => {
  const le = keds.find(k => k.d === 'EHRFwPbmP81ju2sOBeIXAFbfah1gd7JPfe5hEL0sZPqN')!;
  const fixtureVc = { leCredential: le, registry: le.ri, dt: '2026-08-28T10:00:00.000Z', product: { gtin: '4710002048007', name: 'VF-2048' }, carbon: { value_kgco2e: 12.4, unit: 'kgCO2e/unit', method: 'ISO 14067:2018' }, process: { recipe: ['alloy-X 62%'], suppliers: ['S-001'] }, audit: { verifier_lei: '5493001KJTIIGC8Y1R12' } };

  it('accepts a presentation that withholds process and audit while recomputing every SAID', async () => {
    const chain = await verifyChain(fixture, { rootAid: ROOT_OF_TRUST.fixture.aid, verifySignatures: false });
    const vc = buildCarbonCredential(fixtureVc);
    expect(vc.e.le).toEqual({ n: le.d, s: le.s });
    expect(vc.i).toBe(le.a.i);
    const full = verifyDisclosure(vc, chain);
    expect(full.decision).toBe('ACCEPT_CARBON_CLAIM');
    expect(full.withheldBlocks).toEqual([]);
    const partial = disclose(vc, ['product', 'carbon']);
    const result = verifyDisclosure(partial, chain);
    expect(result.decision).toBe('ACCEPT_CARBON_CLAIM');
    expect(result.withheldBlocks).toEqual(['process', 'audit']);
    expect(result.carbon.value_kgco2e).toBe(12.4);
    expect(JSON.stringify(partial)).not.toContain('alloy-X');
    expect(result.bytes).toBeLessThan(serialize(vc).length);
    expect(typeof partial.a.process).toBe('string');
    expect(partial.a.process).toBe(vc.a.process.d);
    expect(partial.d).toBe(vc.d);
  });

  it('denies tampered values, missing required blocks and an invalid issuer chain', async () => {
    const chain = await verifyChain(fixture, { rootAid: ROOT_OF_TRUST.fixture.aid, verifySignatures: false });
    const vc = buildCarbonCredential(fixtureVc);
    const tampered = disclose({ ...vc, a: { ...vc.a, carbon: { ...vc.a.carbon, value_kgco2e: 2.4 } } }, ['product', 'carbon']);
    expect(verifyDisclosure(tampered, chain).decision).toBe('DENY_SAID_MISMATCH');
    expect(verifyDisclosure(disclose(vc, ['product']), chain).decision).toBe('DENY_REQUIRED_BLOCK_WITHHELD');
    const revokedChain = await verifyChain(fixture, { rootAid: ROOT_OF_TRUST.fixture.aid, verifySignatures: false, revoked: new Set([le.d]) });
    expect(verifyDisclosure(disclose(vc, ['product', 'carbon']), revokedChain).decision).toBe('DENY_ISSUER_CHAIN_INVALID');
    expect(verifySaid(CARBON_SCHEMA, ['$id']).ok).toBe(true);
    expect(CARBON_SCHEMA.scopeTags.process).toBe('read:process-recipe');
  });
});

describe('Update Trust standalone page', () => {
  it('ships the pinned official fixture and loads the verifier module', () => {
    expect(page).toContain('<script type="module">');
    expect(page).toContain("import * as K from '/update-trust/said.js'");
    expect(page).toContain("local: '/update-trust/credential.cesr'");
    expect(page).toContain('https://raw.githubusercontent.com/GLEIF-IT/vlei-verifier/5850051b52dce24ed59eae486af76e7c73f6012c/tests/data/credential/credential.cesr');
    expect(page).toContain("ecrSaid: 'EAPHGLJL1s6N4w1Hje5po6JPHu47R9-UoJqLweAci2LV'");
    expect(fixtureText).toContain('EAPHGLJL1s6N4w1Hje5po6JPHu47R9-UoJqLweAci2LV');
  });

  it('maps the six trust points and labels official versus proposed mechanisms', () => {
    ['Principal · 代表誰', 'Authorization · 授權什麼', 'Tool／Action · 行動邊界', 'Policy Gate · 高風險把關', 'Audit · 可稽核', 'Revocation · 可撤銷'].forEach(label => expect(page).toContain(label));
    expect(page).toContain('OFFICIAL · EGF');
    expect(page).toContain('PROPOSED · ACDC');
    expect(page).toContain('PROPOSED EXTENSION');
    expect(page).toContain('Agent Delegation ACDC 與碳足跡 VC（提案，非 GLEIF 官方）');
  });

  it('exposes the full lifecycle with machine-readable deny codes', () => {
    ['DENY_CREDENTIAL_REVOKED', 'DENY_UPSTREAM_ECR_REVOKED', 'DENY_UPSTREAM_LE_REVOKED', 'DENY_MANDATE_EXPIRED', 'DENY_SAID_MISMATCH', 'DENY_ROOT_MISMATCH', 'DENY_NO_DELEGATION', 'DENY_SIGNATURE_UNVERIFIABLE', 'DENY_TEL_NOT_ANCHORED', 'DENY_TEL_EVENT_UNANCHORED', 'DENY_UNSUPPORTED_EVENT_TYPE', 'DENY_CREDENTIAL_GRAPH_INVALID', 'DENY_REGISTRY_COVERAGE_INVALID', 'DENY_UNCONSUMED_AID', 'ALLOW_CHAIN_VERIFIED'].forEach(code => expect(page).toContain(code));
    expect(page).toContain('const esc = v =>');
    expect(page).toContain("s: (parseInt(prior.s, 16) + 1).toString(16)");
    ['id="revokeDelegation"', 'id="revokeEcr"', 'id="revokeLe"', 'id="expireMandate"', 'id="tamperScope"', 'id="rotateAgent"', 'id="reissue"'].forEach(id => expect(page).toContain(id));
    expect(page).toContain('tool_execution=false');
    expect(page).toContain('id="rootProduction"');
  });

  it('keeps the verification layers honest and cites GLEIF sources', () => {
    expect(page).toContain('witness receipts、即時 key state、duplicity');
    expect(page).toContain('production verifier 預期拒絕');
    expect(page).toContain('未寫入任何真實 KEL／TEL');
    expect(page).toContain('EGF 已經定義了什麼、還沒定義什麼、我們補上什麼');
    expect(page).toContain('Primary Document v1.2 · 2026-03-25');
    expect(page).toContain('https://www.gleif.org/en/organizational-identity/introducing-the-verifiable-lei-vlei/introducing-the-vlei-ecosystem-governance-framework');
    expect(page).toContain('https://github.com/GLEIF-IT/vlei-trainings/tree/main/markdown');
    expect(page).toContain('https://www.gleif.org/en/newsroom/blog/why-ai-agents-need-verifiable-organizational-identity');
    expect(page).toContain('verifyfirst.update-trust-evidence.v1');
    expect(page).toContain("tel_scope: 'SUPPLIED_STREAM_SNAPSHOT_ONLY'");
  });

  it('provides a replayable 60-second lifecycle tour ending fail closed', () => {
    expect(page).toContain('觀看 60 秒生命週期');
    expect(page).toContain("chapter: '01 · OFFICIAL CHAIN'");
    expect(page).toContain("chapter: '04 · DISCLOSE ONLY CARBON'");
    expect(page).toContain("chapter: '06 · UPSTREAM REVOKE'");
    expect(page).toContain("chapter: '07 · FAIL CLOSED'");
    expect(page).toContain('只揭露碳排那一項，不交出製程機密');
    expect(page).toContain("scopeTags[b]");
    expect(page).toContain('SCOPE_DENIED');
    expect(page).toContain('<textarea id="fAllow">verify:vlei-chain, read:product-id, read:carbon-footprint-vc, draft:cbam-declaration</textarea>');
    expect(page).toContain('href="/trust-pathways/"');
  });
});
