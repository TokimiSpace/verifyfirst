import React from 'react';
import { ShieldAlert, PhoneCall } from 'lucide-react';
import { Language, RiskSignal } from '../types';

interface InterruptWarningProps {
  scamProbability: number;
  verdict?: string;
  seniorModeVerdict?: string;
  language?: Language;
  isSeniorMode?: boolean;
  signals?: RiskSignal[];
}

const SIGNAL_SHORT: Record<string, { en: string; 'zh-TW': string; vi: string }> = {
  GUARANTEED_RETURNS:      { en: 'Guaranteed returns', 'zh-TW': '保證獲利', vi: 'Lợi nhuận đảm bảo' },
  PRESSURE_TACTICS:        { en: 'Urgency / pressure', 'zh-TW': '催促施壓', vi: 'Áp lực cấp bách' },
  IMPERSONATION:           { en: 'Impersonation', 'zh-TW': '假冒身份', vi: 'Mạo danh' },
  PHISHING_URL:            { en: 'Phishing link', 'zh-TW': '釣魚連結', vi: 'Liên kết lừa đảo' },
  TYPOSQUATTING:           { en: 'Fake domain', 'zh-TW': '假冒網域', vi: 'Tên miền giả' },
  KNOWN_SCAM:              { en: 'Known scam', 'zh-TW': '已知詐騙', vi: 'Lừa đảo đã biết' },
  SUSPICIOUS_PAYMENT:      { en: 'Suspicious payment', 'zh-TW': '可疑付款要求', vi: 'Thanh toán đáng ngờ' },
  CELEBRITY_IMPERSONATION: { en: 'Celebrity scam', 'zh-TW': '假冒名人', vi: 'Mạo danh người nổi tiếng' },
  PONZI_SIGNS:             { en: 'Ponzi / MLM', 'zh-TW': '龐氏傳銷', vi: 'Ponzi/MLM' },
  INSUFFICIENT_DATA:       { en: 'Insufficient data', 'zh-TW': '資料不足', vi: 'Dữ liệu không đủ' },
  RUG_PULL_HISTORY:        { en: 'Rug pull history', 'zh-TW': '捲款跑路紀錄', vi: 'Lịch sử lừa đảo' },
  SCAM_ALLEGATION:         { en: 'Scam reports', 'zh-TW': '多起詐騙舉報', vi: 'Báo cáo lừa đảo' },
  BOT_ACTIVITY:            { en: 'Bot activity', 'zh-TW': '機器人活動', vi: 'Hoạt động bot' },
  UNKNOWN:                 { en: 'Unknown risk', 'zh-TW': '未知風險', vi: 'Rủi ro chưa biết' },
};

