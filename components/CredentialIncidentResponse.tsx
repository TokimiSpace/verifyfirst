import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSearch,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  RefreshCcw,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  CredentialIncidentWorkspace,
  CredentialResponseAction,
  Language,
  TrustTimelineEvent,
} from '../types';
import {
  analyzeCredentialIncident,
  buildCredentialResponseActions,
  createEvidenceId,
  matchCredentialInventory,
  normalizeInventoryNames,
} from '../services/credentialIncident';

interface CredentialIncidentResponseProps {
  language: Language;
  onBack: () => void;
}

const STORAGE_KEY = 'verifyfirst.credential-incident.v1';

const DEFAULT_INVENTORY = [
  'GEMINI_API_KEY',
  'GOGOLOOK_API_KEY',
  'GOOGLE_SAFE_BROWSING_KEY',
  'VIRUSTOTAL_API_KEY',
  'BLOB_READ_WRITE_TOKEN',
  'GOOGLE_SHEETS_WEBHOOK_URL',
  'BOT_API_KEY',
].join('\n');

const DEMO_NOTICE = `Zeabur security incident update — 2026-08-27
An unauthorized party used an internal service credential to retrieve project environment variable records. Customers should revoke and replace affected credentials and review unusual usage and charges.

Confirmed environment variable names include:
ACCESS_TOKEN, API_SECRET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, CF_API_TOKEN,
CLIENT_SECRET, CLOUDFLARE_API_TOKEN, GEMINI_API_KEY, GITHUB_PAT, GITHUB_TOKEN,
GOOGLE_API_KEY, PRIVATE_KEY, STRIPE_SECRET_KEY, ANTHROPIC_API_KEY,
OPENROUTER_API_KEY, OPENAI_API_KEY, DATABASE_URL, JWT_SECRET, MONGODB_URI,
MYSQL_PASSWORD, POSTGRES_PASSWORD, REDIS_PASSWORD, SECRET_KEY.

https://status.zeabur.com/incident/1037896`;

