import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';

const page = fs.readFileSync(path.resolve('public/trust-pathways/index.html'), 'utf8');
const verifierDockerfile = fs.readFileSync(path.resolve('services/vlei-verifier/Dockerfile.vercel'), 'utf8');
const verifierConfig = fs.readFileSync(path.resolve('services/vlei-verifier/verifyfirst-production.json'), 'utf8');

describe('Trust Pathways standalone demo', () => {
  it('keeps all five pain-point pathways', () => {
    ['manufacturing', 'payment', 'government', 'migrant', 'rba'].forEach(key => expect(page).toContain(`${key}:{`));
  });

  it('makes revocation observable and blocks later calls', () => {
    expect(page).toContain('MANDATE_REVOKED');
    expect(page).toContain("if(revoked){toast('DENY · MANDATE_REVOKED')");
  });

  it('states that the demo uses synthetic data', () => {
    expect(page).toContain('所有案例均為合成資料');
  });

  it('provides a replayable 90-second judge journey with a fail-closed ending', () => {
    expect(page).toContain('觀看 90 秒解決方案');
    expect(page).toContain('預計 1 分 30 秒');
    expect(page).toContain('1 vLEI 授權');
    expect(page).toContain('4 撤銷拒絕');
    expect(page).toContain('grid-template-columns:repeat(8,1fr)');
    expect(page).toContain("at:10,chapter:'02 · GLEIF vLEI VERIFIER'");
    expect(page).toContain("at:46,chapter:'05 · PAYMENT RISK + IFF'");
    expect(page).toContain("at:83,chapter:'08 · FAIL CLOSED'");
    expect(page).toContain('tool_execution=false');
    expect(page).toContain("$('#pauseJudge').onclick");
  });

  it('grounds the manufacturing trust chain in official GLEIF vLEI governance', () => {
    expect(page).toContain('GLEIF OFFICIAL MODEL · EGF 4.0 · 2026-03-25');
    expect(page).toContain('GLEIF Root AID');
    expect(page).toContain('Legal Entity vLEI');
    expect(page).toContain('OOR／ECR');
    expect(page).toContain('QVI Credential');
    expect(page).toContain('Authorization Credential');
    expect(page).toContain('KERI + ACDC + 可驗證狀態');
    expect(page).toContain('宏岳精密與畫面中的驗證結果不代表真實 GLEIF');
    expect(page).toContain('https://www.gleif.org/en/organizational-identity/introducing-the-verifiable-lei-vlei');
    expect(page).toContain('https://github.com/GLEIF-IT/vlei-trainings/tree/4af87dc13b3f145c4d078448b1d6ec5a1f4bef25/markdown');
    expect(page).toContain('function verifyVleiTrust()');
  });

  it('loads official ACDC JSON, schema, and CESR samples with layered verification', () => {
    expect(page).toContain('https://raw.githubusercontent.com/WebOfTrust/vLEI/743622abc9a3b3684552e439efc5c8b6fda2f645/samples/acdc/legal-entity-vLEI-credential.json');
    expect(page).not.toContain('raw.githubusercontent.com/WebOfTrust/vLEI/main/');
    expect(page).toContain('E4OU1DuxIAtRRscHSSQCO0UIpk3tVc0QHaNBDUmpHKac-acdc.cesr');
    expect(page).toContain('schema/acdc/legal-entity-vLEI-credential.json');
    expect(page).toContain('function extractCesrAcdcs(stream)');
    expect(page).toContain('BROWSER_STRUCTURE_AND_LINKAGE');
    expect(page).toContain('KERI CRYPTO · LIVE DEMO BACKEND');
    expect(page).toContain('PUT /presentations/{said}（Content-Type: application/json+cesr）→ GET /authorizations/{aid}');
    expect(page).not.toContain('POST /presentations');
  });

  it('uses the same-origin x402 adapter instead of executing an SDK from a CDN', () => {
    expect(page).toContain("verifyFirstApi:'/api/x402-preflight'");
    expect(page).not.toContain('cdn.jsdelivr.net/npm/@ifandonlyif');
    expect(page).not.toContain('import(IFF_SDK.module)');
  });

  it('never marks the KERI crypto layer verified before the live backend actually answers', () => {
    expect(page).not.toContain("setVerifierCheck(3,'ok','KERI CRYPTO · LIVE BACKEND')");
    expect(page).toContain('KERI CRYPTO · LIVE DEMO BACKEND · 尚未送出 · NOT PRODUCTION');
    expect(page).toContain("setBackendCheck('ok','KERI CRYPTO · LIVE DEMO BACKEND VALID · NOT PRODUCTION')");
    expect(page).toContain("setBackendCheck('warn',`KERI CRYPTO · LIVE DEMO BACKEND ${error.name==='AbortError'?'TIMEOUT':'ERROR'} · FAIL CLOSED`)");
    expect(page).toContain('STATUS · NOT REVOKED');
    expect(page).toContain('witness 允許清單不作為正式控制');
  });

  it('links to the Update Trust lifecycle page', () => {
    expect(page).toContain('href="/update-trust/"');
  });

  it('connects the UI to the deployed fail-closed keripy verifier', () => {
    expect(page).toContain("base:'https://verifyfirst-vlei-verifier.vercel.app'");
    expect(page).toContain("method:'PUT'");
    expect(page).toContain("'Content-Type':'application/json+cesr'");
    expect(page).toContain('/authorizations/${VLEI_BACKEND.holderAid}');
    expect(page).toContain("state.textContent='INVALID'");
    expect(page).toContain("state.textContent='FAIL CLOSED'");
    expect(page).toContain('BACKEND_TIMEOUT');
  });

  it('separates the replayable training domain from the non-production live demo backend', () => {
    expect(page).toContain('Training Sandbox · 可重播');
    expect(page).toContain('Live Demo Backend · Test Mode');
    expect(page).toContain('TRAINING ONLY');
    expect(page).toContain('Live demo 不會以 Training 根金鑰產生 VALID');
    expect(page).toContain('此 URL 不屬於自架 production');
    expect(page).toContain("selectVerifierMode('training')");
    expect(page).toContain("verifierMode=mode==='production'?'production':'training'");
  });

  it('cryptographically verifies valid, tampered, and revoked training fixtures', () => {
    const match = page.match(/const TRAINING_FIXTURE=(\{[\s\S]*?\n    \});/);
    expect(match).not.toBeNull();
    const fixture = vm.runInNewContext(`(${match![1]})`);
    const canonicalize = (value: unknown): string => {
      if (value === null || typeof value !== 'object') return JSON.stringify(value);
      if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
    };
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(fixture.publicKeySpki, 'base64url'),
      format: 'der',
      type: 'spki',
    });
    const verify = (value: unknown, signature: string) => crypto.verify(
      null,
      Buffer.from(canonicalize(value)),
      publicKey,
      Buffer.from(signature, 'base64url'),
    );
    const fingerprint = `sha256-${crypto.createHash('sha256').update(Buffer.from(fixture.publicKeySpki, 'base64url')).digest('base64url')}`;
    const tampered = { ...fixture.payload, role: 'Treasury Admin · TAMPERED' };

    expect(fingerprint).toBe(fixture.rootFingerprint);
    expect(verify(fixture.payload, fixture.credentialSignature)).toBe(true);
    expect(verify(tampered, fixture.credentialSignature)).toBe(false);
    expect(verify(fixture.issuedEvent, fixture.issuedSignature)).toBe(true);
    expect(verify(fixture.revokedEvent, fixture.revokedSignature)).toBe(true);
    expect(page).toContain("policy='DENY_CREDENTIAL_REVOKED'");
    expect(page).toContain("policy='ALLOW_TRAINING_ONLY'");
    expect(page).toContain("policy='DENY_SIGNATURE_INVALID'");
  });

  it('pins and labels the non-production live demo verifier container', () => {
    expect(verifierDockerfile).toContain('5850051b52dce24ed59eae486af76e7c73f6012c');
    expect(verifierDockerfile).toContain('40bc4b8586d5ecd409937837d43de27aaf0940d49c24ba40d17c28d753bc385f');
    expect(verifierDockerfile).toContain('sha256sum -c -');
    expect(verifierDockerfile).toContain('ENTRYPOINT ["/keripy/venv/bin/verifier"');
    expect(verifierDockerfile).toContain('VERIFYFIRST_VLEI_PROFILE=live-demo-test-backend');
    expect(verifierDockerfile).toContain('VERIFIER_MODE=test');
    expect(verifierDockerfile).toContain('VERIFY_ROOT_OF_TRUST=True');
    expect(verifierDockerfile).toContain('VERIFIER_ENV=production');
    expect(verifierDockerfile).toContain('DEV_ONLY_ENDPOINTS=^/root_of_trust');
    expect(verifierConfig).toContain('"revocationCheck": true');
    expect(verifierConfig).toContain('"witnessUrlAllowlist"');
    expect(verifierConfig).not.toContain('/refs/heads/main/');
    expect(verifierConfig).toContain('/97850396f504bf8c4e19a42af3290e4b2618f50e/');
  });

  it('queries the live GLEIF LEI Search API and fails closed', () => {
    expect(page).toContain('https://api.gleif.org/api/v1/lei-records/');
    expect(page).toContain('/^[A-Z0-9]{20}$/.test(lei)');
    expect(page).toContain("headers:{Accept:'application/vnd.api+json'}");
    expect(page).toContain('未使用合成資料替代');
    expect(page).toContain('506700GE1G29325QX363');
  });

  it('simulates TEL credential revocation as a fail-closed policy event', () => {
    expect(page).toContain("renderTelState('REVOKED')");
    expect(page).toContain('DENY_CREDENTIAL_REVOKED');
    expect(page).toContain('TEL event · rev');
    expect(page).toContain('不寫入真實 TEL');
  });

  it('maps every judge scene to observable scoring evidence', () => {
    expect(page).toContain('JUDGE SCORE MAP');
    expect(page).toContain('評分項目對照');
    expect(page).toContain('Demo 評審映射 · 非主辦單位官方權重');
    expect(page).toContain("criteria:['問題定義','社會／產業價值']");
    expect(page).toContain("criteria:['失敗安全','可稽核性']");
    expect(page).toContain('function updateRubric(scene)');
  });

  it('switches the score map with pain points 04, 05, and 06 outside the guided tour', () => {
    expect(page).toContain('const scenarioRubrics={');
    expect(page).toContain("government:{chapter:'PAIN POINT 04 · 政府服務'");
    expect(page).toContain("migrant:{chapter:'PAIN POINT 05 · 移工數位信任'");
    expect(page).toContain("rba:{chapter:'PAIN POINT 06 · RBA 供應鏈'");
    expect(page).toContain('主辦方需求對照');
    expect(page).toContain('CONDITIONAL READY · REQUIRE_HUMAN_CONFIRMATION');
    expect(page).toContain('CREDENTIAL READY · ALLOW_CREDENTIAL_ISSUANCE');
    expect(page).toContain('PARTIAL PASS · REQUIRE_EXCEPTION_REVIEW');
    expect(page).toContain('function syncScenarioRubric()');
    expect(page).toContain("if($('#judgeConsole').classList.contains('active'))return");
    expect(page).toContain('syncScenarioRubric()');
  });

  it('adds a pre-execution payment fraud checkpoint with user-controlled hold', () => {
    expect(page).toContain('PRE-EXECUTION CHECKPOINT');
    expect(page).toContain('HOLD_HIGH_RISK_TRANSFER');
    expect(page).toContain('transaction_broadcast=false');
    expect(page).toContain('替本人簽名或廣播資產交易');
  });

  it('supports low, medium, and high versioned risk fixtures', () => {
    ['low:{', 'medium:{', 'high:{'].forEach(level => expect(page).toContain(level));
    expect(page).toContain("source:'TEST_FIXTURE_V1.0'");
  });

  it('queries the public GoPlus address risk endpoint with local validation', () => {
    expect(page).toContain('https://api.gopluslabs.io/api/v1/address_security/');
    expect(page).toContain("/^0x[a-fA-F0-9]{40}$/.test(address)");
    expect(page).toContain('FIXTURE FALLBACK');
  });

  it('uses the pinned IFF SDK through the same-origin preflight API', () => {
    expect(page).toContain('IFF SDK PREFLIGHT · x402 v2');
    expect(page).toContain('https://ifandonlyif.io/sdk');
    expect(page).toContain("version:'0.1.0'");
    expect(page).toContain("verifyFirstApi:'/api/x402-preflight'");
    expect(page).toContain('await fetch(IFF_SDK.verifyFirstApi');
    expect(page).toContain("policy:payload.policy?.decision||'HOLD_IFF_UNAVAILABLE'");
    expect(page).toContain('result.received?.set_fingerprint||result.received_set_fingerprint||null');
    expect(page).toContain('result.observed?.report_hash||result.observed_report_hash||null');
    expect(page).toContain('result.inclusion.sth?.root_hash||result.inclusion.root_hash||null');
    expect(page).not.toContain('cdn.jsdelivr.net/npm/@ifandonlyif');
    expect(page).not.toContain("import('https://");
    expect(page).toContain("consistent:{verdict:'consistent',policy:'CONTINUE_OTHER_CHECKS'");
    expect(page).toContain("diverged:{verdict:'diverged',policy:'HOLD_REQUIREMENT_DIVERGED'");
    expect(page).toContain("stale:{verdict:'stale',policy:'REVIEW_STALE_EVIDENCE'");
    expect(page).toContain("unobserved:{verdict:'unobserved',policy:'REVIEW_UNOBSERVED_ENDPOINT'");
    expect(page).toContain("return'HOLD_IFF_UNAVAILABLE'");
    expect(page).toContain('不能證明秘密從未外洩');
  });

  it('preserves API policy and IFF evidence when the payment scene re-renders', () => {
    const match = page.match(/    function iffPolicyFor\(result\)\{[\s\S]*?\n    function runIffTrainingCase/);
    expect(match).not.toBeNull();
    const functions = match![0].replace(/\n    function runIffTrainingCase$/, '');
    const elements = Object.fromEntries([
      '#iffEndpoint', '#iffResult', '#iffVerdict', '#iffSource', '#iffPolicy', '#iffDetail', '#iffMeta',
    ].map(selector => [selector, { value: 'https://merchant.example/pay', className: '', textContent: '', innerHTML: '' }]));
    const context = vm.createContext({
      document: { querySelectorAll: () => [] },
      $: (selector: string) => elements[selector],
    });
    vm.runInContext(`let iffPreflight = {}; ${functions}`, context);
    const render = vm.runInContext(`(input, source) => {
      renderIffResult(input, source);
      return JSON.parse(JSON.stringify(iffPreflight));
    }`, context) as (input: Record<string, unknown>, source: string) => Record<string, any>;

    const first = render({
      url: 'https://merchant.example/pay',
      verdict: 'diverged',
      policy: 'DENY_REQUIREMENT_DIVERGED',
      received: { set_fingerprint: 'received-fingerprint' },
      observed: { report_hash: 'observed-report-hash' },
      inclusion: { tree_size: 42, log_index: 7, sth: { root_hash: 'root-hash' } },
      checked_at: '2026-09-01T10:00:00.000Z',
    }, 'IFF_PUBLIC_API · @ifandonlyif/x402-preflight@0.1.0');
    const afterSceneSwitch = render(first, first.source);

    expect(afterSceneSwitch).toMatchObject({
      policy: 'DENY_REQUIREMENT_DIVERGED',
      received_set_fingerprint: 'received-fingerprint',
      observed_report_hash: 'observed-report-hash',
      inclusion: { tree_size: 42, log_index: 7, root_hash: 'root-hash' },
    });
    expect(elements['#iffPolicy'].textContent).toBe('DENY_REQUIREMENT_DIVERGED');
  });

  it('keeps the judge journey on two VerifyFirst URLs and embeds IFF in the main demo', () => {
    expect(page).toContain('URL 01 · JUDGE DEMO');
    expect(page).toContain('https://verify1st.tw/trust-pathways/');
    expect(page).toContain('URL 02 · TECHNICAL PROOF');
    expect(page).toContain('https://verify1st.tw/update-trust');
    expect(page).toContain('鏈上＋IFF 查驗');
  });

  it('exports a signed and locally verifiable minimal-disclosure evidence packet', () => {
    expect(page).toContain('verifyfirst.payment-risk-evidence.v3');
    expect(page).toContain('external_evidence:{iff_x402_preflight:');
    expect(page).toContain("event:'IFF_X402_PREFLIGHT'");
    expect(page).toContain("algorithm:'ECDSA_P256_SHA256'");
    expect(page).toContain("crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'}");
    expect(page).toContain("crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'}");
    expect(page).toContain("public_key_jwk:publicKey");
    expect(page).toContain("trust_model:'Integrity proof only; not an organizational identity certificate.'");
    expect(page).toContain("withheld:['full wallet balance'");
  });
});
