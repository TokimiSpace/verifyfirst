import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Download,
  ExternalLink,
  FileCode2,
  Fingerprint,
  Info,
  LoaderCircle,
  Network,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { GleifLeiRecord, lookupLeiRecord } from '../../services/gleif';
import { sealEvidenceBody, sha256EvidenceBody } from '../../services/evidenceIntegrity';
import {
  MAX_VLEI_CESR_BYTES,
  OfficialVleiFixture,
  VleiTrustDomain,
  VleiVerificationResult,
  loadOfficialVleiFixture,
  resolveVleiRepresentedEntity,
  verifyVleiCesr,
} from '../../services/vleiClient';
import { EnterpriseVerificationRecord, Language } from '../../types';

export type VerificationSection = 'LEI' | 'VLEI';

interface TrustVerificationPanelProps {
  language: Language;
  section: VerificationSection;
  records: EnterpriseVerificationRecord[];
  onSectionChange: (section: VerificationSection) => void;
  onBack: () => void;
  onVerified: (record: EnterpriseVerificationRecord) => void;
}

interface VleiViewResult {
  verification: VleiVerificationResult;
  decision: string;
  toolExecution: boolean;
  leiMatch: 'MATCH' | 'MISMATCH' | 'NOT_CHECKED' | 'NO_LEI_IN_CHAIN' | 'LEI_RECORD_REVIEW' | 'STALE_LEI_LOOKUP' | 'AMBIGUOUS_CHAIN';
  evidenceDigest: string;
}

interface CheckedGleifLeiRecord extends GleifLeiRecord {
  lookupDigest: `sha256:${string}`;
}

type CesrSource = 'PASTED_CESR' | 'LOCAL_FILE' | 'GLEIF_TEST_FIXTURE';
const LEI_LOOKUP_MAX_AGE_MS = 15 * 60 * 1_000;

