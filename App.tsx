import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { TruthGuardAnalysis, LoadingState, Language, InputType } from './types';
import { analyzeTruthGuard, APIError } from './services/geminiService';
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
import { ShieldAlert, Search, Globe, CheckCircle2, AlertTriangle, Sparkles, ExternalLink, Accessibility, ChevronDown, ThumbsUp, ThumbsDown, RotateCcw, ArrowLeft } from 'lucide-react';

// UI Text dictionary for all static text
const UI_TEXT = {
  en: {
    appName: 'VerifyFirst',
    appNameHighlight: ' AI',
    poweredBy: 'Powered by tokimi & Gemini',
    seniorMode: 'Senior Mode',
    seniorModeOn: '👴 Senior Mode ON',
    seniorModeOff: '👴 Senior Mode',
    seniorModeDesc: 'Larger text · Simpler results',
    hero: {
      title: 'Verify First,',
      titleHighlight: 'Trust Later',
      subtitle: 'First-step safety verification engine',
      description: 'Paste suspicious content here. We verify where it leads, what it asks you to do, what the risk is, and what the safest next step should be.',
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
    appNameHighlight: ' AI',
    poweredBy: '由 tokimi 及 Gemini 提供支援',
    seniorMode: '長輩模式',
    seniorModeOn: '👴 長輩模式 開啟中',
    seniorModeOff: '👴 長輩模式',
    seniorModeDesc: '大字版・適合長者使用',
    hero: {
      title: '先驗證，',
      titleHighlight: '再相信',
      subtitle: '第一步安全驗證引擎',
      description: '把可疑內容貼進來，我們先幫你安全走一遍，告訴你它會把你帶去哪裡、用了什麼手法、風險是什麼、正規入口在哪裡、現在最安全的下一步是什麼。',
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
    appNameHighlight: ' AI',
    poweredBy: 'Được cung cấp bởi tokimi & Gemini',
    seniorMode: 'Chế độ cao tuổi',
    seniorModeOn: '👴 Chế độ cao tuổi BẬT',
    seniorModeOff: '👴 Chế độ cao tuổi',
    seniorModeDesc: 'Chữ lớn · Dành cho người cao tuổi',
    hero: {
      title: 'Xác minh trước,',
      titleHighlight: 'Tin tưởng sau',
      subtitle: 'Công cụ xác minh an toàn bước đầu',
      description: 'Dán nội dung đáng ngờ vào đây. Hệ thống sẽ kiểm tra nó dẫn bạn đi đâu, dùng thủ thuật gì, rủi ro là gì và bước tiếp theo an toàn nhất.',
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

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('zh-TW');
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
      if (err instanceof APIError) {
        // L5 (total outage) takes priority over the raw errorCode text
        if (err.degradation?.level === 'L5') {
          setError(t.error.totalOutage);
        } else {
          switch (err.errorCode) {
            case 'LLM_QUOTA':
              setError(t.error.llmQuota);
              break;
            case 'LLM_FAILED':
              setError(t.error.serviceConfig);
              break;
            case 'LOCAL_RATE_LIMIT':
              setError(t.error.tooManyRequests);
              break;
            case 'INVALID_INPUT':
              setError(t.error.badRequest);
              break;
            default:
              // Fall back to HTTP status when no errorCode
              if (err.statusCode === 429) setError(t.error.tooManyRequests);
              else if (err.statusCode === 404) setError(t.error.notFound);
              else if (err.statusCode === 400) setError(t.error.badRequest);
              else setError(isSeniorMode ? t.error.defaultMessageSenior : t.error.defaultMessage);
          }
        }
      } else {
        setError(isSeniorMode ? t.error.defaultMessageSenior : t.error.defaultMessage);
      }

      setLoadingState('ERROR');
    }
  };


  // Senior mode styles
  const seniorModeStyles = isSeniorMode ? {
    container: 'text-xl',
    heading: 'text-3xl md:text-4xl',
    text: 'text-xl',
  } : {
    container: '',
    heading: 'text-4xl md:text-6xl',
    text: 'text-lg',
  };

  return (
    <div className={`min-h-screen bg-crypto-dark text-crypto-text font-sans selection:bg-crypto-accent selection:text-crypto-dark pb-20 ${seniorModeStyles.container} ${isSeniorMode ? 'senior-mode' : ''}`}>
      <Analytics />

      {/* Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-md bg-crypto-dark/80 border-b border-gray-800 ${isSeniorMode ? 'py-2' : ''}`}>
        <div className={`container mx-auto px-4 flex items-center justify-between ${isSeniorMode ? 'h-20' : 'h-16'}`}>
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <ShieldAlert className={`text-crypto-accent ${isSeniorMode ? 'w-8 h-8' : 'w-6 h-6'}`} />
            <span className={`font-display font-bold tracking-tight text-white ${isSeniorMode ? 'text-2xl' : 'text-xl'}`}>
              {t.appName}<span className="text-crypto-accent">{t.appNameHighlight}</span>
            </span>
          </a>
          <div className="flex items-center gap-3">
            {/* Senior Mode Toggle */}
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={toggleSeniorMode}
                className={`flex items-center gap-1.5 rounded-xl border-2 font-bold transition-all ${
                  isSeniorMode
                    ? 'bg-green-600 hover:bg-green-500 border-green-400 text-white shadow-lg shadow-green-900/40 px-4 py-2 text-base'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/60 text-amber-300 hover:border-amber-400 px-3 py-1.5 text-sm'
                }`}
              >
                <Accessibility className={isSeniorMode ? 'w-5 h-5' : 'w-4 h-4'} />
                <span>{isSeniorMode ? t.seniorModeOn : t.seniorModeOff}</span>
              </button>
              {!isSeniorMode && (
                <span className="text-xs text-amber-500/70 hidden sm:block whitespace-nowrap">
                  {(t as typeof UI_TEXT['zh-TW']).seniorModeDesc}
                </span>
              )}
            </div>
            {/* Language Dropdown */}
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setLangMenuOpen(prev => !prev)}
                className={`flex items-center gap-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors font-medium ${
                  isSeniorMode ? 'px-4 py-2 text-base' : 'px-3 py-1.5 text-sm'
                }`}
              >
                <Globe className={isSeniorMode ? 'w-5 h-5 text-crypto-accent' : 'w-4 h-4 text-crypto-accent'} />
                <span className="text-white">{LANG_OPTIONS.find(o => o.code === language)?.label}</span>
                <ChevronDown className={`text-gray-400 transition-transform duration-200 ${langMenuOpen ? 'rotate-180' : ''} ${isSeniorMode ? 'w-4 h-4' : 'w-3 h-3'}`} />
              </button>
              {langMenuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden min-w-[90px]">
                  {LANG_OPTIONS.map(({ code, label }) => (
                    <button
                      key={code}
                      onClick={() => { setLanguage(code); setLangMenuOpen(false); }}
                      className={`w-full text-left px-4 py-2 flex items-center gap-2 transition-colors ${
                        isSeniorMode ? 'text-base' : 'text-sm'
                      } ${
                        language === code
                          ? 'bg-crypto-accent/10 text-crypto-accent font-semibold'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {label}
                      {language === code && <span className="ml-auto text-crypto-accent text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 font-mono hidden md:block">
              {t.poweredBy}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`container mx-auto px-4 ${isSeniorMode ? 'mt-8' : 'mt-12'}`}>

        {/* Senior mode banner — shown on landing page when NOT in senior mode */}
        {!isSeniorMode && !analysis && loadingState === 'IDLE' && (
          <div className="max-w-2xl mx-auto mb-4 mt-8">
            <button
              onClick={toggleSeniorMode}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/30 hover:bg-amber-500/15 hover:border-amber-500/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl select-none">👴</span>
                <div className="text-left">
                  <p className={`font-semibold text-amber-300 ${seniorModeStyles.text}`}>
                    {language === 'zh-TW' ? '給長輩用：開啟大字版' : language === 'vi' ? 'Dành cho người cao tuổi: Bật chữ lớn' : 'For seniors: Switch to large text mode'}
                  </p>
                  <p className="text-xs text-amber-500/70 mt-0.5">
                    {language === 'zh-TW' ? '字體更大・結果更簡單・適合長者閱讀' : language === 'vi' ? 'Chữ lớn hơn · Đơn giản hơn · Dễ đọc hơn' : 'Bigger text · Simpler results · Easier to read'}
                  </p>
                </div>
              </div>
              <span className="text-amber-400 text-sm font-medium group-hover:underline whitespace-nowrap">
                {language === 'zh-TW' ? '開啟 →' : language === 'vi' ? 'Bật →' : 'Turn on →'}
              </span>
            </button>
          </div>
        )}

        {/* Hero / Search */}
        <div className={`transition-all duration-500 ease-in-out ${analysis ? 'mt-0' : isSeniorMode ? 'mt-6' : 'mt-14'}`}>
          {/* Hero text — hidden once results are shown */}
          {!analysis && (
            <div className={`text-center ${isSeniorMode ? 'mb-8' : 'mb-8'}`}>
              <h1 className={`font-display font-bold text-white mb-3 ${seniorModeStyles.heading}`}>
                {t.hero.title} <span className="text-transparent bg-clip-text bg-gradient-to-r from-crypto-accent to-blue-500">{t.hero.titleHighlight}</span>
              </h1>

              {!isSeniorMode && (
                <p className="text-gray-500 mx-auto max-w-xl text-base mb-5">
                  {t.hero.description}
                </p>
              )}

              {/* Feature capability pills */}
              {!isSeniorMode && (
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {(language === 'zh-TW' ? [
                    { icon: '📩', label: '詐騙簡訊' },
                    { icon: '🔗', label: '可疑網址' },
                    { icon: '📸', label: '截圖 OCR' },
                    { icon: '📄', label: '.txt 檔案' },
                  ] : language === 'vi' ? [
                    { icon: '📩', label: 'Tin nhắn lừa đảo' },
                    { icon: '🔗', label: 'Liên kết đáng ngờ' },
                    { icon: '📸', label: 'Ảnh chụp màn hình' },
                    { icon: '📄', label: 'File .txt' },
                  ] : [
                    { icon: '📩', label: 'Scam SMS' },
                    { icon: '🔗', label: 'Suspicious URL' },
                    { icon: '📸', label: 'Screenshot OCR' },
                    { icon: '📄', label: '.txt File' },
                  ]).map(({ icon, label }) => (
                    <span key={label} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-xs text-gray-400">
                      <span>{icon}</span>
                      <span>{label}</span>
                    </span>
                  ))}
                </div>
              )}

              {isSeniorMode && (
                <p className={`text-gray-400 mx-auto max-w-xl ${seniorModeStyles.text}`}>
                  {t.hero.descriptionSenior}
                </p>
              )}
            </div>
          )}

          <SearchInput
            key={searchInputKey}
            onSearch={handleSearch}
            isLoading={loadingState === 'SEARCHING' || loadingState === 'ANALYZING'}
            language={language}
            isSeniorMode={isSeniorMode}
          />
        </div>

        {/* Loading State — 3-step progress indicator */}
        {(loadingState === 'SEARCHING' || loadingState === 'ANALYZING') && (() => {
          const steps = language === 'zh-TW'
            ? ['掃描網域與資料庫', 'AI 分析中', '產生報告']
            : language === 'vi'
            ? ['Quét tên miền', 'Phân tích AI', 'Tạo báo cáo']
            : ['Scanning domain & databases', 'AI analysis', 'Building report'];
          return (
            <div className={`flex flex-col items-center justify-center ${isSeniorMode ? 'mt-16' : 'mt-16'}`}>
              {/* Spinner */}
              <div className={`border-4 border-crypto-accent border-t-transparent rounded-full animate-spin mb-6 ${
                isSeniorMode ? 'w-16 h-16' : 'w-12 h-12'
              }`} />
              {/* Step indicators */}
              <div className="flex items-center gap-2 mb-5">
                {steps.map((label, i) => {
                  const stepNum = (i + 1) as 1 | 2 | 3;
                  const isActive = loadingStep === stepNum;
                  const isDone = loadingStep > stepNum;
                  return (
                    <React.Fragment key={label}>
                      <div className="flex flex-col items-center gap-1">
                        <div className={`rounded-full flex items-center justify-center font-bold transition-all duration-500 ${
                          isSeniorMode ? 'w-10 h-10 text-base' : 'w-7 h-7 text-xs'
                        } ${
                          isDone
                            ? 'bg-crypto-accent text-crypto-dark'
                            : isActive
                            ? 'bg-crypto-accent/20 border-2 border-crypto-accent text-crypto-accent animate-pulse'
                            : 'bg-gray-800 border border-gray-700 text-gray-600'
                        }`}>
                          {isDone ? '✓' : stepNum}
                        </div>
                        <span className={`transition-colors duration-300 ${
                          isSeniorMode ? 'text-sm' : 'text-xs'
                        } ${
                          isDone || isActive ? 'text-gray-300' : 'text-gray-600'
                        }`}>{label}</span>
                      </div>
                      {i < steps.length - 1 && (
                        <div className={`h-px w-8 transition-colors duration-500 ${
                          loadingStep > stepNum ? 'bg-crypto-accent' : 'bg-gray-700'
                        }`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
              {/* Current message */}
              <p className={`font-display text-crypto-accent animate-pulse text-center ${isSeniorMode ? 'text-2xl' : 'text-lg'}`}>
                {loadingMessages[loadingMessageIndex]}
              </p>
              <p className={`text-gray-600 mt-1 ${isSeniorMode ? 'text-base' : 'text-xs'}`}>
                {isSeniorMode ? t.loading.waitSenior : t.loading.wait}
              </p>
            </div>
          );
        })()}

        {/* Error State */}
        {loadingState === 'ERROR' && (
          <div className={`max-w-2xl mx-auto mt-10 bg-red-900/20 border border-red-900 rounded-xl text-center ${
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
                className={`inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 font-semibold rounded-xl transition-colors ${
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
          <div ref={resultsRef} className="animate-fade-in-up max-w-3xl mx-auto">

            {/* Check Another — top of results, all screen sizes */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handleReset}
                className={`inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors group ${
                  isSeniorMode ? 'text-lg' : 'text-sm'
                }`}
              >
                <ArrowLeft className={`transition-transform group-hover:-translate-x-0.5 ${isSeniorMode ? 'w-5 h-5' : 'w-4 h-4'}`} />
                {language === 'zh-TW' ? '← 再查一次' : language === 'vi' ? '← Kiểm tra lại' : '← Check Another'}
              </button>
              {analysis.source === 'cache' ? (
                <span className="text-xs text-blue-400 bg-blue-900/20 border border-blue-800 px-2 py-0.5 rounded">
                  {t.results.cachedResult}
                </span>
              ) : (
                <span className="text-xs text-green-400 bg-green-900/20 border border-green-800 px-2 py-0.5 rounded">
                  {t.results.liveAnalysis}
                </span>
              )}
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

            <InterruptWarning
              scamProbability={analysis.scamProbability}
              verdict={analysis.verdict}
              seniorModeVerdict={isSeniorMode ? analysis.seniorModeVerdict : undefined}
              language={language}
              isSeniorMode={isSeniorMode}
              signals={analysis.riskSignals ?? []}
            />

            <AgentFindings
              agent={analysis.agentVerification}
              narrative={(analysis as any).agentNarrativeDescription}
              language={language}
            />

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
            <div className={`mb-6 flex flex-col items-center gap-3 py-4 border-t border-gray-800 ${isSeniorMode ? 'text-lg' : 'text-sm'}`}>
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
        <div className="fixed bottom-6 right-6 z-40 md:hidden">
          <button
            onClick={handleReset}
            className="bg-crypto-accent text-crypto-dark px-5 py-3 rounded-full shadow-lg font-bold flex items-center gap-2"
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
      <footer className="mt-16 border-t border-gray-800 py-8 px-4">
        <div className="container mx-auto text-center">
          <p className="text-xs text-gray-600 mb-3 uppercase tracking-widest font-display">
            {language === 'zh-TW' ? '感謝以下免費服務的支持' : 'Powered by free & open services'}
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-crypto-accent" />
              <span>ScamSniffer Scam Database</span>
            </span>
            <span className="text-gray-700">·</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-crypto-accent" />
              <span>VirusTotal</span>
            </span>
            <span className="text-gray-700">·</span>
            <a
              href="https://cofacts.tw"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-gray-300 transition-colors"
            >
              <CheckCircle2 className="w-3 h-3 text-crypto-accent" />
              <span>Cofacts {language === 'zh-TW' ? '真的假的' : ''}</span>
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default App;
