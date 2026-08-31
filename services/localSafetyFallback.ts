import { InputType, Language, RiskSignal, TruthGuardAnalysis } from '../types';

const COPY = {
  'zh-TW': {
    localName: '本機安全初篩',
    conclusion: '外部查核暫時無法完成。以下只根據你貼上的文字辨識風險訊號，不是已查證結論；請先停止互動，並依照下方步驟處理。',
    noSignals: '目前只有有限資訊，無法確認內容真偽。請勿因此視為安全，改從自行找到的官方入口查證。',
    unknownRoute: '尚未完成官方入口查核',
    unknownReason: '外部查核服務目前不可用，請自行搜尋官方網站或撥打官方電話。',
    report: '整理內容並回報',
    reportDescription: '保留對話、網址與交易畫面，提供給 165、銀行或平台。',
    actions: {
      stop: '先停止互動，不要付款或提供更多資料',
      verify: '自行開啟官方網站或撥打官方電話交叉確認',
      preserve: '保留原始訊息、網址、帳號與時間截圖',
    },
    signals: {
      PRESSURE_TACTICS: '文字中出現要求立刻處理、限時或催促的語句。',
      PHISHING_URL: '內容含有尚未經外部服務查核的連結；不要直接登入或付款。',
      IMPERSONATION: '文字可能以銀行、政府、客服或熟人身分要求你採取行動。',
      SUSPICIOUS_PAYMENT: '文字涉及匯款、付款、保證金、解凍費或加密貨幣。',
      GUARANTEED_RETURNS: '文字出現保證獲利、穩賺或零風險等不合理承諾。',
      INSUFFICIENT_DATA: '外部資料庫與 AI 查核尚未完成，不能據此確認真偽。',
    },
  },
  en: {
    localName: 'On-device safety screening',
    conclusion: 'External verification is temporarily unavailable. The guidance below only identifies patterns in the text you pasted; it is not a verified conclusion. Stop interacting and follow the safety steps below.',
    noSignals: 'There is not enough verified information to judge this content. Do not treat it as safe; verify through an official channel you find independently.',
    unknownRoute: 'Official route not yet verified',
    unknownReason: 'External checks are unavailable. Find the official website or phone number independently.',
    report: 'Prepare and report the content',
    reportDescription: 'Keep the conversation, URL, account, and transaction screenshots for 165, your bank, or the platform.',
    actions: {
      stop: 'Stop interacting; do not pay or share more information',
      verify: 'Open the official site or call its official number independently',
      preserve: 'Keep the original message, URL, account, time, and screenshots',
    },
    signals: {
      PRESSURE_TACTICS: 'The text uses urgency, a deadline, or pressure to act immediately.',
      PHISHING_URL: 'The content includes a link that external services have not checked; do not log in or pay through it.',
      IMPERSONATION: 'The text may claim to be a bank, government agency, support team, or acquaintance.',
      SUSPICIOUS_PAYMENT: 'The text mentions a transfer, payment, deposit, release fee, or cryptocurrency.',
      GUARANTEED_RETURNS: 'The text promises guaranteed profit, certain returns, or zero risk.',
      INSUFFICIENT_DATA: 'External databases and AI checks did not complete, so authenticity remains unverified.',
    },
  },
  vi: {
    localName: 'Sàng lọc an toàn trên thiết bị',
    conclusion: 'Hiện chưa thể xác minh bên ngoài. Hướng dẫn dưới đây chỉ nhận diện mẫu rủi ro trong văn bản bạn đã dán, không phải kết luận đã xác minh. Hãy dừng tương tác và làm theo các bước an toàn.',
    noSignals: 'Chưa có đủ thông tin đã xác minh để đánh giá nội dung. Đừng xem đây là an toàn; hãy tự tìm kênh chính thức để kiểm tra.',
    unknownRoute: 'Chưa xác minh kênh chính thức',
    unknownReason: 'Kiểm tra bên ngoài hiện không khả dụng. Hãy tự tìm trang web hoặc số điện thoại chính thức.',
    report: 'Chuẩn bị và báo cáo nội dung',
    reportDescription: 'Giữ cuộc trò chuyện, URL, tài khoản và ảnh giao dịch để cung cấp cho 165, ngân hàng hoặc nền tảng.',
    actions: {
      stop: 'Dừng tương tác; không thanh toán hoặc cung cấp thêm dữ liệu',
      verify: 'Tự mở trang chính thức hoặc gọi số điện thoại chính thức',
      preserve: 'Giữ tin nhắn gốc, URL, tài khoản, thời gian và ảnh chụp',
    },
    signals: {
      PRESSURE_TACTICS: 'Văn bản tạo áp lực, giới hạn thời gian hoặc yêu cầu hành động ngay.',
      PHISHING_URL: 'Nội dung có liên kết chưa được dịch vụ bên ngoài kiểm tra; không đăng nhập hay thanh toán qua đó.',
      IMPERSONATION: 'Văn bản có thể tự xưng là ngân hàng, cơ quan nhà nước, hỗ trợ hoặc người quen.',
      SUSPICIOUS_PAYMENT: 'Văn bản đề cập chuyển tiền, thanh toán, tiền cọc, phí mở khóa hoặc tiền mã hóa.',
      GUARANTEED_RETURNS: 'Văn bản hứa lợi nhuận đảm bảo, chắc chắn có lời hoặc không có rủi ro.',
      INSUFFICIENT_DATA: 'Cơ sở dữ liệu bên ngoài và AI chưa kiểm tra xong nên chưa thể xác minh tính xác thực.',
    },
  },
} as const;

