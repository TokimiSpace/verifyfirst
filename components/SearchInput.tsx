import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, Link, MessageSquare, ImagePlus, FileText, X, ScanText, AtSign, Phone } from 'lucide-react';
import { Language, InputType } from '../types';

type InputMode = 'URL' | 'SMS_TEXT' | 'PHONE' | 'HANDLE';

interface SearchInputProps {
  onSearch: (input: string, inputType?: InputType, imageData?: { base64: string; mediaType: string }) => void;
  isLoading: boolean;
  language: Language;
  isSeniorMode?: boolean;
}

const TRANSLATIONS = {
  en: {
    placeholder: 'Paste a link, message, phone, or account...',
    placeholderSenior: 'Paste a suspicious LINE message, ad, short link, phone number, or account here...',
    scanning: 'Scanning...',
    scanningSenior: 'Checking...',
    audit: 'Sandbox it',
    auditSenior: 'Is This Safe?',
    detected: {
      URL: 'Link',
      SMS_TEXT: 'Message',
      PHONE: 'Phone',
      HANDLE: 'Account',
    },
    detectedLabel: 'Detected:',
    scenarioHint: 'Not sure what to try? Use a demo case:',
    uploadImage: 'Upload Screenshot',
    uploadTxt: 'Upload .txt file',
    imageReady: 'Screenshot ready — click Check to analyze',
    txtReady: '{name} loaded — click Check to analyze',
    pasteImage: 'or paste a screenshot (Ctrl+V) · or upload a .txt file',
    txtTooLarge: 'File too large — showing first 50,000 characters',
    ocrRunning: 'Reading text from screenshot...',
    ocrDone: 'Text extracted — ready to check',
    ocrFailed: 'Could not read text — please type it manually',
    consoleLabel: 'Submit content for evidence checks',
    consoleMeta: 'External data flow',
    dataNotice: 'When you submit, the text or URL goes to the VerifyFirst API, Gemini, and enabled public-check services. Results may remain in bounded server memory for up to 72 hours. Screenshot OCR runs in this browser; only extracted text is submitted. Never paste passwords, OTPs, full card or ID numbers, seed phrases, or secret keys.',
    privacyLink: 'Data processing notice',
  },
  'zh-TW': {
    placeholder: '貼上連結、訊息、電話或帳號...',
    placeholderSenior: '把可疑的 LINE 訊息、廣告、短網址、電話或帳號貼在這裡...',
    scanning: '掃描中...',
    scanningSenior: '檢查中...',
    audit: '丟進沙盒',
    auditSenior: '這安全嗎？',
    detected: {
      URL: '網址',
      SMS_TEXT: '訊息',
      PHONE: '電話',
      HANDLE: '帳號',
    },
    detectedLabel: '偵測到：',
    scenarioHint: '不知道貼什麼？直接試一個 Demo：',
    uploadImage: '上傳截圖',
    uploadTxt: '上傳 .txt 文字檔',
    imageReady: '截圖已就緒，點擊「檢查」開始分析',
    txtReady: '已載入 {name}，點擊「檢查」開始分析',
    pasteImage: '或直接貼上截圖（Ctrl+V）· 或上傳 .txt 檔案',
    txtTooLarge: '檔案過大，僅顯示前 50,000 字元',
    ocrRunning: '正在辨識截圖文字...',
    ocrDone: '文字已擷取，可以開始檢查',
    ocrFailed: '無法辨識文字，請手動輸入',
    consoleLabel: '送出內容進行公開證據查核',
    consoleMeta: '內容會傳至外部服務',
    dataNotice: '送出後，文字或網址會傳至 VerifyFirst API、Gemini 與已啟用的公開查核服務；結果可能在伺服器的限量記憶體保留最多 72 小時。截圖 OCR 在此瀏覽器執行，只會送出擷取文字。請勿貼密碼、OTP、完整卡號／證件號碼、助記詞或秘密金鑰。',
    privacyLink: '資料處理說明',
  },
  vi: {
    placeholder: 'Dán liên kết, tin nhắn, số điện thoại hoặc tài khoản...',
    placeholderSenior: 'Dán tin nhắn LINE, quảng cáo, liên kết ngắn, số điện thoại hoặc tài khoản đáng ngờ vào đây...',
    scanning: 'Đang quét...',
    scanningSenior: 'Đang kiểm tra...',
    audit: 'Cho vào hộp cát',
    auditSenior: 'Có an toàn không?',
    detected: {
      URL: 'Liên kết',
      SMS_TEXT: 'Tin nhắn',
      PHONE: 'Số điện thoại',
      HANDLE: 'Tài khoản',
    },
    detectedLabel: 'Phát hiện:',
    scenarioHint: 'Chưa biết thử gì? Chọn một trường hợp demo:',
    uploadImage: 'Tải ảnh chụp màn hình',
    uploadTxt: 'Tải file .txt',
    imageReady: 'Ảnh chụp màn hình đã sẵn sàng — nhấn Kiểm tra để phân tích',
    txtReady: 'Đã tải {name} — nhấn Kiểm tra để phân tích',
    pasteImage: 'hoặc dán ảnh chụp màn hình (Ctrl+V) · hoặc tải file .txt',
    txtTooLarge: 'File quá lớn — chỉ hiển thị 50.000 ký tự đầu tiên',
    ocrRunning: 'Đang đọc văn bản từ ảnh chụp màn hình...',
    ocrDone: 'Đã trích xuất văn bản — sẵn sàng kiểm tra',
    ocrFailed: 'Không thể đọc văn bản — vui lòng nhập thủ công',
    consoleLabel: 'Gửi nội dung để kiểm tra bằng chứng công khai',
    consoleMeta: 'Dữ liệu được gửi ra ngoài',
    dataNotice: 'Khi gửi, văn bản hoặc URL sẽ tới API VerifyFirst, Gemini và các dịch vụ kiểm tra công khai đã bật; kết quả có thể nằm trong bộ nhớ máy chủ giới hạn tối đa 72 giờ. OCR ảnh chạy trong trình duyệt này và chỉ văn bản trích xuất được gửi đi. Không dán mật khẩu, OTP, số thẻ/giấy tờ đầy đủ, cụm từ khôi phục hoặc khóa bí mật.',
    privacyLink: 'Thông báo xử lý dữ liệu',
  },
};

