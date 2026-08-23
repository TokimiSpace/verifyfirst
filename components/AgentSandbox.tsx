import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleStop,
  Clock3,
  ExternalLink,
  FileSearch,
  Fingerprint,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  UserRoundCheck,
  X,
} from 'lucide-react';
import {
  AgentActionRequest,
  AgentGrant,
  AgentPolicyResult,
  Language,
  TrustTimelineEvent,
} from '../types';
import { evaluateAgentAction } from '../services/agentPolicy';

interface AgentSandboxProps {
  language: Language;
  grant: AgentGrant;
  onOpenControl: () => void;
  onTimelineEvent: (event: TrustTimelineEvent) => void;
}

type DemoState = 'PENDING' | 'SCANNING' | 'CONFIRM' | 'LIMITED_ALLOW' | 'DENIED';

const COPY = {
  'zh-TW': {
    agentName: '安心工作 Agent',
    eyebrow: 'Agent Filter · 即時請求',
    pendingTitle: '有一個 Agent 想替你行動',
    pendingBody: '安心工作 Agent 想開啟徵才連結，並準備填入你的居留資料。',
    inspect: '先在沙盒檢查',
    control: '查看 Agent 權限',
    represented: '代表 Nguyễn An',
    expires: '授權剩 23 小時',
    request: '要求執行',
    requestValue: '查驗雇主後，提交居留證姓名與電話',
    scanning: '正在沙盒中拆解這次動作',
    step1: 'Agent 身份與授權有效',
    step2: '徵才連結已隔離開啟',
    step3: '偵測到個資送出行為',
    confirmTitle: '需要你確認',
    confirmBody: '查驗網址可以繼續；送出姓名、電話與居留資料前必須由你決定。',
    safeScope: '只允許安全查驗',
    deny: '拒絕這次動作',
    blockLabel: '系統已自動禁止',
    blockValue: '登入、付款、下載 App、要求 OTP',
    allowedTitle: '已限縮範圍，可以繼續',
    allowedBody: 'Agent 只能讀取公開資訊與查驗雇主，沒有取得你的個資。',
    deniedTitle: '已攔下這次動作',
    deniedBody: 'Agent 沒有執行，也沒有送出任何資料。',
    again: '重新模擬',
    revokedTitle: '授權已撤銷，執行失敗',
    revokedBody: '政策閘門在工具執行前拒絕了 Agent。',
    decisionAllow: 'ALLOW · 僅唯讀',
    decisionDeny: 'DENY · 未執行',
  },
  en: {
    agentName: 'WorkSafe Agent',
    eyebrow: 'Agent Filter · live request',
    pendingTitle: 'An Agent wants to act for you',
    pendingBody: 'WorkSafe Agent wants to open a job link and prepare your residency details.',
    inspect: 'Inspect in sandbox',
    control: 'View Agent access',
    represented: 'For Nguyễn An',
    expires: '23 hours left',
    request: 'Requested action',
    requestValue: 'Verify employer, then submit legal name and phone',
    scanning: 'Breaking the action into safe steps',
    step1: 'Agent identity and grant are valid',
    step2: 'Job link opened in isolation',
    step3: 'Personal-data submission detected',
    confirmTitle: 'You need to confirm',
    confirmBody: 'Link verification may continue. Only you can approve sharing your personal information.',
    safeScope: 'Allow safe checks only',
    deny: 'Deny this action',
    blockLabel: 'Always blocked',
    blockValue: 'Login, payment, app download, OTP requests',
    allowedTitle: 'Scope reduced — safe to continue',
    allowedBody: 'The Agent can only read public information and verify the employer. Your data stays private.',
    deniedTitle: 'Action stopped',
    deniedBody: 'The Agent did not run and no data was shared.',
    again: 'Run demo again',
    revokedTitle: 'Authorization revoked — action failed',
    revokedBody: 'The policy gate denied the Agent before any tool was executed.',
    decisionAllow: 'ALLOW · read-only',
    decisionDeny: 'DENY · not executed',
  },
  vi: {
    agentName: 'Agent Việc Làm An Toàn',
    eyebrow: 'Bộ lọc Agent · yêu cầu trực tiếp',
    pendingTitle: 'Một Agent muốn hành động thay bạn',
    pendingBody: 'Agent Việc Làm An Toàn muốn mở liên kết tuyển dụng và chuẩn bị thông tin cư trú.',
    inspect: 'Kiểm tra trong hộp cát',
    control: 'Xem quyền Agent',
    represented: 'Đại diện Nguyễn An',
    expires: 'Còn 23 giờ',
    request: 'Hành động yêu cầu',
    requestValue: 'Xác minh chủ lao động, sau đó gửi tên và số điện thoại',
    scanning: 'Đang tách hành động thành các bước an toàn',
    step1: 'Danh tính và ủy quyền Agent hợp lệ',
    step2: 'Liên kết việc làm được mở cách ly',
    step3: 'Phát hiện hành động gửi dữ liệu cá nhân',
    confirmTitle: 'Bạn cần xác nhận',
    confirmBody: 'Có thể tiếp tục kiểm tra liên kết; chỉ bạn mới có thể cho phép chia sẻ dữ liệu cá nhân.',
    safeScope: 'Chỉ cho phép kiểm tra an toàn',
    deny: 'Từ chối hành động',
    blockLabel: 'Luôn bị chặn',
    blockValue: 'Đăng nhập, thanh toán, tải ứng dụng, yêu cầu OTP',
    allowedTitle: 'Đã giới hạn phạm vi — có thể tiếp tục',
    allowedBody: 'Agent chỉ đọc thông tin công khai và xác minh chủ lao động. Dữ liệu của bạn vẫn riêng tư.',
    deniedTitle: 'Đã chặn hành động',
    deniedBody: 'Agent chưa chạy và không có dữ liệu nào được gửi.',
    again: 'Chạy lại bản demo',
    revokedTitle: 'Đã thu hồi quyền — hành động thất bại',
    revokedBody: 'Cổng chính sách đã từ chối Agent trước khi công cụ được chạy.',
    decisionAllow: 'ALLOW · chỉ đọc',
    decisionDeny: 'DENY · chưa thực thi',
  },
} as const;

