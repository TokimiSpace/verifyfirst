import type { GleifLeiRecord } from './gleif';
import type { LocalDocumentManifestEntry } from './localDocumentManifest';

export const VLEI_HANDOFF_SCHEMA = 'verifyfirst.vlei-handoff.v1' as const;
export const VLEI_LEI_LOOKUP_MAX_AGE_MS = 15 * 60 * 1_000;

export interface GleifLookupEvidence extends GleifLeiRecord {
  lookupDigest: `sha256:${string}`;
}

export interface VleiHandoffCase {
  name: string;
  owner: string;
  targetSystem: string;
  purpose: string;
}

export type GleifLookupReadiness =
  | 'CURRENT_ACTIVE_RECORD'
  | 'RECORD_REVIEW_REQUIRED'
  | 'STALE'
  | 'INVALID_TIMESTAMP'
  | 'NOT_CHECKED';

export const buildVleiHandoff = (input: {
  caseDetails: VleiHandoffCase;
  documentManifest: LocalDocumentManifestEntry[];
  gleifLookup?: GleifLookupEvidence;
  now?: Date;
}) => {
  const generatedAt = (input.now ?? new Date()).toISOString();
  const generatedAtMs = new Date(generatedAt).getTime();
  const lookupAtMs = input.gleifLookup ? new Date(input.gleifLookup.checkedAt).getTime() : Number.NaN;
  const lookupAgeMilliseconds = input.gleifLookup && Number.isFinite(lookupAtMs)
    ? generatedAtMs - lookupAtMs
    : null;
  const lookupFresh = lookupAgeMilliseconds !== null
    && lookupAgeMilliseconds >= 0
    && lookupAgeMilliseconds <= VLEI_LEI_LOOKUP_MAX_AGE_MS;
  const lookupCurrent = input.gleifLookup?.entityStatus === 'ACTIVE'
    && input.gleifLookup.registrationStatus === 'ISSUED';
  const lookupStatus: GleifLookupReadiness = !input.gleifLookup
    ? 'NOT_CHECKED'
    : !Number.isFinite(lookupAtMs) || lookupAgeMilliseconds === null || lookupAgeMilliseconds < 0
      ? 'INVALID_TIMESTAMP'
      : !lookupFresh
        ? 'STALE'
        : !lookupCurrent
          ? 'RECORD_REVIEW_REQUIRED'
          : 'CURRENT_ACTIVE_RECORD';

  return {
    schema: VLEI_HANDOFF_SCHEMA,
    generatedAt,
    submissionStatus: 'DRAFT_NOT_SUBMITTED' as const,
    issuerStatus: 'NOT_ISSUED' as const,
    documentCategoriesStandard: 'VERIFYFIRST_INTERNAL' as const,
    case: {
      name: input.caseDetails.name.trim(),
      owner: input.caseDetails.owner.trim(),
      targetSystem: input.caseDetails.targetSystem.trim(),
      purpose: input.caseDetails.purpose.trim(),
    },
    legalEntity: {
      lei: input.gleifLookup?.lei ?? null,
      gleifLookup: input.gleifLookup ? {
        status: lookupStatus,
        sourceUrl: input.gleifLookup.sourceUrl,
        checkedAt: input.gleifLookup.checkedAt,
        lookupDigest: input.gleifLookup.lookupDigest,
        entityStatus: input.gleifLookup.entityStatus,
        registrationStatus: input.gleifLookup.registrationStatus,
        goldenCopyPublishDate: input.gleifLookup.goldenCopyPublishDate ?? null,
        recordLastUpdateDate: input.gleifLookup.lastUpdateDate ?? null,
        freshness: {
          policy: 'LOOKUP_AGE_MAX_15_MINUTES' as const,
          maxAgeMilliseconds: VLEI_LEI_LOOKUP_MAX_AGE_MS,
          ageMilliseconds: lookupAgeMilliseconds,
          passed: lookupStatus === 'CURRENT_ACTIVE_RECORD',
        },
      } : {
        status: lookupStatus,
        freshness: {
          policy: 'LOOKUP_AGE_MAX_15_MINUTES' as const,
          maxAgeMilliseconds: VLEI_LEI_LOOKUP_MAX_AGE_MS,
          ageMilliseconds: null,
          passed: false,
        },
      },
    },
    documentManifest: input.documentManifest,
    documentHandling: {
      localHashingOnly: true,
      uploaded: false,
      contentIncluded: false,
      authenticityVerified: false,
      browserClockTrusted: false,
      mimeTypeAuthoritative: false,
    },
    readiness: {
      gleifLeiCheck: lookupStatus === 'CURRENT_ACTIVE_RECORD' ? 'COMPLETE' as const : 'PENDING' as const,
      documentManifest: 'COMPLETE' as const,
      qviReviewAndIssuance: 'PENDING' as const,
      productionVerifier: 'PENDING' as const,
    },
    productionGaps: [
      { code: 'DOCUMENT_AUTHENTICITY_NOT_VERIFIED', owner: 'ENTERPRISE_AND_QVI', status: 'PENDING' },
      { code: 'QVI_REVIEW_AND_ISSUANCE_REQUIRED', owner: 'SELECTED_QVI', status: 'PENDING' },
      { code: 'PRODUCTION_VERIFIER_AND_LIVE_STATUS_REQUIRED', owner: 'IMPLEMENTATION_TEAM', status: 'PENDING' },
      { code: 'TRUST_ROOT_POLICY_AND_AUDIT_RETENTION_REQUIRED', owner: 'COMPLIANCE_AND_SECURITY', status: 'PENDING' },
    ],
    limitations: [
      'This is a VerifyFirst internal draft, not a GLEIF or QVI application form.',
      'Document digests are unsigned byte-level self-checks and do not prove authenticity, custody, or trusted time.',
      'Browser-provided MIME types are hints only; document contents were not uploaded or inspected.',
      'VerifyFirst is not a QVI and is not affiliated with or endorsed by GLEIF.',
    ],
    officialDirectory: 'https://www.gleif.org/en/organizational-identity/get-an-lei-vlei/get-a-vlei',
  };
};