const COPY = {
  'zh-TW': {
    back: '回到安全查核', eyebrow: '憑證外洩應變', title: '把外洩消息，變成可完成的處置證據。',
    intro: '貼入官方公告、只用環境變數名稱比對，接著逐項撤銷、重建、部署與查帳。每次完成都會留下真正的 SHA-256 證據。',
    local: 'LOCAL-ONLY', localTitle: '秘密值不離開這台裝置', localBody: '本流程不呼叫 Gemini。若貼入 KEY=value，只保留 KEY，值會在比對時立即丟棄；公告原文也不寫入本機紀錄。',
    steps: ['解析公告', '整理名稱', '比對清單', '完成處置', '封存證據'],
    noticeTitle: '貼入事件公告', noticeBody: '使用供應商公告或可信來源的文字。請勿貼入任何真正的金鑰值。',
    source: '來源連結（選填）', sourcePlaceholder: 'https://status.example.com/incident/...', notice: '公告內容',
    noticePlaceholder: '貼上公告文字；系統會在本機整理受影響服務與環境變數名稱…', demo: '載入 Zeabur 事件範例', analyze: '解析公告',
    missingNotice: '請先貼入包含事件資訊的公告內容。', noNames: '沒有辨識到憑證名稱。請貼入包含環境變數名稱的公告文字。',
    summary: '事件摘要', detected: '辨識到', services: '個相關服務', names: '個憑證名稱', sourceLink: '查看原始來源', newIncident: '開新事件',
    inventoryTitle: '只比對名稱', inventoryBody: '列出平台使用的環境變數名稱，一行一個。可直接貼 KEY=value；值不會被保存或傳送。',
    inventory: '平台憑證清單', owner: '預設負責人', ownerPlaceholder: '例如：Ben / Security', compare: '比對並建立處置清單',
    noMatch: '目前沒有直接命中', noMatchBody: '仍要確認 Zeabur、舊部署、Preview 與隊友環境是否使用相同憑證。',
    matchTitle: '直接命中', actionTitle: '處置清單', actionBody: '每項任務都要有負責人；標記完成時會記錄時間與證據雜湊。',
    taskOwner: '負責人', markDone: '標記完成', reopen: '重新開啟', completed: '已完成', pending: '待處理', affects: '影響',
    timeline: 'Trust Timeline', timelineBody: '只記錄名稱、負責人、動作、時間與 SHA-256；不含秘密值。', events: 'EVENTS',
    copy: '複製應變摘要', copied: '已複製', ownerRequired: '請先填寫這項任務的負責人。', clearConfirm: '確定清除目前事件與本機時間線？',
  },
  en: {
    back: 'Back to safety check', eyebrow: 'Credential incident response', title: 'Turn an exposure notice into verifiable action.',
    intro: 'Paste an official notice, compare environment-variable names only, then revoke, reissue, deploy, and review. Every completion gets a real SHA-256 receipt.',
    local: 'LOCAL-ONLY', localTitle: 'Secret values never leave this device', localBody: 'This flow does not call Gemini. If you paste KEY=value, only KEY survives comparison; notice text is not persisted either.',
    steps: ['Parse notice', 'Extract names', 'Compare', 'Remediate', 'Seal evidence'],
    noticeTitle: 'Paste incident notice', noticeBody: 'Use vendor or trusted-source text. Never paste a live secret value.',
    source: 'Source URL (optional)', sourcePlaceholder: 'https://status.example.com/incident/...', notice: 'Notice text',
    noticePlaceholder: 'Paste the notice; affected services and environment-variable names are extracted locally…', demo: 'Load Zeabur example', analyze: 'Parse notice',
    missingNotice: 'Paste an incident notice first.', noNames: 'No credential names were detected. Include the environment-variable names from the notice.',
    summary: 'Incident summary', detected: 'Detected', services: 'related services', names: 'credential names', sourceLink: 'Open original source', newIncident: 'New incident',
    inventoryTitle: 'Compare names only', inventoryBody: 'List environment-variable names used by your platform, one per line. KEY=value is accepted; values are discarded.',
    inventory: 'Platform credential inventory', owner: 'Default owner', ownerPlaceholder: 'e.g. Ben / Security', compare: 'Compare and build action plan',
    noMatch: 'No direct match', noMatchBody: 'Still check old deployments, previews, teammates, and any Zeabur project for reused credentials.',
    matchTitle: 'Direct matches', actionTitle: 'Response actions', actionBody: 'Every action needs an owner. Completion records the time and an evidence hash.',
    taskOwner: 'Owner', markDone: 'Mark complete', reopen: 'Reopen', completed: 'Completed', pending: 'Pending', affects: 'Affects',
    timeline: 'Trust Timeline', timelineBody: 'Names, owner, action, time, and SHA-256 only—never secret values.', events: 'EVENTS',
    copy: 'Copy response summary', copied: 'Copied', ownerRequired: 'Add an owner before completing this action.', clearConfirm: 'Clear this incident and its local timeline?',
  },
  vi: {
    back: 'Về kiểm tra an toàn', eyebrow: 'Ứng phó lộ thông tin xác thực', title: 'Biến thông báo rò rỉ thành hành động có bằng chứng.',
    intro: 'Dán thông báo chính thức, chỉ so khớp tên biến môi trường, rồi thu hồi, cấp lại, triển khai và kiểm tra. Mỗi lần hoàn tất có bằng chứng SHA-256.',
    local: 'CHỈ CỤC BỘ', localTitle: 'Giá trị bí mật không rời thiết bị', localBody: 'Quy trình không gọi Gemini. Nếu dán KEY=value, chỉ KEY được giữ lại; nội dung thông báo cũng không được lưu.',
    steps: ['Đọc thông báo', 'Lấy tên', 'So khớp', 'Khắc phục', 'Lưu bằng chứng'],
    noticeTitle: 'Dán thông báo sự cố', noticeBody: 'Dùng nội dung từ nhà cung cấp hoặc nguồn tin cậy. Không dán giá trị khóa thật.',
    source: 'Liên kết nguồn (tùy chọn)', sourcePlaceholder: 'https://status.example.com/incident/...', notice: 'Nội dung thông báo',
    noticePlaceholder: 'Dán thông báo; dịch vụ và tên biến môi trường sẽ được xử lý cục bộ…', demo: 'Tải ví dụ Zeabur', analyze: 'Phân tích thông báo',
    missingNotice: 'Hãy dán thông báo sự cố trước.', noNames: 'Không tìm thấy tên thông tin xác thực. Hãy thêm tên biến môi trường.',
    summary: 'Tóm tắt sự cố', detected: 'Đã phát hiện', services: 'dịch vụ liên quan', names: 'tên thông tin xác thực', sourceLink: 'Mở nguồn gốc', newIncident: 'Sự cố mới',
    inventoryTitle: 'Chỉ so khớp tên', inventoryBody: 'Liệt kê tên biến môi trường, mỗi dòng một tên. Có thể dán KEY=value; giá trị sẽ bị loại bỏ.',
    inventory: 'Danh mục thông tin xác thực', owner: 'Người phụ trách mặc định', ownerPlaceholder: 'VD: Ben / Security', compare: 'So khớp và tạo kế hoạch',
    noMatch: 'Không khớp trực tiếp', noMatchBody: 'Vẫn cần kiểm tra bản triển khai cũ, preview, đồng đội và dự án Zeabur.',
    matchTitle: 'Khớp trực tiếp', actionTitle: 'Danh sách ứng phó', actionBody: 'Mỗi việc cần người phụ trách; khi hoàn tất sẽ ghi thời gian và mã bằng chứng.',
    taskOwner: 'Người phụ trách', markDone: 'Đánh dấu xong', reopen: 'Mở lại', completed: 'Đã xong', pending: 'Chờ xử lý', affects: 'Ảnh hưởng',
    timeline: 'Trust Timeline', timelineBody: 'Chỉ lưu tên, người phụ trách, hành động, thời gian và SHA-256—không lưu giá trị bí mật.', events: 'SỰ KIỆN',
    copy: 'Sao chép tóm tắt', copied: 'Đã sao chép', ownerRequired: 'Thêm người phụ trách trước khi hoàn tất.', clearConfirm: 'Xóa sự cố và dòng thời gian cục bộ?',
  },
} as const;

