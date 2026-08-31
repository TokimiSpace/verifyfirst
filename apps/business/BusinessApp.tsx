import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Boxes,
  Building2,
  CircleDollarSign,
  ExternalLink,
  Factory,
  FlaskConical,
  Github,
  KeyRound,
  Landmark,
  Network,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
} from 'lucide-react';
import AgentSandbox from '../../components/AgentSandbox';
import CredentialIncidentResponse from '../../components/CredentialIncidentResponse';
import SandboxControl from '../../components/SandboxControl';
import TrustVerificationPanel, { type VerificationSection } from '../../components/business/TrustVerificationPanel';
import { AgentEvidencePacket, AgentGrant, EnterpriseVerificationRecord, Language, TrustTimelineEvent } from '../../types';

type BusinessView = 'LAB' | 'VERIFY' | 'INCIDENT' | 'CONTROL';

interface AgentWorkspace {
  grant: AgentGrant;
  timeline: TrustTimelineEvent[];
  evidencePackets: AgentEvidencePacket[];
  verificationRecords: EnterpriseVerificationRecord[];
}

const WORKSPACE_KEY = 'verifyfirst.agent-workspace.v1';

const createDefaultGrant = (): AgentGrant => {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 24 * 60 * 60 * 1000);
  return {
    id: `grant_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : issuedAt.getTime().toString(36)}`,
    agentId: 'agent-sandbox-01',
    agentName: 'Compliance Agent',
    agentPurpose: '在執行前查驗公開資訊',
    userName: 'Risk owner',
    status: 'ACTIVE',
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    allowedTargets: ['https://example.com'],
    allowedActions: ['OBSERVE_URL', 'CHECK_IDENTITY', 'READ_PUBLIC_DATA'],
    confirmationActions: ['SUBMIT_PERSONAL_DATA'],
    deniedActions: ['LOGIN', 'PAYMENT', 'REQUEST_OTP', 'DOWNLOAD_APP'],
  };
};

const initialTimeline = (grant: AgentGrant): TrustTimelineEvent[] => [{
  id: 'evt_grant_issued',
  at: grant.issuedAt,
  actor: grant.userName,
  action: 'GRANT_ISSUED',
  target: grant.agentName,
  decision: 'INFO',
  detail: 'Local 24-hour sandbox authorization',
  evidenceId: `local:grant-created:${grant.id}`,
}];

const loadWorkspace = (): AgentWorkspace => {
  const fallback = createDefaultGrant();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WORKSPACE_KEY) || '') as Partial<AgentWorkspace>;
    if (parsed.grant
      && Array.isArray(parsed.grant.allowedTargets)
      && Array.isArray(parsed.grant.allowedActions)
      && Array.isArray(parsed.grant.confirmationActions)
      && Array.isArray(parsed.grant.deniedActions)) {
      return {
        grant: parsed.grant,
        timeline: Array.isArray(parsed.timeline) ? parsed.timeline : initialTimeline(parsed.grant),
        evidencePackets: Array.isArray(parsed.evidencePackets) ? parsed.evidencePackets : [],
        verificationRecords: Array.isArray(parsed.verificationRecords) ? parsed.verificationRecords : [],
      };
    }
  } catch {
    // Corrupt local state falls back to a short-lived, least-privilege policy.
  }
  return { grant: fallback, timeline: initialTimeline(fallback), evidencePackets: [], verificationRecords: [] };
};

const readInitialBusinessRoute = (): { view: BusinessView; section: VerificationSection } => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('module') !== 'verify') return { view: 'LAB', section: 'LEI' };
  return { view: 'VERIFY', section: params.get('section') === 'vlei' ? 'VLEI' : 'LEI' };
};

