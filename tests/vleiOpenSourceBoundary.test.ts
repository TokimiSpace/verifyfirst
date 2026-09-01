import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(file), 'utf8');
const SCHEMA_COMMIT = '97850396f504bf8c4e19a42af3290e4b2618f50e';
const FIXTURE_COMMIT = '5850051b52dce24ed59eae486af76e7c73f6012c';
const FIXTURE_SHA256 = 'daa4bf2dae79a8ae6d9548f2c158144af648fecd7aea49ca46a203c906cca643';

describe('vLEI open-source and source-pinning boundary', () => {
  it('pins every verifier schema URL to one immutable official commit', () => {
    const config = JSON.parse(read('services/vlei-verifier/verifyfirst-production.json')) as {
      durls: string[];
    };

    expect(config.durls).toHaveLength(6);
    config.durls.forEach(url => {
      expect(url).toMatch(new RegExp(`^https://raw\\.githubusercontent\\.com/GLEIF-IT/vLEI-schema/${SCHEMA_COMMIT}/[^/]+\\.json$`));
      expect(url).not.toMatch(/\/refs\/heads\/|\/main\//);
    });

    const said = read('public/update-trust/said.js');
    expect(said).toContain(`commit: '${SCHEMA_COMMIT}'`);
    expect(said).not.toContain('vLEI-schema (main)');
    expect(said).not.toContain('GLEIF-IT/vLEI-schema main');
  });

  it('keeps the redistributed CESR fixture byte-identical to its notice', () => {
    const fixture = fs.readFileSync(path.resolve('public/update-trust/credential.cesr'));
    expect(createHash('sha256').update(fixture).digest('hex')).toBe(FIXTURE_SHA256);

    const notices = read('THIRD_PARTY_NOTICES.md');
    expect(notices).toContain(FIXTURE_COMMIT);
    expect(notices).toContain(FIXTURE_SHA256);
    expect(notices).toContain(SCHEMA_COMMIT);
    expect(notices).toContain('services/vlei-verifier/patches/0001-parse-http-port-as-integer.patch');
  });

  it('ships the Apache license and labels the public backend as demo-only', () => {
    expect(read('LICENSES/Apache-2.0.txt')).toContain('Apache License');
    expect(read('LICENSES/Apache-2.0.txt')).toContain('Version 2.0, January 2004');

    const serviceReadme = read('services/vlei-verifier/README.md');
    expect(serviceReadme).toContain('test-mode, non-durable live demo backend');
    expect(serviceReadme).toMatch(/not a production\s+verifier/);
    expect(serviceReadme).toContain('must not depend on it');

    const trustPathways = read('public/trust-pathways/index.html');
    const updateTrust = read('public/update-trust/index.html');
    expect(trustPathways).toContain('Live Demo Backend · Test Mode');
    expect(trustPathways).toContain('不可用於企業正式判定');
    expect(updateTrust).toContain('LIVE DEMO KERIPY BACKEND（TEST MODE）');
    expect(updateTrust).toContain('結果不可用於正式判定');
    expect(trustPathways).not.toContain('Production Verifier · GLEIF Root');
  });
});
