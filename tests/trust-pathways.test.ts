import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.resolve('public/trust-pathways/index.html'), 'utf8');

describe('Trust Pathways standalone demo', () => {
  it('keeps all four pain-point pathways', () => {
    ['manufacturing', 'government', 'migrant', 'rba'].forEach(key => expect(page).toContain(`${key}:{`));
  });

  it('makes revocation observable and blocks later calls', () => {
    expect(page).toContain('MANDATE_REVOKED');
    expect(page).toContain("if(revoked){toast('DENY · MANDATE_REVOKED')");
  });

  it('states that the demo uses synthetic data', () => {
    expect(page).toContain('所有案例均為合成資料');
  });
});
