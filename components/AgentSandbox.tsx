import React, { FormEvent, useMemo, useState } from 'react';
import {
  Bot,
  Check,
  ChevronRight,
  CircleStop,
  Download,
  Fingerprint,
  Laptop,
  Play,
  RotateCcw,
  Server,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  AgentActionKind,
  AgentActionRequest,
  AgentEvidencePacket,
  AgentGrant,
  AgentPolicyResult,
  Language,
  TrustTimelineEvent,
} from '../types';
import { submitAgentAction } from '../services/agentGateway';

interface AgentSandboxProps {
  language: Language;
  grant: AgentGrant;
  onOpenControl: () => void;
  onTimelineEvent: (event: TrustTimelineEvent) => void;
  onEvidencePacket: (packet: AgentEvidencePacket) => void;
}

type GateSource = 'SERVER_GATE' | 'LOCAL_GATE' | 'FAIL_CLOSED';

const ACTIONS: AgentActionKind[] = [
  'OBSERVE_URL',
  'CHECK_IDENTITY',
  'READ_PUBLIC_DATA',
  'SUBMIT_PERSONAL_DATA',
  'LOGIN',
  'PAYMENT',
  'REQUEST_OTP',
  'DOWNLOAD_APP',
];

const COPY = {
  'zh-TW': {
    eyebrow: 'Agent Trust Sandbox · 可用政策閘門',
    title: '送出一筆 Agent 執行請求',
    body: '填入 Agent 想做的動作與目標。VerifyFirst 會在工具執行前給出可重現的 ALLOW、CONFIRM 或 DENY，並產生完整 Evidence Packet。',
    control: '設定授權政策',
    action: '要求動作',
    target: '工具或目標',
    purpose: '本次目的',
    fields: '會用到的資料欄位名稱',
    fieldsHint: '只填欄位名稱，例如 legal_name, phone；不要貼入真實個資、密碼、OTP 或金鑰。',
    fieldsInvalid: '欄位名稱只能使用英文字母、數字、底線、句點或連字號。',
    evaluate: '執行政策查核',
    evaluating: '政策查核中…',
    resultAllow: '政策允許',
    resultConfirm: '等待本人確認',
    resultDeny: '政策拒絕',
    noExecution: '此結果只決定是否可執行；VerifyFirst 不會替 Agent 操作工具或付款。',
    approve: '允許這一次',
    deny: '拒絕這一次',
    again: '檢查另一筆',
    download: '下載 Evidence JSON',
    server: 'Server policy gate',
    local: 'Local fallback gate',
    failClosed: 'Server unavailable · fail closed',
    evidence: 'EVIDENCE',
    evidenceReady: '決策內容已用 SHA-256 封裝，可下載或交給執行層保存。',
    actionLabels: {
      OBSERVE_URL: '隔離觀察網址', CHECK_IDENTITY: '查驗身分', READ_PUBLIC_DATA: '讀取公開資料',
      SUBMIT_PERSONAL_DATA: '送出個人資料', LOGIN: '登入帳號', PAYMENT: '付款／轉帳',
      REQUEST_OTP: '要求 OTP', DOWNLOAD_APP: '下載應用程式',
    },
    reasons: {
      WITHIN_SCOPE: '動作、目標與有效期限都在這張授權的範圍內。',
      HUMAN_REQUIRED: '這個動作碰到需要本人確認的政策邊界。',
      HUMAN_APPROVED: '本人已明確允許這一次動作。',
      USER_DENIED: '本人已拒絕這一次動作。',
      ACTION_FORBIDDEN: '這個動作被授權政策明確禁止。',
      TARGET_NOT_GRANTED: '目標不在允許清單中。',
      GRANT_REVOKED: '授權已撤銷，所有後續請求立即失敗。',
      GRANT_EXPIRED: '授權已過期。',
      GRANT_MISMATCH: '請求與授權識別碼不一致。',
      INVALID_REQUEST: '請求缺少必要欄位。',
      INVALID_DATA_FIELD_NAMES: '資料欄位只能填名稱，不能包含實際值或秘密。',
      GRANT_INVALID: '授權內容無效。',
      PURPOSE_MISMATCH: '本次目的與短效 Mandate 不一致。',
      PAYMENT_EXECUTION_DISABLED: 'VerifyFirst 只查驗 x402 付款證據，不持有私鑰、簽名或執行付款。',
      GATE_UNAVAILABLE: '伺服器政策閘門無法使用，本次請求依 fail-closed 原則拒絕。',
      SCOPE_NOT_GRANTED: '授權沒有涵蓋這個動作。',
    },
  },
  en: {
    eyebrow: 'Agent Trust Sandbox · usable policy gate',
    title: 'Submit an Agent action request',
    body: 'Describe what the Agent wants to do and where. VerifyFirst returns a reproducible ALLOW, CONFIRM, or DENY before tools run, then creates an Evidence Packet.',
    control: 'Configure authorization',
    action: 'Requested action',
    target: 'Tool or target',
    purpose: 'Purpose for this request',
    fields: 'Data field names used',
    fieldsHint: 'Enter names only, such as legal_name, phone. Never paste personal data, passwords, OTPs, or keys.',
    fieldsInvalid: 'Field names may use letters, numbers, underscores, periods, or hyphens only.',
    evaluate: 'Evaluate policy',
    evaluating: 'Evaluating policy…',
    resultAllow: 'Policy allows this request',
    resultConfirm: 'Human confirmation required',
    resultDeny: 'Policy denies this request',
    noExecution: 'This result controls execution; VerifyFirst does not operate tools or make payments for the Agent.',
    approve: 'Allow once',
    deny: 'Deny once',
    again: 'Check another request',
    download: 'Download Evidence JSON',
    server: 'Server policy gate',
    local: 'Local fallback gate',
    failClosed: 'Server unavailable · fail closed',
    evidence: 'EVIDENCE',
    evidenceReady: 'The decision is sealed with SHA-256 and can be downloaded or retained by your execution layer.',
    actionLabels: {
      OBSERVE_URL: 'Observe URL in isolation', CHECK_IDENTITY: 'Check identity', READ_PUBLIC_DATA: 'Read public data',
      SUBMIT_PERSONAL_DATA: 'Submit personal data', LOGIN: 'Log in', PAYMENT: 'Pay / transfer',
      REQUEST_OTP: 'Request OTP', DOWNLOAD_APP: 'Download application',
    },
    reasons: {
      WITHIN_SCOPE: 'The action, target, and expiry are inside this authorization.',
      HUMAN_REQUIRED: 'The request crossed a policy boundary that requires the represented person.',
      HUMAN_APPROVED: 'The represented person explicitly allowed this one request.',
      USER_DENIED: 'The represented person denied this one request.',
      ACTION_FORBIDDEN: 'The authorization policy explicitly forbids this action.',
      TARGET_NOT_GRANTED: 'The target is outside the allowlist.',
      GRANT_REVOKED: 'The grant was revoked, so every subsequent request fails.',
      GRANT_EXPIRED: 'The authorization has expired.',
      GRANT_MISMATCH: 'The request does not match this authorization id.',
      INVALID_REQUEST: 'Required request fields are missing.',
      INVALID_DATA_FIELD_NAMES: 'Data fields accept names only, never values or secrets.',
      GRANT_INVALID: 'The authorization is invalid.',
      PURPOSE_MISMATCH: 'The request purpose does not match the short-lived mandate.',
      PAYMENT_EXECUTION_DISABLED: 'VerifyFirst inspects x402 payment evidence but never holds keys, signs, or executes payment.',
      GATE_UNAVAILABLE: 'The server policy gate is unavailable, so this request failed closed.',
      SCOPE_NOT_GRANTED: 'This action was not granted.',
    },
  },
  vi: {
    eyebrow: 'Agent Trust Sandbox · cổng chính sách dùng được',
    title: 'Gửi yêu cầu hành động của Agent',
    body: 'Mô tả Agent muốn làm gì và ở đâu. VerifyFirst trả về ALLOW, CONFIRM hoặc DENY có thể tái lập trước khi công cụ chạy, rồi tạo Evidence Packet.',
    control: 'Cấu hình ủy quyền',
    action: 'Hành động yêu cầu',
    target: 'Công cụ hoặc mục tiêu',
    purpose: 'Mục đích lần này',
    fields: 'Tên trường dữ liệu được dùng',
    fieldsHint: 'Chỉ nhập tên trường như legal_name, phone. Không dán dữ liệu cá nhân, mật khẩu, OTP hoặc khóa.',
    fieldsInvalid: 'Tên trường chỉ được dùng chữ, số, dấu gạch dưới, dấu chấm hoặc gạch nối.',
    evaluate: 'Đánh giá chính sách',
    evaluating: 'Đang đánh giá…',
    resultAllow: 'Chính sách cho phép',
    resultConfirm: 'Cần người dùng xác nhận',
    resultDeny: 'Chính sách từ chối',
    noExecution: 'Kết quả chỉ kiểm soát quyền thực thi; VerifyFirst không thao tác công cụ hoặc thanh toán thay Agent.',
    approve: 'Cho phép một lần',
    deny: 'Từ chối một lần',
    again: 'Kiểm tra yêu cầu khác',
    download: 'Tải Evidence JSON',
    server: 'Server policy gate',
    local: 'Local fallback gate',
    failClosed: 'Server unavailable · fail closed',
    evidence: 'EVIDENCE',
    evidenceReady: 'Quyết định được đóng gói bằng SHA-256 để tải xuống hoặc lưu ở tầng thực thi.',
    actionLabels: {
      OBSERVE_URL: 'Quan sát URL cách ly', CHECK_IDENTITY: 'Kiểm tra danh tính', READ_PUBLIC_DATA: 'Đọc dữ liệu công khai',
      SUBMIT_PERSONAL_DATA: 'Gửi dữ liệu cá nhân', LOGIN: 'Đăng nhập', PAYMENT: 'Thanh toán / chuyển tiền',
      REQUEST_OTP: 'Yêu cầu OTP', DOWNLOAD_APP: 'Tải ứng dụng',
    },
    reasons: {
      WITHIN_SCOPE: 'Hành động, mục tiêu và thời hạn đều nằm trong ủy quyền.',
      HUMAN_REQUIRED: 'Yêu cầu chạm ranh giới chính sách cần người dùng xác nhận.',
      HUMAN_APPROVED: 'Người dùng đã cho phép rõ ràng cho lần này.',
      USER_DENIED: 'Người dùng đã từ chối yêu cầu này.',
      ACTION_FORBIDDEN: 'Chính sách ủy quyền cấm rõ hành động này.',
      TARGET_NOT_GRANTED: 'Mục tiêu nằm ngoài danh sách cho phép.',
      GRANT_REVOKED: 'Ủy quyền đã bị thu hồi nên mọi yêu cầu tiếp theo thất bại.',
      GRANT_EXPIRED: 'Ủy quyền đã hết hạn.',
      GRANT_MISMATCH: 'Yêu cầu không khớp mã ủy quyền.',
      INVALID_REQUEST: 'Yêu cầu thiếu trường bắt buộc.',
      INVALID_DATA_FIELD_NAMES: 'Trường dữ liệu chỉ chấp nhận tên, không nhận giá trị hoặc bí mật.',
      GRANT_INVALID: 'Ủy quyền không hợp lệ.',
      PURPOSE_MISMATCH: 'Mục đích yêu cầu không khớp Mandate ngắn hạn.',
      PAYMENT_EXECUTION_DISABLED: 'VerifyFirst chỉ kiểm tra bằng chứng x402, không giữ khóa, ký hoặc thực hiện thanh toán.',
      GATE_UNAVAILABLE: 'Cổng chính sách máy chủ không khả dụng nên yêu cầu bị từ chối theo fail-closed.',
      SCOPE_NOT_GRANTED: 'Hành động này chưa được cấp quyền.',
    },
  },
} as const;