type SignalType = keyof typeof COPY['zh-TW']['signals'];

const RULES: Array<{ type: Exclude<SignalType, 'INSUFFICIENT_DATA'>; pattern: RegExp; level: RiskSignal['level']; weight: number }> = [
  { type: 'PRESSURE_TACTICS', pattern: /立刻|立即|馬上|限時|最後機會|逾期|異常|封鎖|act now|urgent|immediately|deadline|expire|khẩn|ngay|hết hạn|bất thường/i, level: 'WARNING', weight: 18 },
  { type: 'PHISHING_URL', pattern: /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|tw|io|co|xyz|top|site|vip)(?:\/|\b)/i, level: 'WARNING', weight: 20 },
  { type: 'IMPERSONATION', pattern: /銀行|警察|檢察官|政府|客服|金管會|健保|中華郵政|bank|police|government|support|prosecutor|ngân hàng|cảnh sát|chính phủ|hỗ trợ/i, level: 'WARNING', weight: 18 },
  { type: 'SUSPICIOUS_PAYMENT', pattern: /匯款|轉帳|付款|保證金|解凍費|手續費|虛擬幣|加密貨幣|gift card|transfer|payment|deposit|release fee|crypto|chuyển tiền|thanh toán|tiền cọc|phí/i, level: 'CRITICAL', weight: 28 },
  { type: 'GUARANTEED_RETURNS', pattern: /保證獲利|穩賺|零風險|翻倍|guaranteed (?:profit|return)|zero risk|double your|lợi nhuận đảm bảo|không rủi ro/i, level: 'CRITICAL', weight: 32 },
];

const extractDomain = (input: string): string | undefined => {
  const match = input.match(/https?:\/\/([^\s/]+)/i);
  return match?.[1]?.replace(/[),.;!?]+$/, '').toLowerCase();
};

export const buildLocalSafetyFallback = (
  input: string,
  inputType: InputType = 'SMS_TEXT',
  language: Language = 'zh-TW',
): TruthGuardAnalysis => {
  const t = COPY[language];
  const matched = RULES.filter(rule => rule.pattern.test(input));
  const riskSignals: RiskSignal[] = matched.map(rule => ({
    type: rule.type,
    evidence: t.signals[rule.type],
    level: rule.level,
  }));
  riskSignals.push({ type: 'INSUFFICIENT_DATA', evidence: t.signals.INSUFFICIENT_DATA, level: 'INFO' });

  const score = Math.min(92, 35 + matched.reduce((sum, rule) => sum + rule.weight, 0));
  const conclusion = matched.length > 0 ? t.conclusion : t.noSignals;
  const lastAnalyzed = new Date().toISOString();
  const domain = extractDomain(input);

  return {
    handle: 'local-safety-screening',
    displayName: domain || t.localName,
    bioSummary: conclusion,
    trustScore: 100 - score,
    verdict: conclusion,
    credibilityStrengths: [],
    riskFactors: riskSignals.map(signal => signal.evidence),
    history: [],
    lastAnalyzed,
    source: 'local',
    inputType,
    originalInput: input,
    riskSignals,
    suggestedActions: [
      { label: t.actions.stop, type: 'IGNORE', priority: 1 },
      { label: t.actions.verify, type: 'OFFICIAL_CHANNEL', priority: 2 },
      { label: t.actions.preserve, type: 'REPORT', priority: 3 },
    ],
    scamProbability: score,
    // Local rules can prioritize risk, but cannot prove that content is a scam.
    // Keep the verdict in the verification-required lane even at high risk.
    finalVerdict: 'C_SUSPICIOUS_NEEDS_VERIFICATION',
    conclusion,
    normalizedInput: { text: input, domain },
    primaryActions: [{
      label: t.report,
      kind: 'REPORT',
      emphasis: 'primary',
      description: t.reportDescription,
    }],
    agentVerification: {
      status: 'NOT_RUN',
      redirectChain: [],
      forms: [],
      ctaButtons: [],
      asksForLogin: false,
      asksForOtp: false,
      asksForPayment: false,
      asksForAppDownload: false,
      asksToAddChat: false,
      screenshots: [],
      riskObservations: [],
    },
    officialRoute: {
      status: 'OFFICIAL_UNKNOWN',
      label: t.unknownRoute,
      rationale: t.unknownReason,
      lane: 'UNVERIFIED',
    },
    likelyLosses: [],
    trustSummary: riskSignals.map(signal => ({
      label: signal.type,
      value: signal.evidence,
      lane: signal.type === 'INSUFFICIENT_DATA' ? 'UNVERIFIED' : 'OBSERVED',
    })),
    degradation: {
      level: 'L5',
      score: 100,
      services: ['AI / external verification'],
    },
  };
};
