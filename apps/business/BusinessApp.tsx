import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CircleDollarSign,
  FlaskConical,
  Github,
  KeyRound,
  Network,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import BrandMark from '../../components/BrandMark';
import OptionalAnalytics from '../../components/OptionalAnalytics';
import CredentialIncidentResponse from '../../components/CredentialIncidentResponse';
import SandboxControl from '../../components/SandboxControl';
import TrustVerificationPanel, { type VerificationSection } from '../../components/business/TrustVerificationPanel';
import X402Workbench from '../../components/business/X402Workbench';
import { AgentEvidencePacket, AgentGrant, EnterpriseVerificationRecord, Language, TrustTimelineEvent } from '../../types';

type BusinessView = 'LAB' | 'X402' | 'VLEI' | 'INCIDENT' | 'CONTROL';

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
  const module = params.get('module');
  if (module === 'x402') return { view: 'X402', section: 'LEI' };
  if (module === 'vlei' || module === 'verify') {
    return { view: 'VLEI', section: params.get('section') === 'vlei' ? 'VLEI' : 'LEI' };
  }
  if (module === 'audit') return { view: 'CONTROL', section: 'LEI' };
  if (module === 'incident') return { view: 'INCIDENT', section: 'LEI' };
  return { view: 'LAB', section: 'LEI' };
};

