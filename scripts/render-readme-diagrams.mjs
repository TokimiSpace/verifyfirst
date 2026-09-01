#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mermaidCli = '@mermaid-js/mermaid-cli@11.9.0';

const readmes = [
  {
    file: 'README.md',
    locale: 'zh-TW',
    diagrams: [
      ['architecture', 'VerifyFirst 高階系統架構'],
      ['trust-boundary', 'VerifyFirst 信任邊界'],
      ['consumer-flow', 'To C 個人反詐資訊流'],
      ['vlei-flow', 'vLEI 法人與代表權資訊流'],
      ['x402-flow', 'x402 付款條件預檢資訊流'],
      ['incident-flow', '憑證外洩應變資訊流'],
      ['agent-policy-flow', 'Agent 政策閘門資訊流'],
    ],
  },
  {
    file: 'README.en.md',
    locale: 'en',
    diagrams: [
      ['architecture', 'VerifyFirst high-level system architecture'],
      ['trust-boundary', 'VerifyFirst trust boundary'],
      ['consumer-flow', 'Personal anti-scam information flow'],
      ['vlei-flow', 'vLEI legal-entity and authority flow'],
      ['x402-flow', 'x402 payment-requirement preflight flow'],
      ['incident-flow', 'Credential incident-response flow'],
      ['agent-policy-flow', 'Agent policy-gate flow'],
    ],
  },
];

const sourceRoot = join(root, 'docs', 'diagrams', 'src');
const imageRoot = join(root, 'docs', 'diagrams');
const configPath = join(imageRoot, 'mermaid-config.json');

for (const readme of readmes) {
  const readmePath = join(root, readme.file);
  const markdown = readFileSync(readmePath, 'utf8');
  const blocks = [...markdown.matchAll(/~~~mermaid\n([\s\S]*?)\n~~~/g)];
  const sourceDir = join(sourceRoot, readme.locale);
  const outputDir = join(imageRoot, readme.locale);
  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  if (blocks.length !== 0 && blocks.length !== readme.diagrams.length) {
    throw new Error(
      `${readme.file}: expected ${readme.diagrams.length} Mermaid blocks, found ${blocks.length}`,
    );
  }

  if (blocks.length === readme.diagrams.length) {
    blocks.forEach((block, index) => {
      const [name] = readme.diagrams[index];
      writeFileSync(join(sourceDir, `${name}.mmd`), `${block[1].trim()}\n`);
    });

    let blockIndex = 0;
    const rewritten = markdown.replace(/~~~mermaid\n[\s\S]*?\n~~~/g, () => {
      const [name, alt] = readme.diagrams[blockIndex++];
      const image = `docs/diagrams/${readme.locale}/${name}.png`;
      return `[![${alt}](${image})](${image})`;
    });
    writeFileSync(readmePath, rewritten);
  }
}

for (const readme of readmes) {
  for (const [name] of readme.diagrams) {
    const input = join(sourceRoot, readme.locale, `${name}.mmd`);
    const output = join(imageRoot, readme.locale, `${name}.png`);
    const result = spawnSync(
      'npx',
      [
        '--yes',
        mermaidCli,
        '--input',
        input,
        '--output',
        output,
        '--configFile',
        configPath,
        '--theme',
        'neutral',
        '--backgroundColor',
        'white',
        '--width',
        '1600',
        '--scale',
        '1',
      ],
      { cwd: root, encoding: 'utf8' },
    );

    if (result.status !== 0) {
      throw new Error(
        `${relative(root, input)} failed to render:\n${result.stdout}${result.stderr}`,
      );
    }
    process.stdout.write(`rendered ${relative(root, output)}\n`);
  }
}
