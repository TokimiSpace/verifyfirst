import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  Bot,
  Check,
  Clock3,
  Download,
  Edit3,
  Fingerprint,
  KeyRound,
  Link2,
  LockKeyhole,
  RefreshCcw,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { AgentActionKind, AgentEvidencePacket, AgentGrant, EnterpriseVerificationRecord, Language, TrustTimelineEvent } from '../types';

interface SandboxControlProps {
  language: Language;
  grant: AgentGrant;
  timeline: TrustTimelineEvent[];
  evidencePackets: AgentEvidencePacket[];
  verificationRecords: EnterpriseVerificationRecord[];
  onBack: () => void;
  onRevoke: () => void;
  onResetGrant: () => void;
  onUpdateGrant: (grant: AgentGrant) => void;
}

const ACTIONS: AgentActionKind[] = [
  'OBSERVE_URL', 'CHECK_IDENTITY', 'READ_PUBLIC_DATA', 'SUBMIT_PERSONAL_DATA',
  'LOGIN', 'PAYMENT', 'REQUEST_OTP', 'DOWNLOAD_APP',
];

const HUMAN_ONLY_ACTIONS = new Set<AgentActionKind>(['SUBMIT_PERSONAL_DATA', 'LOGIN', 'REQUEST_OTP', 'DOWNLOAD_APP']);