const COPY = {
  'zh-TW': {
    back: '回到行動政策', eyebrow: 'LIVE VERIFICATION WORKSPACE', title: '先確認代表誰，再決定能做什麼。',
    body: '把 Trust Pathways 的即時法人查詢與 Update Trust 的密碼學驗證收進同一個工作台。原始 CESR 只留在瀏覽器記憶體，不上傳、不交給 AI。',
    leiTab: '01 · 法人 LEI', vleiTab: '02 · vLEI／CESR', live: 'LIVE · GLEIF GOLDEN COPY',
    leiTitle: '查驗法律實體公開紀錄', leiBody: '只把 20 字元 LEI 傳給 GLEIF 官方 API。這能確認法人紀錄，不代表持有人擁有有效 vLEI 或代表權。',
    leiLabel: 'Legal Entity Identifier', leiPlaceholder: '輸入 20 字元 LEI', lookup: '查詢 GLEIF', looking: '查詢中',
    entityStatus: '實體狀態', registrationStatus: 'LEI 狀態', jurisdiction: '法域', updated: 'Golden Copy 更新',
    recordVerified: 'LEI RECORD VERIFIED', recordReview: 'LEI RECORD NEEDS REVIEW', source: '官方資料來源',
    crypto: 'LOCAL CRYPTO · NO UPLOAD', vleiTitle: '驗證 vLEI CESR 憑證鏈',
    vleiBody: '瀏覽器直接重算 BLAKE3 SAID、驗 Ed25519 KEL 簽章、ACDC 邊鏈、TEL 狀態與信任根；任何一項失敗就不允許工具執行。',
    production: 'Production · GLEIF root', fixture: 'Self-test · 官方 regression fixture', rootLabel: '信任根政策',
    pasteLabel: '貼上或載入 CESR（上限 128 KiB）', pastePlaceholder: '貼上 application/json+cesr 串流…',
    upload: '選擇本機檔案', useFixture: '載入官方測試 fixture', verify: '執行密碼學驗證', verifying: '驗證中',
    fixtureBoundary: '官方 regression fixture 使用測試信任根，不是真實企業憑證。切到 Production root 時應 fail closed。',
    productionBoundary: 'Production 模式的瀏覽器結果只是預檢；未經 live OOBI、witness 與後端 verifier 復驗，一律不授權執行。',
    decision: 'POLICY DECISION', execution: '工具執行', allowed: '允許', blocked: '阻擋',
    messages: 'CESR 訊息', credentials: '憑證', checks: '檢查', digest: 'Evidence Packet checksum（自我檢查，非簽章）',
    match: '與已查 LEI 一致', mismatch: '與已查 LEI 不一致', notChecked: '尚未用 GLEIF 交叉比對 LEI', noLei: '終端憑證未揭露可用 LEI', leiReview: 'GLEIF 紀錄不是 ACTIVE／ISSUED', staleLei: 'GLEIF 查詢已超過 15 分鐘，請重新查詢', ambiguousChain: '無法唯一確定終端憑證',
    download: '下載 Evidence Packet', noResult: '載入 CESR 後執行驗證，結果會顯示在這裡。', leiNoResult: '輸入 LEI 並查詢，官方法人紀錄會顯示在這裡。',
    boundaries: '能力邊界', boundaryItems: ['TEL 狀態只代表輸入串流的時間點快照，不是即時撤銷查詢', '不驗 live OOBI／witness receipts', '不做 watcher duplicity 偵測', 'Evidence checksum 未簽章，不證明來源', '瀏覽器結果不會自動取得 Agent 授權'],
    recent: '最近查驗摘要', empty: '尚無查驗紀錄', deepDive: '訓練與技術深潛',
    pathwayLink: '情境故事庫', updateLink: '完整 vLEI 技術頁', privacy: 'ZERO STORAGE OPS',
    privacyBody: '只把結果摘要與 SHA-256 寫進本機 Trust Timeline；原始 CESR 不進 localStorage，也不使用 Vercel Blob。',
    gleifBoundary: '只查詢 GLEIF 官方 API，失敗時不改用模擬資料。',
    iffBoundary: '當已查驗網址回傳 HTTP 402 時，Agent 行動閥門會執行 IFF x402 預檢；不會簽名或付款。',
    invalidLei: '請輸入 20 個英文字母或數字的 LEI。', leiPending: 'GLEIF 查詢尚未完成，請稍候再驗證憑證鏈。', fileTooLarge: '檔案超過 128 KiB 上限。', noCesr: '請先貼上、上傳或載入 CESR。',
  },
  en: {
    back: 'Back to action policy', eyebrow: 'LIVE VERIFICATION WORKSPACE', title: 'Verify who is represented before deciding what may run.',
    body: 'One workspace combines the live entity lookup from Trust Pathways with the cryptographic verifier from Update Trust. Raw CESR stays in browser memory and is never sent to AI.',
    leiTab: '01 · Legal entity', vleiTab: '02 · vLEI / CESR', live: 'LIVE · GLEIF GOLDEN COPY',
    leiTitle: 'Verify a public legal-entity record', leiBody: 'Only the 20-character LEI is sent to the official GLEIF API. This verifies a legal record, not vLEI possession or representative authority.',
    leiLabel: 'Legal Entity Identifier', leiPlaceholder: 'Enter a 20-character LEI', lookup: 'Query GLEIF', looking: 'Looking up',
    entityStatus: 'Entity status', registrationStatus: 'LEI status', jurisdiction: 'Jurisdiction', updated: 'Golden Copy update',
    recordVerified: 'LEI RECORD VERIFIED', recordReview: 'LEI RECORD NEEDS REVIEW', source: 'Official source',
    crypto: 'LOCAL CRYPTO · NO UPLOAD', vleiTitle: 'Verify a vLEI CESR credential chain',
    vleiBody: 'The browser recomputes BLAKE3 SAIDs and checks Ed25519 KEL signatures, ACDC edges, TEL status, and the trust root. Any failure blocks tool execution.',
    production: 'Production · GLEIF root', fixture: 'Self-test · official regression fixture', rootLabel: 'Trust-root policy',
    pasteLabel: 'Paste or load CESR (128 KiB maximum)', pastePlaceholder: 'Paste an application/json+cesr stream…',
    upload: 'Choose local file', useFixture: 'Load official test fixture', verify: 'Run cryptographic verification', verifying: 'Verifying',
    fixtureBoundary: 'The official regression fixture uses a test root and is not a real company credential. It should fail closed under the Production root.',
    productionBoundary: 'A Production browser result is preflight evidence only. Tool execution remains blocked until a backend verifier checks live OOBI and witness state.',
    decision: 'POLICY DECISION', execution: 'Tool execution', allowed: 'Allowed', blocked: 'Blocked',
    messages: 'CESR messages', credentials: 'Credentials', checks: 'Checks', digest: 'Evidence Packet checksum (self-check, not a signature)',
    match: 'Matches the checked LEI', mismatch: 'Does not match the checked LEI', notChecked: 'GLEIF LEI cross-check not run', noLei: 'Terminal credential has no usable LEI', leiReview: 'GLEIF record is not ACTIVE / ISSUED', staleLei: 'GLEIF lookup is over 15 minutes old; query it again', ambiguousChain: 'A unique terminal credential cannot be resolved',
    download: 'Download Evidence Packet', noResult: 'Load CESR and run verification to see the result.', leiNoResult: 'Enter an LEI and query the official legal-entity record to see it here.',
    boundaries: 'Capability boundaries', boundaryItems: ['TEL status is a point-in-time snapshot of the supplied stream, not a live revocation query', 'No live OOBI or witness receipts', 'No watcher duplicity detection', 'The Evidence checksum is unsigned and does not prove origin', 'A browser result never grants Agent authority'],
    recent: 'Recent verification summaries', empty: 'No verification records yet', deepDive: 'Training and technical deep dives',
    pathwayLink: 'Scenario library', updateLink: 'Full vLEI technical page', privacy: 'ZERO STORAGE OPS',
    privacyBody: 'Only a summary and SHA-256 digest enter the local Trust Timeline. Raw CESR never enters localStorage or Vercel Blob.',
    gleifBoundary: 'Queries only the official GLEIF API and never falls back to synthetic data.',
    iffBoundary: 'When a checked endpoint returns HTTP 402, the Agent action gate runs an IFF x402 preflight. It never signs or pays.',
    invalidLei: 'Enter exactly 20 ASCII letters or digits.', leiPending: 'The GLEIF lookup is still pending. Wait before verifying the credential chain.', fileTooLarge: 'The file exceeds the 128 KiB limit.', noCesr: 'Paste, upload, or load CESR first.',
  },
  vi: {
    back: 'Về chính sách hành động', eyebrow: 'LIVE VERIFICATION WORKSPACE', title: 'Xác minh đại diện cho ai trước khi quyết định được làm gì.',
    body: 'Một không gian kết hợp tra cứu pháp nhân trực tiếp từ Trust Pathways với trình xác minh mật mã của Update Trust. CESR thô chỉ ở trong bộ nhớ trình duyệt và không gửi cho AI.',
    leiTab: '01 · Pháp nhân LEI', vleiTab: '02 · vLEI / CESR', live: 'LIVE · GLEIF GOLDEN COPY',
    leiTitle: 'Xác minh hồ sơ pháp nhân công khai', leiBody: 'Chỉ LEI 20 ký tự được gửi tới API chính thức của GLEIF. Kết quả không chứng minh quyền sở hữu vLEI hoặc quyền đại diện.',
    leiLabel: 'Legal Entity Identifier', leiPlaceholder: 'Nhập LEI 20 ký tự', lookup: 'Tra cứu GLEIF', looking: 'Đang tra cứu',
    entityStatus: 'Trạng thái pháp nhân', registrationStatus: 'Trạng thái LEI', jurisdiction: 'Pháp vực', updated: 'Golden Copy cập nhật',
    recordVerified: 'LEI RECORD VERIFIED', recordReview: 'LEI RECORD NEEDS REVIEW', source: 'Nguồn chính thức',
    crypto: 'LOCAL CRYPTO · NO UPLOAD', vleiTitle: 'Xác minh chuỗi chứng thư vLEI CESR',
    vleiBody: 'Trình duyệt tính lại BLAKE3 SAID và kiểm tra chữ ký Ed25519 KEL, cạnh ACDC, trạng thái TEL cùng trust root. Bất kỳ lỗi nào cũng chặn thực thi.',
    production: 'Production · GLEIF root', fixture: 'Tự kiểm tra · fixture chính thức', rootLabel: 'Chính sách trust root',
    pasteLabel: 'Dán hoặc tải CESR (tối đa 128 KiB)', pastePlaceholder: 'Dán luồng application/json+cesr…',
    upload: 'Chọn tệp cục bộ', useFixture: 'Tải fixture kiểm thử', verify: 'Chạy xác minh mật mã', verifying: 'Đang xác minh',
    fixtureBoundary: 'Regression fixture dùng trust root thử nghiệm, không phải chứng thư doanh nghiệp thật. Với Production root, nó phải fail closed.',
    productionBoundary: 'Kết quả Production trong trình duyệt chỉ là preflight. Thực thi vẫn bị chặn cho đến khi backend verifier kiểm tra live OOBI và witness.',
    decision: 'POLICY DECISION', execution: 'Thực thi công cụ', allowed: 'Cho phép', blocked: 'Chặn',
    messages: 'Thông điệp CESR', credentials: 'Chứng thư', checks: 'Kiểm tra', digest: 'Checksum Evidence Packet (tự kiểm tra, không phải chữ ký)',
    match: 'Khớp LEI đã tra cứu', mismatch: 'Không khớp LEI đã tra cứu', notChecked: 'Chưa đối chiếu LEI qua GLEIF', noLei: 'Chứng thư cuối không có LEI hợp lệ', leiReview: 'Hồ sơ GLEIF không ACTIVE / ISSUED', staleLei: 'Tra cứu GLEIF đã quá 15 phút; hãy tra cứu lại', ambiguousChain: 'Không xác định được duy nhất chứng thư cuối',
    download: 'Tải Evidence Packet', noResult: 'Tải CESR và chạy xác minh để xem kết quả.', leiNoResult: 'Nhập LEI và tra cứu hồ sơ pháp nhân chính thức để xem tại đây.',
    boundaries: 'Giới hạn năng lực', boundaryItems: ['Trạng thái TEL chỉ là ảnh chụp tại thời điểm của luồng được cung cấp, không phải truy vấn thu hồi trực tiếp', 'Không kiểm tra live OOBI / witness receipts', 'Không phát hiện duplicity qua watcher', 'Checksum Evidence không có chữ ký và không chứng minh nguồn', 'Kết quả trình duyệt không tự cấp quyền Agent'],
    recent: 'Tóm tắt xác minh gần đây', empty: 'Chưa có bản ghi xác minh', deepDive: 'Đào sâu kỹ thuật và đào tạo',
    pathwayLink: 'Thư viện tình huống', updateLink: 'Trang kỹ thuật vLEI đầy đủ', privacy: 'ZERO STORAGE OPS',
    privacyBody: 'Chỉ tóm tắt và SHA-256 vào Trust Timeline cục bộ. CESR thô không vào localStorage hay Vercel Blob.',
    gleifBoundary: 'Chỉ truy vấn API GLEIF chính thức và không thay thế bằng dữ liệu mô phỏng.',
    iffBoundary: 'Khi endpoint đã kiểm tra trả HTTP 402, cổng hành động Agent chạy IFF x402 preflight. Hệ thống không ký hay thanh toán.',
    invalidLei: 'Nhập đúng 20 chữ cái hoặc chữ số.', leiPending: 'Tra cứu GLEIF chưa hoàn tất. Hãy chờ trước khi xác minh chuỗi chứng thư.', fileTooLarge: 'Tệp vượt quá giới hạn 128 KiB.', noCesr: 'Hãy dán, tải lên hoặc nạp CESR trước.',
  },
} as const;

