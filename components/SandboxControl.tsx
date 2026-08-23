import React from 'react';
import {
  ArrowLeft,
  Ban,
  Bot,
  Check,
  Clock3,
  Fingerprint,
  KeyRound,
  Link2,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { AgentGrant, Language, TrustTimelineEvent } from '../types';

interface SandboxControlProps {
  language: Language;
  grant: AgentGrant;
  timeline: TrustTimelineEvent[];
  onBack: () => void;
  onRevoke: () => void;
  onResetGrant: () => void;
}

const COPY = {
  'zh-TW': {
    agentName: '安心工作 Agent', purposeValue: '查驗雇主、仲介與徵才資訊',
    back: '回到沙盒', eyebrow: '我的沙盒', title: '誰能替你做什麼，一眼看清楚。',
    body: '查看 Agent 身份、授權範圍與每一次政策決定。你可以隨時撤銷，下一次執行會立即失敗。',
    active: '授權有效', revoked: '已撤銷', represented: '代表使用者', purpose: '受託目的', expires: '授權期限',
    allow: '可以自動執行', confirm: '必須由你確認', deny: '永遠禁止',
    allowItems: ['在沙盒開啟網址', '查驗雇主與仲介身份', '讀取公開資料'],
    confirmItems: ['送出姓名、電話或居留資料'],
    denyItems: ['登入帳號', '付款或轉帳', '要求 OTP', '下載 App'],
    revoke: '撤銷 Agent 權限', reset: '恢復 Demo 授權', timeline: 'Trust Timeline',
    timelineBody: '每一步都有時間、Agent、工具、決策與證據雜湊。', empty: 'Agent 執行後，紀錄會出現在這裡。',
    evidence: 'IFF Evidence', evidenceBody: '授權與政策結果已整理成可驗證證據；不必讓一般使用者理解鏈、簽章或協定。',
    verified: '最近驗證', policy: '政策套件', chain: '紀錄完整性', demo: 'DEMO',
  },
  en: {
    agentName: 'WorkSafe Agent', purposeValue: 'Verify employers, agencies, and job offers',
    back: 'Back to sandbox', eyebrow: 'My sandbox', title: 'See exactly who can do what for you.',
    body: 'Review Agent identity, authorization boundaries, and every policy decision. Revoke anytime; the next action fails immediately.',
    active: 'Authorization active', revoked: 'Revoked', represented: 'Representing', purpose: 'Authorized purpose', expires: 'Expires',
    allow: 'Runs automatically', confirm: 'You must confirm', deny: 'Always blocked',
    allowItems: ['Open URLs in sandbox', 'Verify employers and agencies', 'Read public data'],
    confirmItems: ['Share name, phone, or residency data'],
    denyItems: ['Log in to accounts', 'Pay or transfer money', 'Request OTP', 'Download apps'],
    revoke: 'Revoke Agent access', reset: 'Restore demo grant', timeline: 'Trust Timeline',
    timelineBody: 'Every step records time, Agent, tool, decision, and evidence hash.', empty: 'Agent activity will appear here.',
    evidence: 'IFF Evidence', evidenceBody: 'Authorization and policy results are packaged as verifiable evidence without exposing protocol complexity to users.',
    verified: 'Last verified', policy: 'Policy bundle', chain: 'Log integrity', demo: 'DEMO',
  },
  vi: {
    agentName: 'Agent Việc Làm An Toàn', purposeValue: 'Xác minh chủ lao động, môi giới và tin tuyển dụng',
    back: 'Về hộp cát', eyebrow: 'Hộp cát của tôi', title: 'Biết rõ ai có thể làm gì thay bạn.',
    body: 'Xem danh tính Agent, phạm vi ủy quyền và mọi quyết định chính sách. Thu hồi bất cứ lúc nào; hành động tiếp theo sẽ thất bại ngay.',
    active: 'Ủy quyền đang hoạt động', revoked: 'Đã thu hồi', represented: 'Đại diện', purpose: 'Mục đích được phép', expires: 'Hết hạn',
    allow: 'Tự động thực hiện', confirm: 'Bạn phải xác nhận', deny: 'Luôn bị chặn',
    allowItems: ['Mở URL trong hộp cát', 'Xác minh chủ lao động và môi giới', 'Đọc dữ liệu công khai'],
    confirmItems: ['Chia sẻ tên, điện thoại hoặc dữ liệu cư trú'],
    denyItems: ['Đăng nhập tài khoản', 'Thanh toán hoặc chuyển tiền', 'Yêu cầu OTP', 'Tải ứng dụng'],
    revoke: 'Thu hồi quyền Agent', reset: 'Khôi phục quyền demo', timeline: 'Trust Timeline',
    timelineBody: 'Mỗi bước ghi lại thời gian, Agent, công cụ, quyết định và mã bằng chứng.', empty: 'Hoạt động Agent sẽ xuất hiện ở đây.',
    evidence: 'IFF Evidence', evidenceBody: 'Ủy quyền và kết quả chính sách được đóng gói thành bằng chứng có thể xác minh mà không làm giao diện phức tạp.',
    verified: 'Xác minh gần nhất', policy: 'Gói chính sách', chain: 'Tính toàn vẹn', demo: 'DEMO',
  },
} as const;

const timeLabel = (iso: string, language: Language) => new Intl.DateTimeFormat(language, {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(new Date(iso));

const SandboxControl: React.FC<SandboxControlProps> = ({ language, grant, timeline, onBack, onRevoke, onResetGrant }) => {
  const t = COPY[language] ?? COPY['zh-TW'];
  const isActive = grant.status === 'ACTIVE';
  const displayActor = (actor: string) => actor === grant.agentName ? t.agentName : actor;
  const expires = new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(grant.expiresAt));

  return (
    <main className="vf-container vf-control-page">
      <button className="vf-back-button" onClick={onBack}><ArrowLeft size={16} />{t.back}</button>
      <div className="vf-control-intro">
        <div><span className="vf-eyebrow">{t.eyebrow}</span><h1>{t.title}</h1><p>{t.body}</p></div>
        <span className="vf-demo-stamp">{t.demo}</span>
      </div>

      <div className="vf-control-grid">
        <section className="vf-grant-card">
          <div className="vf-grant-head">
            <div className="vf-agent-identity"><span className="vf-agent-avatar"><Bot size={18} /></span><div><small>AGENT / {grant.agentId}</small><strong>{t.agentName}</strong></div></div>
            <span className={`vf-status-pill ${isActive ? 'is-active' : 'is-revoked'}`}>{isActive ? <Check size={13} /> : <X size={13} />}{isActive ? t.active : t.revoked}</span>
          </div>
          <div className="vf-grant-meta">
            <div><UserRound size={16} /><span><small>{t.represented}</small>{grant.userName}</span></div>
            <div><Fingerprint size={16} /><span><small>{t.purpose}</small>{t.purposeValue}</span></div>
            <div><Clock3 size={16} /><span><small>{t.expires}</small>{expires}</span></div>
          </div>
          <div className="vf-boundary-grid">
            <div className="is-allow"><h3><ShieldCheck size={16} />{t.allow}</h3>{t.allowItems.map(item => <p key={item}><Check size={13} />{item}</p>)}</div>
            <div className="is-confirm"><h3><KeyRound size={16} />{t.confirm}</h3>{t.confirmItems.map(item => <p key={item}><LockKeyhole size={13} />{item}</p>)}</div>
            <div className="is-deny"><h3><Ban size={16} />{t.deny}</h3>{t.denyItems.map(item => <p key={item}><X size={13} />{item}</p>)}</div>
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
            <div><dt>{t.verified}</dt><dd>14 sec ago <Check size={12} /></dd></div>
            <div><dt>{t.policy}</dt><dd>migrant-safe/v1.4</dd></div>
            <div><dt>{t.chain}</dt><dd>sha256:7fd2…a91c</dd></div>
          </dl>
          <a href="https://ifandonlyif.io" target="_blank" rel="noreferrer">ifandonlyif.io <Link2 size={13} /></a>
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
                <div className="vf-timeline-copy"><strong>{event.action.replaceAll('_', ' ')}</strong><p>{displayActor(event.actor)}{event.target ? ` → ${event.target === grant.agentName ? t.agentName : event.target}` : ''}</p></div>
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