const COPY = {
  'zh-TW': {
    back: '回到沙盒', eyebrow: '我的沙盒', title: '誰能替你做什麼，一眼看清楚。',
    body: '查看 Agent 身份、授權範圍與每一次政策決定。你可以隨時撤銷，下一次執行會立即失敗。',
    active: '授權有效', revoked: '已撤銷', represented: '代表使用者', purpose: '受託目的', expires: '授權期限',
    allow: '可以自動執行', confirm: '必須由你確認', deny: '永遠禁止',
    allowItems: ['在沙盒開啟網址', '查驗雇主與仲介身份', '讀取公開資料'],
    confirmItems: ['送出姓名、電話或居留資料'],
    denyItems: ['登入帳號', '付款或轉帳', '要求 OTP', '下載 App'],
    revoke: '撤銷 Agent 權限', reset: '恢復安全預設', timeline: 'Trust Timeline',
    timelineBody: '每一步都有時間、Agent、工具、決策與證據雜湊。', empty: 'Agent 執行後，紀錄會出現在這裡。',
    evidence: 'VerifyFirst Evidence', evidenceBody: '每次政策結果都封裝成完整 JSON 與 SHA-256 雜湊；x402 付款要求另由 IFF 提供獨立查驗證據。',
    verified: '最近決策', policy: '政策套件', chain: '紀錄 checksum', workspace: 'LOCAL WORKSPACE',
    edit: '編輯授權', save: '儲存政策', cancel: '取消', agentNameLabel: 'Agent 名稱', agentIdLabel: 'Agent ID',
    userLabel: '代表使用者', purposeLabel: '受託目的', targetLabel: '允許目標（逗號分隔）', expiresLabel: '有效期限',
    rulesLabel: '每個動作的政策', export: '匯出完整稽核 JSON', packetCount: 'Evidence Packets', verificationCount: '組織／憑證查驗',
    ruleAllow: 'ALLOW', ruleConfirm: 'CONFIRM', ruleDeny: 'DENY',
    actionLabels: { OBSERVE_URL: '隔離觀察網址', CHECK_IDENTITY: '查驗身分', READ_PUBLIC_DATA: '讀取公開資料', SUBMIT_PERSONAL_DATA: '送出個人資料', LOGIN: '登入帳號', PAYMENT: '付款／轉帳', REQUEST_OTP: '要求 OTP', DOWNLOAD_APP: '下載應用程式' },
  },
  en: {
    back: 'Back to sandbox', eyebrow: 'My sandbox', title: 'See exactly who can do what for you.',
    body: 'Review Agent identity, authorization boundaries, and every policy decision. Revoke anytime; the next action fails immediately.',
    active: 'Authorization active', revoked: 'Revoked', represented: 'Representing', purpose: 'Authorized purpose', expires: 'Expires',
    allow: 'Runs automatically', confirm: 'You must confirm', deny: 'Always blocked',
    allowItems: ['Open URLs in sandbox', 'Verify employers and agencies', 'Read public data'],
    confirmItems: ['Share name, phone, or residency data'],
    denyItems: ['Log in to accounts', 'Pay or transfer money', 'Request OTP', 'Download apps'],
    revoke: 'Revoke Agent access', reset: 'Restore safe defaults', timeline: 'Trust Timeline',
    timelineBody: 'Every step records time, Agent, tool, decision, and evidence hash.', empty: 'Agent activity will appear here.',
    evidence: 'VerifyFirst Evidence', evidenceBody: 'Every policy result is packaged as complete JSON with a SHA-256 digest; IFF supplies independent evidence for observed x402 payment requirements.',
    verified: 'Latest decision', policy: 'Policy bundle', chain: 'Record checksum', workspace: 'LOCAL WORKSPACE',
    edit: 'Edit authorization', save: 'Save policy', cancel: 'Cancel', agentNameLabel: 'Agent name', agentIdLabel: 'Agent ID',
    userLabel: 'Represented user', purposeLabel: 'Authorized purpose', targetLabel: 'Allowed targets (comma-separated)', expiresLabel: 'Expires',
    rulesLabel: 'Policy for each action', export: 'Export full audit JSON', packetCount: 'Evidence Packets', verificationCount: 'Identity / credential checks',
    ruleAllow: 'ALLOW', ruleConfirm: 'CONFIRM', ruleDeny: 'DENY',
    actionLabels: { OBSERVE_URL: 'Observe URL in isolation', CHECK_IDENTITY: 'Check identity', READ_PUBLIC_DATA: 'Read public data', SUBMIT_PERSONAL_DATA: 'Submit personal data', LOGIN: 'Log in', PAYMENT: 'Pay / transfer', REQUEST_OTP: 'Request OTP', DOWNLOAD_APP: 'Download app' },
  },
  vi: {
    back: 'Về hộp cát', eyebrow: 'Hộp cát của tôi', title: 'Biết rõ ai có thể làm gì thay bạn.',
    body: 'Xem danh tính Agent, phạm vi ủy quyền và mọi quyết định chính sách. Thu hồi bất cứ lúc nào; hành động tiếp theo sẽ thất bại ngay.',
    active: 'Ủy quyền đang hoạt động', revoked: 'Đã thu hồi', represented: 'Đại diện', purpose: 'Mục đích được phép', expires: 'Hết hạn',
    allow: 'Tự động thực hiện', confirm: 'Bạn phải xác nhận', deny: 'Luôn bị chặn',
    allowItems: ['Mở URL trong hộp cát', 'Xác minh chủ lao động và môi giới', 'Đọc dữ liệu công khai'],
    confirmItems: ['Chia sẻ tên, điện thoại hoặc dữ liệu cư trú'],
    denyItems: ['Đăng nhập tài khoản', 'Thanh toán hoặc chuyển tiền', 'Yêu cầu OTP', 'Tải ứng dụng'],
    revoke: 'Thu hồi quyền Agent', reset: 'Khôi phục mặc định an toàn', timeline: 'Trust Timeline',
    timelineBody: 'Mỗi bước ghi lại thời gian, Agent, công cụ, quyết định và mã bằng chứng.', empty: 'Hoạt động Agent sẽ xuất hiện ở đây.',
    evidence: 'VerifyFirst Evidence', evidenceBody: 'Mỗi kết quả chính sách được đóng gói thành JSON đầy đủ với SHA-256; IFF cung cấp bằng chứng độc lập cho yêu cầu thanh toán x402.',
    verified: 'Quyết định mới nhất', policy: 'Gói chính sách', chain: 'Checksum bản ghi', workspace: 'LOCAL WORKSPACE',
    edit: 'Sửa ủy quyền', save: 'Lưu chính sách', cancel: 'Hủy', agentNameLabel: 'Tên Agent', agentIdLabel: 'Agent ID',
    userLabel: 'Người được đại diện', purposeLabel: 'Mục đích ủy quyền', targetLabel: 'Mục tiêu cho phép (phân cách bằng dấu phẩy)', expiresLabel: 'Hết hạn',
    rulesLabel: 'Chính sách cho từng hành động', export: 'Xuất JSON kiểm toán đầy đủ', packetCount: 'Evidence Packets', verificationCount: 'Kiểm tra tổ chức / chứng thư',
    ruleAllow: 'ALLOW', ruleConfirm: 'CONFIRM', ruleDeny: 'DENY',
    actionLabels: { OBSERVE_URL: 'Quan sát URL cách ly', CHECK_IDENTITY: 'Kiểm tra danh tính', READ_PUBLIC_DATA: 'Đọc dữ liệu công khai', SUBMIT_PERSONAL_DATA: 'Gửi dữ liệu cá nhân', LOGIN: 'Đăng nhập', PAYMENT: 'Thanh toán / chuyển tiền', REQUEST_OTP: 'Yêu cầu OTP', DOWNLOAD_APP: 'Tải ứng dụng' },
  },
} as const;

