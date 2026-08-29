import { describe, expect, it } from 'vitest';
import {
  analyzeCredentialIncident,
  buildCredentialResponseActions,
  createEvidenceId,
  matchCredentialInventory,
  normalizeInventoryNames,
} from '../services/credentialIncident';

const incidentNotice = `
  An internal credential was used to retrieve environment variables.
  OpenAI and Google credentials may be affected: OPENAI_API_KEY,
  GEMINI_API_KEY, GITHUB_TOKEN, DATABASE_URL and POSTGRES_PASSWORD.
  https://status.example.com/incidents/42
`;

describe('credential incident response', () => {
  it('extracts affected services and credential names from a notice', () => {
    const analysis = analyzeCredentialIncident(incidentNotice, '', new Date('2026-08-29T08:00:00.000Z'));

    expect(analysis.exposedNames).toEqual([
      'DATABASE_URL',
      'GEMINI_API_KEY',
      'GITHUB_TOKEN',
      'OPENAI_API_KEY',
      'POSTGRES_PASSWORD',
    ]);
    expect(analysis.services.map(service => service.label)).toEqual(expect.arrayContaining([
      '資料庫', 'GitHub', 'OpenAI', 'Google / Gemini',
    ]));
    expect(analysis.sourceUrl).toBe('https://status.example.com/incidents/42');
  });

  it('discards values before inventory comparison', () => {
    const liveValue = 'sk-live-value-that-must-not-survive';
    const inventory = normalizeInventoryNames(`OPENAI_API_KEY=${liveValue}\nexport GEMINI_API_KEY=AIza-secret\nUNRELATED_FLAG=true`);

    expect(inventory).toEqual(['GEMINI_API_KEY', 'OPENAI_API_KEY', 'UNRELATED_FLAG']);
    expect(JSON.stringify(inventory)).not.toContain(liveValue);

    const analysis = analyzeCredentialIncident(incidentNotice);
    expect(matchCredentialInventory(analysis, inventory).map(match => match.name)).toEqual([
      'GEMINI_API_KEY', 'OPENAI_API_KEY',
    ]);
  });

  it('builds the five required remediation phases', () => {
    const analysis = analyzeCredentialIncident(incidentNotice);
    const matches = matchCredentialInventory(analysis, ['OPENAI_API_KEY']);
    const actions = buildCredentialResponseActions(matches, 'Security owner');

    expect(actions.map(action => action.phase)).toEqual(['REVOKE', 'REISSUE', 'DEPLOY', 'REVIEW', 'VERIFY']);
    expect(actions.every(action => action.owner === 'Security owner')).toBe(true);
    expect(actions.every(action => action.affectedNames.includes('OPENAI_API_KEY'))).toBe(true);
  });

  it('creates a real SHA-256 evidence identifier', async () => {
    const evidenceId = await createEvidenceId({ action: 'REVOKE_COMPLETED', name: 'OPENAI_API_KEY' });
    expect(evidenceId).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});