const T = {
  en: {
    highTitle: '🚨 Stop — Read Before You Act',
    medTitle: '⚠️ Caution — Verify Before Proceeding',
    lowTitle: '✅ Looks Safe',
    highHuman: "We know you may feel rushed — but pause for a moment. Don't follow the other party's script.",
    medHuman: 'Some risk signals found. Take one minute to verify before doing anything.',
    lowHuman: 'No major risk signals detected. Stay alert if anything feels off.',
    topFlags: 'Top risk signals:',
    stopLabel: '⛔ Stop',
    leaveLabel: '🚪 Leave',
    verifyLabel: '✅ Verify',
    stopItems: [
      'Do NOT send money, gift cards, or crypto',
      'Do NOT click any links from this source',
      'Do NOT share personal info, passwords, or OTP codes',
    ],
    leaveItems: [
      'Step away from the conversation now',
      'Close this chat or hang up the call',
      'Take a breath — urgency is a manipulation tactic',
    ],
    verifyItems: [
      'Use only official contact info you find yourself',
      'Legitimate institutions never pressure or rush you',
      'Keep control of your accounts and funds',
    ],
    call165: '📞 Call 165 Anti-Fraud Hotline',
    tapToCall: 'Tap to call immediately — free 24h hotline',
  },
  'zh-TW': {
    highTitle: '🚨 先停下來——再看這裡',
    medTitle: '⚠️ 先暫停——確認後再行動',
    lowTitle: '✅ 目前看起來安全',
    highHuman: '我知道你現在可能很急——但請先暫停一下。先不要再照對方的流程走。',
    medHuman: '偵測到部分風險訊號。採取任何行動前，先花一分鐘確認。',
    lowHuman: '未偵測到重大風險訊號。若有任何感覺不對勁的地方，請再次確認。',
    topFlags: '主要風險訊號：',
    stopLabel: '⛔ 先停止',
    leaveLabel: '🚪 先離開',
    verifyLabel: '✅ 先驗證',
    stopItems: [
      '先不要匯款、轉加密貨幣或購買禮物卡',
      '先不要點擊對方提供的任何連結',
      '先不要提供個資、密碼或驗證碼（OTP）',
    ],
    leaveItems: [
      '先退出這個對話或掛掉電話',
      '離開對方設定的節奏和時間壓力',
      '冷靜一下——催促本身就是一種操控手法',
    ],
    verifyItems: [
      '只用你自己查到的官方電話或網址',
      '正規機構不會催促你、逼你做決定',
      '先保住資金、帳號與個資的控制權',
    ],
    call165: '📞 撥打 165 反詐騙專線',
    tapToCall: '點擊立即撥打——免費 24 小時',
  },
  vi: {
    highTitle: '🚨 DỪNG LẠI — Đọc trước khi hành động',
    medTitle: '⚠️ CẨN THẬN — Xác minh trước khi tiếp tục',
    lowTitle: '✅ Có vẻ an toàn',
    highHuman: 'Chúng tôi biết bạn có thể đang vội — nhưng hãy dừng lại. Đừng làm theo kịch bản của họ.',
    medHuman: 'Một số tín hiệu cảnh báo đã được tìm thấy. Hãy dành một phút để xác minh trước.',
    lowHuman: 'Không phát hiện tín hiệu rủi ro lớn. Hãy cảnh giác nếu có gì đó bất thường.',
    topFlags: 'Tín hiệu rủi ro chính:',
    stopLabel: '⛔ Dừng',
    leaveLabel: '🚪 Rời đi',
    verifyLabel: '✅ Xác minh',
    stopItems: [
      'KHÔNG gửi tiền, thẻ quà tặng, hoặc tiền điện tử',
      'KHÔNG nhấp vào bất kỳ liên kết nào từ nguồn này',
      'KHÔNG chia sẻ thông tin cá nhân, mật khẩu, hoặc OTP',
    ],
    leaveItems: [
      'Rút lui khỏi cuộc trò chuyện ngay bây giờ',
      'Đóng cuộc trò chuyện hoặc cúp máy',
      'Hít thở — sự cấp bách là chiến thuật thao túng',
    ],
    verifyItems: [
      'Chỉ dùng thông tin liên lạc chính thức bạn tự tìm',
      'Tổ chức hợp pháp không bao giờ thúc giục hoặc áp lực bạn',
      'Giữ quyền kiểm soát tài khoản và tài sản của bạn',
    ],
    call165: '📞 Gọi đường dây chống lừa đảo',
    tapToCall: 'Nhấn để gọi ngay — miễn phí 24h',
  },
};