const PHASE_LABEL = {
  REVOKE: 'REVOKE', REISSUE: 'REISSUE', DEPLOY: 'DEPLOY', REVIEW: 'REVIEW', VERIFY: 'VERIFY',
} as const;

const ACTION_UI = {
  en: {
    REVOKE: ['Revoke old credentials', 'Disable the affected credentials at their issuing services; changing deployment settings alone is not enough.'],
    REISSUE: ['Issue least-privilege replacements', 'Create new credentials with narrower scopes, API restrictions, and separate production and test access.'],
    DEPLOY: ['Update and redeploy', 'Update every affected environment, redeploy, and check old builds and previews for leftovers.'],
    REVIEW: ['Review usage, billing, and access logs', 'Inspect requests, sources, quotas, and charges around the incident window; preserve provider records.'],
    VERIFY: ['Verify and seal the incident', 'Confirm the service works and old credentials fail, then seal the completion in the Trust Timeline.'],
  },
  vi: {
    REVOKE: ['Thu hồi thông tin xác thực cũ', 'Vô hiệu hóa tại dịch vụ phát hành; chỉ đổi cấu hình triển khai là chưa đủ.'],
    REISSUE: ['Cấp lại với quyền tối thiểu', 'Tạo thông tin mới với phạm vi hẹp hơn, giới hạn API và tách môi trường thật với thử nghiệm.'],
    DEPLOY: ['Cập nhật và triển khai lại', 'Cập nhật mọi môi trường bị ảnh hưởng, triển khai lại và kiểm tra bản cũ hoặc preview.'],
    REVIEW: ['Kiểm tra mức dùng, hóa đơn và nhật ký', 'Kiểm tra yêu cầu, nguồn, hạn mức và chi phí quanh thời điểm sự cố; giữ lại nhật ký nhà cung cấp.'],
    VERIFY: ['Xác minh và đóng sự cố', 'Xác nhận dịch vụ hoạt động và khóa cũ đã vô hiệu, sau đó lưu bằng chứng vào Trust Timeline.'],
  },
} as const;

const loadWorkspace = (): CredentialIncidentWorkspace | null => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as CredentialIncidentWorkspace | null;
    return parsed?.version === 1 && parsed.analysis?.id ? parsed : null;
  } catch {
    return null;
  }
};

const makeTimelineEvent = async (
  event: Omit<TrustTimelineEvent, 'id' | 'evidenceId'>,
): Promise<TrustTimelineEvent> => {
  const evidenceId = await createEvidenceId(event);
  return { ...event, id: `evt_${Date.now().toString(36)}_${evidenceId.slice(-6)}`, evidenceId };
};