// Scenario chips — each fills the input with a representative example.
// `preview` is what we render on the page (redacted with xxxxx so crawlers
// and Safe Browsing scanners don't classify this page as containing scam
// content). `sample` is the real input sent to the backend only after a
// user click — it triggers the server-side short-circuit (see
// api/example-responses.ts) and never appears in the rendered DOM.
const SCENARIO_CHIPS: Array<{
  id: string;
  icon: string;
  label: { en: string; 'zh-TW': string; vi: string };
  preview: { en: string; 'zh-TW': string; vi: string };
  sample: string;
}> = [
  {
    id: 'line_forward',
    icon: '💬',
    label: { en: 'LINE Forward', 'zh-TW': 'LINE 轉傳', vi: 'Chuyển tiếp LINE' },
    preview: {
      en: '"A friend sent this on LINE — says xxxxx order problem, need to xxxxx my info now: https://xxx.xx/xxxxxxxxx"',
      'zh-TW': '「朋友剛在 LINE 傳這個給我，說 xxxxx 訂單異常要我立刻 xxxxx 資料：https://xxx.xx/xxxxxxxxx」',
      vi: '"Bạn gửi qua LINE — nói đơn hàng xxxxx có vấn đề, cần xxxxx thông tin ngay: https://xxx.xx/xxxxxxxxx"',
    },
    sample: '朋友剛在 LINE 傳這個給我，說蝦皮訂單異常要我立刻更新資料：https://bit.ly/verify-shopee-tw',
  },
  {
    id: 'facebook_ad',
    icon: '📢',
    label: { en: 'Facebook Ad', 'zh-TW': 'Facebook 廣告', vi: 'Quảng cáo Facebook' },
    preview: {
      en: 'https://xxx.xx/xxxxxxxxx (short link from an ad — merchant unknown)',
      'zh-TW': 'https://xxx.xx/xxxxxxxxx（廣告短網址，商家不明）',
      vi: 'https://xxx.xx/xxxxxxxxx (liên kết rút gọn từ quảng cáo, không rõ người bán)',
    },
    sample: 'https://bit.ly/tw-sale-event',
  },
  {
    id: 'phishing_sms',
    icon: '📩',
    label: { en: 'Phishing SMS', 'zh-TW': '釣魚簡訊', vi: 'SMS lừa đảo' },
    preview: {
      en: '"Your xxxxx cannot be xxxxx — please click to xxxxx your address: https://xxx-xx-xxxxxxx.xxx/xxxxxx"',
      'zh-TW': '「您的 xxxxx 無法 xxxxx，請點擊 xxxxx 地址：https://xxx-xx-xxxxxxx.xxx/xxxxxx」',
      vi: '"xxxxx của bạn không thể xxxxx — xin nhấp để xxxxx địa chỉ: https://xxx-xx-xxxxxxx.xxx/xxxxxx"',
    },
    sample: '您的包裹無法投遞，請點擊更新地址：https://post-tw-delivery.net/verify',
  },
  {
    id: 'short_link',
    icon: '🔗',
    label: { en: 'Short Link', 'zh-TW': '短網址', vi: 'Liên kết rút gọn' },
    preview: {
      en: 'https://xxxxx.xx/xxxxxx (destination hidden)',
      'zh-TW': 'https://xxxxx.xx/xxxxxx（目的地不明）',
      vi: 'https://xxxxx.xx/xxxxxx (đích đến không xác định)',
    },
    sample: 'https://reurl.cc/4g5Yx2',
  },
];