const InterruptWarning: React.FC<InterruptWarningProps> = ({
  scamProbability,
  verdict,
  seniorModeVerdict,
  language = 'en',
  isSeniorMode = false,
  signals = [],
}) => {
  const t = T[language as keyof typeof T] ?? T.en;
  const isHighRisk = scamProbability >= 70;
  const isMediumRisk = scamProbability >= 40 && scamProbability < 70;
  const showCTA = isHighRisk || isMediumRisk;

  // Top 3 signals by severity
  const topSignals = [...signals]
    .sort((a, b) => {
      const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      return (order[a.level as keyof typeof order] ?? 2) - (order[b.level as keyof typeof order] ?? 2);
    })
    .slice(0, 3);

  const getShortLabel = (type: string) => {
    const entry = SIGNAL_SHORT[type] ?? SIGNAL_SHORT.UNKNOWN;
    return entry[language as keyof typeof entry] ?? entry.en;
  };

  const headerBg = isHighRisk
    ? 'bg-red-950/70 border-red-600'
    : isMediumRisk
    ? 'bg-yellow-950/50 border-yellow-600'
    : 'bg-green-950/40 border-green-700';

  const accentColor = isHighRisk ? 'text-red-300' : isMediumRisk ? 'text-yellow-300' : 'text-green-300';

  const displayVerdict = isSeniorMode ? (seniorModeVerdict ?? verdict) : verdict;
  const humanCopy = isHighRisk ? t.highHuman : isMediumRisk ? t.medHuman : t.lowHuman;
  const riskClass = isHighRisk ? 'is-high' : isMediumRisk ? 'is-medium' : 'is-low';

  return (
    <div className={`vf-interrupt ${riskClass} border-2 rounded-2xl overflow-hidden mb-5 ${headerBg}`}>
      {/* ── Header: verdict + human copy + score badge ── */}
      <div className={`vf-interrupt-header px-5 py-5 ${isHighRisk ? 'bg-red-900/30' : isMediumRisk ? 'bg-yellow-900/20' : 'bg-green-900/15'}`}>
        <div className="flex items-start gap-3">
          <ShieldAlert className={`flex-shrink-0 mt-0.5 ${isSeniorMode ? 'w-10 h-10' : 'w-7 h-7'} ${accentColor}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className={`font-bold leading-tight ${accentColor} ${isSeniorMode ? 'text-3xl' : 'text-2xl'}`}>
                {isHighRisk ? t.highTitle : isMediumRisk ? t.medTitle : t.lowTitle}
              </h2>
              <span className={`flex-shrink-0 px-2.5 py-0.5 rounded-full font-bold text-sm ${
                isHighRisk
                  ? 'bg-red-500 text-white animate-pulse'
                  : isMediumRisk
                  ? 'bg-yellow-500 text-black'
                  : 'bg-green-500 text-white'
              }`}>
                {scamProbability}%
              </span>
            </div>

            {/* Human-sounding copy */}
            <p className={`text-gray-200 leading-snug ${isSeniorMode ? 'text-xl' : 'text-sm'}`}>
              {humanCopy}
            </p>

            {/* Verdict from AI */}
            {displayVerdict && (
              <p className={`mt-2 font-semibold text-white/90 italic ${isSeniorMode ? 'text-2xl' : 'text-sm'}`}>
                "{displayVerdict}"
              </p>
            )}

            {/* Top 3 red-flag pills — first-screen summary */}
            {topSignals.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <span className={`text-gray-400 ${isSeniorMode ? 'text-base' : 'text-xs'}`}>{t.topFlags}</span>
                {topSignals.map((s, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium border ${isSeniorMode ? 'text-base' : 'text-xs'} ${
                      s.level === 'CRITICAL'
                        ? 'bg-red-900/50 border-red-700 text-red-300'
                        : s.level === 'WARNING'
                        ? 'bg-orange-900/40 border-orange-700 text-orange-300'
                        : 'bg-blue-900/30 border-blue-700 text-blue-300'
                    }`}
                  >
                    {s.level === 'CRITICAL' ? '🔴' : s.level === 'WARNING' ? '🟠' : '🔵'}
                    {getShortLabel(s.type)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 3-Layer CTA: Stop / Leave / Verify ── */}
      {showCTA && (
        <div className="vf-interrupt-grid grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-800/40">
          {/* Layer 1: Stop */}
          <div className={`vf-stop bg-red-950/50 ${isSeniorMode ? 'p-5' : 'p-4'}`}>
            <div className={`font-bold text-red-400 mb-3 ${isSeniorMode ? 'text-xl' : 'text-sm'}`}>
              {t.stopLabel}
            </div>
            <ul className="space-y-2">
              {t.stopItems.map((item, i) => (
                <li key={i} className={`flex items-start gap-2 text-red-200 ${isSeniorMode ? 'text-lg' : 'text-sm'}`}>
                  <span className="flex-shrink-0 mt-0.5 select-none">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Layer 2: Leave */}
          <div className={`vf-leave bg-orange-950/40 ${isSeniorMode ? 'p-5' : 'p-4'}`}>
            <div className={`font-bold text-orange-400 mb-3 ${isSeniorMode ? 'text-xl' : 'text-sm'}`}>
              {t.leaveLabel}
            </div>
            <ul className="space-y-2">
              {t.leaveItems.map((item, i) => (
                <li key={i} className={`flex items-start gap-2 text-orange-200 ${isSeniorMode ? 'text-lg' : 'text-sm'}`}>
                  <span className="flex-shrink-0 mt-0.5 select-none">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Layer 3: Verify */}
          <div className={`vf-verify bg-blue-950/40 ${isSeniorMode ? 'p-5' : 'p-4'}`}>
            <div className={`font-bold text-blue-400 mb-3 ${isSeniorMode ? 'text-xl' : 'text-sm'}`}>
              {t.verifyLabel}
            </div>
            <ul className="space-y-2">
              {t.verifyItems.map((item, i) => (
                <li key={i} className={`flex items-start gap-2 text-blue-200 ${isSeniorMode ? 'text-lg' : 'text-sm'}`}>
                  <span className="flex-shrink-0 mt-0.5 select-none">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── 165 CTA: zh-TW high-risk only ── */}
      {isHighRisk && language === 'zh-TW' && (
        <div className="vf-hotline px-5 py-5 bg-red-900/25 border-t border-red-800/60 text-center">
          <p className={`text-gray-300 mb-3 ${isSeniorMode ? 'text-xl' : 'text-xs'}`}>{t.tapToCall}</p>
          <a
            href="tel:165"
            className={`inline-flex items-center gap-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold rounded-2xl shadow-lg transition-colors ${
              isSeniorMode ? 'px-12 py-5 text-3xl' : 'px-8 py-4 text-xl'
            }`}
          >
            <PhoneCall className={isSeniorMode ? 'w-10 h-10' : 'w-6 h-6'} />
            {t.call165}
          </a>
        </div>
      )}
    </div>
  );
};

export default InterruptWarning;
