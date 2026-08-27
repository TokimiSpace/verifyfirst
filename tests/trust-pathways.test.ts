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
    expect(page).toContain('90 秒評審模式');
    expect(page).toContain("at:42,chapter:'04 · PAYMENT RISK'");
    expect(page).toContain("at:82,chapter:'07 · FAIL CLOSED'");
    expect(page).toContain('tool_execution=false');
    expect(page).toContain("$('#pauseJudge').onclick");
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

  it('exports a transparent, minimal-disclosure evidence packet', () => {
    expect(page).toContain('verifyfirst.payment-risk-evidence.v1');
    expect(page).toContain("cryptographic_seal:'NOT_IMPLEMENTED_IN_DEMO'");
    expect(page).toContain("withheld:['full wallet balance'");
  });
});
