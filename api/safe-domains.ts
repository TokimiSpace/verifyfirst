// Operator-maintained official-domain identity hints.
//
// These entries answer only "which public hostname does this deployment claim
// as its own?" They are not security verdicts, do not cover arbitrary
// subdomains, and must never bypass the normal evidence pipeline or influence a
// safety score by themselves.

import type { Language } from '../types';

export interface OfficialDomainIdentity {
  hostname: string;
  canonicalDomain: string;
  label: string;
  source: 'OPERATOR_CONFIG';
  limitation: string;
}

const OFFICIAL_DOMAINS: Array<{
  domain: string;
  aliases?: string[];
  label: Record<Language, string>;
  limitation: Record<Language, string>;
}> = [
  {
    domain: 'verify1st.tw',
    aliases: ['www.verify1st.tw'],
    label: {
      en: 'VerifyFirst — operator-listed official domain',
      'zh-TW': 'VerifyFirst — 營運者列出的官方網域',
      vi: 'VerifyFirst — tên miền chính thức do đơn vị vận hành công bố',
    },
    limitation: {
      en: 'Identity hint only. It does not prove that the current page is safe, uncompromised, or appropriate for a transaction.',
      'zh-TW': '這只識別營運者列出的網域，不證明目前頁面安全、未遭入侵或適合進行交易。',
      vi: 'Đây chỉ là gợi ý nhận diện tên miền; không chứng minh trang hiện tại an toàn, chưa bị xâm nhập hoặc phù hợp để giao dịch.',
    },
  },
];

const DOMAIN_MAP = new Map<string, typeof OFFICIAL_DOMAINS[number]>();
for (const entry of OFFICIAL_DOMAINS) {
  DOMAIN_MAP.set(entry.domain.toLowerCase(), entry);
  for (const alias of entry.aliases ?? []) DOMAIN_MAP.set(alias.toLowerCase(), entry);
}

const resolveHost = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  try {
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(candidate).hostname.toLowerCase().replace(/\.+$/, '');
  } catch {
    return null;
  }
};

export function getOfficialDomainIdentity(input: string, language: string): OfficialDomainIdentity | null {
  const hostname = resolveHost(input);
  if (!hostname) return null;

  // Exact host/alias match only. An operator-listed apex must not implicitly
  // endorse user-controlled, delegated, or compromised subdomains.
  const entry = DOMAIN_MAP.get(hostname);
  if (!entry) return null;

  const lang = (['en', 'zh-TW', 'vi'] as const).includes(language as Language)
    ? (language as Language)
    : 'en';
  return {
    hostname,
    canonicalDomain: entry.domain,
    label: entry.label[lang],
    source: 'OPERATOR_CONFIG',
    limitation: entry.limitation[lang],
  };
}

export function buildOfficialDomainIdentityFacts(identity: OfficialDomainIdentity | null): string {
  if (!identity) return '';
  return [
    '=== OPERATOR-CONFIGURED DOMAIN IDENTITY (IDENTITY ONLY; NOT SAFETY EVIDENCE) ===',
    `- Listed hostname: ${identity.hostname}`,
    `- Identity label: ${identity.label}`,
    `- Limitation: ${identity.limitation}`,
    '- This hint MUST NOT raise a trust score, lower scam probability, suppress risk evidence, or replace independent checks.',
    '=== END OPERATOR-CONFIGURED DOMAIN IDENTITY ===',
  ].join('\n');
}
