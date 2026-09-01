import React, { useMemo, useRef, useState } from 'react';
import {
  Building2,
  Check,
  Clock3,
  Download,
  FileCheck2,
  Info,
  LoaderCircle,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import {
  MAX_LOCAL_DOCUMENT_BYTES,
  MAX_LOCAL_DOCUMENT_FILES,
  MAX_LOCAL_DOCUMENT_TOTAL_BYTES,
  LocalDocumentManifestError,
  createLocalDocumentManifest,
  type LocalDocumentCategory,
  type LocalDocumentManifestEntry,
} from '../../services/localDocumentManifest';
import { buildVleiHandoff, VLEI_LEI_LOOKUP_MAX_AGE_MS, type GleifLookupEvidence } from '../../services/vleiHandoff';
import type { Language } from '../../types';

interface VleiImplementationIntakeProps {
  language: Language;
  gleifLookup?: GleifLookupEvidence;
}

const CATEGORY_VALUES: LocalDocumentCategory[] = [
  'LEGAL_ENTITY_IDENTITY',
  'OWNERSHIP_RELATIONSHIP',
  'REPRESENTATIVE_IDENTITY',
  'REPRESENTATIVE_AUTHORITY',
  'ROLE_EVIDENCE',
  'OTHER',
];

const COPY = {
  'zh-TW': {
    kicker: 'vLEI IMPLEMENTATION INTAKE',
    title: '整理成可交給法遵、QVI 與技術團隊的申請準備包。',
    body: '填寫導入目的並在本機產生文件摘要。VerifyFirst 不發行 vLEI，也不取代 QVI 的身分、職權與文件查核。請勿在欄位中填入密碼、私鑰或其他機密值。',
    caseName: '案件名稱', owner: '企業負責人／團隊', targetSystem: '預計導入系統', purpose: '導入目的',
    casePlaceholder: '例如：供應商代表權查驗', ownerPlaceholder: '例如：法遵部／王小姐', systemPlaceholder: '例如：供應商入口網站', purposePlaceholder: '說明要驗證的組織、角色與預計使用情境',
    documents: '本機文件摘要', documentBody: '可一次選擇多份文件。所有檔案只在此瀏覽器計算 SHA-256，不會上傳；摘要不代表文件內容真實、有效或已受 QVI 接受。',
    commonCategory: '本批文件共同類別', choose: '選擇本機文件', generate: '產生安全摘要', generating: '計算中',
    limits: `最多 ${MAX_LOCAL_DOCUMENT_FILES} 檔、單檔 ${MAX_LOCAL_DOCUMENT_BYTES / 1024 / 1024} MiB、總計 ${MAX_LOCAL_DOCUMENT_TOTAL_BYTES / 1024 / 1024} MiB；超限即停止。`,
    selected: '已選文件', noFiles: '尚未選擇文件', documentLabel: '交接文件',
    readiness: '導入準備度', liveLei: 'GLEIF LEI 即時查驗', manifest: '文件摘要已產生', qvi: 'QVI 受理與正式發證', backend: '正式 verifier 與撤銷狀態查驗',
    passed: '完成', pending: '待完成', leiReady: '已由前一步帶入即時查驗的 LEI。', leiMissing: '請先在 LEI 頁完成 GLEIF 即時查驗。',
    manifestReady: '只有顯示名稱、類型、類別、大小、SHA-256 與查核時間。', manifestMissing: '選擇文件後產生本機摘要。',
    qviPending: '須由企業選擇 GLEIF 列名的 QVI，依其要求完成身分、職權與文件查核。', backendPending: '正式使用前仍須部署受控的 verifier、信任根政策、即時狀態查驗與稽核保存。',
    manifestTitle: '文件 manifest', noManifest: '摘要產生後會顯示於此，不會顯示或保存文件內容。',
    download: '下載 QVI／技術交接 JSON', incomplete: '請先填完四個案件欄位並產生至少一份文件摘要。',
    officialQvi: '查看 GLEIF 官方 QVI 名單', error: '無法產生文件摘要',
    categories: {
      LEGAL_ENTITY_IDENTITY: '法人身分資料', OWNERSHIP_RELATIONSHIP: '所有權／關係資料', REPRESENTATIVE_IDENTITY: '代表人身分資料', REPRESENTATIVE_AUTHORITY: '代表權證明', ROLE_EVIDENCE: '角色／職務證明', OTHER: '其他',
    },
  },
  en: {
    kicker: 'vLEI IMPLEMENTATION INTAKE',
    title: 'Prepare a handoff package for compliance, a QVI, and the implementation team.',
    body: 'Describe the intended deployment and create document summaries locally. VerifyFirst does not issue vLEIs or replace a QVI’s identity, authority, and document checks. Never enter passwords, private keys, or secret values.',
    caseName: 'Case name', owner: 'Business owner / team', targetSystem: 'Target system', purpose: 'Implementation purpose',
    casePlaceholder: 'Example: Supplier authority verification', ownerPlaceholder: 'Example: Compliance / Jane', systemPlaceholder: 'Example: Supplier portal', purposePlaceholder: 'Describe the organization, role, and intended use to verify',
    documents: 'Local document summary', documentBody: 'Select multiple files at once. Each SHA-256 digest is computed only in this browser and nothing is uploaded. A summary does not prove that a document is authentic, valid, or accepted by a QVI.',
    commonCategory: 'Common category for this batch', choose: 'Choose local files', generate: 'Create safe summary', generating: 'Hashing',
    limits: `Maximum ${MAX_LOCAL_DOCUMENT_FILES} files, ${MAX_LOCAL_DOCUMENT_BYTES / 1024 / 1024} MiB each, and ${MAX_LOCAL_DOCUMENT_TOTAL_BYTES / 1024 / 1024} MiB total. Exceeding a limit stops the operation.`,
    selected: 'Selected files', noFiles: 'No files selected', documentLabel: 'Handoff document',
    readiness: 'Implementation readiness', liveLei: 'Live GLEIF LEI check', manifest: 'Document manifest created', qvi: 'QVI review and issuance', backend: 'Production verifier and status checks',
    passed: 'Complete', pending: 'Pending', leiReady: 'A live-checked LEI was supplied by the previous step.', leiMissing: 'Complete the live GLEIF lookup on the LEI page first.',
    manifestReady: 'Contains only display name, type, category, size, SHA-256, and check time.', manifestMissing: 'Select files and create their local summary.',
    qviPending: 'The organization must select a GLEIF-listed QVI and complete that QVI’s identity, authority, and document checks.', backendPending: 'Production still requires a controlled verifier, trust-root policy, live status checks, and audit retention.',
    manifestTitle: 'Document manifest', noManifest: 'The summary appears here without displaying or retaining document contents.',
    download: 'Download QVI / technical handoff JSON', incomplete: 'Complete all four case fields and create at least one document summary first.',
    officialQvi: 'View the official GLEIF QVI list', error: 'The document summary could not be created',
    categories: {
      LEGAL_ENTITY_IDENTITY: 'Legal-entity identity', OWNERSHIP_RELATIONSHIP: 'Ownership / relationships', REPRESENTATIVE_IDENTITY: 'Representative identity', REPRESENTATIVE_AUTHORITY: 'Representative authority', ROLE_EVIDENCE: 'Role evidence', OTHER: 'Other',
    },
  },
  vi: {
    kicker: 'vLEI IMPLEMENTATION INTAKE',
    title: 'Chuẩn bị gói bàn giao cho tuân thủ, QVI và đội triển khai.',
    body: 'Mô tả mục đích triển khai và tạo bản tóm tắt tài liệu ngay trên máy. VerifyFirst không phát hành vLEI và không thay thế việc QVI kiểm tra danh tính, thẩm quyền và tài liệu. Không nhập mật khẩu, khóa riêng hoặc giá trị bí mật.',
    caseName: 'Tên hồ sơ', owner: 'Người / nhóm phụ trách', targetSystem: 'Hệ thống dự kiến', purpose: 'Mục đích triển khai',
    casePlaceholder: 'Ví dụ: Xác minh quyền đại diện nhà cung cấp', ownerPlaceholder: 'Ví dụ: Nhóm tuân thủ', systemPlaceholder: 'Ví dụ: Cổng nhà cung cấp', purposePlaceholder: 'Mô tả tổ chức, vai trò và tình huống cần xác minh',
    documents: 'Tóm tắt tài liệu cục bộ', documentBody: 'Có thể chọn nhiều tệp. SHA-256 chỉ được tính trong trình duyệt này và không có nội dung nào được tải lên. Bản tóm tắt không chứng minh tài liệu là thật, hợp lệ hoặc đã được QVI chấp nhận.',
    commonCategory: 'Loại chung cho lô tài liệu', choose: 'Chọn tệp cục bộ', generate: 'Tạo bản tóm tắt an toàn', generating: 'Đang tính',
    limits: `Tối đa ${MAX_LOCAL_DOCUMENT_FILES} tệp, ${MAX_LOCAL_DOCUMENT_BYTES / 1024 / 1024} MiB mỗi tệp và ${MAX_LOCAL_DOCUMENT_TOTAL_BYTES / 1024 / 1024} MiB tổng cộng. Vượt giới hạn sẽ dừng.`,
    selected: 'Tệp đã chọn', noFiles: 'Chưa chọn tệp', documentLabel: 'Tài liệu bàn giao',
    readiness: 'Mức sẵn sàng triển khai', liveLei: 'Kiểm tra LEI trực tiếp từ GLEIF', manifest: 'Đã tạo manifest tài liệu', qvi: 'QVI xem xét và phát hành', backend: 'Verifier production và kiểm tra trạng thái',
    passed: 'Hoàn tất', pending: 'Chờ xử lý', leiReady: 'LEI đã kiểm tra trực tiếp được chuyển từ bước trước.', leiMissing: 'Hãy hoàn tất tra cứu GLEIF trực tiếp trên trang LEI trước.',
    manifestReady: 'Chỉ có tên hiển thị, loại, danh mục, kích thước, SHA-256 và thời gian kiểm tra.', manifestMissing: 'Chọn tệp rồi tạo bản tóm tắt cục bộ.',
    qviPending: 'Doanh nghiệp phải chọn QVI có tên trong danh sách GLEIF và hoàn tất việc kiểm tra danh tính, thẩm quyền, tài liệu theo yêu cầu của QVI.', backendPending: 'Production vẫn cần verifier được kiểm soát, chính sách trust root, kiểm tra trạng thái trực tiếp và lưu vết kiểm toán.',
    manifestTitle: 'Manifest tài liệu', noManifest: 'Bản tóm tắt sẽ xuất hiện tại đây mà không hiển thị hoặc lưu nội dung tài liệu.',
    download: 'Tải JSON bàn giao QVI / kỹ thuật', incomplete: 'Hãy điền đủ bốn trường hồ sơ và tạo ít nhất một bản tóm tắt tài liệu.',
    officialQvi: 'Xem danh sách QVI chính thức của GLEIF', error: 'Không thể tạo bản tóm tắt tài liệu',
    categories: {
      LEGAL_ENTITY_IDENTITY: 'Danh tính pháp nhân', OWNERSHIP_RELATIONSHIP: 'Sở hữu / quan hệ', REPRESENTATIVE_IDENTITY: 'Danh tính người đại diện', REPRESENTATIVE_AUTHORITY: 'Thẩm quyền đại diện', ROLE_EVIDENCE: 'Bằng chứng vai trò', OTHER: 'Khác',
    },
  },
} as const;

const QVI_DIRECTORY_URL = 'https://www.gleif.org/en/organizational-identity/get-an-lei-vlei/get-a-vlei';

const VleiImplementationIntake: React.FC<VleiImplementationIntakeProps> = ({ language, gleifLookup }) => {
  const t = COPY[language] ?? COPY['zh-TW'];
  const inputRef = useRef<HTMLInputElement>(null);
  const [caseName, setCaseName] = useState('');
  const [owner, setOwner] = useState('');
  const [targetSystem, setTargetSystem] = useState('');
  const [purpose, setPurpose] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<LocalDocumentCategory>('ROLE_EVIDENCE');
  const [manifest, setManifest] = useState<LocalDocumentManifestEntry[]>([]);
  const [manifestError, setManifestError] = useState('');
  const [hashing, setHashing] = useState(false);

  const normalizedLei = gleifLookup?.lei ?? '';
  const lookupAgeMs = gleifLookup ? Date.now() - new Date(gleifLookup.checkedAt).getTime() : Number.NaN;
  const leiLiveChecked = Boolean(
    gleifLookup
    && gleifLookup.entityStatus === 'ACTIVE'
    && gleifLookup.registrationStatus === 'ISSUED'
    && Number.isFinite(lookupAgeMs)
    && lookupAgeMs >= 0
    && lookupAgeMs <= VLEI_LEI_LOOKUP_MAX_AGE_MS,
  );
  const manifestReady = manifest.length > 0;
  const intakeComplete = [caseName, owner, targetSystem, purpose].every(value => value.trim().length > 0);
  const canDownload = intakeComplete && manifestReady;
  const selectedBytes = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files]);

  const chooseFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(event.target.files ?? []));
    setManifest([]);
    setManifestError('');
  };

  const buildManifest = async () => {
    if (!files.length || hashing) return;
    setHashing(true);
    setManifest([]);
    setManifestError('');
    try {
      const nextManifest = await createLocalDocumentManifest(
        files,
        files.map((_, index) => ({
          category,
          displayName: `${t.documentLabel} ${String(index + 1).padStart(2, '0')}`,
        })),
      );
      setManifest(nextManifest);
    } catch (error) {
      const code = error instanceof LocalDocumentManifestError ? error.code : 'LOCAL_DOCUMENT_MANIFEST_FAILED';
      setManifestError(`${t.error} · ${code}`);
    } finally {
      setHashing(false);
    }
  };

  const downloadHandoff = () => {
    if (!canDownload) return;
    const handoff = buildVleiHandoff({
      caseDetails: { name: caseName, owner, targetSystem, purpose },
      documentManifest: manifest,
      gleifLookup,
    });
    const url = URL.createObjectURL(new Blob([JSON.stringify(handoff, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `verifyfirst-vlei-handoff-${Date.now()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  const readinessRows = [
    { label: t.liveLei, complete: leiLiveChecked, detail: leiLiveChecked ? `${t.leiReady} ${normalizedLei}` : t.leiMissing, icon: Building2 },
    { label: t.manifest, complete: manifestReady, detail: manifestReady ? t.manifestReady : t.manifestMissing, icon: FileCheck2 },
    { label: t.qvi, complete: false, detail: t.qviPending, icon: ShieldCheck },
    { label: t.backend, complete: false, detail: t.backendPending, icon: Clock3 },
  ];

  return (
    <section className="vf-vlei-workbench vf-vlei-implementation-intake" aria-labelledby="vlei-implementation-title">
      <div className="vf-vlei-input-card">
        <div className="vf-vlei-card-head">
          <div><span className="vf-agent-kicker">{t.kicker}</span><h2 id="vlei-implementation-title">{t.title}</h2><p>{t.body}</p></div>
          <FileCheck2 size={24} />
        </div>

        <div className="vf-grant-editor-fields">
          <label><span>{t.caseName}</span><input value={caseName} maxLength={120} onChange={event => setCaseName(event.target.value)} placeholder={t.casePlaceholder} /></label>
          <label><span>{t.owner}</span><input value={owner} maxLength={120} onChange={event => setOwner(event.target.value)} placeholder={t.ownerPlaceholder} /></label>
          <label><span>{t.targetSystem}</span><input value={targetSystem} maxLength={160} onChange={event => setTargetSystem(event.target.value)} placeholder={t.systemPlaceholder} /></label>
          <label className="is-wide"><span>{t.purpose}</span><input value={purpose} maxLength={500} onChange={event => setPurpose(event.target.value)} placeholder={t.purposePlaceholder} /></label>
        </div>

        <div className="vf-source-boundary"><Info size={15} /><span>{t.documentBody}</span></div>
        <fieldset className="vf-root-policy">
          <legend>{t.commonCategory}</legend>
          <label className="is-selected">
            <span><strong>{t.categories[category]}</strong><select value={category} disabled={hashing} onChange={event => { setCategory(event.target.value as LocalDocumentCategory); setManifest([]); setManifestError(''); }}>{CATEGORY_VALUES.map(value => <option value={value} key={value}>{t.categories[value]}</option>)}</select></span>
          </label>
        </fieldset>
        <input ref={inputRef} type="file" multiple hidden disabled={hashing} onChange={chooseFiles} />
        <div className="vf-vlei-actions">
          <button type="button" className="vf-secondary-button" disabled={hashing} onClick={() => inputRef.current?.click()}><Upload size={14} />{t.choose}</button>
          <button type="button" className="vf-primary-button" disabled={hashing || files.length === 0} onClick={buildManifest}>{hashing ? <LoaderCircle className="is-spinning" size={15} /> : <FileCheck2 size={15} />}{hashing ? t.generating : t.generate}</button>
        </div>
        <p className="vf-fixture-boundary"><Info size={14} />{t.limits}</p>
        <div className="vf-cesr-source"><code>{files.length ? `${t.selected} · ${files.length}` : t.noFiles}</code><span>{Math.round(selectedBytes / 1024)} KiB</span></div>
        {files.length > 0 && <div className="vf-check-list">{files.map((file, index) => <article key={`${file.name}-${file.size}-${index}`} className="is-valid"><Check size={14} /><div><strong>{file.name}</strong><p>{file.type || 'application/octet-stream'} · {Math.round(file.size / 1024)} KiB</p></div><small>LOCAL</small></article>)}</div>}
        {manifestError && <div className="vf-verification-error" role="alert"><X size={15} /><span>{manifestError}</span></div>}
      </div>

      <div className={`vf-vlei-result-card ${manifestReady ? 'is-allow' : 'is-idle'}`} aria-live="polite">
        <div className="vf-vlei-decision"><div><small>READINESS</small><h2>{t.readiness}</h2><p>{manifestReady ? 'HANDOFF DRAFT READY' : 'LOCAL PREPARATION'}</p></div><span>{manifestReady ? <Check size={22} /> : <Clock3 size={22} />}<small>{t.manifest}</small><b>{manifestReady ? t.passed : t.pending}</b></span></div>
        <div className="vf-check-list">{readinessRows.map(({ label, complete, detail, icon: Icon }) => <article key={label} className={complete ? 'is-valid' : 'is-invalid'}>{complete ? <Check size={14} /> : <Icon size={14} />}<div><strong>{label}</strong><p>{detail}</p></div><small>{complete ? t.passed : t.pending}</small></article>)}</div>

        <span className="vf-agent-kicker">{t.manifestTitle}</span>
        {manifestReady ? <div className="vf-credential-chain">{manifest.map((entry, index) => <article className="is-valid" key={entry.digest}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{t.categories[entry.category]} · {entry.type || 'application/octet-stream'}</small><strong>{entry.name}</strong><code>{entry.digest.slice(0, 24)}…</code><b>{Math.round(entry.size / 1024)} KiB</b></div><Check size={15} /></article>)}</div> : <div className="vf-result-empty"><FileCheck2 size={29} /><strong>LOCAL SHA-256 MANIFEST</strong><p>{t.noManifest}</p></div>}

        <div className="vf-evidence-actions">
          <a href={QVI_DIRECTORY_URL} target="_blank" rel="noreferrer">{t.officialQvi}</a>
          <button type="button" className="vf-primary-button" disabled={!canDownload} title={!canDownload ? t.incomplete : undefined} onClick={downloadHandoff}><Download size={14} />{t.download}</button>
        </div>
        {!canDownload && <p className="vf-fixture-boundary"><Info size={14} />{t.incomplete}</p>}
      </div>
    </section>
  );
};

export default VleiImplementationIntake;