const COPY = {
  'zh-TW': {
    subtitle: '企業信任實驗室', experiment: 'EXPERIMENTAL · 實驗性功能',
    navLabel: '企業實驗室功能', layersLabel: '企業驗證層', flowLabel: 'Agent 請求驗證流程',
    warning: '此區用於技術驗證與共同開發，尚未承諾 SLA，也不能直接作為正式法遵、付款或身分決策。',
    back: '個人反詐', lab: '總覽', x402Nav: 'x402 付款預檢', verify: 'vLEI 法人授權', incident: '憑證應變', control: 'Agent 政策沙盒',
    eyebrow: 'VERIFYFIRST · ENTERPRISE IMPLEMENTATION LAB', title: '把「誰有權行動」和', highlight: '「付款要求是否一致」分開驗證。',
    body: 'vLEI 核對法人與代表權；x402 + IFF 核對金額、資產、網路與收款方。兩條路都在真正執行前留下可下載的查驗紀錄。',
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
    choose: '選擇要落實的驗證路徑', chooseBody: '先交結構化資料完成預檢，再把 Evidence 與上線缺口交給企業負責人。兩條結果不能互相替代。',
    vleiTrack: '組織身分與代表權', vleiAudience: '法遵 · 公司治理 · IAM', vleiInput: '提交 LEI 與 vLEI CESR',
    vleiDetail: '即時查 GLEIF 法人狀態；在瀏覽器驗 SAID、KEL、ACDC／TEL 與信任根。',
    vleiOutput: '法人摘要 · CESR Evidence · 後端復驗清單', vleiCta: '進入 vLEI 工作台',
    x402Track: '機器付款條件預檢', x402Audience: '財務 · 採購 · 支付工程', x402Input: '提交 Endpoint 與 PAYMENT-REQUIRED',
    x402Detail: '對照企業金額、資產、網路、收款方政策，再以 IFF 外部觀測檢查一致性。',
    x402Output: '政策判定 · IFF 摘要 · Evidence Packet', x402Cta: '進入 x402 工作台',
    sharedGate: '落地價值', sharedTitle: '企業拿到的是可重跑的查驗與交接包。',
    sharedBody: 'LLM 可以幫忙寫一份流程，但不能替代官方來源連線、密碼學預檢、企業政策判定與可重現 Evidence。',
    implementationKicker: 'IMPLEMENTATION, NOT A GENERATED CHECKLIST',
    operations: [
      ['官方來源查驗', '選擇 LIVE 時查 GLEIF Golden Copy 或 IFF 觀測；服務失敗會明確顯示並 fail closed。'],
      ['企業政策確定性判定', '每個欄位與密碼學規則都有可重跑結果，不靠語言模型自行補結論。'],
      ['工程與法遵交接', '下載 Evidence、文件摘要、政策設定與正式環境尚待完成的整合項目。'],
    ],
    maturityTitle: '不需要先有工程團隊，也不限制有能力整合的企業。',
    maturityBody: '同一套驗證核心提供兩種導入深度；可以先用引導流程確認價值，再把相同 Evidence schema 接進既有系統或 chatbot。',
    starter: '引導導入', starterFor: '超新手／尚無專責工程',
    starterBody: '用欄位、範例與本機文件摘要完成第一次沙盒；下載交接包後再交給法遵、QVI 或外包工程。',
    starterVlei: '從 LEI 與文件開始', starterX402: '用 x402 範例試跑',
    builder: '技術整合', builderFor: '有 API／LLM／Chatbot 能力',
    builderBody: '提交結構化 CESR 或 x402 JSON、執行 LIVE 查驗，讓系統讀取機器可讀 Evidence；秘密值不進 LLM。',
    builderVlei: '驗 CESR 憑證鏈', builderX402: '執行 LIVE x402 預檢',
    owner: '適用負責人', submit: '提交', deliver: '交付',
    source: '開源與技術邊界',
  },
  en: {
    subtitle: 'Enterprise trust lab', experiment: 'EXPERIMENTAL',
    navLabel: 'Enterprise lab features', layersLabel: 'Enterprise verification layers', flowLabel: 'Agent request verification flow',
    warning: 'This area is for technical validation and co-development. It has no SLA and must not be used alone for production compliance, payment, or identity decisions.',
    back: 'Personal anti-scam', lab: 'Overview', x402Nav: 'x402 preflight', verify: 'vLEI authority', incident: 'Key response', control: 'Agent policy sandbox',
    eyebrow: 'VERIFYFIRST · ENTERPRISE IMPLEMENTATION LAB', title: 'Verify “who may act” separately from', highlight: '“whether a payment request is consistent.”',
    body: 'vLEI checks legal entity and representative authority. x402 + IFF checks amount, asset, network, and payee. Both leave downloadable evidence before execution.',
    boundaryTitle: 'Policy behavior works today; production trust roots do not.',
    boundaryBody: 'The local grant is test policy. Production still needs signed vLEI / Mandate verification, revocation status, and your own root-of-trust allowlist.',
    capabilities: [['Identity', 'Organization, representative, and Agent'], ['Authorization', 'Purpose, scope, target, and expiry'], ['Policy', 'ALLOW / CONFIRM / DENY'], ['Evidence', 'SHA-256 packet and revocation log']],
    logicTitle: 'One enterprise entry, three verification steps you can run.',
    logicBody: 'Verify legal entities and credentials before the policy gate decides whether an Agent may act. Raw CESR input is never persisted.',
    modules: [['POLICY GATE', 'Agent Action Sandbox', 'Submit real policy requests and inspect allow, confirmation, denial, and Evidence Packets.', 'LAB'], ['GLEIF LIVE', 'Verify a legal entity', 'Query the official GLEIF Golden Copy by LEI and fail closed when no record is available.', 'LEI'], ['VLEI CRYPTO', 'Verify a CESR credential chain', 'Recompute SAIDs and verify KEL signatures, ACDC edges, TEL status, and the selected trust root in your browser.', 'VLEI']],
    customers: ['Brands / manufacturers', 'Finance / payments', 'Government / public service'],
    pains: ['Unclear Agent identity', 'Authorization expands without limit', 'Accountability cannot be reconstructed'],
    x402: 'Before payment, compare x402 amount, asset, and payee evidence. VerifyFirst never holds keys, signs, or pays.',
    choose: 'Choose an implementation track', chooseBody: 'Submit structured input, run preflight, then hand Evidence and production gaps to the accountable owner. The tracks do not replace one another.',
    vleiTrack: 'Organization identity & authority', vleiAudience: 'Compliance · Governance · IAM', vleiInput: 'Submit LEI and vLEI CESR',
    vleiDetail: 'Query live GLEIF status, then verify SAID, KEL, ACDC / TEL, and trust roots in the browser.',
    vleiOutput: 'Entity summary · CESR Evidence · backend checklist', vleiCta: 'Open vLEI workspace',
    x402Track: 'Machine-payment requirement preflight', x402Audience: 'Finance · Procurement · Payments', x402Input: 'Submit endpoint and PAYMENT-REQUIRED',
    x402Detail: 'Check amount, asset, network, and payee policy before comparing with IFF public observations.',
    x402Output: 'Policy decision · IFF summary · Evidence Packet', x402Cta: 'Open x402 workspace',
    sharedGate: 'IMPLEMENTATION VALUE', sharedTitle: 'The deliverable is a repeatable check and implementation handoff.',
    sharedBody: 'An LLM can draft a process, but it cannot replace official-source connections, cryptographic preflight, deterministic enterprise policy, or reproducible Evidence.',
    implementationKicker: 'IMPLEMENTATION, NOT A GENERATED CHECKLIST',
    operations: [
      ['Official-source verification', 'LIVE queries GLEIF Golden Copy or IFF observations. Service failures remain visible and fail closed.'],
      ['Deterministic enterprise policy', 'Every field and cryptographic rule has a repeatable outcome instead of a model-written conclusion.'],
      ['Engineering and compliance handoff', 'Download Evidence, document summaries, policy settings, and outstanding production integration work.'],
    ],
    maturityTitle: 'Start without an engineering team; integrate deeply when ready.',
    maturityBody: 'The same verification core supports two adoption depths. Prove value with guided flows, then consume the same Evidence schema in existing systems or a chatbot.',
    starter: 'Guided adoption', starterFor: 'First-time / no dedicated engineering',
    starterBody: 'Use fields, examples, and local document summaries for the first sandbox, then hand the package to compliance, a QVI, or an implementation partner.',
    starterVlei: 'Start with LEI and documents', starterX402: 'Run an x402 example',
    builder: 'Technical integration', builderFor: 'API / LLM / chatbot capable',
    builderBody: 'Submit structured CESR or x402 JSON, run LIVE checks, and let systems consume machine-readable Evidence. Secrets never enter an LLM.',
    builderVlei: 'Verify a CESR chain', builderX402: 'Run LIVE x402 preflight',
    owner: 'For', submit: 'Submit', deliver: 'Deliver',
    source: 'Source and technical boundaries',
  },
  vi: {
    subtitle: 'Phòng thí nghiệm niềm tin doanh nghiệp', experiment: 'THỬ NGHIỆM',
    navLabel: 'Chức năng phòng thí nghiệm doanh nghiệp', layersLabel: 'Các lớp xác minh doanh nghiệp', flowLabel: 'Luồng xác minh yêu cầu Agent',
    warning: 'Khu vực này dành cho kiểm chứng kỹ thuật và cùng phát triển. Chưa có SLA và không được dùng riêng cho quyết định tuân thủ, thanh toán hoặc danh tính chính thức.',
    back: 'Chống lừa đảo cá nhân', lab: 'Tổng quan', x402Nav: 'Kiểm tra x402', verify: 'Ủy quyền vLEI', incident: 'Ứng phó khóa', control: 'Sandbox policy Agent',
    eyebrow: 'VERIFYFIRST · ENTERPRISE IMPLEMENTATION LAB', title: 'Xác minh riêng “ai có quyền hành động” và', highlight: '“yêu cầu thanh toán có nhất quán không.”',
    body: 'vLEI kiểm tra pháp nhân và quyền đại diện. x402 + IFF kiểm tra số tiền, tài sản, mạng và người nhận. Cả hai để lại bằng chứng tải xuống trước khi thực thi.',
    boundaryTitle: 'Hành vi chính sách đã hoạt động; trust root production thì chưa.',
    boundaryBody: 'Grant cục bộ là chính sách thử nghiệm. Production vẫn phải xác minh vLEI / Mandate có chữ ký, trạng thái thu hồi và allowlist trust root riêng.',
    capabilities: [['Danh tính', 'Tổ chức, đại diện và Agent'], ['Ủy quyền', 'Mục đích, phạm vi, mục tiêu, thời hạn'], ['Chính sách', 'ALLOW / CONFIRM / DENY'], ['Bằng chứng', 'SHA-256 packet và nhật ký thu hồi']],
    logicTitle: 'Một cổng doanh nghiệp với ba bước xác minh có thể chạy.',
    logicBody: 'Xác minh pháp nhân và chứng thư trước khi cổng chính sách quyết định Agent có được hành động hay không. CESR thô không được lưu.',
    modules: [['POLICY GATE', 'Agent Action Sandbox', 'Gửi yêu cầu chính sách thật và xem allow, xác nhận, từ chối cùng Evidence Packet.', 'LAB'], ['GLEIF LIVE', 'Xác minh pháp nhân', 'Tra cứu Golden Copy chính thức của GLEIF bằng LEI và fail closed khi không có dữ liệu.', 'LEI'], ['VLEI CRYPTO', 'Xác minh chuỗi chứng thư CESR', 'Tính lại SAID và kiểm tra chữ ký KEL, cạnh ACDC, trạng thái TEL cùng trust root trong trình duyệt.', 'VLEI']],
    customers: ['Thương hiệu / nhà máy', 'Tài chính / thanh toán', 'Chính phủ / dịch vụ công'],
    pains: ['Không rõ Agent đại diện ai', 'Ủy quyền bị mở rộng vô hạn', 'Không thể phục dựng trách nhiệm'],
    x402: 'Trước thanh toán, đối chiếu số tiền, tài sản và người nhận x402. VerifyFirst không giữ khóa, ký hay thanh toán.',
    choose: 'Chọn luồng triển khai', chooseBody: 'Gửi dữ liệu có cấu trúc, chạy kiểm tra trước, rồi bàn giao Evidence và khoảng trống production cho người phụ trách. Hai luồng không thay thế nhau.',
    vleiTrack: 'Danh tính tổ chức & quyền đại diện', vleiAudience: 'Tuân thủ · Quản trị · IAM', vleiInput: 'Gửi LEI và vLEI CESR',
    vleiDetail: 'Tra cứu GLEIF trực tiếp, rồi kiểm tra SAID, KEL, ACDC / TEL và trust root trong trình duyệt.',
    vleiOutput: 'Tóm tắt pháp nhân · CESR Evidence · checklist backend', vleiCta: 'Mở không gian vLEI',
    x402Track: 'Kiểm tra yêu cầu thanh toán máy', x402Audience: 'Tài chính · Mua sắm · Thanh toán', x402Input: 'Gửi endpoint và PAYMENT-REQUIRED',
    x402Detail: 'Kiểm tra chính sách số tiền, tài sản, mạng, người nhận rồi đối chiếu quan sát công khai của IFF.',
    x402Output: 'Quyết định policy · IFF · Evidence Packet', x402Cta: 'Mở không gian x402',
    sharedGate: 'GIÁ TRỊ TRIỂN KHAI', sharedTitle: 'Sản phẩm bàn giao là kiểm tra lặp lại được và gói triển khai.',
    sharedBody: 'LLM có thể soạn quy trình, nhưng không thay thế kết nối nguồn chính thức, preflight mật mã, policy xác định và Evidence có thể tái tạo.',
    implementationKicker: 'IMPLEMENTATION, NOT A GENERATED CHECKLIST',
    operations: [
      ['Xác minh nguồn chính thức', 'LIVE truy vấn GLEIF Golden Copy hoặc quan sát IFF. Lỗi dịch vụ được hiển thị và fail closed.'],
      ['Policy doanh nghiệp xác định', 'Mỗi trường và quy tắc mật mã có kết quả lặp lại được, không dựa vào kết luận do mô hình viết.'],
      ['Bàn giao kỹ thuật và tuân thủ', 'Tải Evidence, tóm tắt tài liệu, cấu hình policy và các việc production còn thiếu.'],
    ],
    maturityTitle: 'Không cần đội kỹ thuật lúc bắt đầu; có thể tích hợp sâu khi sẵn sàng.',
    maturityBody: 'Cùng một lõi xác minh hỗ trợ hai mức triển khai. Thử luồng hướng dẫn trước, rồi dùng cùng Evidence schema trong hệ thống hoặc chatbot.',
    starter: 'Triển khai hướng dẫn', starterFor: 'Mới bắt đầu / chưa có kỹ thuật riêng',
    starterBody: 'Dùng biểu mẫu, ví dụ và tóm tắt tài liệu cục bộ để chạy sandbox đầu tiên, rồi bàn giao cho tuân thủ, QVI hoặc đối tác triển khai.',
    starterVlei: 'Bắt đầu với LEI và tài liệu', starterX402: 'Chạy ví dụ x402',
    builder: 'Tích hợp kỹ thuật', builderFor: 'Có API / LLM / chatbot',
    builderBody: 'Gửi CESR hoặc x402 JSON có cấu trúc, chạy LIVE và cho hệ thống đọc Evidence. Bí mật không vào LLM.',
    builderVlei: 'Xác minh chuỗi CESR', builderX402: 'Chạy LIVE x402 preflight',
    owner: 'Dành cho', submit: 'Gửi', deliver: 'Bàn giao',
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
  const appendVerification = useCallback((record: EnterpriseVerificationRecord) => {
    setVerificationRecords(current => [record, ...current.filter(item => item.id !== record.id)].slice(0, 50));
    const action = record.kind === 'LEI_LOOKUP'
      ? 'LEI_RECORD_CHECKED'
      : record.kind === 'VLEI_CHAIN'
        ? 'VLEI_CHAIN_CHECKED'
        : 'X402_REQUIREMENT_CHECKED';
    const timelineDecision = record.decision.startsWith('DENY')
      ? 'DENY'
      : record.decision.startsWith('HOLD') || record.decision.includes('REVIEW') || record.decision.includes('BACKEND')
        ? 'REQUIRE_CONFIRMATION'
        : 'INFO';
    appendTimeline({
      id: `evt_verify_${record.id}`,
      at: record.checkedAt,
      actor: 'VerifyFirst verifier',
      action,
      target: record.subject,
      decision: timelineDecision,
      detail: record.decision,
      evidenceId: `sha256:${record.digest}`,
    });
  }, [appendTimeline]);
  const selectView = useCallback((next: BusinessView, section?: VerificationSection, x402Mode?: 'live' | 'simulation') => {
    setView(next);
    if (section) setVerificationSection(section);
    const url = new URL(window.location.href);
    if (next === 'VLEI') {
      const nextSection = section ?? verificationSection;
      url.searchParams.set('module', 'vlei');
      url.searchParams.set('section', nextSection === 'VLEI' ? 'vlei' : 'lei');
    } else if (next === 'X402') {
      url.searchParams.set('module', 'x402');
      url.searchParams.delete('section');
      url.searchParams.set('mode', x402Mode ?? 'live');
    } else if (next === 'CONTROL') {
      url.searchParams.set('module', 'audit');
      url.searchParams.delete('section');
    } else if (next === 'INCIDENT') {
      url.searchParams.set('module', 'incident');
      url.searchParams.delete('section');
    } else {
      url.searchParams.delete('module');
      url.searchParams.delete('section');
    }
    if (next !== 'X402') url.searchParams.delete('mode');
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
      <OptionalAnalytics />
      <header className="vf-header">
        <div className="vf-container vf-header-inner">
          <a className="vf-brand" href="/business/">
            <span className="vf-brand-mark"><BrandMark className="vf-brand-symbol" /></span>
            <span className="vf-brand-copy"><span className="vf-brand-name">VerifyFirst <b>Lab</b></span><span className="vf-brand-subtitle">{t.subtitle}</span></span>
          </a>
          <nav className="vf-product-nav" aria-label={t.navLabel}>
            <button title={t.lab} aria-label={t.lab} className={view === 'LAB' ? 'is-active' : ''} onClick={() => selectView('LAB')}><FlaskConical size={14} />{t.lab}</button>
            <button title={t.verify} aria-label={t.verify} className={view === 'VLEI' ? 'is-active' : ''} onClick={() => selectView('VLEI')}><Building2 size={14} />{t.verify}</button>
            <button title={t.x402Nav} aria-label={t.x402Nav} className={view === 'X402' ? 'is-active' : ''} onClick={() => selectView('X402')}><CircleDollarSign size={14} />{t.x402Nav}</button>
            <button title={t.incident} aria-label={t.incident} className={view === 'INCIDENT' ? 'is-active' : ''} onClick={() => selectView('INCIDENT')}><KeyRound size={14} />{t.incident}</button>
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
      ) : view === 'VLEI' ? (
        <TrustVerificationPanel language={language} section={verificationSection} records={verificationRecords} onSectionChange={(section) => selectView('VLEI', section)} onBack={() => selectView('LAB')} onVerified={appendVerification} />
      ) : view === 'X402' ? (
        <X402Workbench language={language} records={verificationRecords} onBack={() => selectView('LAB')} onVerified={appendVerification} />
      ) : (
        <main className="vf-container vf-main">
          <section className="vf-enterprise-hero">
            <div className="vf-enterprise-hero-copy">
              <span className="vf-eyebrow">{t.eyebrow}</span>
              <h1>{t.title}<br /><strong>{t.highlight}</strong></h1>
              <p>{t.body}</p>
              <div className="vf-track-quick-links">
                <button type="button" className="is-vlei" onClick={() => selectView('VLEI')}><Building2 size={16} /><span><small>LEI · vLEI</small>{t.vleiTrack}</span><ArrowRight size={14} /></button>
                <button type="button" className="is-x402" onClick={() => selectView('X402')}><CircleDollarSign size={16} /><span><small>x402 · IFF</small>{t.x402Track}</span><ArrowRight size={14} /></button>
              </div>
            </div>
            <div className="vf-enterprise-proof-note"><ShieldCheck size={20} /><div><strong>LIVE SOURCES · REPEATABLE EVIDENCE</strong><p>{t.chooseBody}</p></div></div>

            <div className="vf-track-heading"><span className="vf-agent-kicker">TWO SEPARATE TRUST QUESTIONS</span><h2>{t.choose}</h2></div>
            <div className="vf-enterprise-track-grid">
              <button type="button" className="vf-enterprise-track is-vlei" onClick={() => selectView('VLEI')}>
                <div className="vf-track-top"><span><Building2 size={21} /></span><small>LEI · vLEI</small></div>
                <h2>{t.vleiTrack}</h2><p>{t.vleiDetail}</p>
                <dl><div><dt>{t.owner}</dt><dd>{t.vleiAudience}</dd></div><div><dt>{t.submit}</dt><dd>{t.vleiInput}</dd></div><div><dt>{t.deliver}</dt><dd>{t.vleiOutput}</dd></div></dl>
                <div className="vf-track-badges"><span>GLEIF LIVE</span><span>LOCAL CRYPTO</span><span className="is-warning">BACKEND NEEDED</span></div>
                <b>{t.vleiCta}<ArrowRight size={14} /></b>
              </button>
              <button type="button" className="vf-enterprise-track is-x402" onClick={() => selectView('X402')}>
                <div className="vf-track-top"><span><CircleDollarSign size={21} /></span><small>x402 · IFF</small></div>
                <h2>{t.x402Track}</h2><p>{t.x402Detail}</p>
                <dl><div><dt>{t.owner}</dt><dd>{t.x402Audience}</dd></div><div><dt>{t.submit}</dt><dd>{t.x402Input}</dd></div><div><dt>{t.deliver}</dt><dd>{t.x402Output}</dd></div></dl>
                <div className="vf-track-badges"><span>IFF PREFLIGHT</span><span>NO KEYS</span><span>NO PAYMENT</span></div>
                <b>{t.x402Cta}<ArrowRight size={14} /></b>
              </button>
            </div>

            <div className="vf-evidence-rail" aria-label="Enterprise verification delivery flow">
              <div><ReceiptText size={17} /><span><small>01</small>STRUCTURED INPUT</span></div><ArrowRight size={15} />
              <div><Network size={17} /><span><small>02</small>LIVE / LOCAL CHECK</span></div><ArrowRight size={15} />
              <div><ShieldCheck size={17} /><span><small>03</small>POLICY DECISION</span></div><ArrowRight size={15} />
              <div><Check size={17} /><span><small>04</small>EVIDENCE HANDOFF</span></div>
            </div>
          </section>

          <section className="vf-adoption-section" aria-labelledby="adoption-title">
            <header><div><span className="vf-eyebrow">ADOPTION PATH</span><h2 id="adoption-title">{t.maturityTitle}</h2></div><p>{t.maturityBody}</p></header>
            <div className="vf-adoption-grid">
              <article className="is-starter">
                <div><span>01</span><small>{t.starterFor}</small></div><h3>{t.starter}</h3><p>{t.starterBody}</p>
                <div><button type="button" onClick={() => selectView('VLEI', 'LEI')}><Building2 size={14} />{t.starterVlei}<ArrowRight size={13} /></button><button type="button" onClick={() => selectView('X402', undefined, 'simulation')}><FlaskConical size={14} />{t.starterX402}<ArrowRight size={13} /></button></div>
              </article>
              <article className="is-builder">
                <div><span>02</span><small>{t.builderFor}</small></div><h3>{t.builder}</h3><p>{t.builderBody}</p>
                <div><button type="button" onClick={() => selectView('VLEI', 'VLEI')}><Network size={14} />{t.builderVlei}<ArrowRight size={13} /></button><button type="button" onClick={() => selectView('X402', undefined, 'live')}><CircleDollarSign size={14} />{t.builderX402}<ArrowRight size={13} /></button></div>
              </article>
            </div>
          </section>

          <section className="vf-enterprise-operations">
            <header><div><span className="vf-eyebrow">{t.implementationKicker}</span><h2>{t.sharedTitle}</h2></div><p>{t.sharedBody}</p></header>
            <div className="vf-enterprise-operation-grid">
              {t.operations.map((item, index) => <article key={item[0]}><span>0{index + 1}</span><h3>{item[0]}</h3><p>{item[1]}</p></article>)}
            </div>
            <div className="vf-enterprise-secondary-actions"><button type="button" onClick={() => selectView('INCIDENT')}><KeyRound size={15} />{t.incident}<ArrowRight size={13} /></button><button type="button" onClick={() => selectView('CONTROL')}><SlidersHorizontal size={15} />{t.control}<ArrowRight size={13} /></button></div>
          </section>
        </main>
      )}

      <footer className="vf-footer"><div className="vf-container vf-footer-inner"><p>{t.source}</p><div className="vf-footer-services"><a href="https://github.com/topben/cryptotruth" target="_blank" rel="noreferrer"><Github size={13} />GitHub</a><a href="/privacy/">Data processing</a><a href="/trust-pathways/">Trust Pathways</a><a href="/update-trust/">Update Trust</a></div></div></footer>
    </div>
  );
};

export default BusinessApp;
