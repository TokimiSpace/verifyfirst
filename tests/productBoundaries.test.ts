import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.resolve(file), 'utf8');
const consumer = read('App.tsx');
const business = read('apps/business/BusinessApp.tsx');
const entry = read('index.tsx');
const intake = read('components/consumer/SituationIntake.tsx');
const assistant = read('components/consumer/SafetyAssistant.tsx');
const x402Workbench = read('components/business/X402Workbench.tsx');
const x402Api = read('api/x402-preflight.ts');
const x402Policy = read('services/x402Policy.ts');
const vleiIntake = read('components/business/VleiImplementationIntake.tsx');
const documentManifest = read('services/localDocumentManifest.ts');
const vleiHandoff = read('services/vleiHandoff.ts');
const boundaries = read('docs/PRODUCT_BOUNDARIES.md');
const trustPathways = read('public/trust-pathways/index.html');
const updateTrust = read('public/update-trust/index.html');
const vercel = JSON.parse(read('vercel.json'));

describe('To C / To B product boundaries', () => {
  it('lazy-loads a dedicated enterprise app only on /business', () => {
    expect(entry).toContain("window.location.pathname === '/business'");
    expect(entry).toContain("import('./apps/business/BusinessApp')");
    expect(entry).toContain("import('./App')");
    expect(vercel.rewrites).toContainEqual({ source: '/business/', destination: '/index.html' });
  });

  it('keeps the consumer app focused on multilingual anti-scam help', () => {
    expect(consumer).toContain('多語言反詐安全助手');
    expect(consumer).toContain('<SituationIntake');
    expect(consumer).toContain('<SafetyAssistant');
    expect(consumer).toContain("{ code: 'vi',");
    expect(consumer).not.toContain('<AgentSandbox');
    expect(consumer).not.toContain('<SandboxControl');
  });

  it('collects the incident stage without requesting sensitive identifiers', () => {
    for (const stage of ['RECEIVED', 'OPENED', 'SHARED', 'PAID']) expect(intake).toContain(stage);
    expect(intake).toContain('不需要填姓名或帳號');
    expect(assistant).toContain('請勿輸入密碼、完整卡號、OTP、身分證字號或真實金鑰');
    expect(assistant).toContain('href="tel:165"');
    expect(assistant).toContain('href="tel:110"');
  });

  it('marks every enterprise entry as experimental and links the lab modules', () => {
    expect(business).toContain('EXPERIMENTAL · 實驗性功能');
    expect(business).toContain('尚未承諾 SLA');
    expect(business).toContain('href="/trust-pathways/"');
    expect(business).toContain('href="/update-trust/"');
    expect(business).toContain('<TrustVerificationPanel');
    expect(business).toContain('<X402Workbench');
    expect(business).toContain("url.searchParams.set('module', 'vlei')");
    expect(business).toContain("url.searchParams.set('module', 'x402')");
    expect(business).not.toContain('<AgentSandbox');
    expect(business).toContain('verificationRecords={verificationRecords}');
    expect(trustPathways).toContain('EXPERIMENTAL');
    expect(updateTrust).toContain('EXPERIMENTAL');
    expect(trustPathways).toContain('href="/business/"');
    expect(updateTrust).toContain('href="/business/"');
  });

  it('keeps vLEI authority and x402 payment evidence as separate enterprise products', () => {
    expect(business).toContain('組織身分與代表權');
    expect(business).toContain('機器付款條件預檢');
    expect(x402Workbench).toContain('schema: X402_EVIDENCE_SCHEMA');
    expect(x402Api).toContain("X402_EVIDENCE_SCHEMA = 'verifyfirst.x402-preflight.v2'");
    expect(x402Workbench).toContain("payment: 'NOT_EXECUTED'");
    expect(x402Workbench).toContain('未自動改用模擬結果');
    expect(x402Api).toContain('merchantEndpointFetched: false');
    expect(x402Api).not.toContain('fetch(endpoint');
    expect(x402Policy).toContain("selectedOptionBinding: 'NOT_BOUND'");
    expect(x402Policy).toContain("paymentExecution: 'NOT_EXECUTED'");
  });

  it('offers guided adoption and machine-readable integration without making the LLM a verifier', () => {
    expect(business).toContain('引導導入');
    expect(business).toContain('技術整合');
    expect(business).toContain("selectView('X402', undefined, 'simulation')");
    expect(business).toContain("selectView('VLEI', 'VLEI')");
    expect(boundaries).toContain('The model is not the verifier');
    expect(boundaries).toContain('secret-free Evidence');
  });

  it('creates a local vLEI handoff manifest without uploading document contents', () => {
    expect(vleiIntake).toContain('buildVleiHandoff');
    expect(vleiHandoff).toContain("VLEI_HANDOFF_SCHEMA = 'verifyfirst.vlei-handoff.v1'");
    expect(vleiHandoff).toContain("submissionStatus: 'DRAFT_NOT_SUBMITTED'");
    expect(vleiHandoff).toContain('uploaded: false');
    expect(vleiHandoff).toContain('contentIncluded: false');
    expect(documentManifest).toContain('MAX_LOCAL_DOCUMENT_FILES = 12');
    expect(documentManifest).toContain('createLocalDocumentManifest');
    expect(documentManifest).not.toContain('objectUrl');
  });

  it('keeps raw CESR in memory while persisting verification summaries only', () => {
    const verifier = read('components/business/TrustVerificationPanel.tsx');
    const client = read('services/vleiClient.ts');
    expect(verifier).toContain('原始 CESR 只留在瀏覽器記憶體');
    expect(verifier).toContain("kind: 'VLEI_CHAIN'");
    expect(business).toContain('verificationRecords');
    expect(business).not.toContain('rawCesr');
    expect(client).toContain('MAX_VLEI_CESR_BYTES = 128 * 1024');
    expect(client).toContain('Production verification cannot bypass KEL/TEL anchoring');
  });

  it('fails closed across the enterprise credential and evidence boundaries', () => {
    const verifier = read('components/business/TrustVerificationPanel.tsx');
    const client = read('services/vleiClient.ts');
    const canonicalVerifier = read('public/update-trust/said.js');
    const evidenceIntegrity = read('services/evidenceIntegrity.ts');
    expect(client).toContain('assertStrictCesrFraming');
    expect(client).toContain('resolveVleiRepresentedEntity');
    expect(client).toContain("options.trustDomain === 'production' && locallyAllows");
    expect(client).toContain('DENY_BACKEND_VERIFICATION_REQUIRED');
    expect(canonicalVerifier).toContain("id: 'registry-issuer'");
    expect(canonicalVerifier).toContain('DENY_REGISTRY_ISSUER_MISMATCH');
    expect(verifier).toContain('DENY_LEI_NOT_CHECKED');
    expect(verifier).toContain('DENY_LEI_LOOKUP_STALE');
    expect(verifier).toContain('DENY_BACKEND_VERIFICATION_REQUIRED');
    for (const provenanceField of ['sourceUrl', 'checkedAt', 'goldenCopyPublishDate', 'lookupDigest', 'LOOKUP_AGE_MAX_15_MINUTES']) {
      expect(verifier).toContain(provenanceField);
    }
    expect(verifier).toContain('leiLookupInFlight.current = true');
    expect(verifier).toContain('leiRecordRef.current = null');
    expect(verifier).toContain('sealEvidenceBody(packetBody)');
    expect(evidenceIntegrity).toContain('verifyEvidenceEnvelope');
    expect(evidenceIntegrity).toContain("kind: 'SELF_CHECK_ONLY'");
    expect(evidenceIntegrity).toContain("authenticity: 'UNSIGNED'");
  });

  it('documents release and trust invariants for open-source contributors', () => {
    expect(boundaries).toContain('## To C invariants');
    expect(boundaries).toContain('## To B invariants');
    expect(boundaries).toContain('execution.status: "NOT_EXECUTED"');
    expect(boundaries).toContain('Never commit `.env` files');
  });
});
