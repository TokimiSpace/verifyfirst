import React, { useState, useEffect, useRef, useCallback } from 'react';
import OptionalAnalytics from './components/OptionalAnalytics';
import { TruthGuardAnalysis, LoadingState, Language, InputType } from './types';
import { analyzeTruthGuard, APIError } from './services/geminiService';
import { buildLocalSafetyFallback } from './services/localSafetyFallback';
import SearchInput from './components/SearchInput';
import TrustMeter from './components/TrustMeter';
import HistoryTimeline from './components/HistoryTimeline';
import ActionGuidance from './components/ActionGuidance';
import RiskSignals from './components/RiskSignals';
import InterruptWarning from './components/InterruptWarning';
import LossRiskPanel from './components/LossRiskPanel';
import TacticCards from './components/TacticCards';
import ScamScriptBreakdown from './components/ScamScriptBreakdown';
import RescueMode from './components/RescueMode';
import OfficialVerification from './components/OfficialVerification';
import EvidencePack from './components/EvidencePack';
import VerdictSummary from './components/VerdictSummary';
import DegradationBanner from './components/DegradationBanner';
import PrimaryActions from './components/PrimaryActions';
import AgentFindings from './components/AgentFindings';
import CofactsFindings from './components/CofactsFindings';
import ReportModal from './components/ReportModal';
import SituationIntake, { ConsumerSituation } from './components/consumer/SituationIntake';
import SafetyAssistant from './components/consumer/SafetyAssistant';
import { ShieldAlert, Search, Globe, CheckCircle2, AlertTriangle, Sparkles, ExternalLink, Accessibility, ChevronDown, ThumbsUp, ThumbsDown, RotateCcw, ArrowLeft, ShieldCheck, Building2 } from 'lucide-react';
import BrandMark from './components/BrandMark';