const ERROR_COPY: Record<Language, Record<string, string>> = {
  'zh-TW': {
    GLEIF_TIMEOUT: 'GLEIF 查詢逾時，本次不放行。',
    LEI_NOT_FOUND: 'GLEIF 找不到這筆 LEI 紀錄。',
    GLEIF_HTTP_ERROR: 'GLEIF 服務目前無法完成查詢。',
    GLEIF_REQUEST_FAILED: '無法連線到 GLEIF，本次不放行。',
    INVALID_GLEIF_RESPONSE: 'GLEIF 回應格式無法驗證。',
    GLEIF_RESPONSE_TOO_LARGE: 'GLEIF 回應超過安全上限。',
    VLEI_INPUT_TOO_LARGE: 'CESR 超過 128 KiB 安全上限。',
    VLEI_CRYPTO_UNAVAILABLE: '這個瀏覽器無法執行所需的密碼學驗證。',
    VLEI_FIXTURE_HTTP_ERROR: '無法載入官方測試 fixture。',
    VLEI_FIXTURE_INTEGRITY_ERROR: '測試 fixture 的 SHA-256 與釘選版本不一致。',
    WEBCRYPTO_UNAVAILABLE: '瀏覽器不支援所需的 WebCrypto。',
    VERIFICATION_FAILED: '驗證無法完成，本次不放行。',
  },
  en: {
    GLEIF_TIMEOUT: 'The GLEIF lookup timed out, so this check is blocked.',
    LEI_NOT_FOUND: 'GLEIF has no record for this LEI.',
    GLEIF_HTTP_ERROR: 'GLEIF could not complete the lookup.',
    GLEIF_REQUEST_FAILED: 'GLEIF could not be reached, so this check is blocked.',
    INVALID_GLEIF_RESPONSE: 'The GLEIF response could not be validated.',
    GLEIF_RESPONSE_TOO_LARGE: 'The GLEIF response exceeded the safety limit.',
    VLEI_INPUT_TOO_LARGE: 'CESR exceeds the 128 KiB safety limit.',
    VLEI_CRYPTO_UNAVAILABLE: 'This browser cannot run the required cryptographic verification.',
    VLEI_FIXTURE_HTTP_ERROR: 'The official test fixture could not be loaded.',
    VLEI_FIXTURE_INTEGRITY_ERROR: 'The fixture SHA-256 does not match the pinned version.',
    WEBCRYPTO_UNAVAILABLE: 'The required WebCrypto capability is unavailable.',
    VERIFICATION_FAILED: 'Verification could not be completed, so this check is blocked.',
  },
  vi: {
    GLEIF_TIMEOUT: 'Tra cứu GLEIF hết thời gian, vì vậy lần kiểm tra này bị chặn.',
    LEI_NOT_FOUND: 'GLEIF không có hồ sơ cho LEI này.',
    GLEIF_HTTP_ERROR: 'GLEIF hiện không thể hoàn tất tra cứu.',
    GLEIF_REQUEST_FAILED: 'Không thể kết nối GLEIF, vì vậy lần kiểm tra này bị chặn.',
    INVALID_GLEIF_RESPONSE: 'Không thể xác minh phản hồi GLEIF.',
    GLEIF_RESPONSE_TOO_LARGE: 'Phản hồi GLEIF vượt giới hạn an toàn.',
    VLEI_INPUT_TOO_LARGE: 'CESR vượt giới hạn an toàn 128 KiB.',
    VLEI_CRYPTO_UNAVAILABLE: 'Trình duyệt này không thể chạy xác minh mật mã cần thiết.',
    VLEI_FIXTURE_HTTP_ERROR: 'Không thể tải fixture kiểm thử chính thức.',
    VLEI_FIXTURE_INTEGRITY_ERROR: 'SHA-256 của fixture không khớp phiên bản đã ghim.',
    WEBCRYPTO_UNAVAILABLE: 'Không có khả năng WebCrypto cần thiết.',
    VERIFICATION_FAILED: 'Không thể hoàn tất xác minh, vì vậy lần kiểm tra này bị chặn.',
  },
};

