import {
  CredentialIncidentAnalysis,
  CredentialEnvironmentInventory,
  CredentialIncidentSeverity,
  CredentialInventoryMatch,
  CredentialResponseAction,
  CredentialService,
} from '../types';

type ServiceRule = {
  id: string;
  label: string;
  severity: CredentialIncidentSeverity;
  keywords: string[];
  namePatterns: RegExp[];
};

const SERVICE_RULES: ServiceRule[] = [
  { id: 'deployment', label: '部署與儲存', severity: 'CRITICAL', keywords: ['vercel', 'blob'], namePatterns: [/^BLOB_/, /^VERCEL_/, /^DEPLOY_/ ] },
  { id: 'database', label: '資料庫', severity: 'CRITICAL', keywords: ['database', 'postgres', 'mysql', 'mongodb', 'redis'], namePatterns: [/^DATABASE_URL$/, /^POSTGRES_/, /^MYSQL_/, /^MONGODB_/, /^REDIS_/] },
  { id: 'aws', label: 'AWS', severity: 'CRITICAL', keywords: ['aws'], namePatterns: [/^AWS_/] },
  { id: 'github', label: 'GitHub', severity: 'CRITICAL', keywords: ['github'], namePatterns: [/^GITHUB_/, /^GH_/] },
  { id: 'cloudflare', label: 'Cloudflare', severity: 'CRITICAL', keywords: ['cloudflare'], namePatterns: [/^CF_/, /^CLOUDFLARE_/] },
  { id: 'stripe', label: 'Stripe', severity: 'CRITICAL', keywords: ['stripe'], namePatterns: [/^STRIPE_/] },
  { id: 'openai', label: 'OpenAI', severity: 'HIGH', keywords: ['openai'], namePatterns: [/^OPENAI_/] },
  { id: 'anthropic', label: 'Anthropic', severity: 'HIGH', keywords: ['anthropic'], namePatterns: [/^ANTHROPIC_/] },
  { id: 'openrouter', label: 'OpenRouter', severity: 'HIGH', keywords: ['openrouter'], namePatterns: [/^OPENROUTER_/] },
  { id: 'google', label: 'Google / Gemini', severity: 'HIGH', keywords: ['google', 'gemini'], namePatterns: [/^GOOGLE_/, /^GEMINI_/] },
  { id: 'virustotal', label: 'VirusTotal', severity: 'HIGH', keywords: ['virustotal'], namePatterns: [/^VIRUSTOTAL_/] },
  { id: 'gogolook', label: 'GogoLook', severity: 'HIGH', keywords: ['gogolook'], namePatterns: [/^GOGOLOOK_/] },
  { id: 'generic', label: '其他秘密', severity: 'HIGH', keywords: [], namePatterns: [/^(ACCESS_TOKEN|API_SECRET|CLIENT_SECRET|PRIVATE_KEY|SECRET_KEY|JWT_SECRET|BOT_API_KEY)$/] },
];

const SECRET_NAME_SIGNAL = /(?:^|_)(?:API_?KEY|TOKEN|SECRET|PASSWORD|PASS|PRIVATE_?KEY|CREDENTIAL|WEBHOOK_?URL|DATABASE_?URL|CONNECTION_?STRING)(?:$|_)/;
const NAME_PATTERN = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;
const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/i;

const unique = (values: string[]) => [...new Set(values)];

const isCredentialName = (value: string) => {
  if (value.length < 4 || value.length > 96) return false;
  if (SECRET_NAME_SIGNAL.test(value)) return true;
  return SERVICE_RULES.some(rule => rule.namePatterns.some(pattern => pattern.test(value)));
};

export const extractCredentialNames = (notice: string): string[] => unique(
  (notice.toUpperCase().match(NAME_PATTERN) ?? [])
    .map(name => name.trim())
    .filter(isCredentialName),
).sort();

/**
 * Convert pasted inventory lines into names only. Values after `=` or `:` are
 * intentionally discarded and are never returned to callers.
 */
export const normalizeInventoryNames = (input: string): string[] => unique(
  input
    .split(/[\n,;]/)
    .map(line => line.trim().replace(/^export\s+/i, ''))
    .map(line => {
      const match = line.match(/^([A-Za-z][A-Za-z0-9_]{2,95})(?:\s*[:=].*)?$/);
      return match?.[1]?.toUpperCase() ?? '';
    })
    .filter(Boolean),
).sort();

const ruleForName = (name: string): ServiceRule => (
  SERVICE_RULES.find(rule => rule.id !== 'generic' && rule.namePatterns.some(pattern => pattern.test(name)))
  ?? SERVICE_RULES.find(rule => rule.id === 'generic')!
);