// UI Text dictionary for all static text
const UI_TEXT = {
  en: {
    appName: 'VerifyFirst',
    appNameHighlight: '',
    poweredBy: 'Powered by tokimi & Gemini',
    seniorMode: 'Senior Mode',
    seniorModeOn: '👴 Senior Mode ON',
    seniorModeOff: '👴 Senior Mode',
    seniorModeDesc: 'Larger text · Simpler results',
    hero: {
      title: 'Something feels wrong?',
      titleHighlight: 'Check before you act.',
      subtitle: 'A guided anti-scam safety assistant',
      description: 'Tell us what happened, then paste the message, link, phone number, or account. VerifyFirst checks the evidence and guides your next safe step.',
      descriptionSenior: 'Paste the suspicious message, ad, short link, phone number, or account here first.'
    },
    loading: {
      messages: [
        'Checking for scam patterns...',
        'Searching fraud databases...',
        'Analyzing content...',
        'Cross-referencing sources...',
        'Investigating red flags...',
        'Compiling safety report...'
      ],
      messagesSenior: [
        'Checking if it\'s safe...',
        'Looking for warning signs...',
        'Almost done...'
      ],
      wait: 'This usually takes 15-30 seconds',
      waitSenior: 'Please wait a moment...'
    },
    error: {
      title: 'Check Failed',
      titleSenior: 'Something Went Wrong',
      tooManyRequests: 'You\'ve hit the hourly usage limit for your device. Please wait a moment and try again.',
      notFound: 'Could not find information. Please try again.',
      badRequest: 'Invalid input. Please check what you entered.',
      llmQuota: 'Our AI analysis service is at capacity right now. Please try again in an hour, or call 165 for urgent help.',
      serviceConfig: 'A service configuration issue is preventing analysis. Please contact support.',
      totalOutage: 'Our services are experiencing heavy load. Please try again later — or call 165 right away if this is urgent.',
      defaultMessage: 'An unexpected error occurred. Please try again.',
      defaultMessageSenior: 'We couldn\'t check this. Please try again or call 165 for help.'
    },
    degradation: {
      l1: '⚠️ {services} is currently unavailable. Results are still reliable.',
      l2: '⚠️ Several data sources unavailable ({services}). Analysis may be less complete than usual.',
      l3: '⚠️ Most external verification services are at capacity. AI analysis still works, but third-party cross-check was skipped this time.',
    },
    common: {
      unknown: 'Unknown'
    },
    results: {
      shareOnX: 'Share on X',
      cachedAgo: '📦 Cached {time} ago',
      cachedResult: '📦 Cached Result',
      liveAnalysis: '🟢 Live Analysis',
      localScreening: '🟠 On-device screening only',
      executiveSummary: 'Summary',
      executiveSummarySenior: 'Is This Safe?',
      detailedAnalysis: 'Detailed Analysis',
      credibilityFactors: 'Safe Signs',
      risksAndCriticisms: 'Warning Signs',
      noStrengths: 'No specific safe signs found',
      noRisks: 'No specific warnings found',
      trackRecord: 'History'
    },
    share: {
      tweetTemplate: 'I just checked this on TruthGuard AI!\n\n📊 {verdict}\n🔍 Safety Score: {score}/100\n\nCheck suspicious messages yourself:\nhttps://verify1st.tw'
    },
    search: {
      newSearch: 'Check Another'
    },
    guidance: {
      advancedInfo: 'Want more details? Ask Gemini for a deeper analysis.',
      call165: 'Not sure? Call 165 (Taiwan Anti-Fraud Hotline) for free advice!'
    },
    inline: {
      call165Btn: 'Call 165 for Help',
      screenshot: 'Screenshot',
      message: 'Message',
      unknownIdentity: 'Unknown',
      impersonator: 'Fake',
      seniorHint: 'Got a suspicious message or link? Paste it here and we\'ll check it for you!'
    }
  },
  'zh-TW': {
    appName: 'VerifyFirst',
    appNameHighlight: '',
    poweredBy: '由 tokimi 及 Gemini 提供支援',
    seniorMode: '長輩模式',
    seniorModeOn: '👴 長輩模式 開啟中',
    seniorModeOff: '👴 長輩模式',
    seniorModeDesc: '大字版・適合長者使用',
    hero: {
      title: '覺得哪裡怪怪的？',
      titleHighlight: '行動前，先查清楚。',
      subtitle: '多語言反詐安全助手',
      description: '先告訴我們你目前做到哪一步，再貼上可疑訊息、連結、電話或帳號。VerifyFirst 會查核證據，並陪你完成下一個安全步驟。',
      descriptionSenior: '把可疑訊息、廣告、短網址、電話或帳號先貼進來，我們先幫你驗證。'
    },
    loading: {
      messages: [
        '正在檢查詐騙特徵...',
        '搜尋詐騙資料庫...',
        '分析內容...',
        '交叉比對來源...',
        '調查危險訊號...',
        '整理安全報告...'
      ],
      messagesSenior: [
        '正在檢查是否安全...',
        '尋找警示訊號...',
        '快好了...'
      ],
      wait: '這通常需要 15-30 秒',
      waitSenior: '請稍等一下...'
    },
    error: {
      title: '檢查失敗',
      titleSenior: '出了點問題',
      tooManyRequests: '您的裝置已達到本小時的使用次數上限，請稍後再試。',
      notFound: '找不到相關資訊。請重試。',
      badRequest: '輸入無效。請確認您輸入的內容。',
      llmQuota: 'AI 分析服務目前已達使用上限，請一小時後再試，或撥打 165 諮詢。',
      serviceConfig: '服務設定出現問題,請聯絡客服。',
      totalOutage: '服務目前負載過高,請稍後再試。若有緊急狀況,請立即撥打 165。',
      defaultMessage: '發生未預期的錯誤。請重試。',
      defaultMessageSenior: '我們無法檢查這個。請重試或撥打 165 尋求協助。'
    },
    degradation: {
      l1: '⚠️ {services} 暫時無法使用，但分析結果仍然可靠。',
      l2: '⚠️ 多個資料來源暫時無法使用（{services}），分析可能不夠完整。',
      l3: '⚠️ 多項外部查核服務已達上限，AI 分析仍可使用，但本次跳過第三方交叉比對。',
    },
    common: {
      unknown: '未知'
    },
    results: {
      shareOnX: '分享到 X',
      cachedAgo: '📦 {time} 前快取',
      cachedResult: '📦 快取結果',
      liveAnalysis: '🟢 即時分析',
      localScreening: '🟠 僅本機安全初篩',
      executiveSummary: '總結摘要',
      executiveSummarySenior: '這安全嗎？',
      detailedAnalysis: '詳細分析',
      credibilityFactors: '安全跡象',
      risksAndCriticisms: '警示訊號',
      noStrengths: '未發現特定安全跡象',
      noRisks: '未發現特定警示',
      trackRecord: '歷史紀錄'
    },
    share: {
      tweetTemplate: '我剛在 TruthGuard AI 查了這個！\n\n📊 {verdict}\n🔍 安全分數：{score}/100\n\n自己來查查可疑訊息：\nhttps://verify1st.tw'
    },
    search: {
      newSearch: '再查一個'
    },
    guidance: {
      advancedInfo: '想要更詳細的分析？請 Gemini 提供更深入的調查。',
      call165: '不確定嗎？撥打 165（反詐騙專線）免費諮詢！'
    },
    inline: {
      call165Btn: '撥打 165 求助',
      screenshot: '截圖分析',
      message: '訊息',
      unknownIdentity: '身分未明',
      impersonator: '冒充者',
      seniorHint: '收到可疑訊息或連結？貼上來讓我們幫您檢查！'
    }
  },
  vi: {
    appName: 'VerifyFirst',
    appNameHighlight: '',
    poweredBy: 'Được cung cấp bởi tokimi & Gemini',
    seniorMode: 'Chế độ cao tuổi',
    seniorModeOn: '👴 Chế độ cao tuổi BẬT',
    seniorModeOff: '👴 Chế độ cao tuổi',
    seniorModeDesc: 'Chữ lớn · Dành cho người cao tuổi',
    hero: {
      title: 'Có điều gì đáng ngờ?',
      titleHighlight: 'Hãy kiểm tra trước khi hành động.',
      subtitle: 'Trợ lý chống lừa đảo đa ngôn ngữ',
      description: 'Hãy cho biết bạn đã thực hiện đến đâu, rồi dán tin nhắn, liên kết, số điện thoại hoặc tài khoản. VerifyFirst kiểm tra bằng chứng và hướng dẫn bước an toàn tiếp theo.',
      descriptionSenior: 'Dán tin nhắn, quảng cáo, liên kết ngắn, số điện thoại hoặc tài khoản đáng ngờ vào đây trước.'
    },
    loading: {
      messages: [
        'Đang kiểm tra mô hình lừa đảo...',
        'Tìm kiếm cơ sở dữ liệu gian lận...',
        'Đang phân tích nội dung...',
        'Đối chiếu các nguồn...',
        'Điều tra dấu hiệu đỏ...',
        'Đang biên soạn báo cáo an toàn...'
      ],
      messagesSenior: [
        'Đang kiểm tra xem có an toàn không...',
        'Tìm kiếm dấu hiệu cảnh báo...',
        'Sắp xong rồi...'
      ],
      wait: 'Quá trình này thường mất 15-30 giây',
      waitSenior: 'Vui lòng đợi một chút...'
    },
    error: {
      title: 'Kiểm tra thất bại',
      titleSenior: 'Đã xảy ra sự cố',
      tooManyRequests: 'Thiết bị của bạn đã đạt giới hạn sử dụng trong giờ này. Vui lòng đợi một lúc rồi thử lại.',
      notFound: 'Không tìm thấy thông tin. Vui lòng thử lại.',
      badRequest: 'Dữ liệu nhập không hợp lệ. Vui lòng kiểm tra lại.',
      llmQuota: 'Dịch vụ phân tích AI của chúng tôi tạm thời quá tải. Vui lòng thử lại sau một giờ hoặc gọi 165 để được hỗ trợ.',
      serviceConfig: 'Sự cố cấu hình dịch vụ. Vui lòng liên hệ hỗ trợ.',
      totalOutage: 'Các dịch vụ đang quá tải. Vui lòng thử lại sau — hoặc gọi 165 ngay nếu khẩn cấp.',
      defaultMessage: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.',
      defaultMessageSenior: 'Chúng tôi không thể kiểm tra điều này. Vui lòng thử lại hoặc gọi đường dây hỗ trợ.'
    },
    degradation: {
      l1: '⚠️ {services} hiện không khả dụng. Kết quả vẫn đáng tin cậy.',
      l2: '⚠️ Nhiều nguồn dữ liệu không khả dụng ({services}). Phân tích có thể chưa đầy đủ.',
      l3: '⚠️ Hầu hết dịch vụ xác minh bên ngoài đã quá tải. AI phân tích vẫn hoạt động, nhưng lần này bỏ qua kiểm tra chéo.',
    },
    common: {
      unknown: 'Không rõ'
    },
    results: {
      shareOnX: 'Chia sẻ lên X',
      cachedAgo: '📦 Đã lưu cache {time} trước',
      cachedResult: '📦 Kết quả đã lưu cache',
      liveAnalysis: '🟢 Phân tích trực tiếp',
      localScreening: '🟠 Chỉ sàng lọc trên thiết bị',
      executiveSummary: 'Tóm tắt',
      executiveSummarySenior: 'Có an toàn không?',
      detailedAnalysis: 'Phân tích chi tiết',
      credibilityFactors: 'Dấu hiệu an toàn',
      risksAndCriticisms: 'Dấu hiệu cảnh báo',
      noStrengths: 'Không tìm thấy dấu hiệu an toàn cụ thể',
      noRisks: 'Không tìm thấy cảnh báo cụ thể',
      trackRecord: 'Lịch sử'
    },
    share: {
      tweetTemplate: 'Tôi vừa kiểm tra điều này trên VerifyFirst AI!\n\n📊 {verdict}\n🔍 Điểm an toàn: {score}/100\n\nTự kiểm tra tin nhắn đáng ngờ:\nhttps://verify1st.tw'
    },
    search: {
      newSearch: 'Kiểm tra thêm'
    },
    guidance: {
      advancedInfo: 'Muốn biết thêm chi tiết? Hãy nhờ Gemini phân tích sâu hơn.',
      call165: 'Không chắc chắn? Gọi đường dây hỗ trợ để được tư vấn miễn phí!'
    },
    inline: {
      call165Btn: 'Gọi hỗ trợ',
      screenshot: 'Phân tích ảnh chụp',
      message: 'Tin nhắn',
      unknownIdentity: 'Danh tính không rõ',
      impersonator: 'Giả mạo',
      seniorHint: 'Nhận được tin nhắn hoặc liên kết đáng ngờ? Dán vào đây để chúng tôi kiểm tra!'
    }
  }
} as const;