const timeLabel = (iso: string, language: Language) => new Intl.DateTimeFormat(language, {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(new Date(iso));

const SandboxControl: React.FC<SandboxControlProps> = ({ language, grant, timeline, evidencePackets, verificationRecords, onBack, onRevoke, onResetGrant, onUpdateGrant }) => {
  const t = COPY[language] ?? COPY['zh-TW'];
  const isActive = grant.status === 'ACTIVE';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(grant);
  const [targets, setTargets] = useState(grant.allowedTargets.join(', '));
  const displayActor = (actor: string) => actor;
  const expires = new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(grant.expiresAt));
  const latestEvidence = evidencePackets[0];

  useEffect(() => {
    setDraft(grant);
    setTargets(grant.allowedTargets.join(', '));
  }, [grant]);

  const groupedActions = useMemo(() => ({
    allow: ACTIONS.filter(action => grant.allowedActions.includes(action)),
    confirm: ACTIONS.filter(action => grant.confirmationActions.includes(action)),
    deny: ACTIONS.filter(action => grant.deniedActions.includes(action)),
  }), [grant]);

  const ruleFor = (action: AgentActionKind) => draft.deniedActions.includes(action)
    ? 'DENY'
    : draft.confirmationActions.includes(action)
      ? 'CONFIRM'
      : 'ALLOW';

  const updateRule = (action: AgentActionKind, rule: 'ALLOW' | 'CONFIRM' | 'DENY') => {
    setDraft(current => ({
      ...current,
      allowedActions: rule === 'ALLOW' ? [...current.allowedActions.filter(item => item !== action), action] : current.allowedActions.filter(item => item !== action),
      confirmationActions: rule === 'CONFIRM' ? [...current.confirmationActions.filter(item => item !== action), action] : current.confirmationActions.filter(item => item !== action),
      deniedActions: rule === 'DENY' ? [...current.deniedActions.filter(item => item !== action), action] : current.deniedActions.filter(item => item !== action),
    }));
  };

  const save = () => {
    const allowedTargets = targets.split(',').map(item => item.trim()).filter(Boolean).slice(0, 32);
    const protectedDraft = {
      ...draft,
      status: 'ACTIVE' as const,
      allowedTargets,
      allowedActions: draft.allowedActions.filter(action => !HUMAN_ONLY_ACTIONS.has(action) && action !== 'PAYMENT'),
      confirmationActions: [...draft.confirmationActions.filter(action => action !== 'PAYMENT'), ...ACTIONS.filter(action => HUMAN_ONLY_ACTIONS.has(action) && !draft.deniedActions.includes(action))].filter((action, index, values) => values.indexOf(action) === index),
      deniedActions: [...draft.deniedActions.filter(action => action !== 'PAYMENT'), 'PAYMENT' as const].filter((action, index, values) => values.indexOf(action) === index),
    };
    onUpdateGrant(protectedDraft);
    setEditing(false);
  };

  const exportAudit = () => {
    const payload = { schema: 'verifyfirst.agent-workspace.v1', exportedAt: new Date().toISOString(), grant, timeline, evidencePackets, verificationRecords };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `verifyfirst-agent-audit-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="vf-container vf-control-page">
      <button className="vf-back-button" onClick={onBack}><ArrowLeft size={16} />{t.back}</button>
      <div className="vf-control-intro">
        <div><span className="vf-eyebrow">{t.eyebrow}</span><h1>{t.title}</h1><p>{t.body}</p></div>
        <span className="vf-demo-stamp">{t.workspace}</span>
      </div>

      <div className="vf-control-grid">
        <section className="vf-grant-card">
          <div className="vf-grant-head">
            <div className="vf-agent-identity"><span className="vf-agent-avatar"><Bot size={18} /></span><div><small>AGENT / {grant.agentId}</small><strong>{grant.agentName}</strong></div></div>
            <div className="vf-grant-head-actions"><button className="vf-text-button" onClick={() => setEditing(value => !value)}><Edit3 size={13} />{t.edit}</button><span className={`vf-status-pill ${isActive ? 'is-active' : 'is-revoked'}`}>{isActive ? <Check size={13} /> : <X size={13} />}{isActive ? t.active : t.revoked}</span></div>
          </div>
          {editing && (
            <div className="vf-grant-editor">
              <div className="vf-grant-editor-fields">
                <label><span>{t.agentNameLabel}</span><input value={draft.agentName} onChange={event => setDraft({ ...draft, agentName: event.target.value })} /></label>
                <label><span>{t.agentIdLabel}</span><input value={draft.agentId} onChange={event => setDraft({ ...draft, agentId: event.target.value })} /></label>
                <label><span>{t.userLabel}</span><input value={draft.userName} onChange={event => setDraft({ ...draft, userName: event.target.value })} /></label>
                <label><span>{t.expiresLabel}</span><input type="datetime-local" value={draft.expiresAt.slice(0, 16)} onChange={event => { const date = new Date(event.target.value); if (!Number.isNaN(date.getTime())) setDraft({ ...draft, expiresAt: date.toISOString() }); }} /></label>
                <label className="is-wide"><span>{t.purposeLabel}</span><input value={draft.agentPurpose} onChange={event => setDraft({ ...draft, agentPurpose: event.target.value })} /></label>
                <label className="is-wide"><span>{t.targetLabel}</span><input value={targets} onChange={event => setTargets(event.target.value)} placeholder="https://api.example.com, *.example.org" /></label>
              </div>
              <span className="vf-agent-kicker">{t.rulesLabel}</span>
              <div className="vf-policy-editor-list">{ACTIONS.map(action => {
                const paymentLocked = action === 'PAYMENT';
                const humanOnly = HUMAN_ONLY_ACTIONS.has(action);
                const value = paymentLocked ? 'DENY' : humanOnly && ruleFor(action) === 'ALLOW' ? 'CONFIRM' : ruleFor(action);
                return <label key={action}><span>{t.actionLabels[action]}</span><select value={value} disabled={paymentLocked} onChange={event => updateRule(action, event.target.value as 'ALLOW' | 'CONFIRM' | 'DENY')}>{!humanOnly && !paymentLocked && <option value="ALLOW">{t.ruleAllow}</option>}{!paymentLocked && <option value="CONFIRM">{t.ruleConfirm}</option>}<option value="DENY">{t.ruleDeny}</option></select></label>;
              })}</div>
              <div className="vf-agent-actions"><button className="vf-secondary-button" onClick={() => { setDraft(grant); setTargets(grant.allowedTargets.join(', ')); setEditing(false); }}>{t.cancel}</button><button className="vf-primary-button" onClick={save}><Save size={15} />{t.save}</button></div>
            </div>
          )}
          <div className="vf-grant-meta">
            <div><UserRound size={16} /><span><small>{t.represented}</small>{grant.userName}</span></div>
            <div><Fingerprint size={16} /><span><small>{t.purpose}</small>{grant.agentPurpose}</span></div>
            <div><Clock3 size={16} /><span><small>{t.expires}</small>{expires}</span></div>
          </div>
          <div className="vf-boundary-grid">
            <div className="is-allow"><h3><ShieldCheck size={16} />{t.allow}</h3>{groupedActions.allow.map(item => <p key={item}><Check size={13} />{t.actionLabels[item]}</p>)}</div>
            <div className="is-confirm"><h3><KeyRound size={16} />{t.confirm}</h3>{groupedActions.confirm.map(item => <p key={item}><LockKeyhole size={13} />{t.actionLabels[item]}</p>)}</div>
            <div className="is-deny"><h3><Ban size={16} />{t.deny}</h3>{groupedActions.deny.map(item => <p key={item}><X size={13} />{t.actionLabels[item]}</p>)}</div>
          </div>
          {isActive ? (
            <button className="vf-revoke-button" onClick={onRevoke}><Ban size={16} />{t.revoke}</button>
          ) : (
            <button className="vf-secondary-button" onClick={onResetGrant}><RefreshCcw size={16} />{t.reset}</button>
          )}
        </section>

        <aside className="vf-evidence-card">
          <div className="vf-evidence-orbit"><span><Link2 size={21} /></span></div>
          <span className="vf-agent-kicker">EVIDENCE LAYER</span>
          <h2>{t.evidence}</h2><p>{t.evidenceBody}</p>
          <dl>
            <div><dt>{t.verified}</dt><dd>{latestEvidence ? timeLabel(latestEvidence.createdAt, language) : '—'} {latestEvidence && <Check size={12} />}</dd></div>
            <div><dt>{t.policy}</dt><dd>verifyfirst.sandbox-policy.v1</dd></div>
            <div><dt>{t.chain}</dt><dd>{latestEvidence ? `${latestEvidence.integrity.digest.slice(0, 8)}…${latestEvidence.integrity.digest.slice(-4)}` : '—'}</dd></div>
            <div><dt>{t.packetCount}</dt><dd>{evidencePackets.length}</dd></div>
            <div><dt>{t.verificationCount}</dt><dd>{verificationRecords.length}</dd></div>
          </dl>
          <a href="https://ifandonlyif.io" target="_blank" rel="noreferrer">ifandonlyif.io <Link2 size={13} /></a>
          <button className="vf-secondary-button vf-export-audit" onClick={exportAudit}><Download size={14} />{t.export}</button>
        </aside>
      </div>

      <section className="vf-trust-timeline">
        <div className="vf-section-heading"><div><span className="vf-agent-kicker">AUDIT LOG</span><h2>{t.timeline}</h2><p>{t.timelineBody}</p></div><span>{timeline.length} EVENTS</span></div>
        {timeline.length === 0 ? <div className="vf-timeline-empty">{t.empty}</div> : (
          <div className="vf-timeline-list">
            {timeline.map((event, index) => (
              <article key={event.id} className={`is-${event.decision.toLowerCase()}`}>
                <div className="vf-timeline-rail"><span>{timeline.length - index}</span></div>
                <time>{timeLabel(event.at, language)}</time>
                <div className="vf-timeline-copy"><strong>{event.action.replaceAll('_', ' ')}</strong><p>{displayActor(event.actor)}{event.target ? ` → ${event.target === grant.agentName ? grant.agentName : event.target}` : ''}</p></div>
                <span className="vf-timeline-decision">{event.decision}</span>
                <code>{event.evidenceId.slice(0, 20)}…</code>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default SandboxControl;