const detectServices = (notice: string, exposedNames: string[]): CredentialService[] => {
  const lowerNotice = notice.toLowerCase();
  return SERVICE_RULES
    .map(rule => {
      const matchedNames = exposedNames.filter(name => rule.namePatterns.some(pattern => pattern.test(name)));
      const mentioned = rule.keywords.some(keyword => lowerNotice.includes(keyword));
      return matchedNames.length || mentioned
        ? { id: rule.id, label: rule.label, severity: rule.severity, matchedNames }
        : null;
    })
    .filter((service): service is CredentialService => Boolean(service));
};

export const analyzeCredentialIncident = (
  notice: string,
  sourceUrl = '',
  now = new Date(),
): CredentialIncidentAnalysis => {
  const exposedNames = extractCredentialNames(notice);
  const urlCandidate = sourceUrl.trim() || notice.match(URL_PATTERN)?.[0] || '';
  let normalizedUrl: string | undefined;
  try {
    const parsed = new URL(urlCandidate);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') normalizedUrl = parsed.toString();
  } catch {
    normalizedUrl = undefined;
  }
  return {
    id: `cred_incident_${now.getTime().toString(36)}`,
    sourceUrl: normalizedUrl,
    detectedAt: now.toISOString(),
    exposedNames,
    services: detectServices(notice, exposedNames),
  };
};

export const matchCredentialInventory = (
  analysis: CredentialIncidentAnalysis,
  environments: CredentialEnvironmentInventory[],
): CredentialInventoryMatch[] => {
  const exposedSet = new Set(analysis.exposedNames);
  const inventoryNames = unique(environments.flatMap(environment => environment.credentialNames)).sort();
  return inventoryNames
    .filter(name => exposedSet.has(name))
    .map(name => {
      const service = ruleForName(name);
      return {
        name,
        service: service.label,
        severity: service.severity,
        environments: environments
          .filter(environment => environment.credentialNames.includes(name))
          .map(({ id, label, system }) => ({ id, label, system })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};

const namesLabel = (matches: CredentialInventoryMatch[]) => matches.map(match => match.name).join('、');

export const buildCredentialResponseActions = (
  matches: CredentialInventoryMatch[],
  owner: string,
): CredentialResponseAction[] => {
  const affectedNames = matches.map(match => match.name);
  const affectedEnvironments = unique(matches.flatMap(match => match.environments.map(environment => environment.label)));
  const label = namesLabel(matches) || '尚未命中的憑證';
  const base = `${Date.now().toString(36)}_${affectedNames.join('_').toLowerCase() || 'no_match'}`;
  return [
    {
      id: `action_revoke_${base}`,
      phase: 'REVOKE',
      title: '撤銷舊憑證',
      detail: affectedNames.length ? `先在原服務停用 ${label}，不要只覆寫部署設定。` : '確認其他部署與歷史環境沒有使用公告中的憑證。',
      affectedNames,
      affectedEnvironments,
      owner,
      status: 'PENDING',
    },
    {
      id: `action_reissue_${base}`,
      phase: 'REISSUE',
      title: '重建最小權限憑證',
      detail: affectedNames.length ? '建立新憑證，縮小權限、限制 API，並分開正式與測試環境。' : '若後續發現命中，依最小權限原則建立替代憑證。',
      affectedNames,
      affectedEnvironments,
      owner,
      status: 'PENDING',
    },
    {
      id: `action_deploy_${base}`,
      phase: 'DEPLOY',
      title: '更新部署並重新發布',
      detail: '更新受影響環境的秘密設定、重新部署，再確認舊版本與預覽環境沒有殘留。',
      affectedNames,
      affectedEnvironments,
      owner,
      status: 'PENDING',
    },
    {
      id: `action_review_${base}`,
      phase: 'REVIEW',
      title: '檢查用量、帳單與存取紀錄',
      detail: '從事件開始時間往前檢查異常請求、來源、額度與費用，保留供應商紀錄。',
      affectedNames,
      affectedEnvironments,
      owner,
      status: 'PENDING',
    },
    {
      id: `action_verify_${base}`,
      phase: 'VERIFY',
      title: '驗證新版本並封存事件',
      detail: '確認服務正常、舊憑證已失效，並將完成時間與證據雜湊寫入 Trust Timeline。',
      affectedNames,
      affectedEnvironments,
      owner,
      status: 'PENDING',
    },
  ];
};

export const createEvidenceId = async (payload: unknown): Promise<string> => {
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `sha256:${hash}`;
};
