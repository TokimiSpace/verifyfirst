import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CircleDollarSign,
  Download,
  ExternalLink,
  FileJson,
  FlaskConical,
  Info,
  LoaderCircle,
  Play,
  Radio,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import {
  X402_EVIDENCE_SCHEMA,
  X402_IFF_SDK,
  X402_POLICY_VERSION,
  X402_RESPONSE_SCHEMA,
  type EnterpriseX402PreflightResponse,
} from '../../api/x402-preflight';
import { sealEvidenceBody, sha256EvidenceBody, type EvidenceEnvelope } from '../../services/evidenceIntegrity';
import {
  evaluateX402Policy,
  parseX402Requirement,
  X402PolicyValidationError,
  type X402IffState,
  type X402SandboxPolicy,
} from '../../services/x402Policy';
import type { EnterpriseVerificationRecord, IffX402Preflight, Language } from '../../types';

interface X402WorkbenchProps {
  language: Language;
  records: EnterpriseVerificationRecord[];
  onBack: () => void;
  onVerified: (record: EnterpriseVerificationRecord) => void;
}

type WorkbenchMode = 'LIVE' | 'SIMULATION';
type EvidencePacket = EvidenceEnvelope<Record<string, unknown>>;

const MAX_INPUT_BYTES = 64 * 1024;
const SAMPLE_ENDPOINT = 'https://api.example.com/paid-resource';
const SAMPLE_REQUIREMENT = {
  x402Version: 2,
  accepts: [{
    scheme: 'exact',
    network: 'eip155:84532',
    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7c',
    amount: '100000',
    payTo: '0x1111111111111111111111111111111111111111',
  }],
};

