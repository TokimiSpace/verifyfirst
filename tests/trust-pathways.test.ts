import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.resolve('public/trust-pathways/index.html'), 'utf8');

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
    expect(page).toContain('1 限定授權');
    expect(page).toContain('4 撤銷拒絕');
    expect(page).toContain('grid-template-columns:repeat(7,1fr)');
    expect(page).toContain("at:42,chapter:'04 · PAYMENT RISK'");
    expect(page).toContain("at:82,chapter:'07 · FAIL CLOSED'");
    expect(page).toContain('tool_execution=false');
    expect(page).toContain("$('#pauseJudge').onclick");
  });

  it('maps every judge scene to observable scoring evidence', () => {
    expect(page).toContain('JUDGE SCORE MAP');
    expect(page).toContain('評分項目對照');
    expect(page).toContain('Demo 評審映射 · 非主辦單位官方權重');
    expect(page).toContain("criteria:['問題定義','社會／產業價值']");
    expect(page).toContain("criteria:['失敗安全','可稽核性']");
    expect(page).toContain('function updateRubric(scene)');
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

  it('exports a signed and locally verifiable minimal-disclosure evidence packet', () => {
    expect(page).toContain('verifyfirst.payment-risk-evidence.v2');
    expect(page).toContain("algorithm:'ECDSA_P256_SHA256'");
    expect(page).toContain("crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'}");
    expect(page).toContain("crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'}");
    expect(page).toContain("public_key_jwk:publicKey");
    expect(page).toContain("trust_model:'Integrity proof only; not an organizational identity certificate.'");
    expect(page).toContain("withheld:['full wallet balance'");
  });
});
