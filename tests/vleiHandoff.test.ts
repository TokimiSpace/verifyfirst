import { describe, expect, it } from 'vitest';
import { buildVleiHandoff } from '../services/vleiHandoff';
import type { LocalDocumentManifestEntry } from '../services/localDocumentManifest';

const NOW = new Date('2026-09-01T12:00:00.000Z');
const manifest: LocalDocumentManifestEntry[] = [{
  name: 'Handoff document 01',
  type: 'application/pdf',
  category: 'ROLE_EVIDENCE' as const,
  size: 1024,
  digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  checkedAt: '2026-09-01T11:59:00.000Z',
}];
const caseDetails = { name: 'Supplier authority', owner: 'Compliance team', targetSystem: 'Supplier portal', purpose: 'Authority verification' };
const lookup = {
  lei: '506700GE1G29325QX363', legalName: 'Example Entity', entityStatus: 'ACTIVE', registrationStatus: 'ISSUED', jurisdiction: 'TW',
  sourceUrl: 'https://api.gleif.org/api/v1/lei-records/506700GE1G29325QX363', checkedAt: '2026-09-01T11:50:00.000Z',
  lookupDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const,
};

describe('vLEI implementation handoff', () => {
  it('carries fresh live GLEIF provenance while remaining an unsubmitted draft', () => {
    const handoff = buildVleiHandoff({ caseDetails, documentManifest: manifest, gleifLookup: lookup, now: NOW });
    expect(handoff).toMatchObject({
      schema: 'verifyfirst.vlei-handoff.v1', submissionStatus: 'DRAFT_NOT_SUBMITTED', issuerStatus: 'NOT_ISSUED',
      documentCategoriesStandard: 'VERIFYFIRST_INTERNAL',
      readiness: { gleifLeiCheck: 'COMPLETE', qviReviewAndIssuance: 'PENDING', productionVerifier: 'PENDING' },
      legalEntity: { gleifLookup: { status: 'CURRENT_ACTIVE_RECORD', sourceUrl: lookup.sourceUrl, lookupDigest: lookup.lookupDigest, freshness: { passed: true } } },
    });
  });

  it('marks stale or absent lookup evidence pending instead of inferring a live check from LEI syntax', () => {
    const stale = buildVleiHandoff({ caseDetails, documentManifest: manifest, gleifLookup: { ...lookup, checkedAt: '2026-09-01T11:00:00.000Z' }, now: NOW });
    const absent = buildVleiHandoff({ caseDetails, documentManifest: manifest, now: NOW });
    expect(stale.legalEntity.gleifLookup.status).toBe('STALE');
    expect(stale.readiness.gleifLeiCheck).toBe('PENDING');
    expect(absent.legalEntity).toMatchObject({ lei: null, gleifLookup: { status: 'NOT_CHECKED' } });
  });

  it('serializes only the bounded manifest and explicit limitations, never file bodies', () => {
    const serialized = JSON.stringify(buildVleiHandoff({ caseDetails, documentManifest: manifest, now: NOW }));
    expect(serialized).toContain('Handoff document 01');
    expect(serialized).not.toContain('rawCesr');
    expect(serialized).not.toContain('objectUrl');
    expect(serialized).not.toContain('documentContent');
    expect(serialized).toContain('Browser-provided MIME types are hints only');
  });
});