const timeLabel = (iso: string, language: Language) => new Intl.DateTimeFormat(language, {
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(new Date(iso));

const CredentialIncidentResponse: React.FC<CredentialIncidentResponseProps> = ({ language, onBack }) => {
  const t = COPY[language] ?? COPY['zh-TW'];
  const [workspace, setWorkspace] = useState<CredentialIncidentWorkspace | null>(() => loadWorkspace());
  const [notice, setNotice] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [inventoryInput, setInventoryInput] = useState(() => loadWorkspace()?.inventoryNames.join('\n') || DEFAULT_INVENTORY);
  const [defaultOwner, setDefaultOwner] = useState(() => loadWorkspace()?.actions.find(action => action.owner)?.owner || '');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (workspace) localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    else localStorage.removeItem(STORAGE_KEY);
  }, [workspace]);

  const completedCount = workspace?.actions.filter(action => action.status === 'COMPLETED').length ?? 0;
  const hasPlan = Boolean(workspace?.actions.length);
  const allComplete = hasPlan && completedCount === workspace!.actions.length;
  const progress = useMemo(() => [
    Boolean(workspace),
    Boolean(workspace?.analysis.exposedNames.length),
    hasPlan,
    allComplete,
    allComplete && Boolean(workspace?.timeline.length),
  ], [workspace, hasPlan, allComplete]);

  const actionCopy = (action: CredentialResponseAction) => {
    if (language === 'zh-TW') return { title: action.title, detail: action.detail };
    const localized = ACTION_UI[language][action.phase];
    return { title: localized[0], detail: localized[1] };
  };

  const handleAnalyze = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (notice.trim().length < 20) {
      setError(t.missingNotice);
      return;
    }
    const analysis = analyzeCredentialIncident(notice, sourceUrl);
    if (!analysis.exposedNames.length) {
      setError(t.noNames);
      return;
    }
    const timelineEvent = await makeTimelineEvent({
      at: new Date().toISOString(), actor: 'VerifyFirst local parser', action: 'INCIDENT_PARSED',
      target: analysis.sourceUrl || 'pasted notice', decision: 'INFO',
      detail: `${analysis.services.length} services / ${analysis.exposedNames.length} credential names; values excluded`,
    });
    setWorkspace({ version: 1, analysis, inventoryNames: [], matches: [], actions: [], timeline: [timelineEvent] });
    setNotice('');
    setSourceUrl('');
  };

  const handleCompare = async () => {
    if (!workspace) return;
    setError('');
    const inventoryNames = normalizeInventoryNames(inventoryInput);
    const matches = matchCredentialInventory(workspace.analysis, inventoryNames);
    const actions = buildCredentialResponseActions(matches, defaultOwner.trim());
    const timelineEvent = await makeTimelineEvent({
      at: new Date().toISOString(), actor: 'VerifyFirst name matcher', action: 'INVENTORY_MATCHED',
      target: `${inventoryNames.length} credential names`, decision: matches.length ? 'REQUIRE_CONFIRMATION' : 'INFO',
      detail: `${matches.length} direct matches; secret values discarded before comparison`,
    });
    setInventoryInput(inventoryNames.join('\n'));
    setWorkspace(current => current ? {
      ...current, inventoryNames, matches, actions, timeline: [timelineEvent, ...current.timeline].slice(0, 60),
    } : current);
  };

  const updateActionOwner = (actionId: string, owner: string) => {
    setWorkspace(current => current ? {
      ...current,
      actions: current.actions.map(action => action.id === actionId ? { ...action, owner } : action),
    } : current);
  };

  const toggleAction = async (action: CredentialResponseAction) => {
    if (!workspace) return;
    if (!action.owner.trim()) {
      setError(t.ownerRequired);
      return;
    }
    setError('');
    const now = new Date().toISOString();
    const completing = action.status === 'PENDING';
    const evidencePayload = {
      incidentId: workspace.analysis.id,
      actionId: action.id,
      phase: action.phase,
      affectedNames: action.affectedNames,
      owner: action.owner.trim(),
      status: completing ? 'COMPLETED' : 'REOPENED',
      at: now,
    };
    const evidenceId = await createEvidenceId(evidencePayload);
    const localizedAction = actionCopy(action);
    const timelineEvent: TrustTimelineEvent = {
      id: `evt_${Date.now().toString(36)}_${evidenceId.slice(-6)}`,
      at: now,
      actor: action.owner.trim(),
      action: completing ? `${action.phase}_COMPLETED` : `${action.phase}_REOPENED`,
      target: action.affectedNames.join(', ') || 'credential inventory',
      decision: completing ? 'ALLOW' : 'REQUIRE_CONFIRMATION',
      detail: localizedAction.title,
      evidenceId,
    };
    setWorkspace(current => current ? {
      ...current,
      actions: current.actions.map(item => item.id === action.id ? {
        ...item,
        status: completing ? 'COMPLETED' : 'PENDING',
        completedAt: completing ? now : undefined,
        evidenceId: completing ? evidenceId : undefined,
      } : item),
      timeline: [timelineEvent, ...current.timeline].slice(0, 60),
    } : current);
  };

  const resetWorkspace = () => {
    if (workspace && !window.confirm(t.clearConfirm)) return;
    setWorkspace(null);
    setNotice('');
    setSourceUrl('');
    setInventoryInput(DEFAULT_INVENTORY);
    setDefaultOwner('');
    setError('');
  };

  const copySummary = async () => {
    if (!workspace) return;
    const lines = [
      'VerifyFirst — Credential Incident Response',
      `Incident: ${workspace.analysis.id}`,
      `Source: ${workspace.analysis.sourceUrl || 'N/A'}`,
      `Exposed names: ${workspace.analysis.exposedNames.join(', ')}`,
      `Direct matches: ${workspace.matches.map(match => match.name).join(', ') || 'none'}`,
      '',
      ...workspace.actions.map(action => `[${action.status}] ${action.phase} — ${actionCopy(action).title} — ${action.owner || 'unassigned'}${action.evidenceId ? ` — ${action.evidenceId}` : ''}`),
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="vf-container vf-incident-page">
      <button className="vf-back-button" onClick={onBack}><ArrowLeft size={16} />{t.back}</button>

      <header className="vf-incident-intro">
        <div>
          <span className="vf-eyebrow">{t.eyebrow}</span>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
        </div>
        <aside className="vf-local-seal">
          <span><LockKeyhole size={15} />{t.local}</span>
          <strong>{t.localTitle}</strong>
          <p>{t.localBody}</p>
        </aside>
      </header>

      <ol className="vf-containment-rail" aria-label="Response progress">
        {t.steps.map((step, index) => (
          <li key={step} className={progress[index] ? 'is-done' : index === progress.findIndex(done => !done) ? 'is-current' : ''}>
            <span>{progress[index] ? <Check size={13} /> : String(index + 1).padStart(2, '0')}</span>
            <strong>{step}</strong>
          </li>
        ))}
      </ol>

      {!workspace ? (
        <section className="vf-incident-intake">
          <div className="vf-incident-section-head">
            <span><FileSearch size={18} /></span>
            <div><small>STEP 01 / SOURCE</small><h2>{t.noticeTitle}</h2><p>{t.noticeBody}</p></div>
          </div>
          <form onSubmit={handleAnalyze}>
            <label>
              <span>{t.source}</span>
              <input value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder={t.sourcePlaceholder} inputMode="url" />
            </label>
            <label>
              <span>{t.notice}</span>
              <textarea value={notice} onChange={event => setNotice(event.target.value)} placeholder={t.noticePlaceholder} rows={11} />
            </label>
            {error && <p className="vf-incident-error" role="alert"><AlertOctagon size={15} />{error}</p>}
            <div className="vf-incident-form-actions">
              <button type="button" className="vf-text-button" onClick={() => { setNotice(DEMO_NOTICE); setSourceUrl('https://status.zeabur.com/incident/1037896'); }}>
                <RefreshCcw size={14} />{t.demo}
              </button>
              <button type="submit" className="vf-incident-primary"><ScanSearch size={16} />{t.analyze}</button>
            </div>
          </form>
        </section>
      ) : (
        <>
          <section className="vf-incident-summary">
            <div className="vf-incident-summary-main">
              <small>INCIDENT / {workspace.analysis.id}</small>
              <h2>{t.summary}</h2>
              <p>{t.detected} <strong>{workspace.analysis.services.length}</strong> {t.services}、<strong>{workspace.analysis.exposedNames.length}</strong> {t.names}。</p>
              <div className="vf-service-chips">
                {workspace.analysis.services.map(service => <span key={service.id} className={`is-${service.severity.toLowerCase()}`}>{service.label}</span>)}
              </div>
            </div>
            <div className="vf-incident-summary-actions">
              {workspace.analysis.sourceUrl && <a href={workspace.analysis.sourceUrl} target="_blank" rel="noreferrer">{t.sourceLink}<ExternalLink size={13} /></a>}
              <button onClick={resetWorkspace}><RotateCcw size={13} />{t.newIncident}</button>
            </div>
          </section>

          <div className="vf-incident-workgrid">
            <section className="vf-inventory-card">
              <div className="vf-incident-section-head">
                <span><KeyRound size={18} /></span>
                <div><small>STEP 02–03 / NAME-ONLY</small><h2>{t.inventoryTitle}</h2><p>{t.inventoryBody}</p></div>
              </div>
              <label>
                <span>{t.inventory}</span>
                <textarea value={inventoryInput} onChange={event => setInventoryInput(event.target.value)} rows={9} spellCheck={false} />
              </label>
              <label>
                <span>{t.owner}</span>
                <input value={defaultOwner} onChange={event => setDefaultOwner(event.target.value)} placeholder={t.ownerPlaceholder} />
              </label>
              <button className="vf-incident-primary is-wide" onClick={handleCompare}><Fingerprint size={16} />{t.compare}</button>
            </section>

            <aside className="vf-exposure-ledger">
              <div className="vf-ledger-head"><small>EXPOSURE LEDGER</small><span>{workspace.analysis.exposedNames.length}</span></div>
              <div className="vf-ledger-list">
                {workspace.analysis.exposedNames.map(name => {
                  const match = workspace.matches.find(item => item.name === name);
                  return <div key={name} className={match ? 'is-match' : ''}><code>{name}</code>{match ? <strong>{t.matchTitle}</strong> : <span>NOTICE</span>}</div>;
                })}
              </div>
            </aside>
          </div>

          {hasPlan && (
            <section className="vf-action-board">
              <div className="vf-section-heading">
                <div><span className="vf-agent-kicker">STEP 04 / CONTAINMENT</span><h2>{t.actionTitle}</h2><p>{t.actionBody}</p></div>
                <span>{completedCount} / {workspace.actions.length} {t.completed}</span>
              </div>
              {workspace.matches.length === 0 && <div className="vf-no-match"><ShieldCheck size={19} /><div><strong>{t.noMatch}</strong><p>{t.noMatchBody}</p></div></div>}
              {workspace.matches.length > 0 && (
                <div className="vf-match-strip"><AlertOctagon size={16} /><strong>{workspace.matches.length} {t.matchTitle}</strong>{workspace.matches.map(match => <code key={match.name}>{match.name}</code>)}</div>
              )}
              <div className="vf-action-list">
                {workspace.actions.map((action, index) => (
                  <article key={action.id} className={action.status === 'COMPLETED' ? 'is-completed' : ''}>
                    <div className="vf-action-index">{String(index + 1).padStart(2, '0')}</div>
                    <div className="vf-action-copy">
                      <div><span>{PHASE_LABEL[action.phase]}</span><strong>{actionCopy(action).title}</strong></div>
                      <p>{actionCopy(action).detail}</p>
                      {action.affectedNames.length > 0 && <small>{t.affects}: {action.affectedNames.join(' · ')}</small>}
                    </div>
                    <label className="vf-action-owner"><span><UserRound size={12} />{t.taskOwner}</span><input value={action.owner} onChange={event => updateActionOwner(action.id, event.target.value)} placeholder="—" /></label>
                    <button className="vf-action-toggle" onClick={() => toggleAction(action)}>
                      {action.status === 'COMPLETED' ? <><RotateCcw size={14} />{t.reopen}</> : <><CheckCircle2 size={14} />{t.markDone}</>}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {error && <p className="vf-incident-error is-floating" role="alert"><AlertOctagon size={15} />{error}</p>}

          <section className="vf-trust-timeline vf-incident-timeline">
            <div className="vf-section-heading">
              <div><span className="vf-agent-kicker">STEP 05 / EVIDENCE</span><h2>{t.timeline}</h2><p>{t.timelineBody}</p></div>
              <div className="vf-timeline-tools"><button onClick={copySummary}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? t.copied : t.copy}</button><span>{workspace.timeline.length} {t.events}</span></div>
            </div>
            <div className="vf-timeline-list">
              {workspace.timeline.map((event, index) => (
                <article key={event.id} className={`is-${event.decision.toLowerCase()}`}>
                  <div className="vf-timeline-rail"><span>{workspace.timeline.length - index}</span></div>
                  <time>{timeLabel(event.at, language)}</time>
                  <div className="vf-timeline-copy"><strong>{event.action.replaceAll('_', ' ')}</strong><p>{event.actor}{event.target ? ` → ${event.target}` : ''}</p></div>
                  <span className="vf-timeline-decision">{event.decision}</span>
                  <code title={event.evidenceId}>{event.evidenceId}</code>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
};

export default CredentialIncidentResponse;