const COPY = {
  'zh-TW': {
    back: '回到企業總覽', eyebrow: 'x402 · PAYMENT REQUIREMENT PREFLIGHT',
    title: '先驗付款要求，再交給錢包與人工審批。',
    body: '提交 endpoint、x402 v2 PAYMENT-REQUIRED 與企業允許條件。VerifyFirst 先跑本機政策，再用 IFF 外部觀測檢查 requirement 是否一致。',
    live: '真實 IFF 預檢', simulation: '模擬沙盒', simulated: 'SIMULATED · 不連 IFF',
    privacy: '送出範圍', privacyBody: 'LIVE 會把清除 query／帳密後的 endpoint 與 requirement 傳給 VerifyFirst API 及 IFF；不抓 endpoint、不收私鑰。',
    caseName: '案件名稱', owner: '企業負責人', endpoint: '付款資源 endpoint（HTTPS）', requirement: 'PAYMENT-REQUIRED JSON',
    network: '允許網路', asset: '允許資產', payee: '允許收款方', max: '金額上限（資產最小單位）',
    load: '載入沙盒範例', upload: '上傳 JSON', run: '執行預檢', running: '查驗中',
    iffScenario: '模擬 IFF verdict', input: '01 · 提交資料', policy: '02 · 企業政策', result: '03 · 判定與交接',
    noResult: '執行後會分開顯示企業政策與 IFF evidence，並產生可下載的 Evidence Packet。',
    policyDecision: '企業政策判定', iffEvidence: 'IFF 外部證據', payment: '付款執行', notExecuted: 'NOT EXECUTED',
    canonicalMatch: '本機 canonical 指紋吻合', payeeFingerprint: '收款方指紋',
    selected: '候選 option', notBound: 'NOT BOUND', download: '下載 Evidence Packet',
    liveSource: 'LIVE · IFANDONLYIF PUBLIC API', localSource: 'LOCAL POLICY SANDBOX',
    ready: '可進入人工／錢包政策審批', hold: '暫停並修正或複核',
    boundary: '一致只代表 requirement 與 IFF 外部觀測相符，不代表商家安全、一定交付或已授權付款。VerifyFirst 不持有私鑰、不簽名、不付款。',
    fileTooLarge: 'JSON 檔案超過 64 KiB。', invalidJson: '請提供有效的 x402 v2 JSON。', liveFailed: '真實預檢失敗；未自動改用模擬結果。',
    recent: '最近 x402 預檢', empty: '尚無 x402 查驗紀錄', whatShips: '可交給工程與法遵的產物',
    outputs: ['逐 option 的 network／asset／payee／amount 判定', 'IFF verdict、指紋與公開日誌摘要（有資料時）', '無秘密值、unsigned SHA-256 self-check Evidence JSON'],
  },
  en: {
    back: 'Back to enterprise overview', eyebrow: 'x402 · PAYMENT REQUIREMENT PREFLIGHT',
    title: 'Verify the requirement before wallet or human approval.',
    body: 'Submit an endpoint, x402 v2 PAYMENT-REQUIRED, and enterprise constraints. VerifyFirst checks local policy first, then compares with IFF external observations.',
    live: 'Live IFF preflight', simulation: 'Simulation sandbox', simulated: 'SIMULATED · no IFF call',
    privacy: 'Data sent', privacyBody: 'LIVE sends the endpoint after removing query and credentials, plus the requirement, to VerifyFirst and IFF. It never fetches the endpoint or receives keys.',
    caseName: 'Case name', owner: 'Accountable owner', endpoint: 'Payment resource endpoint (HTTPS)', requirement: 'PAYMENT-REQUIRED JSON',
    network: 'Allowed network', asset: 'Allowed asset', payee: 'Allowed payee', max: 'Maximum amount (smallest unit)',
    load: 'Load sandbox example', upload: 'Upload JSON', run: 'Run preflight', running: 'Checking',
    iffScenario: 'Simulated IFF verdict', input: '01 · INPUT', policy: '02 · ENTERPRISE POLICY', result: '03 · DECISION & HANDOFF',
    noResult: 'Run a check to see enterprise policy and IFF evidence separately, then download an Evidence Packet.',
    policyDecision: 'Enterprise policy decision', iffEvidence: 'IFF external evidence', payment: 'Payment execution', notExecuted: 'NOT EXECUTED',
    canonicalMatch: 'Local canonical fingerprint matched', payeeFingerprint: 'Payee fingerprint',
    selected: 'Candidate option', notBound: 'NOT BOUND', download: 'Download Evidence Packet',
    liveSource: 'LIVE · IFANDONLYIF PUBLIC API', localSource: 'LOCAL POLICY SANDBOX',
    ready: 'Ready for human / wallet policy review', hold: 'Hold for correction or review',
    boundary: 'Consistent means the requirement matches IFF observation. It does not prove merchant safety, delivery, or payment authorization. VerifyFirst never holds keys, signs, or pays.',
    fileTooLarge: 'The JSON file exceeds 64 KiB.', invalidJson: 'Provide valid x402 v2 JSON.', liveFailed: 'Live preflight failed; no simulation result was substituted.',
    recent: 'Recent x402 preflights', empty: 'No x402 checks yet', whatShips: 'Handoff for engineering and compliance',
    outputs: ['Per-option network / asset / payee / amount checks', 'IFF verdict, fingerprints, and public-log summary when available', 'Secret-free unsigned SHA-256 self-check Evidence JSON'],
  },
  vi: {
    back: 'Về tổng quan doanh nghiệp', eyebrow: 'x402 · PAYMENT REQUIREMENT PREFLIGHT',
    title: 'Xác minh yêu cầu trước khi ví hoặc con người phê duyệt.',
    body: 'Gửi endpoint, x402 v2 PAYMENT-REQUIRED và giới hạn doanh nghiệp. VerifyFirst kiểm tra policy cục bộ rồi đối chiếu quan sát bên ngoài của IFF.',
    live: 'Kiểm tra IFF thật', simulation: 'Sandbox mô phỏng', simulated: 'SIMULATED · không gọi IFF',
    privacy: 'Dữ liệu gửi đi', privacyBody: 'LIVE gửi endpoint đã bỏ query/thông tin đăng nhập và requirement tới VerifyFirst cùng IFF. Không tải endpoint và không nhận khóa.',
    caseName: 'Tên hồ sơ', owner: 'Người phụ trách', endpoint: 'Endpoint thanh toán (HTTPS)', requirement: 'PAYMENT-REQUIRED JSON',
    network: 'Mạng cho phép', asset: 'Tài sản cho phép', payee: 'Người nhận cho phép', max: 'Số tiền tối đa (đơn vị nhỏ nhất)',
    load: 'Nạp ví dụ sandbox', upload: 'Tải JSON', run: 'Chạy kiểm tra', running: 'Đang kiểm tra',
    iffScenario: 'IFF verdict mô phỏng', input: '01 · DỮ LIỆU', policy: '02 · POLICY DOANH NGHIỆP', result: '03 · QUYẾT ĐỊNH & BÀN GIAO',
    noResult: 'Chạy để xem riêng policy doanh nghiệp và bằng chứng IFF, rồi tải Evidence Packet.',
    policyDecision: 'Quyết định policy', iffEvidence: 'Bằng chứng IFF', payment: 'Thực hiện thanh toán', notExecuted: 'NOT EXECUTED',
    canonicalMatch: 'Fingerprint canonical cục bộ khớp', payeeFingerprint: 'Fingerprint người nhận',
    selected: 'Option ứng viên', notBound: 'NOT BOUND', download: 'Tải Evidence Packet',
    liveSource: 'LIVE · IFANDONLYIF PUBLIC API', localSource: 'LOCAL POLICY SANDBOX',
    ready: 'Sẵn sàng cho người/ví duyệt policy', hold: 'Tạm dừng để sửa hoặc xem lại',
    boundary: 'Consistent chỉ nghĩa là requirement khớp quan sát IFF, không chứng minh người bán an toàn, giao hàng hay đã được phép trả tiền. VerifyFirst không giữ khóa, ký hoặc thanh toán.',
    fileTooLarge: 'Tệp JSON vượt 64 KiB.', invalidJson: 'Hãy cung cấp JSON x402 v2 hợp lệ.', liveFailed: 'Kiểm tra thật thất bại; không tự thay bằng mô phỏng.',
    recent: 'Kiểm tra x402 gần đây', empty: 'Chưa có kiểm tra x402', whatShips: 'Bàn giao cho kỹ thuật và tuân thủ',
    outputs: ['Kiểm tra network / asset / payee / amount từng option', 'IFF verdict, fingerprint và tóm tắt log công khai khi có', 'Evidence JSON không chứa bí mật, self-check SHA-256 không ký'],
  },
} as const;