// Mirrors the server's bare-domain check (api/analyze.ts isBareDomain) so the
// input badge matches how the backend will actually classify the paste. Keep
// BARE_DOMAIN_RE and KNOWN_TLDS in sync with that file.
const BARE_DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.([a-z]{2,})$/i;
const KNOWN_TLDS = new Set([
  'com', 'net', 'org', 'io', 'co', 'cc', 'xyz', 'top', 'vip', 'app', 'site',
  'online', 'shop', 'store', 'info', 'biz', 'live', 'me', 'tv', 'ai', 'link',
  'click', 'dev', 'pro', 'asia', 'work', 'fun', 'icu', 'gov', 'edu',
  'tw', 'cn', 'hk', 'mo', 'jp', 'kr', 'us', 'uk', 'in', 'ph', 'vn', 'th',
  'sg', 'my', 'id', 'au', 'de', 'fr', 'ru', 'br',
]);

const isBareDomain = (value: string): boolean => {
  const m = value.match(BARE_DOMAIN_RE);
  return m ? KNOWN_TLDS.has(m[4].toLowerCase()) : false;
};

const detectInputType = (value: string): InputMode => {
  const trimmed = value.trim();
  if (/^(https?:\/\/|www\.)/i.test(trimmed) || isBareDomain(trimmed)) return 'URL';
  if (/^\+?\d[\d\s\-()]{7,}$/.test(trimmed)) return 'PHONE';
  if (/^@?[a-zA-Z0-9._]{2,50}$/.test(trimmed)) return 'HANDLE';
  return 'SMS_TEXT';
};

const getModeIcon = (mode: InputMode, className: string) => {
  switch (mode) {
    case 'URL':      return <Link className={className} />;
    case 'PHONE':    return <Phone className={className} />;
    case 'HANDLE':   return <AtSign className={className} />;
    case 'SMS_TEXT': return <MessageSquare className={className} />;
  }
};

