import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.resolve(file), 'utf8');
const consumer = read('App.tsx');
const business = read('apps/business/BusinessApp.tsx');
const entry = read('index.tsx');
const intake = read('components/consumer/SituationIntake.tsx');
const assistant = read('components/consumer/SafetyAssistant.tsx');
const boundaries = read('docs/PRODUCT_BOUNDARIES.md');
const trustPathways = read('public/trust-pathways/index.html');
const updateTrust = read('public/update-trust/index.html');
const vercel = JSON.parse(read('vercel.json'));

describe('To C / To B product boundaries', () => {
  it('lazy-loads a dedicated enterprise app only on /business', () => {
    expect(entry).toContain("window.location.pathname === '/business'");
    expect(entry).toContain("import('./apps/business/BusinessApp')");
    expect(entry).toContain("import('./App')");
    expect(vercel.rewrites).toContainEqual({ source: '/business/', destination: '/index.html' });
  });

  it('keeps the consumer app focused on multilingual anti-scam help', () => {
    expect(consumer).toContain('多語言反詐安全助手');
    expect(consumer).toContain('<SituationIntake');
    expect(consumer).toContain('<SafetyAssistant');
    expect(consumer).toContain("{ code: 'vi',");
    expect(consumer).not.toContain('<AgentSandbox');
    expect(consumer).not.toContain('<SandboxControl');
  });

  it('collects the incident stage without requesting sensitive identifiers', () => {
    for (const stage of ['RECEIVED', 'OPENED', 'SHARED', 'PAID']) expect(intake).toContain(stage);
    expect(intake).toContain('不需要填姓名或帳號');
    expect(assistant).toContain('請勿輸入密碼、完整卡號、OTP、身分證字號或真實金鑰');
    expect(assistant).toContain('href="tel:165"');
    expect(assistant).toContain('href="tel:110"');
  });

  it('marks every enterprise entry as experimental and links the lab modules', () => {
    expect(business).toContain('EXPERIMENTAL · 實驗性功能');
    expect(business).toContain('尚未承諾 SLA');
    expect(business).toContain("'/trust-pathways/'");
    expect(business).toContain("'/update-trust/'");
    expect(trustPathways).toContain('EXPERIMENTAL');
    expect(updateTrust).toContain('EXPERIMENTAL');
    expect(trustPathways).toContain('href="/business/"');
    expect(updateTrust).toContain('href="/business/"');
  });

  it('documents release and trust invariants for open-source contributors', () => {
    expect(boundaries).toContain('## To C invariants');
    expect(boundaries).toContain('## To B invariants');
    expect(boundaries).toContain('execution.status: "NOT_EXECUTED"');
    expect(boundaries).toContain('Never commit `.env` files');
  });
});