const LANG_OPTIONS: { code: Language; label: string }[] = [
  { code: 'zh-TW', label: '繁中' },
  { code: 'en',    label: 'EN'   },
  { code: 'vi',    label: 'VI'   },
];

const CONSUMER_UI: Record<Language, {
  headerSubtitle: string;
  eyebrow: string;
  boundaryTitle: string;
  boundaryBody: string;
  seniorTitle: string;
  seniorBody: string;
  seniorAction: string;
  steps: Array<{ title: string; description: string }>;
  businessLabel: string;
}> = {
  'zh-TW': {
    headerSubtitle: '多語言反詐安全助手',
    eyebrow: 'VERIFYFIRST · PERSONAL ANTI-SCAM',
    boundaryTitle: '先停、先查，再決定。',
    boundaryBody: '不用登入，也不要貼密碼、OTP、完整卡號或身分證字號。若已付款，請優先聯絡銀行並撥打 165。',
    seniorTitle: '給長輩使用大字版',
    seniorBody: '更大的字、更短的說明與更直接的下一步。',
    seniorAction: '開啟',
    steps: [
      { title: '說明狀況', description: '選擇是否點擊、提供資料或已付款' },
      { title: '貼上內容', description: '訊息、網址、電話、帳號或截圖' },
      { title: '查核證據', description: '比對公開資料與可觀察的風險訊號' },
      { title: '對話求助', description: '依你的狀況整理止損、查證與報案步驟' },
    ],
    businessLabel: '企業信任實驗室',
  },
  en: {
    headerSubtitle: 'Multilingual anti-scam assistant',
    eyebrow: 'VERIFYFIRST · PERSONAL ANTI-SCAM',
    boundaryTitle: 'Pause, check, then decide.',
    boundaryBody: 'No sign-in required. Never paste passwords, OTPs, full card numbers, or ID numbers. If you already paid, contact your bank and call 165 first.',
    seniorTitle: 'Switch to Senior Mode',
    seniorBody: 'Larger type, shorter explanations, and clearer next steps.',
    seniorAction: 'Turn on',
    steps: [
      { title: 'Describe the situation', description: 'Tell us whether you clicked, shared data, or paid' },
      { title: 'Paste the content', description: 'Message, URL, phone, account, or screenshot' },
      { title: 'Check evidence', description: 'Compare public records and observable risk signals' },
      { title: 'Get guided help', description: 'Turn findings into recovery, verification, and reporting steps' },
    ],
    businessLabel: 'Enterprise trust lab',
  },
  vi: {
    headerSubtitle: 'Trợ lý chống lừa đảo đa ngôn ngữ',
    eyebrow: 'VERIFYFIRST · PERSONAL ANTI-SCAM',
    boundaryTitle: 'Dừng lại, kiểm tra, rồi mới quyết định.',
    boundaryBody: 'Không cần đăng nhập. Không dán mật khẩu, OTP, số thẻ đầy đủ hoặc số giấy tờ. Nếu đã thanh toán, hãy liên hệ ngân hàng và gọi 165 trước.',
    seniorTitle: 'Bật chế độ chữ lớn',
    seniorBody: 'Chữ lớn hơn, giải thích ngắn hơn và bước tiếp theo rõ ràng hơn.',
    seniorAction: 'Bật',
    steps: [
      { title: 'Mô tả tình trạng', description: 'Cho biết đã nhấp, cung cấp dữ liệu hay thanh toán' },
      { title: 'Dán nội dung', description: 'Tin nhắn, URL, điện thoại, tài khoản hoặc ảnh chụp' },
      { title: 'Kiểm tra bằng chứng', description: 'Đối chiếu nguồn công khai và dấu hiệu quan sát được' },
      { title: 'Nhận hướng dẫn', description: 'Chuyển kết quả thành bước giảm thiệt hại và báo cáo' },
    ],
    businessLabel: 'Phòng thí nghiệm niềm tin doanh nghiệp',
  },
};
const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('zh-TW');
  const [situation, setSituation] = useState<ConsumerSituation>({ stage: 'RECEIVED', channel: 'LINE' });
  const [loadingState, setLoadingState] = useState<LoadingState>('IDLE');
  const [analysis, setAnalysis] = useState<TruthGuardAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState<number>(0);
  const [isSeniorMode, setIsSeniorMode] = useState<boolean>(false);
  const [langMenuOpen, setLangMenuOpen] = useState<boolean>(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);
  const [loadingStep, setLoadingStep] = useState<1 | 2 | 3>(1);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [searchInputKey, setSearchInputKey] = useState(0);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === 'zh-TW'
      ? 'VerifyFirst｜多語言反詐安全助手'
      : language === 'vi'
        ? 'VerifyFirst｜Trợ lý chống lừa đảo'
        : 'VerifyFirst | Multilingual anti-scam assistant';
  }, [language]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get current language text
  const t = UI_TEXT[language];
  const landing = CONSUMER_UI[language];

  // Get loading messages based on mode
  const loadingMessages = isSeniorMode ? t.loading.messagesSenior : t.loading.messages;

  // Cycle through loading messages
  useEffect(() => {
    if (loadingState === 'SEARCHING' || loadingState === 'ANALYZING') {
      const interval = setInterval(() => {
        setLoadingMessageIndex(Math.floor(Math.random() * loadingMessages.length));
      }, isSeniorMode ? 3000 : 2000);
      return () => clearInterval(interval);
    }
  }, [loadingState, loadingMessages.length, isSeniorMode]);

  // Auto-scroll to results when analysis completes
  useEffect(() => {
    if (loadingState === 'COMPLETED' && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [loadingState]);

  // Loading step progression: step 1 → SEARCHING, step 2 → ANALYZING (1.5s), step 3 → ~8s into ANALYZING
  useEffect(() => {
    if (loadingState === 'SEARCHING') {
      setLoadingStep(1);
    } else if (loadingState === 'ANALYZING') {
      setLoadingStep(2);
      const t3 = setTimeout(() => setLoadingStep(3), 8000);
      return () => clearTimeout(t3);
    }
  }, [loadingState]);

  const toggleSeniorMode = () => {
    setIsSeniorMode(prev => !prev);
  };

  const handleReset = useCallback(() => {
    setAnalysis(null);
    setError(null);
    setLoadingState('IDLE');
    setFeedbackGiven(null);
    setLoadingStep(1);
    setSearchInputKey(k => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSearch = async (input: string, inputType?: InputType, imageData?: { base64: string; mediaType: string }) => {
    setError(null);
    setAnalysis(null);
    setFeedbackGiven(null);
    setLoadingStep(1);
    setLoadingState('SEARCHING');
    setLoadingMessageIndex(0);

    // Advance to "analyzing" after a short beat. Functional update — reading
    // `loadingState` here would see the stale value captured at render time,
    // and the step indicator would never leave step 1.
    setTimeout(() => {
        setLoadingState(prev => (prev === 'SEARCHING' ? 'ANALYZING' : prev));
    }, 1500);

    try {
      // Use the new TruthGuard analysis function
      // IMAGE type falls back to SMS_TEXT since backend uses Gemini (no image support via this path)
      const effectiveInput = inputType === 'IMAGE' ? (input || '[screenshot]') : input;
      const effectiveType = inputType === 'IMAGE' ? 'SMS_TEXT' : inputType;
      const result = await analyzeTruthGuard(effectiveInput, effectiveType, language, false);

      setAnalysis(result);
      setLoadingState('COMPLETED');
    } catch (err) {
      console.error(err);

      // Handle specific API error codes — prefer errorCode from the body
      // (more specific than HTTP status), fall back to statusCode mapping.
      if (err instanceof APIError && err.errorCode === 'INVALID_INPUT') {
        setError(t.error.badRequest);
        setLoadingState('ERROR');
        return;
      }

      // Keep the consumer safety path usable when AI or external verification
      // is unavailable. This is explicitly labelled as local, unverified
      // screening so it cannot be confused with completed evidence checks.
      const fallback = buildLocalSafetyFallback(
        inputType === 'IMAGE' ? (input || '[screenshot]') : input,
        inputType === 'IMAGE' ? 'SMS_TEXT' : inputType,
        language,
      );
      setAnalysis(fallback);
      setLoadingState('COMPLETED');

    }
  };


  return (
    <div className={`vf-app ${isSeniorMode ? 'senior-mode text-xl' : ''}`}>
      <OptionalAnalytics />

      {/* Consumer header */}
      <header className="vf-header">
        <div className={`vf-container vf-header-inner ${isSeniorMode ? 'min-h-[76px]' : ''}`}>
          <a href="/" className="vf-brand" onClick={(event) => { event.preventDefault(); handleReset(); }}>
            <span className="vf-brand-mark">
              <BrandMark className={isSeniorMode ? 'w-6 h-6' : 'w-[21px] h-[21px]'} />
            </span>
            <span className="vf-brand-copy">
              <span className={`vf-brand-name ${isSeniorMode ? 'text-xl' : ''}`}>{t.appName}</span>
              <span className="vf-brand-subtitle">{landing.headerSubtitle}</span>
            </span>
          </a>
          <nav className="vf-product-nav vf-consumer-nav" aria-label="Product">
            <a className="is-active" href="/"><ShieldCheck size={14} />{language === 'zh-TW' ? '個人反詐' : language === 'vi' ? 'Chống lừa đảo' : 'Personal safety'}</a>
            <a href="/business/"><Building2 size={14} />{landing.businessLabel}<span>LAB</span></a>
          </nav>
          <div className="vf-header-actions">
            <button onClick={toggleSeniorMode} className={`vf-header-control ${isSeniorMode ? 'is-active' : ''}`} aria-pressed={isSeniorMode}>
              <Accessibility className={isSeniorMode ? 'w-5 h-5' : 'w-4 h-4'} />
              <span className="vf-control-label">{isSeniorMode ? t.seniorModeOn : t.seniorModeOff}</span>
            </button>
            <div className="relative" ref={langMenuRef}>
              <button onClick={() => setLangMenuOpen(prev => !prev)} className="vf-header-control" aria-expanded={langMenuOpen}>
                <Globe className={isSeniorMode ? 'w-5 h-5' : 'w-4 h-4'} />
                <span className="vf-control-label">{LANG_OPTIONS.find(o => o.code === language)?.label}</span>
                <ChevronDown className={`transition-transform duration-200 ${langMenuOpen ? 'rotate-180' : ''} w-3 h-3`} />
              </button>
              {langMenuOpen && (
                <div className="vf-language-menu">
                  {LANG_OPTIONS.map(({ code, label }) => (
                    <button key={code} onClick={() => { setLanguage(code); setLangMenuOpen(false); }} className={`vf-language-option ${language === code ? 'is-active' : ''}`}>
                      {label}{language === code && <span className="ml-auto text-crypto-accent">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="vf-container vf-main">
        {!analysis && loadingState === 'IDLE' && (
          <section className="vf-hero vf-consumer-hero">
            <div className="vf-hero-copy">
              <span className="vf-eyebrow">{landing.eyebrow}</span>
              <h1 className="vf-hero-title">{t.hero.title}<br /><strong>{t.hero.titleHighlight}</strong></h1>
              <p className={`vf-hero-description ${isSeniorMode ? 'text-xl' : ''}`}>{isSeniorMode ? t.hero.descriptionSenior : t.hero.description}</p>
              <div className="vf-boundary-note">
                <ShieldCheck className="w-5 h-5" />
                <div><strong>{landing.boundaryTitle}</strong><p>{landing.boundaryBody}</p></div>
              </div>
              {!isSeniorMode && (
                <button className="vf-senior-banner w-full" onClick={toggleSeniorMode}>
                  <span><strong>{landing.seniorTitle}</strong><span>{landing.seniorBody}</span></span>
                  <strong>{landing.seniorAction} →</strong>
                </button>
              )}
            </div>

            <div className="vf-sandbox-stack vf-consumer-stack">
              <SituationIntake language={language} value={situation} onChange={setSituation} isSeniorMode={isSeniorMode} />
              <div className="vf-inspection-tray" aria-hidden="true"><span>STEP 2</span><i /><span>PASTE</span><i /><span>CHECK</span></div>
              <SearchInput key={searchInputKey} onSearch={handleSearch} isLoading={false} language={language} isSeniorMode={isSeniorMode} />
            </div>

            {!isSeniorMode && (
              <div className="vf-capability-rail" aria-label="Anti-scam help flow">
                {landing.steps.map((item, index) => (
                  <div className="vf-capability-step" key={item.title}>
                    <span className="vf-capability-index">0{index + 1}</span>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {/* Loading State — 3-step progress indicator */}
        {(loadingState === 'SEARCHING' || loadingState === 'ANALYZING') && (() => {
          const steps = language === 'zh-TW'
            ? ['掃描網域與資料庫', 'AI 分析中', '產生報告']
            : language === 'vi'
            ? ['Quét tên miền', 'Phân tích AI', 'Tạo báo cáo']
            : ['Scanning domain & databases', 'AI analysis', 'Building report'];
          return (
            <div className={`vf-loading-card ${isSeniorMode ? 'p-10' : ''}`}>
              <div className="vf-pixel-loader" aria-hidden="true">
                {Array.from({ length: 9 }).map((_, index) => <span key={index} />)}
              </div>
              <h2 className={`vf-loading-title ${isSeniorMode ? 'text-2xl' : ''}`}>
                {loadingMessages[loadingMessageIndex]}
              </h2>
              <div className="vf-progress-list">
                {steps.map((label, i) => {
                  const stepNum = (i + 1) as 1 | 2 | 3;
                  const isActive = loadingStep === stepNum;
                  const isDone = loadingStep > stepNum;
                  return (
                    <div className={`vf-progress-row ${isDone ? 'is-done' : ''} ${isActive ? 'is-active' : ''}`} key={label}>
                      <span className="font-mono text-[9px]">0{stepNum}</span>
                      <span className={isSeniorMode ? 'text-lg' : ''}>{label}</span>
                      <span className="vf-progress-state">
                        {isDone ? 'done' : isActive ? 'running' : 'queued'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className={`mt-4 text-gray-500 ${isSeniorMode ? 'text-base' : 'text-[10px] font-mono'}`}>
                {isSeniorMode ? t.loading.waitSenior : t.loading.wait}
              </p>
            </div>
          );
        })()}

        {/* Error State */}
        {loadingState === 'ERROR' && (
          <div className={`vf-error-card ${
            isSeniorMode ? 'p-8' : 'p-6'
          }`}>
            <ShieldAlert className={`text-red-500 mx-auto mb-4 ${isSeniorMode ? 'w-16 h-16' : 'w-12 h-12'}`} />
            <h3 className={`font-bold text-red-400 mb-2 ${isSeniorMode ? 'text-2xl' : 'text-xl'}`}>
              {isSeniorMode ? t.error.titleSenior : t.error.title}
            </h3>
            <p className={`text-gray-400 ${isSeniorMode ? 'text-xl' : ''}`}>{error}</p>
            <div className={`flex flex-col sm:flex-row items-center justify-center gap-3 ${isSeniorMode ? 'mt-8' : 'mt-5'}`}>
              <button
                onClick={handleReset}
                className={`vf-header-control ${
                  isSeniorMode ? 'px-8 py-4 text-xl' : 'px-5 py-2.5 text-sm'
                }`}
              >
                <RotateCcw className={isSeniorMode ? 'w-6 h-6' : 'w-4 h-4'} />
                {language === 'zh-TW' ? '重新嘗試' : language === 'vi' ? 'Thử lại' : 'Try Again'}
              </button>
              {language === 'zh-TW' && (
                <a
                  href="tel:165"
                  className={`inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors ${
                    isSeniorMode ? 'px-8 py-4 text-xl' : 'px-5 py-2.5 text-sm'
                  }`}
                >
                  📞 {t.inline.call165Btn}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Results View */}
        {analysis && loadingState === 'COMPLETED' && (
          <div ref={resultsRef} className="vf-results">

            {/* Check Another — top of results, all screen sizes */}
            <div className="vf-results-toolbar">
              <button
                onClick={handleReset}
                className={`vf-back-button group ${
                  isSeniorMode ? 'text-lg' : 'text-sm'
                }`}
              >
                <ArrowLeft className={`transition-transform group-hover:-translate-x-0.5 ${isSeniorMode ? 'w-5 h-5' : 'w-4 h-4'}`} />
                {language === 'zh-TW' ? '再查一次' : language === 'vi' ? 'Kiểm tra lại' : 'Check another'}
              </button>
              <span className="vf-source-badge">
                {analysis.source === 'cache'
                  ? t.results.cachedResult
                  : analysis.source === 'local'
                    ? t.results.localScreening
                    : t.results.liveAnalysis}
              </span>
            </div>

            {analysis.degradation && analysis.degradation.level !== 'L0' && (
              <div className="mb-4">
                <DegradationBanner degradation={analysis.degradation} language={language} />
              </div>
            )}

            <VerdictSummary
              conclusion={analysis.conclusion}
              verdict={analysis.finalVerdict}
              language={language}
            />

            <PrimaryActions
              actions={analysis.primaryActions}
              officialRoute={analysis.officialRoute}
              language={language}
              onReport={() => setReportModalOpen(true)}
            />

            <SafetyAssistant
              key={`${analysis.lastAnalyzed}-${situation.stage}-${language}`}
              analysis={analysis}
              situation={situation}
              language={language}
            />

            <InterruptWarning
              scamProbability={analysis.scamProbability}
              verdict={analysis.verdict}
              seniorModeVerdict={isSeniorMode ? analysis.seniorModeVerdict : undefined}
              language={language}
              isSeniorMode={isSeniorMode}
              signals={analysis.riskSignals ?? []}
            />

            {analysis.agentVerification.status !== 'NOT_RUN' && (
              <AgentFindings
                agent={analysis.agentVerification}
                narrative={(analysis as any).agentNarrativeDescription}
                language={language}
              />
            )}

            {(analysis as any).cofactsResult && (
              <CofactsFindings
                cofacts={(analysis as any).cofactsResult}
                language={language}
              />
            )}

            <LossRiskPanel
              scamProbability={analysis.scamProbability}
              likelyLosses={analysis.likelyLosses}
              language={language}
              isSeniorMode={isSeniorMode}
            />

            {!isSeniorMode && analysis.riskSignals && analysis.riskSignals.length > 0 && (
              <>
                <TacticCards
                  signals={analysis.riskSignals}
                  language={language}
                  isSeniorMode={false}
                />

                <RiskSignals
                  signals={analysis.riskSignals}
                  language={language}
                  isSeniorMode={false}
                />

                <ScamScriptBreakdown
                  signals={analysis.riskSignals}
                  scamProbability={analysis.scamProbability}
                  language={language}
                  isSeniorMode={false}
                />
              </>
            )}

            <RescueMode
              scamProbability={analysis.scamProbability}
              language={language}
              isSeniorMode={isSeniorMode}
            />

            {!isSeniorMode && (
              <>
                <OfficialVerification
                  officialRoute={analysis.officialRoute}
                  language={language}
                />

                <EvidencePack
                  analysis={analysis}
                  language={language}
                  isSeniorMode={false}
                />

                {analysis.history && analysis.history.length > 0 && (
                  <div className="mb-6">
                    <HistoryTimeline
                      events={analysis.history}
                      title={t.results.trackRecord}
                      language={language}
                    />
                  </div>
                )}
              </>
            )}

            {analysis.suggestedActions && analysis.suggestedActions.length > 0 && !isSeniorMode && (
              <ActionGuidance
                actions={analysis.suggestedActions}
                scamProbability={analysis.scamProbability}
                language={language}
                isSeniorMode={isSeniorMode}
                onReport={() => setReportModalOpen(true)}
              />
            )}

            {/* ── Below the fold: analysis detail + trust meter (non-senior) ── */}
            {!isSeniorMode && (
              <div className="mb-6 space-y-4">
                {analysis.bioSummary && (
                  <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                    <p className="text-gray-300 leading-relaxed text-sm">{analysis.bioSummary}</p>
                    {analysis.source === 'cache' && analysis.cachedAt && (
                    <div className="mt-3">
                      <span className="text-xs text-blue-400 bg-blue-900/20 border border-blue-800 px-2 py-0.5 rounded">
                        {t.results.cachedAgo.replace('{time}', (() => {
                          const ageMs = Date.now() - analysis.cachedAt!;
                          const ageMinutes = Math.round(ageMs / 1000 / 60);
                          return ageMinutes < 60 ? `${ageMinutes}m` : `${Math.round(ageMinutes / 60)}h`;
                        })())}
                      </span>
                    </div>
                  )}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.credibilityStrengths && analysis.credibilityStrengths.length > 0 && (
                    <div className="bg-crypto-card p-4 rounded-xl border border-gray-800">
                      <h4 className="text-sm font-semibold text-crypto-success mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        {t.results.credibilityFactors}
                      </h4>
                      <ul className="space-y-2">
                        {analysis.credibilityStrengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                            <CheckCircle2 className="w-3 h-3 text-crypto-success mt-1 flex-shrink-0" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysis.riskFactors && analysis.riskFactors.length > 0 && (
                    <div className="bg-crypto-card p-4 rounded-xl border border-gray-800">
                      <h4 className="text-sm font-semibold text-orange-500 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {t.results.risksAndCriticisms}
                      </h4>
                      <ul className="space-y-2">
                        {analysis.riskFactors.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                            <AlertTriangle className="w-3 h-3 text-orange-500 mt-1 flex-shrink-0" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Trust meter — demoted to bottom */}
            {!isSeniorMode && (
              <div className="mb-6">
                <TrustMeter score={analysis.trustScore} language={language} />
              </div>
            )}

            {/* Feedback row */}
            <div className={`vf-feedback mb-6 flex flex-col items-center gap-3 py-5 border-t ${isSeniorMode ? 'text-lg' : 'text-sm'}`}>
              {feedbackGiven === null ? (
                <>
                  <p className="text-gray-500">
                    {language === 'zh-TW' ? '這次分析對你有幫助嗎？' : language === 'vi' ? 'Phân tích này có hữu ích không?' : 'Was this analysis helpful?'}
                  </p>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setFeedbackGiven('up')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 hover:border-green-500/60 hover:bg-green-900/20 hover:text-green-400 text-gray-400 transition-all ${isSeniorMode ? 'text-base px-6 py-3' : ''}`}
                    >
                      <ThumbsUp className={isSeniorMode ? 'w-5 h-5' : 'w-4 h-4'} />
                      {language === 'zh-TW' ? '有幫助' : language === 'vi' ? 'Có ích' : 'Helpful'}
                    </button>
                    <button
                      onClick={() => setFeedbackGiven('down')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 hover:border-red-500/60 hover:bg-red-900/20 hover:text-red-400 text-gray-400 transition-all ${isSeniorMode ? 'text-base px-6 py-3' : ''}`}
                    >
                      <ThumbsDown className={isSeniorMode ? 'w-5 h-5' : 'w-4 h-4'} />
                      {language === 'zh-TW' ? '需要改善' : language === 'vi' ? 'Cần cải thiện' : 'Needs work'}
                    </button>
                  </div>
                </>
              ) : (
                <p className={`text-gray-400 ${isSeniorMode ? 'text-lg' : 'text-sm'}`}>
                  {feedbackGiven === 'up'
                    ? (language === 'zh-TW' ? '✅ 謝謝你的回饋！' : language === 'vi' ? '✅ Cảm ơn phản hồi của bạn!' : '✅ Thanks for your feedback!')
                    : (language === 'zh-TW' ? '✅ 收到，我們會持續改善。' : language === 'vi' ? '✅ Đã nhận, chúng tôi sẽ cải thiện.' : '✅ Noted, we\'ll keep improving.')}
                </p>
              )}
            </div>

            {/* Gemini link */}
            <a
              href="https://gemini.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="mb-10 flex items-center gap-3 p-3 bg-crypto-accent/5 border border-crypto-accent/20 rounded-lg hover:bg-crypto-accent/10 active:bg-crypto-accent/15 transition-colors group"
            >
              <Sparkles className="w-4 h-4 text-crypto-accent flex-shrink-0" />
              <span className={`text-gray-300 group-hover:text-gray-200 transition-colors ${isSeniorMode ? 'text-lg' : 'text-sm'}`}>
                {t.guidance.advancedInfo}
              </span>
              <ExternalLink className="w-4 h-4 text-crypto-accent flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity ml-auto" />
            </a>

          </div>
        )}
      </main>

      {/* Sticky "Check Another" — mobile fab */}
      {analysis && (
        <div className="vf-mobile-reset fixed bottom-6 right-6 z-40 md:hidden">
          <button
            onClick={handleReset}
            className="vf-submit px-5 py-3 rounded-full shadow-lg font-bold flex items-center gap-2"
          >
            <Search size={18} /> {t.search.newSearch}
          </button>
        </div>
      )}

      {/* 165 Report Modal */}
      {reportModalOpen && analysis && (
        <ReportModal
          analysis={analysis}
          language={language}
          onClose={() => setReportModalOpen(false)}
        />
      )}

      {/* Footer: Free API Acknowledgments */}
      <footer className="vf-footer">
        <div className="vf-container vf-footer-inner">
          <p className="m-0 font-mono uppercase tracking-[0.12em]">
            {language === 'zh-TW' ? '感謝以下免費服務的支持' : 'Powered by free & open services'}
          </p>
          <div className="vf-footer-services">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>ScamSniffer Scam Database</span>
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>VirusTotal</span>
            </span>
            <span className="text-gray-700">·</span>
            <a
              href="https://cofacts.tw"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-gray-300 transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Cofacts {language === 'zh-TW' ? '真的假的' : ''}</span>
            </a>
            <span className="text-gray-700">·</span>
            <a
              href="https://ifandonlyif.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-gray-300 transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>ifandonlyif.io</span>
            </a>
            <span className="text-gray-700">·</span>
            <a
              href="https://github.com/TokimiSpace/verifyfirst"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-gray-300 transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Open source</span>
            </a>
            <span className="text-gray-700">·</span>
            <a href="/business/" className="flex items-center gap-1 hover:text-gray-300 transition-colors"><Building2 className="w-3 h-3" /><span>{landing.businessLabel}</span></a>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default App;