const COPY = {
  'zh-TW': {
    subtitle: '企業信任實驗室', experiment: 'EXPERIMENTAL · 實驗性功能',
    navLabel: '企業實驗室功能', layersLabel: '企業驗證層', flowLabel: 'Agent 請求驗證流程',
    warning: '此區用於技術驗證與共同開發，尚未承諾 SLA，也不能直接作為正式法遵、付款或身分決策。',
    back: '個人反詐', lab: '行動政策', verify: '組織與憑證', incident: '憑證應變', control: '授權與稽核',
    eyebrow: 'VERIFYFIRST · B2B TRUST LAB', title: 'Agent 要做事？', highlight: '先留下可驗證的決策。',
    body: '面向企業法遵、風控與資安團隊的實驗性工作區：在 Agent 呼叫工具前，核對身分、短效授權、目的、目標與風險。',
    boundaryTitle: '現在能驗證政策行為，但還不是正式信任根。',
    boundaryBody: '本機 grant 是測試政策；正式環境仍須驗證簽章、vLEI／Mandate、撤銷狀態與組織自己的 root-of-trust allowlist。',
    capabilities: [
      ['身分', '組織、代表人與 Agent 主體'], ['授權', '目的、範圍、目標與期限'], ['政策', 'ALLOW／CONFIRM／DENY'], ['證據', 'SHA-256 Packet 與撤銷紀錄'],
    ],
    logicTitle: '一個企業入口，三個真的可以操作的驗證步驟。',
    logicBody: '先查法人與憑證，再讓政策閘門決定 Agent 能否行動；只保存結果摘要，不保存原始 CESR 憑證。',
    modules: [
      ['POLICY GATE', 'Agent Action Sandbox', '送出真實政策請求，觀察允許、本人確認、拒絕與 Evidence Packet。', 'LAB'],
      ['GLEIF LIVE', '查驗法律實體', '輸入 LEI 即時查詢 GLEIF Golden Copy；查不到就 fail closed。', 'LEI'],
      ['VLEI CRYPTO', '驗證 CESR 憑證鏈', '在瀏覽器重算 SAID、驗 KEL 簽章、ACDC 邊鏈、TEL 狀態與信任根。', 'VLEI'],
    ],
    customers: ['品牌商／製造商', '金融／電支', '政府／公共服務'],
    pains: ['Agent 代表誰不清楚', '一次授權被無限擴張', '出事後無法還原責任'],
    x402: '付款前只查驗 x402 requirement 的金額、資產與收款方一致性；不持有私鑰、不簽名、不付款。',
    source: '開源與技術邊界',
  },
  en: {
    subtitle: 'Enterprise trust lab', experiment: 'EXPERIMENTAL',
    navLabel: 'Enterprise lab features', layersLabel: 'Enterprise verification layers', flowLabel: 'Agent request verification flow',
    warning: 'This area is for technical validation and co-development. It has no SLA and must not be used alone for production compliance, payment, or identity decisions.',
    back: 'Personal anti-scam', lab: 'Action policy', verify: 'Identity & credentials', incident: 'Key response', control: 'Authorization & audit',
    eyebrow: 'VERIFYFIRST · B2B TRUST LAB', title: 'Before an Agent acts,', highlight: 'make the decision verifiable.',
    body: 'An experimental workspace for compliance, risk, and security teams to check identity, short-lived authorization, purpose, target, and risk before tools run.',
    boundaryTitle: 'Policy behavior works today; production trust roots do not.',
    boundaryBody: 'The local grant is test policy. Production still needs signed vLEI / Mandate verification, revocation status, and your own root-of-trust allowlist.',
    capabilities: [['Identity', 'Organization, representative, and Agent'], ['Authorization', 'Purpose, scope, target, and expiry'], ['Policy', 'ALLOW / CONFIRM / DENY'], ['Evidence', 'SHA-256 packet and revocation log']],
    logicTitle: 'One enterprise entry, three verification steps you can run.',
    logicBody: 'Verify legal entities and credentials before the policy gate decides whether an Agent may act. Raw CESR input is never persisted.',
    modules: [['POLICY GATE', 'Agent Action Sandbox', 'Submit real policy requests and inspect allow, confirmation, denial, and Evidence Packets.', 'LAB'], ['GLEIF LIVE', 'Verify a legal entity', 'Query the official GLEIF Golden Copy by LEI and fail closed when no record is available.', 'LEI'], ['VLEI CRYPTO', 'Verify a CESR credential chain', 'Recompute SAIDs and verify KEL signatures, ACDC edges, TEL status, and the selected trust root in your browser.', 'VLEI']],
    customers: ['Brands / manufacturers', 'Finance / payments', 'Government / public service'],
    pains: ['Unclear Agent identity', 'Authorization expands without limit', 'Accountability cannot be reconstructed'],
    x402: 'Before payment, compare x402 amount, asset, and payee evidence. VerifyFirst never holds keys, signs, or pays.',
    source: 'Source and technical boundaries',
  },
  vi: {
    subtitle: 'Phòng thí nghiệm niềm tin doanh nghiệp', experiment: 'THỬ NGHIỆM',
    navLabel: 'Chức năng phòng thí nghiệm doanh nghiệp', layersLabel: 'Các lớp xác minh doanh nghiệp', flowLabel: 'Luồng xác minh yêu cầu Agent',
    warning: 'Khu vực này dành cho kiểm chứng kỹ thuật và cùng phát triển. Chưa có SLA và không được dùng riêng cho quyết định tuân thủ, thanh toán hoặc danh tính chính thức.',
    back: 'Chống lừa đảo cá nhân', lab: 'Chính sách hành động', verify: 'Tổ chức & chứng thư', incident: 'Ứng phó khóa', control: 'Ủy quyền & kiểm toán',
    eyebrow: 'VERIFYFIRST · B2B TRUST LAB', title: 'Trước khi Agent hành động,', highlight: 'hãy làm quyết định có thể kiểm chứng.',
    body: 'Không gian thử nghiệm cho nhóm tuân thủ, rủi ro và an ninh để kiểm tra danh tính, ủy quyền ngắn hạn, mục đích, mục tiêu và rủi ro trước khi công cụ chạy.',
    boundaryTitle: 'Hành vi chính sách đã hoạt động; trust root production thì chưa.',
    boundaryBody: 'Grant cục bộ là chính sách thử nghiệm. Production vẫn phải xác minh vLEI / Mandate có chữ ký, trạng thái thu hồi và allowlist trust root riêng.',
    capabilities: [['Danh tính', 'Tổ chức, đại diện và Agent'], ['Ủy quyền', 'Mục đích, phạm vi, mục tiêu, thời hạn'], ['Chính sách', 'ALLOW / CONFIRM / DENY'], ['Bằng chứng', 'SHA-256 packet và nhật ký thu hồi']],
    logicTitle: 'Một cổng doanh nghiệp với ba bước xác minh có thể chạy.',
    logicBody: 'Xác minh pháp nhân và chứng thư trước khi cổng chính sách quyết định Agent có được hành động hay không. CESR thô không được lưu.',
    modules: [['POLICY GATE', 'Agent Action Sandbox', 'Gửi yêu cầu chính sách thật và xem allow, xác nhận, từ chối cùng Evidence Packet.', 'LAB'], ['GLEIF LIVE', 'Xác minh pháp nhân', 'Tra cứu Golden Copy chính thức của GLEIF bằng LEI và fail closed khi không có dữ liệu.', 'LEI'], ['VLEI CRYPTO', 'Xác minh chuỗi chứng thư CESR', 'Tính lại SAID và kiểm tra chữ ký KEL, cạnh ACDC, trạng thái TEL cùng trust root trong trình duyệt.', 'VLEI']],
    customers: ['Thương hiệu / nhà máy', 'Tài chính / thanh toán', 'Chính phủ / dịch vụ công'],
    pains: ['Không rõ Agent đại diện ai', 'Ủy quyền bị mở rộng vô hạn', 'Không thể phục dựng trách nhiệm'],
    x402: 'Trước thanh toán, đối chiếu số tiền, tài sản và người nhận x402. VerifyFirst không giữ khóa, ký hay thanh toán.',
    source: 'Mã nguồn và ranh giới kỹ thuật',
  },
} as const;

