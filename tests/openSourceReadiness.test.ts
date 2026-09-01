import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.resolve(file), 'utf8');

describe('open-source and self-hosting contract', () => {
  it('publishes an MIT license and reproducible contributor workflow', () => {
    const pkg = JSON.parse(read('package.json')) as { license?: string; packageManager?: string; scripts?: Record<string, string> };
    expect(pkg.license).toBe('MIT');
    expect(read('LICENSE')).toContain('MIT License');
    expect(pkg.scripts).toMatchObject({ build: 'vite build', test: 'vitest run', typecheck: 'tsc --noEmit' });
    expect(pkg.packageManager).toBe('npm@10.9.3');
    expect(read('.nvmrc').trim()).toBe('22.19.0');
    expect(read('CONTRIBUTING.md')).toContain('npm ci');
    expect(read('CONTRIBUTING.md')).toContain('npm run typecheck');
    expect(read('CONTRIBUTING.md')).toContain('docs/PRODUCT_BOUNDARIES.md');
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toContain('npm ci');
    expect(ci).toContain('npm run typecheck');
    expect(ci).toContain('npm test');
    expect(ci).toContain('npm run build');
    expect(read('.github/dependabot.yml')).toContain('package-ecosystem: npm');
  });

  it('keeps secrets untracked and analytics opt-in', () => {
    const ignore = read('.gitignore');
    expect(ignore).toMatch(/^\.env\*$/m);
    expect(ignore).toMatch(/^!\.env\.example$/m);
    for (const extension of ['pem', 'key', 'p12', 'pfx']) {
      expect(ignore).toContain(`*.${extension}`);
    }
    expect(read('.env.example')).toContain('VITE_ENABLE_VERCEL_ANALYTICS=false');
    expect(read('.env.example')).toContain('ENABLE_URL_OBSERVATION=false');
    expect(read('components/OptionalAnalytics.tsx')).toContain("VITE_ENABLE_VERCEL_ANALYTICS === 'true'");
    expect(read('docs/SELF_HOSTING.md')).toContain('self-hosted builds default to no analytics');
  });

  it('bundles executable frontend dependencies instead of importing them from a CDN', () => {
    const html = read('index.html');
    expect(html).not.toContain('cdn.tailwindcss.com');
    expect(html).not.toContain('aistudiocdn.com');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('type="importmap"');
    expect(read('styles.css')).toContain('@tailwind utilities');
    expect(read('tailwind.config.cjs')).toContain("'./components/**/*.{ts,tsx}'");
  });

  it('keeps historical x402 schemas immutable and publishes the current version separately', () => {
    const evidenceV1 = JSON.parse(read('public/schemas/verifyfirst.x402-preflight.v1.schema.json'));
    const responseV1 = JSON.parse(read('public/schemas/verifyfirst.x402-preflight-response.v1.schema.json'));
    const evidenceV2 = JSON.parse(read('public/schemas/verifyfirst.x402-preflight.v2.schema.json'));
    const responseV2 = JSON.parse(read('public/schemas/verifyfirst.x402-preflight-response.v2.schema.json'));

    expect(evidenceV1.properties.schema.const).toBe('verifyfirst.x402-preflight.v1');
    expect(evidenceV1.$defs.verifier.properties.iffSdk.const).toBe('@ifandonlyif/x402-preflight@0.1.0');
    expect(evidenceV1.$defs.iffResult.properties).not.toHaveProperty('localPayeeFingerprint');
    expect(responseV1.properties.schema.const).toBe('verifyfirst.x402-preflight-response.v1');

    expect(evidenceV2.properties.schema.const).toBe('verifyfirst.x402-preflight.v2');
    expect(evidenceV2.$defs.verifier.properties.iffSdk.const).toBe('@ifandonlyif/x402-preflight@0.2.0');
    expect(evidenceV2.$defs.iffResult.properties).toHaveProperty('localPayeeFingerprint');
    expect(evidenceV2.$defs.execution.properties.status.const).toBe('NOT_EXECUTED');
    expect(responseV2.properties.schema.const).toBe('verifyfirst.x402-preflight-response.v2');
    expect(responseV2.properties.iff.anyOf[0].$ref).toContain('verifyfirst.x402-preflight.v2.schema.json');
    expect(read('api/x402-preflight.ts')).toContain("X402_POLICY_VERSION = 'verifyfirst.x402-enterprise-policy.v1'");
  });

  it('publishes the vLEI handoff as an explicitly unsubmitted internal draft', () => {
    const schema = JSON.parse(read('public/schemas/verifyfirst.vlei-handoff.v1.schema.json'));
    expect(schema.properties.schema.const).toBe('verifyfirst.vlei-handoff.v1');
    expect(schema.properties.submissionStatus.const).toBe('DRAFT_NOT_SUBMITTED');
    expect(schema.properties.issuerStatus.const).toBe('NOT_ISSUED');
    expect(schema.properties.documentCategoriesStandard.const).toBe('VERIFYFIRST_INTERNAL');
  });

  it('documents keyless enterprise and optional To C AI profiles', () => {
    const selfHosting = read('docs/SELF_HOSTING.md');
    expect(selfHosting).toContain('Enterprise live preflight');
    expect(selfHosting).toContain('No private API key');
    expect(selfHosting).toContain('To C live AI');
    expect(selfHosting).toContain('The model is never the verifier');
  });

  it('links a public data-processing notice beside the To C input without crowding product footers', () => {
    const notice = read('public/privacy/index.html');
    const consumer = read('App.tsx');
    const business = read('apps/business/BusinessApp.tsx');
    expect(notice).toContain('DATA PROCESSING NOTICE');
    expect(notice).toContain('72 小時');
    expect(notice).toContain('Self-hosters must publish a notice');
    expect(read('components/SearchInput.tsx')).toContain('href="/privacy/"');
    expect(consumer).not.toContain('href="/privacy/"');
    expect(business).not.toContain('href="/privacy/"');
    expect(business).not.toContain('href="/trust-pathways/"');
    expect(business).not.toContain('href="/update-trust/"');
  });
});