const MAX_TXT_CHARS = 50_000;

const SearchInput: React.FC<SearchInputProps> = ({ onSearch, isLoading, language, isSeniorMode = false }) => {
  const t = TRANSLATIONS[language];
  const [input, setInput] = useState('');
  const [image, setImage] = useState<{ dataUrl: string; base64: string; mediaType: string } | null>(null);
  const [txtFileName, setTxtFileName] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'running' | 'done' | 'failed'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const txtInputRef = useRef<HTMLInputElement>(null);

  const loadTextFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.txt') && file.type !== 'text/plain') return;
    const reader = new FileReader();
    reader.onload = (e) => {
      let text = (e.target?.result as string) ?? '';
      if (text.length > MAX_TXT_CHARS) {
        text = text.slice(0, MAX_TXT_CHARS);
        // small non-blocking toast via console — actual notice shown via txtTooLarge translation
      }
      setInput(text);
      setImage(null);
      setTxtFileName(file.name);
    };
    reader.readAsText(file, 'utf-8');
  }, []);

  const loadImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const originalDataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1920;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
          else { width = Math.round(width * MAX_DIM / height); height = MAX_DIM; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        let dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (dataUrl.length > 5_400_000) dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        const base64 = dataUrl.split(',')[1];
        setImage({ dataUrl, base64, mediaType: 'image/jpeg' });
        setInput('');
        setTxtFileName(null);
        setOcrStatus('running');

        try {
          const langs = language === 'vi' ? 'vie+eng' : 'chi_tra+eng';
          // Dynamic import keeps tesseract.js out of the initial bundle —
          // it's only needed when someone actually uses screenshot OCR.
          const { createWorker, OEM } = await import('tesseract.js');
          const workerOptions = {
            ...(import.meta.env.VITE_TESSERACT_WORKER_PATH ? { workerPath: import.meta.env.VITE_TESSERACT_WORKER_PATH } : {}),
            ...(import.meta.env.VITE_TESSERACT_CORE_PATH ? { corePath: import.meta.env.VITE_TESSERACT_CORE_PATH } : {}),
            ...(import.meta.env.VITE_TESSERACT_LANG_PATH ? { langPath: import.meta.env.VITE_TESSERACT_LANG_PATH } : {}),
          };
          const worker = await createWorker(langs, OEM.LSTM_ONLY, workerOptions);
          const { data } = await worker.recognize(dataUrl);
          await worker.terminate();
          const extracted = data.text.trim();
          if (extracted.length > 10) {
            setInput(extracted);
            setImage(null);
            setOcrStatus('done');
          } else {
            setOcrStatus('failed');
          }
        } catch {
          setOcrStatus('failed');
        }
      };
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
  }, [language]);

  // Handle paste events (image paste via Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) { loadImageFile(file); e.preventDefault(); }
          return;
        }
        if (item.type === 'text/plain') {
          // plain text pastes are handled natively by the input/textarea
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [loadImageFile]);

  // Debounced type — only updates 600ms after user stops typing (no badge flicker)
  const [displayedType, setDisplayedType] = useState<InputMode | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!input.trim()) {
      setDisplayedType(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setDisplayedType(detectInputType(input));
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input]);

  // Switch to textarea only when content is long or multi-line — never based on detected type
  const useTextarea = input.length > 80 || input.includes('\n');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ocrStatus === 'running') return;
    if (!input.trim()) return;
    const finalType = detectInputType(input);
    onSearch(input.trim(), finalType);
  };

  const placeholder = isSeniorMode ? t.placeholderSenior : t.placeholder;

  const submitButton = (extraClass = '') => (
    <button
      type="submit"
      disabled={isLoading || ocrStatus === 'running' || (!input.trim() && !image)}
      className={`vf-submit ${isSeniorMode ? 'min-h-[54px] px-6 text-lg' : ''} ${extraClass}`}
    >
      {isLoading ? (
        <>
          <Loader2 className={`animate-spin ${isSeniorMode ? 'w-7 h-7' : 'w-5 h-5'}`} />
          <span className="vf-submit-label">{isSeniorMode ? t.scanningSenior : t.scanning}</span>
        </>
      ) : (
        <>
          <Search className={isSeniorMode ? 'w-7 h-7' : 'w-5 h-5'} />
          <span className="vf-submit-label">{isSeniorMode ? t.auditSenior : t.audit}</span>
        </>
      )}
    </button>
  );

  return (
    <div className="w-full">
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { loadImageFile(f); setTxtFileName(null); } e.target.value = ''; }}
      />

      {/* Hidden file inputs */}
      <input
        ref={txtInputRef}
        type="file"
        accept=".txt,text/plain"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) loadTextFile(f); e.target.value = ''; }}
      />

      <div className="vf-search-console">
        <div className="vf-console-head">
          <div className="vf-console-label">
            <span className="vf-live-dot" aria-hidden="true" />
            <span>{t.consoleLabel}</span>
          </div>
          <span className="vf-console-meta">{t.consoleMeta}</span>
        </div>

        <div className="vf-console-body">
          {/* Image preview — shown while OCR is running */}
          {image && (
            <div className="relative mb-3 overflow-hidden rounded-xl border border-gray-700 bg-gray-950">
              <img src={image.dataUrl} alt="screenshot preview" className="w-full max-h-64 object-contain" />
              {ocrStatus !== 'running' && (
                <button
                  type="button"
                  onClick={() => { setImage(null); setOcrStatus('idle'); }}
                  className="vf-icon-button absolute right-2 top-2 bg-gray-950/80"
                  aria-label="Remove screenshot"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center justify-center gap-2 border-t border-gray-800 py-2">
                {ocrStatus === 'running'
                  ? <Loader2 className="w-4 h-4 text-crypto-accent animate-spin" />
                  : <ScanText className="w-4 h-4 text-crypto-accent" />
                }
                <p className="text-xs text-crypto-accent">
                  {ocrStatus === 'running' ? t.ocrRunning : ocrStatus === 'failed' ? t.ocrFailed : t.imageReady}
                </p>
              </div>
            </div>
          )}

          {ocrStatus === 'done' && !image && input.trim() && (
            <div className="mb-2 flex items-center gap-1.5 text-xs text-crypto-accent">
              <ScanText className="w-3 h-3" />
              <p>{t.ocrDone}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
          {useTextarea ? (
          <div className="vf-search-field">
            {/* Filename badge when loaded from .txt */}
            {txtFileName && (
              <div className="flex items-center gap-2 px-4 pt-3">
                <FileText className="w-3.5 h-3.5 text-crypto-accent flex-shrink-0" />
                <span className="truncate text-xs font-medium text-gray-300">{txtFileName}</span>
                {input.length >= MAX_TXT_CHARS && (
                  <span className="text-xs text-yellow-400 flex-shrink-0">· {t.txtTooLarge}</span>
                )}
                <button
                  type="button"
                  onClick={() => { setTxtFileName(null); setInput(''); }}
                  className="ml-auto text-gray-500 hover:text-gray-300 flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <textarea
              className={`vf-search-textarea ${isSeniorMode ? 'min-h-[210px] p-6 text-xl' : ''} ${txtFileName ? 'pt-2' : ''}`}
              placeholder={placeholder}
              value={input}
              onChange={(e) => { setInput(e.target.value); if (txtFileName) setTxtFileName(null); }}
              disabled={isLoading}
            />
            <div className="vf-field-footer">
              <div className="vf-upload-actions">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  title={t.uploadImage}
                  className="vf-icon-button disabled:opacity-40"
                >
                  <ImagePlus className={isSeniorMode ? 'w-5 h-5' : 'w-4 h-4'} />
                </button>
                <button
                  type="button"
                  onClick={() => txtInputRef.current?.click()}
                  disabled={isLoading}
                  title={t.uploadTxt}
                  className="vf-icon-button disabled:opacity-40"
                >
                  <FileText className={isSeniorMode ? 'w-5 h-5' : 'w-4 h-4'} />
                </button>
              </div>
              {submitButton()}
            </div>
          </div>
        ) : (
          <div className="vf-search-field vf-search-field-row">
            <div className="vf-search-leading">
              {input.trim() && displayedType
                ? getModeIcon(displayedType, isSeniorMode ? 'w-6 h-6' : 'w-4 h-4')
                : <Search className={isSeniorMode ? 'w-6 h-6' : 'w-4 h-4'} />
              }
            </div>
            <input
              type="text"
              className={`vf-search-input ${isSeniorMode ? 'min-h-[82px] text-xl' : ''}`}
              placeholder={placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => txtInputRef.current?.click()}
              disabled={isLoading}
              title={t.uploadTxt}
              className="vf-icon-button flex-shrink-0 disabled:opacity-40"
            >
              <FileText className={isSeniorMode ? 'w-6 h-6' : 'w-5 h-5'} />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title={t.uploadImage}
              className="vf-icon-button flex-shrink-0 disabled:opacity-40"
            >
              <ImagePlus className={isSeniorMode ? 'w-6 h-6' : 'w-5 h-5'} />
            </button>
            {submitButton()}
          </div>
        )}
          </form>

          <p className={`vf-search-data-notice ${isSeniorMode ? 'is-senior' : ''}`}>
            {t.dataNotice} <a href="/privacy/" target="_blank" rel="noreferrer">{t.privacyLink}</a>
          </p>

      {/* Paste hint — shown when no image and no input */}
      {!image && !input.trim() && !isSeniorMode && (
        <p className="vf-search-hint">{t.pasteImage}</p>
      )}

      {/* Detected Type Badge */}
      {displayedType && displayedType !== 'SMS_TEXT' && input.trim() && (
        <div>
          <span className="vf-detected">
            {getModeIcon(displayedType, 'w-3 h-3')}
            {t.detectedLabel} {t.detected[displayedType]}
          </span>
        </div>
      )}

      {/* Scenario Chips — only when input is empty and not senior mode.
          Each card shows a redacted preview (xxxxx) so crawlers don't index
          the scam patterns; the real sample is sent to the backend on click. */}
      {!input.trim() && !isSeniorMode && (
        <div className="vf-examples">
          <p className="vf-examples-heading">{t.scenarioHint}</p>
          <div className="vf-example-grid">
            {SCENARIO_CHIPS.map(({ id, icon, label, preview, sample }) => {
              const lang = language as keyof typeof label;
              return (
                <button
                  key={id}
                  onClick={() => setInput(sample)}
                  aria-label={label[lang] ?? label.en}
                  className="vf-example-card disabled:opacity-50"
                  disabled={isLoading}
                >
                  <div className="vf-example-title">
                    <span>{icon}</span>
                    <span>{label[lang] ?? label.en}</span>
                  </div>
                  <p className="vf-example-copy">
                    {preview[lang] ?? preview.en}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}
        </div>
      </div>

      {/* Senior Mode hint */}
      {isSeniorMode && !input.trim() && (
        <div className="mt-6 text-center">
          <p className="text-xl text-gray-300">
            {language === 'zh-TW'
              ? '收到可疑訊息或連結？貼上來讓我們幫您檢查！'
              : language === 'vi'
              ? 'Nhận được tin nhắn hoặc liên kết đáng ngờ? Dán vào đây để chúng tôi kiểm tra!'
              : 'Got a suspicious message or link? Paste it here and we\'ll check it for you!'}
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchInput;