const BusinessApp: React.FC = () => {
  const initial = useRef<AgentWorkspace>(loadWorkspace());
  const initialRoute = useRef(readInitialBusinessRoute());
  const [language, setLanguage] = useState<Language>('zh-TW');
  const [view, setView] = useState<BusinessView>(initialRoute.current.view);
  const [verificationSection, setVerificationSection] = useState<VerificationSection>(initialRoute.current.section);
  const [grant, setGrant] = useState(initial.current.grant);
  const [timeline, setTimeline] = useState(initial.current.timeline);
  const [evidencePackets, setEvidencePackets] = useState(initial.current.evidencePackets);
  const [verificationRecords, setVerificationRecords] = useState(initial.current.verificationRecords);
  const t = COPY[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === 'zh-TW' ? 'VerifyFirst 企業信任實驗室｜實驗性' : 'VerifyFirst Enterprise Trust Lab · Experimental';
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = t.warning;
  }, [language, t.warning]);

  useEffect(() => {
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ grant, timeline, evidencePackets, verificationRecords }));
  }, [grant, timeline, evidencePackets, verificationRecords]);

  const appendTimeline = useCallback((event: TrustTimelineEvent) => setTimeline(current => [event, ...current].slice(0, 20)), []);
  const appendEvidence = useCallback((packet: AgentEvidencePacket) => setEvidencePackets(current => [packet, ...current.filter(item => item.id !== packet.id)].slice(0, 50)), []);
  const appendVerification = useCallback((record: EnterpriseVerificationRecord) => {
    setVerificationRecords(current => [record, ...current.filter(item => item.id !== record.id)].slice(0, 50));
    appendTimeline({
      id: `evt_verify_${record.id}`,
      at: record.checkedAt,
      actor: 'VerifyFirst verifier',
      action: record.kind === 'LEI_LOOKUP' ? 'LEI_RECORD_CHECKED' : 'VLEI_CHAIN_CHECKED',
      target: record.subject,
      decision: 'INFO',
      detail: record.decision,
      evidenceId: `sha256:${record.digest}`,
    });
  }, [appendTimeline]);
  const selectView = useCallback((next: BusinessView, section?: VerificationSection) => {
    setView(next);
    if (section) setVerificationSection(section);
    const url = new URL(window.location.href);
    if (next === 'VERIFY') {
      const nextSection = section ?? verificationSection;
      url.searchParams.set('module', 'verify');
      url.searchParams.set('section', nextSection === 'VLEI' ? 'vlei' : 'lei');
    } else {
      url.searchParams.delete('module');
      url.searchParams.delete('section');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [verificationSection]);
  const revoke = useCallback(() => {
    const now = new Date().toISOString();
    setGrant(current => ({ ...current, status: 'REVOKED' }));
    appendTimeline({ id: `evt_revoke_${Date.now().toString(36)}`, at: now, actor: grant.userName, action: 'GRANT_REVOKED', target: grant.agentName, decision: 'DENY', detail: 'Authorization revoked by user', evidenceId: `sha256:revoked_${Date.now().toString(36)}` });
  }, [appendTimeline, grant.agentName, grant.userName]);
  const reset = useCallback(() => {
    const next = createDefaultGrant();
    setGrant(next);
    setTimeline(initialTimeline(next));
    setEvidencePackets([]);
  }, []);
  const updateGrant = useCallback((next: AgentGrant) => {
    setGrant(next);
    appendTimeline({ id: `evt_policy_${Date.now().toString(36)}`, at: new Date().toISOString(), actor: next.userName, action: 'GRANT_UPDATED', target: next.agentName, decision: 'INFO', detail: 'Sandbox policy updated', evidenceId: `local:${Date.now().toString(36)}` });
  }, [appendTimeline]);

  return (
    <div className="vf-app vf-business-app">
      <Analytics />
      <header className="vf-header">
        <div className="vf-container vf-header-inner">
          <a className="vf-brand" href="/business/">
            <span className="vf-brand-mark"><Boxes size={18} /></span>
            <span className="vf-brand-copy"><span className="vf-brand-name">VerifyFirst <b>Lab</b></span><span className="vf-brand-subtitle">{t.subtitle}</span></span>
          </a>
          <nav className="vf-product-nav" aria-label={t.navLabel}>
            <button title={t.lab} aria-label={t.lab} className={view === 'LAB' ? 'is-active' : ''} onClick={() => selectView('LAB')}><FlaskConical size={14} />{t.lab}</button>
            <button title={t.verify} aria-label={t.verify} className={view === 'VERIFY' ? 'is-active' : ''} onClick={() => selectView('VERIFY')}><Network size={14} />{t.verify}</button>
            <button title={t.incident} aria-label={t.incident} className={view === 'INCIDENT' ? 'is-active' : ''} onClick={() => selectView('INCIDENT')}><KeyRound size={14} />{t.incident}</button>
            <button title={t.control} aria-label={t.control} className={view === 'CONTROL' ? 'is-active' : ''} onClick={() => selectView('CONTROL')}><SlidersHorizontal size={14} />{t.control}<span className={grant.status === 'ACTIVE' ? 'is-live' : 'is-off'}>{grant.status === 'ACTIVE' ? '1' : '0'}</span></button>
          </nav>
          <div className="vf-header-actions">
            <a className="vf-header-control vf-consumer-link" href="/"><ArrowLeft size={14} /><span className="vf-control-label">{t.back}</span></a>
            <label className="vf-language-select"><span className="sr-only">Language</span><select value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="zh-TW">繁中</option><option value="en">EN</option><option value="vi">VI</option></select></label>
          </div>
        </div>
      </header>

      <div className="vf-experiment-ribbon"><div className="vf-container"><span><FlaskConical size={14} />{t.experiment}</span><p>{t.warning}</p></div></div>

      {view === 'CONTROL' ? (
        <SandboxControl language={language} grant={grant} timeline={timeline} evidencePackets={evidencePackets} verificationRecords={verificationRecords} onBack={() => selectView('LAB')} onRevoke={revoke} onResetGrant={reset} onUpdateGrant={updateGrant} />
      ) : view === 'INCIDENT' ? (
        <CredentialIncidentResponse language={language} onBack={() => selectView('LAB')} />
      ) : view === 'VERIFY' ? (
        <TrustVerificationPanel language={language} section={verificationSection} records={verificationRecords} onSectionChange={(section) => selectView('VERIFY', section)} onBack={() => selectView('LAB')} onVerified={appendVerification} />
      ) : (
        <main className="vf-container vf-main">
          <section className="vf-business-hero">
            <div className="vf-hero-copy">
              <span className="vf-eyebrow">{t.eyebrow}</span>
              <h1 className="vf-hero-title">{t.title}<br /><strong>{t.highlight}</strong></h1>
              <p className="vf-hero-description">{t.body}</p>
              <div className="vf-boundary-note"><ShieldCheck size={20} /><div><strong>{t.boundaryTitle}</strong><p>{t.boundaryBody}</p></div></div>
            </div>
            <div id="agent-gate" className="vf-sandbox-stack">
              <div className="vf-inspection-tray" aria-hidden="true"><span>REQUEST</span><i /><span>VERIFY</span><i /><span>DECIDE</span></div>
              <AgentSandbox language={language} grant={grant} onOpenControl={() => selectView('CONTROL')} onTimelineEvent={appendTimeline} onEvidencePacket={appendEvidence} />
            </div>
            <div className="vf-capability-rail" aria-label={t.layersLabel}>
              {t.capabilities.map((item, index) => <div className="vf-capability-step" key={item[0]}><span className="vf-capability-index">0{index + 1}</span><strong>{item[0]}</strong><p>{item[1]}</p></div>)}
            </div>
          </section>

          <section className="vf-product-logic vf-business-logic" aria-labelledby="business-modules-title">
            <header className="vf-product-logic-head"><div><span className="vf-eyebrow">LAB MODULES</span><h2 id="business-modules-title">{t.logicTitle}</h2></div><p>{t.logicBody}</p></header>
            <div className="vf-trust-lane" aria-label={t.flowLabel}>
              <div className="vf-trust-node"><Bot size={19} /><span><small>01 · REQUEST</small>AI AGENT</span></div><ArrowRight className="vf-trust-arrow" size={17} />
              <div className="vf-trust-node is-gate"><ShieldCheck size={19} /><span><small>02 · POLICY GATE</small>VERIFYFIRST</span><div><b>ALLOW</b><b>CONFIRM</b><b>DENY</b></div></div><ArrowRight className="vf-trust-arrow" size={17} />
              <div className="vf-trust-node"><Wrench size={19} /><span><small>03 · EXECUTION</small>TOOL / API</span></div>
            </div>
            <div className="vf-business-module-grid">
              {t.modules.map((module, index) => {
                const Icon = [SlidersHorizontal, Network, KeyRound][index];
                const openModule = () => {
                  if (module[3] === 'LAB') {
                    document.getElementById('agent-gate')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                  }
                  selectView('VERIFY', module[3] as VerificationSection);
                };
                return <button type="button" onClick={openModule} key={module[0]}><span><Icon size={19} /></span><small>{module[0]}</small><h3>{module[1]}</h3><p>{module[2]}</p><b>OPEN <ArrowRight size={13} /></b></button>;
              })}
            </div>
            <div className="vf-market-grid">
              <div className="vf-ledger-column"><span className="vf-agent-kicker">TARGET USERS</span>{t.customers.map((item, index) => { const Icon = [Factory, Building2, Landmark][index]; return <article key={item}><Icon size={17} /><div><strong>{item}</strong></div></article>; })}</div>
              <div className="vf-ledger-column is-problem"><span className="vf-agent-kicker">PROBLEMS</span>{t.pains.map((item, index) => <article key={item}><b>0{index + 1}</b><div><strong>{item}</strong></div></article>)}</div>
            </div>
            <div className="vf-x402-band"><span className="vf-x402-icon"><CircleDollarSign size={21} /></span><div><span className="vf-agent-kicker">X402 + IFF EVIDENCE</span><h3>x402 preflight boundary</h3><p>{t.x402}</p></div><a href="https://ifandonlyif.io" target="_blank" rel="noreferrer">ifandonlyif.io <ExternalLink size={13} /></a></div>
          </section>
        </main>
      )}

      <footer className="vf-footer"><div className="vf-container vf-footer-inner"><p>{t.source}</p><div className="vf-footer-services"><a href="https://github.com/topben/cryptotruth" target="_blank" rel="noreferrer"><Github size={13} />GitHub</a><a href="/trust-pathways/">Trust Pathways</a><a href="/update-trust/">Update Trust</a></div></div></footer>
    </div>
  );
};

export default BusinessApp;