const requestId = () => `req_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;

const AgentSandbox: React.FC<AgentSandboxProps> = ({
  language,
  grant,
  onOpenControl,
  onTimelineEvent,
  onEvidencePacket,
}) => {
  const t = COPY[language] ?? COPY['zh-TW'];
  const [action, setAction] = useState<AgentActionKind>('OBSERVE_URL');
  const [target, setTarget] = useState('https://example.com');
  const [purpose, setPurpose] = useState(grant.agentPurpose);
  const [dataFields, setDataFields] = useState('');
  const [request, setRequest] = useState<AgentActionRequest | null>(null);
  const [policy, setPolicy] = useState<AgentPolicyResult | null>(null);
  const [evidence, setEvidence] = useState<AgentEvidencePacket | null>(null);
  const [source, setSource] = useState<GateSource | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState('');

  const reason = useMemo(() => {
    if (!policy) return '';
    return t.reasons[policy.reasonCode as keyof typeof t.reasons] ?? policy.reason;
  }, [policy, t.reasons]);

  const record = (
    nextRequest: AgentActionRequest,
    nextPolicy: AgentPolicyResult,
    nextEvidence: AgentEvidencePacket,
    actor: string,
  ) => {
    setRequest(nextRequest);
    setPolicy(nextPolicy);
    setEvidence(nextEvidence);
    onEvidencePacket(nextEvidence);
    onTimelineEvent({
      id: `evt_${Date.now().toString(36)}`,
      at: nextPolicy.evaluatedAt,
      actor,
      action: nextRequest.action,
      target: nextRequest.target,
      decision: nextPolicy.decision,
      detail: nextPolicy.reasonCode,
      evidenceId: nextEvidence.id,
    });
  };

  const evaluate = async (event: FormEvent) => {
    event.preventDefault();
    const parsedFields = dataFields.split(',').map(field => field.trim()).filter(Boolean).slice(0, 32);
    if (parsedFields.some(field => !/^[a-z][a-z0-9_.-]{0,63}$/i.test(field))) {
      setFieldError(t.fieldsInvalid);
      return;
    }
    setFieldError('');
    setBusy(true);
    const nextRequest: AgentActionRequest = {
      id: requestId(),
      grantId: grant.id,
      action,
      target: target.trim(),
      purpose: purpose.trim(),
      dataFields: parsedFields,
    };
    try {
      const decision = await submitAgentAction(grant, nextRequest);
      setSource(decision.source);
      record(nextRequest, decision.result, decision.evidence, grant.agentName);
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (approved: boolean) => {
    if (!request || !evidence) return;
    setBusy(true);
    try {
      const decision = await submitAgentAction(grant, request, {
        approved,
        actor: grant.userName,
        parentEvidenceId: evidence.id,
      });
      setSource(decision.source);
      record(request, decision.result, decision.evidence, grant.userName);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setRequest(null);
    setPolicy(null);
    setEvidence(null);
    setSource(null);
    setFieldError('');
  };

  const downloadEvidence = () => {
    if (!evidence) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `verifyfirst-agent-evidence-${evidence.integrity.digest.slice(0, 12)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resultTitle = policy?.decision === 'ALLOW'
    ? t.resultAllow
    : policy?.decision === 'REQUIRE_CONFIRMATION'
      ? t.resultConfirm
      : t.resultDeny;

  return (
    <section className={`vf-agent-request ${policy ? `is-${policy.decision.toLowerCase()}` : ''}`} aria-live="polite">
      <div className="vf-agent-request-head">
        <div className="vf-agent-identity">
          <span className="vf-agent-avatar"><Bot size={18} /></span>
          <div><span className="vf-agent-kicker">{t.eyebrow}</span><strong>{grant.agentName}</strong></div>
        </div>
        <button className="vf-text-button" onClick={onOpenControl}>{t.control}<ChevronRight size={14} /></button>
      </div>

      {!policy ? (
        <form className="vf-agent-body vf-agent-enter vf-agent-form" onSubmit={evaluate}>
          <div className="vf-agent-title-row"><div><h2>{t.title}</h2><p>{t.body}</p></div></div>
          <div className="vf-agent-form-grid">
            <label><span>{t.action}</span><select value={action} onChange={event => setAction(event.target.value as AgentActionKind)}>{ACTIONS.map(item => <option value={item} key={item}>{t.actionLabels[item]}</option>)}</select></label>
            <label><span>{t.target}</span><input value={target} onChange={event => setTarget(event.target.value)} placeholder="https://api.example.com" required /></label>
            <label className="is-wide"><span>{t.purpose}</span><input value={purpose} onChange={event => setPurpose(event.target.value)} required /></label>
            <label className="is-wide"><span>{t.fields}</span><input value={dataFields} onChange={event => { setDataFields(event.target.value); setFieldError(''); }} placeholder="legal_name, phone" aria-invalid={Boolean(fieldError)} /><small className={fieldError ? 'is-error' : ''}>{fieldError || t.fieldsHint}</small></label>
          </div>
          <div className="vf-agent-actions"><button className="vf-primary-button" disabled={busy} type="submit"><Play size={16} />{busy ? t.evaluating : t.evaluate}</button></div>
        </form>
      ) : (
        <div className="vf-agent-body vf-agent-enter">
          <div className={`vf-decision-banner is-${policy.decision === 'REQUIRE_CONFIRMATION' ? 'confirm' : policy.decision.toLowerCase()}`}>
            <span>{policy.decision === 'ALLOW' ? <ShieldCheck size={22} /> : policy.decision === 'REQUIRE_CONFIRMATION' ? <Fingerprint size={22} /> : <X size={22} />}</span>
            <div><small>{policy.decision} · {policy.reasonCode}</small><h2>{resultTitle}</h2><p>{reason}</p></div>
          </div>
          <p className="vf-execution-boundary"><CircleStop size={14} />{t.noExecution}</p>
          {evidence && (
            <div className="vf-evidence-result">
              <div><small>{t.evidence}</small><strong>{t.evidenceReady}</strong><code>{evidence.id.slice(0, 31)}…</code></div>
              <span>{source === 'SERVER_GATE' ? <Server size={14} /> : <Laptop size={14} />}{source === 'SERVER_GATE' ? t.server : source === 'FAIL_CLOSED' ? t.failClosed : t.local}</span>
            </div>
          )}
          <div className="vf-agent-actions is-split">
            <button className="vf-secondary-button" onClick={reset}><RotateCcw size={15} />{t.again}</button>
            <div className="vf-agent-action-cluster">
              {policy.decision === 'REQUIRE_CONFIRMATION' && <><button className="vf-secondary-button is-danger" disabled={busy} onClick={() => resolve(false)}><X size={15} />{t.deny}</button><button className="vf-primary-button" disabled={busy} onClick={() => resolve(true)}><Check size={15} />{t.approve}</button></>}
              {policy.decision !== 'REQUIRE_CONFIRMATION' && <button className="vf-secondary-button" onClick={downloadEvidence}><Download size={15} />{t.download}</button>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AgentSandbox;