const cleanEndpoint = (value: string): string => {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('INVALID_ENDPOINT_URL');
  url.search = '';
  url.hash = '';
  return url.toString();
};

const downloadJson = (value: unknown, name: string) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

const short = (value?: string, head = 10, tail = 6) => value
  ? value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value
  : '—';

const X402Workbench: React.FC<X402WorkbenchProps> = ({ language, records, onBack, onVerified }) => {
  const t = COPY[language] ?? COPY['zh-TW'];
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<WorkbenchMode>(() => (
    new URLSearchParams(window.location.search).get('mode') === 'simulation' ? 'SIMULATION' : 'LIVE'
  ));
  const [caseName, setCaseName] = useState('API payment preflight');
  const [owner, setOwner] = useState('Payments owner');
  const [endpoint, setEndpoint] = useState(SAMPLE_ENDPOINT);
  const [requirementText, setRequirementText] = useState(JSON.stringify(SAMPLE_REQUIREMENT, null, 2));
  const [network, setNetwork] = useState(SAMPLE_REQUIREMENT.accepts[0].network);
  const [asset, setAsset] = useState(SAMPLE_REQUIREMENT.accepts[0].asset);
  const [payee, setPayee] = useState(SAMPLE_REQUIREMENT.accepts[0].payTo);
  const [maxAmount, setMaxAmount] = useState(SAMPLE_REQUIREMENT.accepts[0].amount);
  const [scenario, setScenario] = useState<X402IffState>('consistent');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<EnterpriseX402PreflightResponse | null>(null);
  const [packet, setPacket] = useState<EvidencePacket | null>(null);

  const recent = useMemo(() => records.filter(record => record.kind === 'X402_PREFLIGHT').slice(0, 4), [records]);
  const policy = (): X402SandboxPolicy => ({
    allowedNetworks: [network], allowedAssets: [asset], allowedPayees: [payee], maxAmount,
  });

  const resetResult = () => { setResult(null); setPacket(null); setError(''); };
  const changeMode = (next: WorkbenchMode) => {
    setMode(next);
    resetResult();
    const url = new URL(window.location.href);
    url.searchParams.set('mode', next === 'SIMULATION' ? 'simulation' : 'live');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  };
  const setSample = () => {
    setEndpoint(SAMPLE_ENDPOINT);
    setRequirementText(JSON.stringify(SAMPLE_REQUIREMENT, null, 2));
    setNetwork(SAMPLE_REQUIREMENT.accepts[0].network);
    setAsset(SAMPLE_REQUIREMENT.accepts[0].asset);
    setPayee(SAMPLE_REQUIREMENT.accepts[0].payTo);
    setMaxAmount(SAMPLE_REQUIREMENT.accepts[0].amount);
    resetResult();
  };

  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    resetResult();
    if (file.size > MAX_INPUT_BYTES) { setError(t.fileTooLarge); return; }
    const raw = await file.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_INPUT_BYTES) { setError(t.fileTooLarge); return; }
    setRequirementText(raw);
  };

  const run = async () => {
    setLoading(true);
    resetResult();
    try {
      if (new TextEncoder().encode(requirementText).byteLength > MAX_INPUT_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
      const paymentRequired = parseX402Requirement(JSON.parse(requirementText));
      const requirementDigest = `sha256:${await sha256EvidenceBody(paymentRequired)}`;
      const sanitizedEndpoint = cleanEndpoint(endpoint);
      let next: EnterpriseX402PreflightResponse;

      if (mode === 'LIVE') {
        const response = await fetch('/api/x402-preflight', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpointUrl: sanitizedEndpoint, paymentRequired, policy: policy() }),
        });
        if (!response.ok) {
          const detail = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(detail?.error || 'LIVE_PREFLIGHT_FAILED');
        }
        next = await response.json() as EnterpriseX402PreflightResponse;
      } else {
        const evaluation = evaluateX402Policy(paymentRequired, policy(), scenario);
        const iff: IffX402Preflight = {
          provider: 'ifandonlyif.io', evidenceSource: 'SIMULATED', status: scenario === 'unavailable' ? 'UNAVAILABLE' : 'VERIFIED', verdict: scenario === 'unavailable' ? undefined : scenario,
          inclusionAvailable: false, errorCode: scenario === 'unavailable' ? 'SIMULATED_UNAVAILABLE' : undefined,
          disclaimer: 'SIMULATED_RESULT_ONLY',
        };
        next = {
          schema: X402_RESPONSE_SCHEMA, checkedAt: new Date().toISOString(), endpoint: sanitizedEndpoint,
          source: { requirement: 'CALLER_SUPPLIED', externalEvidence: 'SIMULATED', merchantEndpointFetched: false },
          iff, policy: evaluation,
          verifier: { policyVersion: X402_POLICY_VERSION, iffSdk: X402_IFF_SDK },
          execution: { status: 'NOT_EXECUTED', payment: 'NOT_EXECUTED', selectedOption: 'NOT_BOUND' },
          limitations: [t.boundary, 'SIMULATION_ONLY_NO_EXTERNAL_EVIDENCE'],
        };
      }

      const evidence = await sealEvidenceBody({
        schema: X402_EVIDENCE_SCHEMA, createdAt: next.checkedAt, mode,
        case: { name: caseName.trim() || 'Untitled x402 preflight', owner: owner.trim() || 'Unassigned' },
        endpoint: next.endpoint, requirementDigest, paymentRequired, enterprisePolicy: policy(),
        verifier: next.verifier, iff: next.iff, policyEvaluation: next.policy,
        execution: next.execution, source: next.source, limitations: next.limitations,
      });
      setResult(next);
      setPacket(evidence);
      onVerified({
        id: `x402_${evidence.integrity.digest.slice(0, 16)}`,
        kind: 'X402_PREFLIGHT',
        source: mode === 'LIVE' ? 'https://ifandonlyif.io' : 'LOCAL_SIMULATION',
        trustDomain: mode === 'SIMULATION'
          ? 'LOCAL_X402_SIMULATION'
          : next.iff?.evidenceSource === 'IFF_CUSTOM_API'
            ? 'IFF_CUSTOM_EVIDENCE'
            : next.iff?.evidenceSource === 'IFF_PUBLIC_API'
              ? 'IFF_PUBLIC_EVIDENCE'
              : 'IFF_UNAVAILABLE',
        subject: next.endpoint,
        decision: next.policy.decision,
        checkedAt: next.checkedAt,
        digest: evidence.integrity.digest,
        limitations: next.limitations,
        metadata: {
          mode, iffState: next.policy.iffState, localPolicyMatched: next.policy.localPolicyMatched,
          selectedIndex: next.policy.selectedIndex ?? -1, paymentExecution: 'NOT_EXECUTED', requirementDigest,
        },
      });
    } catch (caught) {
      if (caught instanceof X402PolicyValidationError) setError(caught.issues[0]?.message || t.invalidJson);
      else if (caught instanceof SyntaxError) setError(t.invalidJson);
      else setError(mode === 'LIVE' ? `${t.liveFailed} (${(caught as Error)?.message || 'UNKNOWN'})` : ((caught as Error)?.message || t.invalidJson));
    } finally {
      setLoading(false);
    }
  };

  const ready = result?.policy.decision === 'READY_FOR_HUMAN_APPROVAL';

  return (
    <main className="vf-container vf-x402-page">
      <button className="vf-back-button" onClick={onBack}><ArrowLeft size={16} />{t.back}</button>
      <header className="vf-x402-intro">
        <div><span className="vf-eyebrow">{t.eyebrow}</span><h1>{t.title}</h1><p>{t.body}</p></div>
        <div className="vf-x402-disclosure"><ShieldCheck size={20} /><div><strong>{t.privacy}</strong><p>{t.privacyBody}</p></div></div>
      </header>

      <div className="vf-workbench-mode" role="group" aria-label={`${t.live} / ${t.simulation}`}>
        <button type="button" aria-pressed={mode === 'LIVE'} className={mode === 'LIVE' ? 'is-active' : ''} onClick={() => changeMode('LIVE')}><Radio size={15} />{t.live}<small>IFF API</small></button>
        <button type="button" aria-pressed={mode === 'SIMULATION'} className={mode === 'SIMULATION' ? 'is-active is-simulated' : ''} onClick={() => changeMode('SIMULATION')}><FlaskConical size={15} />{t.simulation}<small>4 VERDICTS</small></button>
      </div>
      {mode === 'SIMULATION' && <div className="vf-simulation-banner"><FlaskConical size={14} />{t.simulated}</div>}

      <section className="vf-x402-workbench">
        <div className="vf-x402-input-card">
          <span className="vf-agent-kicker">{t.input}</span>
          <div className="vf-x402-case-grid">
            <label><span>{t.caseName}</span><input value={caseName} onChange={event => setCaseName(event.target.value)} /></label>
            <label><span>{t.owner}</span><input value={owner} onChange={event => setOwner(event.target.value)} /></label>
          </div>
          <label className="vf-x402-field"><span>{t.endpoint}</span><input type="url" value={endpoint} onChange={event => { setEndpoint(event.target.value); resetResult(); }} spellCheck={false} /></label>
          <label className="vf-x402-field"><span>{t.requirement}</span><textarea value={requirementText} onChange={event => { setRequirementText(event.target.value); resetResult(); }} spellCheck={false} /></label>
          <input ref={fileInput} hidden type="file" accept=".json,application/json" onChange={chooseFile} />
          <div className="vf-x402-file-actions"><button className="vf-secondary-button" type="button" onClick={() => fileInput.current?.click()}><Upload size={14} />{t.upload}</button><button className="vf-secondary-button" type="button" onClick={setSample}><FileJson size={14} />{t.load}</button></div>
        </div>

        <div className="vf-x402-policy-card">
          <span className="vf-agent-kicker">{t.policy}</span>
          <div className="vf-x402-policy-grid">
            <label><span>{t.network}</span><input value={network} onChange={event => { setNetwork(event.target.value); resetResult(); }} spellCheck={false} /></label>
            <label><span>{t.asset}</span><input value={asset} onChange={event => { setAsset(event.target.value); resetResult(); }} spellCheck={false} /></label>
            <label><span>{t.payee}</span><input value={payee} onChange={event => { setPayee(event.target.value); resetResult(); }} spellCheck={false} /></label>
            <label><span>{t.max}</span><input inputMode="numeric" value={maxAmount} onChange={event => { setMaxAmount(event.target.value); resetResult(); }} spellCheck={false} /></label>
            {mode === 'SIMULATION' && <label className="is-wide"><span>{t.iffScenario}</span><select value={scenario} onChange={event => { setScenario(event.target.value as X402IffState); resetResult(); }}><option value="consistent">consistent</option><option value="diverged">diverged</option><option value="stale">stale</option><option value="unobserved">unobserved</option><option value="unavailable">unavailable</option></select></label>}
          </div>
          {error && <div className="vf-verification-error" role="alert"><X size={15} /><span>{error}</span></div>}
          <button className="vf-primary-button vf-x402-run" type="button" disabled={loading} onClick={run}>{loading ? <LoaderCircle className="is-spinning" size={15} /> : <Play size={15} />}{loading ? t.running : t.run}</button>
          <p className="vf-x402-boundary"><Info size={14} />{t.boundary}</p>
        </div>

        <div className={`vf-x402-result-card ${result ? (ready ? 'is-ready' : 'is-hold') : 'is-idle'}`} aria-live="polite">
          <span className="vf-agent-kicker">{t.result}</span>
          {result ? <>
            <div className="vf-x402-decision"><span>{ready ? <Check size={22} /> : <X size={22} />}</span><div><small>{ready ? t.ready : t.hold}</small><h2>{result.policy.decision}</h2></div></div>
            <dl className="vf-x402-result-grid">
              <div><dt>{t.policyDecision}</dt><dd>{result.policy.localPolicyMatched ? 'MATCH' : 'MISMATCH'}</dd></div>
              <div><dt>{t.iffEvidence}</dt><dd>{result.iff?.verdict ?? result.iff?.errorCode ?? 'NOT QUERIED'}</dd></div>
              <div><dt>{t.selected}</dt><dd>{result.policy.selectedIndex === null ? '—' : `#${result.policy.selectedIndex + 1}`} · {t.notBound}</dd></div>
              <div><dt>{t.payment}</dt><dd>{t.notExecuted}</dd></div>
            </dl>
            <div className="vf-x402-options">{result.policy.optionChecks.map(check => <article key={check.index} className={check.matchesPolicy ? 'is-match' : 'is-mismatch'}><span>OPTION {check.index + 1}</span><strong>{check.option.amount} · {short(check.option.asset)}</strong><p>{check.matchesPolicy ? 'ALL POLICY FIELDS MATCH' : check.mismatchReasons.join(' · ')}</p></article>)}</div>
            {result.iff && <div className="vf-iff-summary"><small>{mode === 'LIVE' ? `${result.iff.evidenceSource} · SDK 0.2.0 · canonical v${result.iff.fingerprintVersion ?? '—'}` : t.localSource}</small><code>received {short(result.iff.receivedFingerprint)} / observed {short(result.iff.observedFingerprint)}</code>{result.iff.localPayeeFingerprint && <code>{t.payeeFingerprint} · {short(result.iff.localPayeeFingerprint, 14, 8)}</code>}{result.iff.receivedFingerprintMatchesLocal && <b><Check size={12} />{t.canonicalMatch}</b>}<span>{result.iff.inclusionAvailable ? `LOG #${result.iff.inclusionLogIndex ?? '—'} / ${result.iff.inclusionTreeSize ?? '—'}` : 'NO INCLUSION PROOF'}</span></div>}
            {packet && <button className="vf-primary-button vf-x402-download" onClick={() => downloadJson(packet, `verifyfirst-x402-${Date.now()}.json`)}><Download size={14} />{t.download}</button>}
          </> : <div className="vf-result-empty"><CircleDollarSign size={29} /><strong>POLICY × IFF EVIDENCE</strong><p>{t.noResult}</p></div>}
        </div>
      </section>

      <section className="vf-x402-handoff">
        <div><span className="vf-agent-kicker">{t.whatShips}</span>{t.outputs.map(item => <p key={item}><Check size={13} />{item}</p>)}</div>
        <div><span className="vf-agent-kicker">{t.recent}</span>{recent.length ? recent.map(record => <article key={record.id}><strong>{record.decision}</strong><code>{short(record.subject, 22, 8)}</code></article>) : <p>{t.empty}</p>}</div>
        <div><span className="vf-agent-kicker">PROTOCOL SOURCES</span><a href="https://docs.x402.org/core-concepts/http-402" target="_blank" rel="noreferrer">x402 HTTP 402 <ExternalLink size={13} /></a><a href="https://ifandonlyif.io" target="_blank" rel="noreferrer">ifandonlyif.io <ExternalLink size={13} /></a></div>
      </section>
    </main>
  );
};

export default X402Workbench;
