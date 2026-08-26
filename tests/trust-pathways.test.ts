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
    expect(page).toContain("at:78,chapter:'06 · FAIL CLOSED'");
    expect(page).toContain('tool_execution=false');
    expect(page).toContain("$('#pauseJudge').onclick");
  });

  it('adds a pre-execution payment fraud checkpoint with user-controlled hold', () => {
    expect(page).toContain('PRE-EXECUTION CHECKPOINT');
    expect(page).toContain('HOLD_HIGH_RISK_TRANSFER');
    expect(page).toContain('transaction_broadcast=false');
    expect(page).toContain('替本人簽名或廣播資產交易');
  });
});