const requestFor = (grantId: string, action: AgentActionRequest['action']): AgentActionRequest => ({
  id: `req_${action.toLowerCase()}`,
  grantId,
  action,
  target: 'work-taiwan-careers.example/apply',
  purpose: 'Verify a recruiter before sharing migrant-worker information',
  dataFields: action === 'SUBMIT_PERSONAL_DATA' ? ['legal_name', 'phone', 'residency_id'] : undefined,
});

const evidenceId = () => `evt_${Date.now().toString(36)}`;

const AgentSandbox: React.FC<AgentSandboxProps> = ({ language, grant, onOpenControl, onTimelineEvent }) => {
  const [state, setState] = useState<DemoState>('PENDING');
  const [policy, setPolicy] = useState<AgentPolicyResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = COPY[language] ?? COPY['zh-TW'];
  const displayAgentName = t.agentName;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const grantLabel = useMemo(() => grant.status === 'ACTIVE' ? t.expires : grant.status, [grant.status, t.expires]);

  const inspect = () => {
    setState('SCANNING');
    setPolicy(null);
    timer.current = setTimeout(() => {
      const next = evaluateAgentAction(grant, requestFor(grant.id, 'SUBMIT_PERSONAL_DATA'));
      setPolicy(next);
      const isRevoked = next.reasonCode === 'GRANT_REVOKED' || next.reasonCode === 'GRANT_EXPIRED';
      setState(isRevoked || next.decision === 'DENY' ? 'DENIED' : 'CONFIRM');
      onTimelineEvent({
        id: evidenceId(),
        at: next.evaluatedAt,
        actor: grant.agentName,
        action: 'SUBMIT_PERSONAL_DATA',
        target: 'work-taiwan-careers.example',
        decision: next.decision,
        detail: next.reasonCode,
        evidenceId: `sha256:${evidenceId()}`,
      });
    }, 1250);
  };

  const allowSafeOnly = () => {
    const next = evaluateAgentAction(grant, requestFor(grant.id, 'OBSERVE_URL'));
    setPolicy(next);
    setState(next.decision === 'ALLOW' ? 'LIMITED_ALLOW' : 'DENIED');
    onTimelineEvent({
      id: evidenceId(),
      at: next.evaluatedAt,
      actor: grant.agentName,
      action: 'OBSERVE_URL',
      target: 'work-taiwan-careers.example',
      decision: next.decision,
      detail: next.reasonCode,
      evidenceId: `sha256:${evidenceId()}`,
    });
  };

  const deny = () => {
    setPolicy({
      decision: 'DENY',
      reasonCode: 'USER_DENIED',
      reason: 'The user denied this one-time action.',
      matchedRule: 'human:deny',
      evaluatedAt: new Date().toISOString(),
    });
    setState('DENIED');
    onTimelineEvent({
      id: evidenceId(),
      at: new Date().toISOString(),
      actor: grant.userName,
      action: 'USER_DENIED',
      target: grant.agentName,
      decision: 'DENY',
      detail: 'No tool executed',
      evidenceId: `sha256:${evidenceId()}`,
    });
  };

  const reset = () => {
    setState('PENDING');
    setPolicy(null);
  };

  const isRevoked = grant.status !== 'ACTIVE';

  return (
    <section className={`vf-agent-request is-${state.toLowerCase()}`} aria-live="polite">
      <div className="vf-agent-request-head">
        <div className="vf-agent-identity">
          <span className="vf-agent-avatar"><Bot size={18} /></span>
          <div>
            <span className="vf-agent-kicker">{t.eyebrow}</span>
            <strong>{displayAgentName}</strong>
          </div>
        </div>
        <button className="vf-text-button" onClick={onOpenControl}>
          {t.control}<ChevronRight size={14} />
        </button>
      </div>

      {state === 'PENDING' && (
        <div className="vf-agent-body vf-agent-enter">
          <div className="vf-agent-title-row">
            <div>
              <h2>{t.pendingTitle}</h2>
              <p>{t.pendingBody}</p>
            </div>
            <span className="vf-pending-pulse"><span /></span>
          </div>
          <div className="vf-request-spec">
            <div><UserRoundCheck size={16} /><span>{t.represented}</span></div>
            <div><Clock3 size={16} /><span>{grantLabel}</span></div>
            <div className="is-wide"><FileSearch size={16} /><span><small>{t.request}</small>{t.requestValue}</span></div>
          </div>
          <div className="vf-agent-actions">
            <button className="vf-primary-button" onClick={inspect}>
              <ScanLine size={17} />{t.inspect}<ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {state === 'SCANNING' && (
        <div className="vf-agent-body vf-agent-enter">
          <div className="vf-scan-title"><ScanLine size={20} /><h2>{t.scanning}</h2></div>
          <div className="vf-scan-track"><span /></div>
          <div className="vf-scan-steps">
            <div><Check size={15} />{t.step1}</div>
            <div><Check size={15} />{t.step2}</div>
            <div className="is-running"><span className="vf-mini-loader" />{t.step3}</div>
          </div>
        </div>
      )}

      {state === 'CONFIRM' && (
        <div className="vf-agent-body vf-agent-enter">
          <div className="vf-decision-banner is-confirm">
            <span><Fingerprint size={22} /></span>
            <div><small>REQUIRE CONFIRMATION</small><h2>{t.confirmTitle}</h2><p>{t.confirmBody}</p></div>
          </div>
          <div className="vf-policy-block"><LockKeyhole size={16} /><span><small>{t.blockLabel}</small>{t.blockValue}</span></div>
          <div className="vf-agent-actions is-split">
            <button className="vf-primary-button" onClick={allowSafeOnly}><ShieldCheck size={17} />{t.safeScope}</button>
            <button className="vf-secondary-button is-danger" onClick={deny}><CircleStop size={17} />{t.deny}</button>
          </div>
        </div>
      )}

      {state === 'LIMITED_ALLOW' && (
        <div className="vf-agent-body vf-agent-enter">
          <div className="vf-decision-banner is-allow">
            <span><ShieldCheck size={22} /></span>
            <div><small>{t.decisionAllow}</small><h2>{t.allowedTitle}</h2><p>{t.allowedBody}</p></div>
          </div>
          <div className="vf-agent-actions is-split">
            <button className="vf-secondary-button" onClick={reset}>{t.again}</button>
            <button className="vf-text-button" onClick={onOpenControl}>{t.control}<ExternalLink size={13} /></button>
          </div>
        </div>
      )}

      {state === 'DENIED' && (
        <div className="vf-agent-body vf-agent-enter">
          <div className="vf-decision-banner is-deny">
            <span><X size={22} /></span>
            <div>
              <small>{t.decisionDeny}</small>
              <h2>{isRevoked ? t.revokedTitle : t.deniedTitle}</h2>
              <p>{isRevoked ? t.revokedBody : t.deniedBody}</p>
            </div>
          </div>
          {policy && <code className="vf-policy-code">policy/{policy.reasonCode.toLowerCase()} · {policy.matchedRule}</code>}
          <div className="vf-agent-actions is-split">
            <button className="vf-secondary-button" onClick={reset}>{t.again}</button>
            <button className="vf-text-button" onClick={onOpenControl}>{t.control}<ExternalLink size={13} /></button>
          </div>
        </div>
      )}
    </section>
  );
};

export default AgentSandbox;
