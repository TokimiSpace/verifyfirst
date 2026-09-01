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
    const environments = [{ id: 'env_prod', label: 'Production', system: 'API', credentialNames: inventory }];
    expect(matchCredentialInventory(analysis, environments).map(match => match.name)).toEqual([
      'GEMINI_API_KEY', 'OPENAI_API_KEY',
    ]);
    expect(JSON.stringify(environments)).not.toContain(liveValue);
  });

  it('associates one exposed name with every affected enterprise environment', () => {
    const analysis = analyzeCredentialIncident(incidentNotice);
    const matches = matchCredentialInventory(analysis, [
      { id: 'env_prod', label: 'Production', system: 'Vercel', credentialNames: ['OPENAI_API_KEY'] },
      { id: 'env_preview', label: 'Preview', system: 'Cloudflare', credentialNames: ['OPENAI_API_KEY', 'UNRELATED_FLAG'] },
    ]);

    expect(matches[0]).toMatchObject({
      name: 'OPENAI_API_KEY',
      environments: [{ label: 'Production' }, { label: 'Preview' }],
    });
  });

  it('builds the five required remediation phases', () => {
    const analysis = analyzeCredentialIncident(incidentNotice);
    const matches = matchCredentialInventory(analysis, [{
      id: 'env_prod', label: 'Production', system: 'API', credentialNames: ['OPENAI_API_KEY'],
    }]);
    const actions = buildCredentialResponseActions(matches, 'Security owner');

    expect(actions.map(action => action.phase)).toEqual(['REVOKE', 'REISSUE', 'DEPLOY', 'REVIEW', 'VERIFY']);
    expect(actions.every(action => action.owner === 'Security owner')).toBe(true);
    expect(actions.every(action => action.affectedNames.includes('OPENAI_API_KEY'))).toBe(true);
    expect(actions.every(action => action.affectedEnvironments.some(environment => environment.id === 'env_prod'))).toBe(true);
  });

  it('keeps same-named environments distinct by id and system', () => {
    const analysis = analyzeCredentialIncident(incidentNotice);
    const matches = matchCredentialInventory(analysis, [
      { id: 'env_api', label: 'Production', system: 'API', credentialNames: ['OPENAI_API_KEY'] },
      { id: 'env_worker', label: 'Production', system: 'Worker', credentialNames: ['OPENAI_API_KEY'] },
    ]);
    const actions = buildCredentialResponseActions(matches, 'Security owner');

    expect(actions[0].affectedEnvironments).toEqual([
      { id: 'env_api', label: 'Production', system: 'API' },
      { id: 'env_worker', label: 'Production', system: 'Worker' },
    ]);
  });

  it('creates a real SHA-256 evidence identifier', async () => {
    const evidenceId = await createEvidenceId({ action: 'REVOKE_COMPLETED', name: 'OPENAI_API_KEY' });
    expect(evidenceId).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