const short = (value: string, head = 10, tail = 6) => value.length > head + tail + 1
  ? `${value.slice(0, head)}…${value.slice(-tail)}`
  : value;

const errorLabel = (error: unknown, language: Language) => {
  const candidate = error as { code?: string; message?: string };
  const code = candidate?.code || 'VERIFICATION_FAILED';
  const localized = ERROR_COPY[language]?.[code] ?? ERROR_COPY[language].VERIFICATION_FAILED;
  return `${localized} · ${code}`;
};

const recordId = (kind: string) => `verify_${kind.toLowerCase()}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const TrustVerificationPanel: React.FC<TrustVerificationPanelProps> = ({
  language,
  section,
  records,
  onSectionChange,
  onBack,
  onVerified,
}) => {
  const t = COPY[language] ?? COPY['zh-TW'];
  const fileInput = useRef<HTMLInputElement>(null);
  const leiRequestRevision = useRef(0);
  const vleiRequestRevision = useRef(0);
  const leiLookupInFlight = useRef(false);
  const leiRecordRef = useRef<CheckedGleifLeiRecord | null>(null);
  const [leiInput, setLeiInput] = useState('');
  const [leiRecord, setLeiRecord] = useState<CheckedGleifLeiRecord | null>(null);
  const [leiLoading, setLeiLoading] = useState(false);
  const [leiError, setLeiError] = useState('');
  const [trustDomain, setTrustDomain] = useState<VleiTrustDomain>('production');
  const [cesr, setCesr] = useState('');
  const [cesrSource, setCesrSource] = useState<CesrSource>('PASTED_CESR');
  const [sourceLabel, setSourceLabel] = useState('PASTED_CESR');
  const [fixture, setFixture] = useState<OfficialVleiFixture | null>(null);
  const [vleiLoading, setVleiLoading] = useState(false);
  const [vleiError, setVleiError] = useState('');
  const [vleiResult, setVleiResult] = useState<VleiViewResult | null>(null);
  const [evidencePacket, setEvidencePacket] = useState<Record<string, unknown> | null>(null);

  const recent = useMemo(() => records.slice(0, 5), [records]);
  const leiIsCurrent = leiRecord?.entityStatus === 'ACTIVE' && leiRecord.registrationStatus === 'ISSUED';

  useEffect(() => () => {
    leiRequestRevision.current += 1;
    vleiRequestRevision.current += 1;
  }, []);

  const invalidateVleiResult = () => {
    vleiRequestRevision.current += 1;
    setVleiLoading(false);
    setVleiResult(null);
    setEvidencePacket(null);
  };

  const runLeiLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = leiInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{20}$/.test(normalized)) {
      setLeiError(t.invalidLei);
      return;
    }
    const requestRevision = ++leiRequestRevision.current;
    leiLookupInFlight.current = true;
    leiRecordRef.current = null;
    setLeiLoading(true);
    setLeiRecord(null);
    setLeiError('');
    invalidateVleiResult();
    try {
      const result = await lookupLeiRecord(normalized);
      const digest = await sha256EvidenceBody(result);
      if (requestRevision !== leiRequestRevision.current) return;
      const checkedResult: CheckedGleifLeiRecord = { ...result, lookupDigest: `sha256:${digest}` };
      const decision = result.entityStatus === 'ACTIVE' && result.registrationStatus === 'ISSUED'
        ? 'LEI_RECORD_ACTIVE'
        : 'LEI_RECORD_REVIEW';
      leiRecordRef.current = checkedResult;
      setLeiRecord(checkedResult);
      onVerified({
        id: recordId('lei'),
        kind: 'LEI_LOOKUP',
        source: result.sourceUrl,
        trustDomain: 'GLEIF_GOLDEN_COPY',
        subject: result.lei,
        decision,
        checkedAt: result.checkedAt,
        digest,
        limitations: ['Confirms a GLEIF legal-entity record only.', 'Does not prove vLEI possession or representative authority.'],
        metadata: {
          legalName: result.legalName,
          entityStatus: result.entityStatus,
          registrationStatus: result.registrationStatus,
          jurisdiction: result.jurisdiction,
        },
      });
    } catch (error) {
      if (requestRevision !== leiRequestRevision.current) return;
      leiRecordRef.current = null;
      setLeiRecord(null);
      setLeiError(errorLabel(error, language));
    } finally {
      if (requestRevision === leiRequestRevision.current) {
        leiLookupInFlight.current = false;
        setLeiLoading(false);
      }
    }
  };

  const loadFixture = async () => {
    const requestRevision = ++vleiRequestRevision.current;
    setVleiLoading(true);
    setVleiError('');
    setVleiResult(null);
    setEvidencePacket(null);
    try {
      const loaded = await loadOfficialVleiFixture();
      if (requestRevision !== vleiRequestRevision.current) return;
      setCesr(loaded.raw);
      setFixture(loaded);
      setCesrSource('GLEIF_TEST_FIXTURE');
      setSourceLabel(`GLEIF-IT · ${loaded.pinnedCommit.slice(0, 7)} · ${Math.round(loaded.bytes / 1024)} KiB`);
      setTrustDomain('fixture');
    } catch (error) {
      if (requestRevision !== vleiRequestRevision.current) return;
      setVleiError(errorLabel(error, language));
    } finally {
      if (requestRevision === vleiRequestRevision.current) setVleiLoading(false);
    }
  };

  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    // Selecting a new source must revoke any decision made for the previous
    // CESR before validation or I/O can fail. This also invalidates an older
    // file read that may still be in flight.
    invalidateVleiResult();
    const requestRevision = vleiRequestRevision.current;
    setCesr('');
    setCesrSource('LOCAL_FILE');
    setSourceLabel(`LOCAL_FILE · ${file.name} · ${Math.round(file.size / 1024)} KiB`);
    setFixture(null);
    setVleiError('');

    if (file.size > MAX_VLEI_CESR_BYTES) {
      setVleiError(t.fileTooLarge);
      return;
    }
    try {
      const raw = await file.text();
      if (requestRevision !== vleiRequestRevision.current) return;
      if (new TextEncoder().encode(raw).byteLength > MAX_VLEI_CESR_BYTES) {
        setVleiError(t.fileTooLarge);
        return;
      }
      setCesr(raw);
      setVleiError('');
    } catch (error) {
      if (requestRevision !== vleiRequestRevision.current) return;
      setVleiError(errorLabel(error, language));
    }
  };

  const runVleiVerification = async () => {
    if (leiLookupInFlight.current) {
      setVleiError(t.leiPending);
      return;
    }
    if (!cesr.trim()) {
      setVleiError(t.noCesr);
      return;
    }
    const requestRevision = ++vleiRequestRevision.current;
    const checkedLeiRevision = leiRequestRevision.current;
    const checkedCesr = cesr;
    const checkedTrustDomain = trustDomain;
    const checkedLeiRecord = leiRecordRef.current;
    const checkedCesrSource = cesrSource;
    const checkedSourceLabel = sourceLabel;
    const checkedFixture = fixture;
    setVleiLoading(true);
    setVleiError('');
    setVleiResult(null);
    setEvidencePacket(null);
    try {
      const verification = await verifyVleiCesr(checkedCesr, { trustDomain: checkedTrustDomain });
      if (requestRevision !== vleiRequestRevision.current || checkedLeiRevision !== leiRequestRevision.current) return;
      const representedEntity = resolveVleiRepresentedEntity(verification);
      const checkedLeiIsCurrent = checkedLeiRecord?.entityStatus === 'ACTIVE' && checkedLeiRecord.registrationStatus === 'ISSUED';
      const leiLookupAgeMs = checkedLeiRecord
        ? Math.max(0, Date.now() - new Date(checkedLeiRecord.checkedAt).getTime())
        : null;
      const checkedLeiIsFresh = leiLookupAgeMs !== null
        && Number.isFinite(leiLookupAgeMs)
        && leiLookupAgeMs <= LEI_LOOKUP_MAX_AGE_MS;
      const leiMatch: VleiViewResult['leiMatch'] = representedEntity.status === 'AMBIGUOUS_CHAIN'
        ? 'AMBIGUOUS_CHAIN'
        : representedEntity.status !== 'RESOLVED'
          ? 'NO_LEI_IN_CHAIN'
          : !checkedLeiRecord
            ? 'NOT_CHECKED'
            : representedEntity.lei !== checkedLeiRecord.lei
              ? 'MISMATCH'
              : !checkedLeiIsCurrent
                ? 'LEI_RECORD_REVIEW'
                : !checkedLeiIsFresh
                  ? 'STALE_LEI_LOOKUP'
                  : 'MATCH';
      const decision = !verification.decision.toolExecution
        ? verification.decision.code
        : leiMatch === 'AMBIGUOUS_CHAIN'
          ? 'DENY_AMBIGUOUS_CREDENTIAL_CHAIN'
          : leiMatch === 'NO_LEI_IN_CHAIN'
            ? 'DENY_REPRESENTED_LEI_UNRESOLVED'
            : leiMatch === 'NOT_CHECKED'
              ? 'DENY_LEI_NOT_CHECKED'
              : leiMatch === 'LEI_RECORD_REVIEW'
                ? 'DENY_LEI_RECORD_NOT_ACTIVE'
                : leiMatch === 'STALE_LEI_LOOKUP'
                  ? 'DENY_LEI_LOOKUP_STALE'
                : leiMatch === 'MISMATCH'
                  ? 'DENY_LEI_MISMATCH'
                  : checkedTrustDomain === 'production'
                    ? 'DENY_BACKEND_VERIFICATION_REQUIRED'
                    : verification.decision.code;
      const toolExecution = verification.decision.toolExecution
        && leiMatch === 'MATCH'
        && checkedTrustDomain === 'fixture';
      const packetBody = {
        schema: 'verifyfirst.enterprise-verification.v1',
        generatedAt: verification.verifiedAt,
        source: {
          kind: checkedCesrSource,
          label: checkedSourceLabel,
          digest: verification.sourceDigest,
          bytes: verification.stats.bytes,
          ...(checkedFixture ? { pinnedCommit: checkedFixture.pinnedCommit, upstream: checkedFixture.upstream } : {}),
        },
        root: verification.root,
        representedEntity,
        legalEntityCrossCheck: checkedLeiRecord
          ? {
            lei: checkedLeiRecord.lei,
            legalName: checkedLeiRecord.legalName,
            entityStatus: checkedLeiRecord.entityStatus,
            registrationStatus: checkedLeiRecord.registrationStatus,
            result: leiMatch,
            provenance: {
              sourceUrl: checkedLeiRecord.sourceUrl,
              checkedAt: checkedLeiRecord.checkedAt,
              goldenCopyPublishDate: checkedLeiRecord.goldenCopyPublishDate ?? null,
              recordLastUpdateDate: checkedLeiRecord.lastUpdateDate ?? null,
              lookupDigest: checkedLeiRecord.lookupDigest,
            },
            freshness: {
              policy: 'LOOKUP_AGE_MAX_15_MINUTES',
              maxAgeMilliseconds: LEI_LOOKUP_MAX_AGE_MS,
              ageMilliseconds: leiLookupAgeMs,
              passed: checkedLeiIsFresh,
            },
          }
          : { result: leiMatch },
        decision: { code: decision, toolExecution },
        checks: verification.checks,
        credentials: verification.credentials,
        limitations: verification.limitations,
      };
      const packet = await sealEvidenceBody(packetBody);
      const packetDigest = packet.integrity.digest;
      if (requestRevision !== vleiRequestRevision.current || checkedLeiRevision !== leiRequestRevision.current) return;
      const viewResult = { verification, decision, toolExecution, leiMatch, evidenceDigest: packetDigest };
      setVleiResult(viewResult);
      setEvidencePacket(packet);
      onVerified({
        id: recordId('vlei'),
        kind: 'VLEI_CHAIN',
        source: checkedCesrSource,
        trustDomain: checkedTrustDomain === 'production' ? 'GLEIF_PRODUCTION' : 'GLEIF_TEST_FIXTURE',
        subject: representedEntity.status === 'RESOLVED' ? representedEntity.lei : verification.decision.leaf ?? 'CESR_CHAIN',
        decision,
        checkedAt: verification.verifiedAt,
        digest: packetDigest,
        limitations: verification.limitations,
        metadata: {
          toolExecution,
          sourceDigest: verification.sourceDigest,
          evidencePacketId: packet.id,
          messages: verification.stats.messages,
          credentials: verification.stats.credentials,
          checksPassed: verification.checks.filter(item => item.ok).length,
          checksTotal: verification.checks.length,
          leiCrossCheck: leiMatch,
          leiLookupDigest: checkedLeiRecord?.lookupDigest,
        },
      });
    } catch (error) {
      if (requestRevision !== vleiRequestRevision.current) return;
      setVleiResult(null);
      setEvidencePacket(null);
      setVleiError(errorLabel(error, language));
    } finally {
      if (requestRevision === vleiRequestRevision.current) setVleiLoading(false);
    }
  };

  const downloadEvidence = () => {
    if (!evidencePacket) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidencePacket, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `verifyfirst-enterprise-evidence-${Date.now()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  const onCesrChange = (value: string) => {
    invalidateVleiResult();
    setCesr(value);
    setCesrSource('PASTED_CESR');
    setSourceLabel('PASTED_CESR');
    setFixture(null);
  };

  const onLeiInputChange = (value: string) => {
    const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
    leiRequestRevision.current += 1;
    leiLookupInFlight.current = false;
    setLeiLoading(false);
    setLeiInput(normalized);
    setLeiError('');
    if (normalized !== leiRecordRef.current?.lei) {
      leiRecordRef.current = null;
      setLeiRecord(null);
    }
    invalidateVleiResult();
  };

  const onTrustDomainChange = (next: VleiTrustDomain) => {
    setTrustDomain(next);
    setVleiError('');
    invalidateVleiResult();
  };

  const matchLabel = vleiResult?.leiMatch === 'MATCH' ? t.match
    : vleiResult?.leiMatch === 'MISMATCH' ? t.mismatch
      : vleiResult?.leiMatch === 'NO_LEI_IN_CHAIN' ? t.noLei
      : vleiResult?.leiMatch === 'LEI_RECORD_REVIEW' ? t.leiReview
        : vleiResult?.leiMatch === 'STALE_LEI_LOOKUP' ? t.staleLei
          : vleiResult?.leiMatch === 'AMBIGUOUS_CHAIN' ? t.ambiguousChain
            : t.notChecked;

  return (
    <main className="vf-container vf-verification-page">
      <button className="vf-back-button" onClick={onBack}><ArrowLeft size={16} />{t.back}</button>
      <header className="vf-verification-intro">
        <div><span className="vf-eyebrow">{t.eyebrow}</span><h1>{t.title}</h1><p>{t.body}</p></div>
        <div className="vf-verification-privacy"><ShieldCheck size={20} /><div><strong>{t.privacy}</strong><p>{t.privacyBody}</p></div></div>
      </header>

      <div className="vf-verification-tabs" aria-label={`${t.leiTab} / ${t.vleiTab}`}>
        <button type="button" aria-pressed={section === 'LEI'} className={section === 'LEI' ? 'is-active' : ''} onClick={() => onSectionChange('LEI')}><Building2 size={16} /><span>{t.leiTab}</span><small>API</small></button>
        <button type="button" aria-pressed={section === 'VLEI'} className={section === 'VLEI' ? 'is-active' : ''} onClick={() => onSectionChange('VLEI')}><Fingerprint size={16} /><span>{t.vleiTab}</span><small>CRYPTO</small></button>
      </div>

      {section === 'LEI' ? (
        <section className="vf-verification-workbench" aria-labelledby="lei-workbench-title">
          <div className="vf-verification-form-card" aria-busy={leiLoading}>
            <span className="vf-agent-kicker">{t.live}</span>
            <h2 id="lei-workbench-title">{t.leiTitle}</h2><p>{t.leiBody}</p>
            <form className="vf-lei-form" onSubmit={runLeiLookup}>
              <label><span>{t.leiLabel}</span><input value={leiInput} onChange={event => onLeiInputChange(event.target.value)} placeholder={t.leiPlaceholder} autoComplete="off" spellCheck={false} /></label>
              <button className="vf-primary-button" disabled={leiLoading}>{leiLoading ? <LoaderCircle className="is-spinning" size={15} /> : <Network size={15} />}{leiLoading ? t.looking : t.lookup}</button>
            </form>
            {leiError && <div className="vf-verification-error" role="alert"><X size={15} /><span>{leiError}</span></div>}
            <div className="vf-source-boundary"><Info size={15} /><span>{t.gleifBoundary}</span></div>
          </div>

          <div className={`vf-verification-result-card ${leiRecord ? (leiIsCurrent ? 'is-allow' : 'is-review') : 'is-idle'}`} aria-live="polite">
            {leiRecord ? <>
              <div className="vf-result-decision"><span>{leiIsCurrent ? <Check size={20} /> : <Info size={20} />}</span><div><small>{leiIsCurrent ? t.recordVerified : t.recordReview}</small><h2>{leiRecord.legalName}</h2><code>{leiRecord.lei}</code></div></div>
              <dl className="vf-entity-grid">
                <div><dt>{t.entityStatus}</dt><dd>{leiRecord.entityStatus}</dd></div>
                <div><dt>{t.registrationStatus}</dt><dd>{leiRecord.registrationStatus}</dd></div>
                <div><dt>{t.jurisdiction}</dt><dd>{leiRecord.jurisdiction}</dd></div>
                <div><dt>{t.updated}</dt><dd>{leiRecord.goldenCopyPublishDate ?? leiRecord.lastUpdateDate ?? '—'}</dd></div>
              </dl>
              <a href={leiRecord.sourceUrl} target="_blank" rel="noreferrer">{t.source} <ExternalLink size={13} /></a>
              <button className="vf-next-verification" onClick={() => onSectionChange('VLEI')}>{t.vleiTab}<ArrowRight size={14} /></button>
            </> : <div className="vf-result-empty"><Building2 size={29} /><strong>GLEIF Golden Copy</strong><p>{t.leiNoResult}</p></div>}
          </div>
        </section>
      ) : (
        <section className="vf-vlei-workbench" aria-labelledby="vlei-workbench-title">
          <div className="vf-vlei-input-card" aria-busy={vleiLoading}>
            <div className="vf-vlei-card-head"><div><span className="vf-agent-kicker">{t.crypto}</span><h2 id="vlei-workbench-title">{t.vleiTitle}</h2><p>{t.vleiBody}</p></div><FileCode2 size={24} /></div>
            <fieldset className="vf-root-policy"><legend>{t.rootLabel}</legend>
              <label className={trustDomain === 'production' ? 'is-selected' : ''}><input type="radio" name="root" disabled={vleiLoading} checked={trustDomain === 'production'} onChange={() => onTrustDomainChange('production')} /><span><strong>{t.production}</strong><small>ROOT AID · EINmHd…NrYoS</small></span></label>
              <label className={trustDomain === 'fixture' ? 'is-selected is-fixture' : ''}><input type="radio" name="root" disabled={vleiLoading} checked={trustDomain === 'fixture'} onChange={() => onTrustDomainChange('fixture')} /><span><strong>{t.fixture}</strong><small>TEST ROOT · EHOuGi…Hp8pW</small></span></label>
            </fieldset>
            <label className="vf-cesr-input"><span>{t.pasteLabel}</span><textarea value={cesr} disabled={vleiLoading} onChange={event => onCesrChange(event.target.value)} placeholder={t.pastePlaceholder} spellCheck={false} /></label>
            <div className="vf-cesr-source"><code>{sourceLabel}</code><span>{Math.round(new TextEncoder().encode(cesr).byteLength / 1024)} / 128 KiB</span></div>
            <input ref={fileInput} type="file" accept=".cesr,.txt,.json,application/json,text/plain" hidden onChange={chooseFile} />
            <div className="vf-vlei-actions">
              <button className="vf-secondary-button" type="button" disabled={vleiLoading} onClick={() => fileInput.current?.click()}><Upload size={14} />{t.upload}</button>
              <button className="vf-secondary-button" type="button" disabled={vleiLoading} onClick={loadFixture}><Download size={14} />{t.useFixture}</button>
              <button className="vf-primary-button" type="button" disabled={vleiLoading || leiLoading || !cesr.trim()} onClick={runVleiVerification}>{vleiLoading ? <LoaderCircle className="is-spinning" size={15} /> : <ShieldCheck size={15} />}{vleiLoading ? t.verifying : t.verify}</button>
            </div>
            <p className="vf-fixture-boundary"><Info size={14} />{trustDomain === 'fixture' ? t.fixtureBoundary : t.productionBoundary}</p>
            {vleiError && <div className="vf-verification-error" role="alert"><X size={15} /><span>{vleiError}</span></div>}
          </div>

          <div className={`vf-vlei-result-card ${vleiResult ? (vleiResult.toolExecution ? 'is-allow' : 'is-deny') : 'is-idle'}`} aria-live="polite">
            {vleiResult ? <>
              <div className="vf-vlei-decision"><div><small>{t.decision}</small><h2>{vleiResult.decision}</h2><p>{vleiResult.verification.root.label}</p></div><span>{vleiResult.toolExecution ? <Check size={22} /> : <X size={22} />}<small>{t.execution}</small><b>{vleiResult.toolExecution ? t.allowed : t.blocked}</b></span></div>
              <div className="vf-vlei-stats">
                <div><small>{t.messages}</small><strong>{vleiResult.verification.stats.messages}</strong></div>
                <div><small>{t.credentials}</small><strong>{vleiResult.verification.stats.credentials}</strong></div>
                <div><small>{t.checks}</small><strong>{vleiResult.verification.checks.filter(item => item.ok).length}/{vleiResult.verification.checks.length}</strong></div>
              </div>
              <div className={`vf-lei-crosscheck is-${vleiResult.leiMatch.toLowerCase()}`}><Building2 size={14} /><span>{matchLabel}</span></div>
              <div className="vf-credential-chain">
                {vleiResult.verification.credentials.map((credential, index) => <article key={credential.said || index} className={credential.chainValid ? 'is-valid' : 'is-invalid'}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{credential.schemaKey || 'ACDC'} · {credential.status}</small><strong>{credential.schemaTitle}</strong><code>{short(credential.said)}</code>{credential.lei && <b>LEI {credential.lei}</b>}</div>{credential.chainValid ? <Check size={15} /> : <X size={15} />}</article>)}
              </div>
              <div className="vf-check-list">
                {vleiResult.verification.checks.map(check => <article key={check.id} className={check.ok ? 'is-valid' : 'is-invalid'}>{check.ok ? <Check size={14} /> : <X size={14} />}<div><strong>{check.label}</strong><p>{check.detail}</p></div><small>{check.level}</small></article>)}
              </div>
              <div className="vf-evidence-actions"><code>{t.digest} · {short(`sha256:${vleiResult.evidenceDigest}`, 18, 8)}</code><button className="vf-primary-button" onClick={downloadEvidence}><Download size={14} />{t.download}</button></div>
            </> : <div className="vf-result-empty"><Fingerprint size={29} /><strong>SAID · KEL · ACDC · TEL</strong><p>{t.noResult}</p></div>}
          </div>
        </section>
      )}

      <section className="vf-verification-footer-grid">
        <div className="vf-verification-boundaries"><span className="vf-agent-kicker">{t.boundaries}</span>{t.boundaryItems.map(item => <p key={item}><Info size={13} />{item}</p>)}</div>
        <div className="vf-verification-history"><span className="vf-agent-kicker">{t.recent}</span>{recent.length ? recent.map(record => <article key={record.id}><span className={record.decision.startsWith('DENY') ? 'is-deny' : 'is-info'}>{record.kind === 'LEI_LOOKUP' ? <Building2 size={13} /> : <Fingerprint size={13} />}</span><div><strong>{record.decision}</strong><code>{record.trustDomain} · {short(record.subject)}</code></div><time dateTime={record.checkedAt}>{new Intl.DateTimeFormat(language, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(record.checkedAt))}</time></article>) : <p>{t.empty}</p>}</div>
        <div className="vf-verification-deep-dive"><span className="vf-agent-kicker">{t.deepDive}</span><a href="/trust-pathways/">{t.pathwayLink}<ExternalLink size={13} /></a><a href="/update-trust/">{t.updateLink}<ExternalLink size={13} /></a><p>{t.iffBoundary}</p></div>
      </section>
    </main>
  );
};

export default TrustVerificationPanel;
