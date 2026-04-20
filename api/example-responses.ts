// Short-circuit canned responses for the example chips in SearchInput.
// Users clicking these burn zero upstream quota (no Gemini / Safe Browsing /
// VirusTotal / agent-sandbox calls), and the scam content stays out of the
// frontend JS bundle so Safe Browsing crawlers can't index it on verify1st.tw.

import type { InputType, Language } from '../types';

type Lang = Language;

interface ExampleSpec {
  id: string;
  type: InputType;
  input: string;
  scamProbability: number;
  riskType: string;
  text: Record<Lang, {
    displayName: string;
    bioSummary: string;
    verdict: string;
    conclusion: string;
    evidence: string;
    credibilityStrengths: string[];
    riskFactors: string[];
  }>;
}

const SPECS: ExampleSpec[] = [
  {
    id: 'line_forward',
    type: 'SMS_TEXT',
    input: '朋友剛在 LINE 傳這個給我，說蝦皮訂單異常要我立刻更新資料：https://bit.ly/verify-shopee-tw',
    scamProbability: 88,
    riskType: 'PHISHING_URL',
    text: {
      en: {
        displayName: 'Shopee Impersonation (LINE Forward)',
        bioSummary: 'A forwarded LINE message claiming a Shopee order is at risk and asking the user to update their details on a shortened link.',
        verdict: 'Very likely a phishing scam impersonating Shopee.',
        conclusion: 'This looks like a classic Shopee phishing scam. The urgent "order abnormal" wording plus a short URL are common tactics — do not click the link. If you want to check your order, open the official Shopee app directly.',
        evidence: 'Uses urgency tactics ("immediately update") and a bit.ly short link that hides the real destination, which is a well-known Shopee impersonation pattern.',
        credibilityStrengths: [],
        riskFactors: [
          'Urgent wording pressuring the user to act immediately',
          'Shortened URL hiding the real destination',
          'Impersonates a well-known brand (Shopee)',
        ],
      },
      'zh-TW': {
        displayName: '蝦皮冒充詐騙（LINE 轉傳）',
        bioSummary: 'LINE 轉傳訊息，聲稱蝦皮訂單異常並要求點擊短網址更新資料。',
        verdict: '極可能是冒充蝦皮的釣魚詐騙。',
        conclusion: '這是典型的蝦皮釣魚詐騙。「訂單異常」的急迫用詞加上短網址是常見手法,請勿點擊連結。若要確認訂單,請直接打開官方蝦皮 App。',
        evidence: '使用急迫字眼(「立刻更新」)並用 bit.ly 短網址掩蓋真實目的地,是冒充蝦皮的常見模式。',
        credibilityStrengths: [],
        riskFactors: [
          '使用急迫字眼催促立即行動',
          '短網址隱藏真實目的地',
          '冒充知名品牌(蝦皮)',
        ],
      },
      vi: {
        displayName: 'Giả mạo Shopee (chuyển tiếp LINE)',
        bioSummary: 'Tin nhắn LINE chuyển tiếp tuyên bố đơn hàng Shopee có vấn đề và yêu cầu nhấp vào liên kết rút gọn để cập nhật.',
        verdict: 'Rất có thể là lừa đảo giả danh Shopee.',
        conclusion: 'Đây là lừa đảo phishing giả danh Shopee điển hình. Cách diễn đạt khẩn cấp cộng với liên kết rút gọn là chiêu trò thường gặp — không nhấp. Nếu muốn kiểm tra đơn hàng, hãy mở ứng dụng Shopee chính thức.',
        evidence: 'Sử dụng ngôn từ cấp bách ("cập nhật ngay") và liên kết bit.ly che giấu đích đến thực.',
        credibilityStrengths: [],
        riskFactors: [
          'Ngôn từ cấp bách gây áp lực hành động ngay',
          'Liên kết rút gọn che giấu đích đến',
          'Mạo danh thương hiệu nổi tiếng (Shopee)',
        ],
      },
    },
  },
  {
    id: 'facebook_ad',
    type: 'URL',
    input: 'https://bit.ly/tw-sale-event',
    scamProbability: 62,
    riskType: 'SUSPICIOUS_PAYMENT',
    text: {
      en: {
        displayName: 'Suspicious Facebook Ad Link',
        bioSummary: 'A shortened URL from a Facebook ad with no clear merchant identity.',
        verdict: 'Suspicious — proceed with caution.',
        conclusion: 'Short URLs from Facebook ads often lead to fake shopping sites. Without knowing the merchant, we cannot verify this is a legitimate sale. Search for the brand name on the official site before buying anything.',
        evidence: 'Bit.ly shortener masks the destination and there is no identifiable merchant name, which matches the pattern of many fake "flash sale" ads.',
        credibilityStrengths: [],
        riskFactors: [
          'Shortened URL with no brand context',
          'Common pattern for fake e-commerce ads',
          'Merchant identity cannot be verified',
        ],
      },
      'zh-TW': {
        displayName: '可疑的 Facebook 廣告連結',
        bioSummary: '來自 Facebook 廣告的短網址,沒有明確的商家身份。',
        verdict: '可疑 — 請謹慎處理。',
        conclusion: 'Facebook 廣告的短網址常導向假購物網站。在不知道商家是誰的情況下,我們無法確認這是否為合法特賣。購買前請先在品牌官網搜尋確認。',
        evidence: 'Bit.ly 短網址遮蔽了目的地,也沒有可辨識的商家名稱,符合許多假「快閃特賣」廣告的模式。',
        credibilityStrengths: [],
        riskFactors: [
          '短網址沒有品牌資訊',
          '假電商廣告常見模式',
          '無法驗證商家身份',
        ],
      },
      vi: {
        displayName: 'Liên kết quảng cáo Facebook đáng ngờ',
        bioSummary: 'URL rút gọn từ quảng cáo Facebook, không có danh tính người bán rõ ràng.',
        verdict: 'Đáng ngờ — hãy thận trọng.',
        conclusion: 'URL rút gọn từ quảng cáo Facebook thường dẫn đến trang mua sắm giả mạo. Không thể xác minh đây có phải khuyến mãi hợp pháp hay không. Hãy tìm thương hiệu trên trang chính thức trước khi mua.',
        evidence: 'Bit.ly che giấu đích đến và không có tên người bán nhận dạng được.',
        credibilityStrengths: [],
        riskFactors: [
          'URL rút gọn không có ngữ cảnh thương hiệu',
          'Mẫu phổ biến của quảng cáo thương mại điện tử giả',
          'Không thể xác minh danh tính người bán',
        ],
      },
    },
  },
  {
    id: 'phishing_sms',
    type: 'SMS_TEXT',
    input: '您的包裹無法投遞，請點擊更新地址：https://post-tw-delivery.net/verify',
    scamProbability: 92,
    riskType: 'PHISHING_URL',
    text: {
      en: {
        displayName: 'Parcel-Delivery Phishing SMS',
        bioSummary: 'An SMS claiming a parcel cannot be delivered and asking the user to update their address on an unofficial URL.',
        verdict: 'Almost certainly a phishing scam.',
        conclusion: 'This is a well-known parcel-delivery phishing scam. The real post office in Taiwan will never ask you to update an address via a link in an SMS. Do not click the link — call 165 if you already did.',
        evidence: 'The domain looks official but is not the real Chunghwa Post site (post.gov.tw). Combined with the vague "parcel undeliverable" wording, this matches thousands of reported phishing SMS cases.',
        credibilityStrengths: [],
        riskFactors: [
          'Domain mimics but is not the real postal service',
          'Classic "undeliverable parcel" phishing template',
          'Widely reported to 165 anti-fraud line',
        ],
      },
      'zh-TW': {
        displayName: '包裹投遞釣魚簡訊',
        bioSummary: '聲稱包裹無法投遞,要求用戶在非官方網址更新地址的簡訊。',
        verdict: '幾乎可以確定是釣魚詐騙。',
        conclusion: '這是眾所周知的包裹投遞釣魚詐騙。中華郵政絕不會透過簡訊連結要求您更新地址。請勿點擊連結 — 如果您已經點了,請立即撥打 165。',
        evidence: '網域看似官方但並非真正的中華郵政網站 (post.gov.tw)。加上模糊的「包裹無法投遞」用詞,符合已被回報的數千起釣魚簡訊案例。',
        credibilityStrengths: [],
        riskFactors: [
          '網域模仿但並非真正郵政服務',
          '經典的「包裹無法投遞」釣魚模板',
          '已廣泛被 165 反詐騙專線記錄',
        ],
      },
      vi: {
        displayName: 'SMS lừa đảo giao bưu kiện',
        bioSummary: 'SMS tuyên bố bưu kiện không thể giao và yêu cầu cập nhật địa chỉ trên URL không chính thức.',
        verdict: 'Gần như chắc chắn là lừa đảo phishing.',
        conclusion: 'Đây là lừa đảo phishing giao hàng bưu điện nổi tiếng. Bưu điện Đài Loan thật không bao giờ yêu cầu cập nhật địa chỉ qua liên kết SMS. Không nhấp — gọi 165 nếu bạn đã nhấp.',
        evidence: 'Tên miền bắt chước nhưng không phải trang Chunghwa Post thật (post.gov.tw).',
        credibilityStrengths: [],
        riskFactors: [
          'Tên miền bắt chước dịch vụ bưu chính thật',
          'Mẫu phishing "bưu kiện không giao được" cổ điển',
          'Được báo cáo rộng rãi tới đường dây chống lừa đảo 165',
        ],
      },
    },
  },
  {
    id: 'short_link',
    type: 'URL',
    input: 'https://reurl.cc/4g5Yx2',
    scamProbability: 55,
    riskType: 'INSUFFICIENT_DATA',
    text: {
      en: {
        displayName: 'Short URL (reurl.cc)',
        bioSummary: 'A shortened URL from reurl.cc with no context about the destination.',
        verdict: 'Unknown — verify the destination before visiting.',
        conclusion: 'Short URLs hide the real destination. Without knowing what website this leads to, we cannot judge it safe. Use a URL expander (like checkshorturl.com) to see where it goes before clicking.',
        evidence: 'reurl.cc is a legitimate Taiwanese shortener, but short URLs are often used to disguise phishing or scam destinations.',
        credibilityStrengths: [
          'reurl.cc itself is a legitimate Taiwan-based service',
        ],
        riskFactors: [
          'Destination unknown — could be anything',
          'Short URLs are commonly used to hide scams',
        ],
      },
      'zh-TW': {
        displayName: '短網址 (reurl.cc)',
        bioSummary: '來自 reurl.cc 的短網址,沒有關於目的地的資訊。',
        verdict: '未知 — 前往之前請先確認目的地。',
        conclusion: '短網址會隱藏真實目的地。在不知道此連結指向何處的情況下,我們無法判斷是否安全。點擊前,請使用網址展開工具(如 checkshorturl.com)查看它實際指向哪裡。',
        evidence: 'reurl.cc 本身是合法的台灣短網址服務,但短網址常被用來掩蓋釣魚或詐騙目的地。',
        credibilityStrengths: [
          'reurl.cc 本身是合法的台灣服務',
        ],
        riskFactors: [
          '目的地不明 — 可能是任何東西',
          '短網址常被用來掩蓋詐騙',
        ],
      },
      vi: {
        displayName: 'URL rút gọn (reurl.cc)',
        bioSummary: 'URL rút gọn từ reurl.cc không có ngữ cảnh về đích đến.',
        verdict: 'Chưa biết — xác minh đích đến trước khi truy cập.',
        conclusion: 'URL rút gọn che giấu đích đến thực. Chúng tôi không thể đánh giá là an toàn. Hãy dùng công cụ mở rộng URL (như checkshorturl.com) để xem nó dẫn đến đâu trước khi nhấp.',
        evidence: 'reurl.cc là dịch vụ rút gọn hợp pháp của Đài Loan, nhưng URL rút gọn thường bị lợi dụng.',
        credibilityStrengths: [
          'reurl.cc là dịch vụ hợp pháp của Đài Loan',
        ],
        riskFactors: [
          'Đích đến không xác định',
          'URL rút gọn thường được dùng để che giấu lừa đảo',
        ],
      },
    },
  },
];

function deriveVerdict(prob: number): 'A_MARKETING' | 'B_RISKY_MARKETING' | 'C_SUSPICIOUS_NEEDS_VERIFICATION' | 'D_HIGH_RISK_SCAM' {
  if (prob >= 75) return 'D_HIGH_RISK_SCAM';
  if (prob >= 45) return 'C_SUSPICIOUS_NEEDS_VERIFICATION';
  if (prob >= 25) return 'B_RISKY_MARKETING';
  return 'A_MARKETING';
}

function buildActions(prob: number, language: Lang) {
  const actions: any[] = [];
  if (prob >= 70) {
    actions.push({
      label: language === 'zh-TW' ? '📞 撥打 165 反詐騙專線' : language === 'vi' ? '📞 Gọi 165 đường dây chống lừa đảo' : '📞 Call 165 Anti-Fraud Hotline',
      actionUrl: 'tel:165',
      type: 'CALL_165',
      priority: 1,
    });
    actions.push({
      label: language === 'zh-TW' ? '🚫 封鎖此聯絡人' : language === 'vi' ? '🚫 Chặn liên hệ này' : '🚫 Block This Contact',
      type: 'BLOCK',
      priority: 2,
    });
  } else if (prob >= 40) {
    actions.push({
      label: language === 'zh-TW' ? '✅ 透過官方管道驗證' : language === 'vi' ? '✅ Xác minh qua kênh chính thức' : '✅ Verify via Official Channel',
      type: 'OFFICIAL_CHANNEL',
      priority: 1,
    });
  } else {
    actions.push({
      label: language === 'zh-TW' ? '✅ 看起來安全,但請保持警覺' : language === 'vi' ? '✅ Có vẻ an toàn, hãy cảnh giác' : '✅ Appears Safe, Stay Vigilant',
      type: 'VERIFY',
      priority: 1,
    });
  }
  return actions;
}

function buildResponse(spec: ExampleSpec, language: Lang): any {
  const t = spec.text[language];
  const prob = spec.scamProbability;
  const trustScore = 100 - prob;

  return {
    handle: '',
    displayName: t.displayName,
    bioSummary: t.bioSummary,
    identityStatus: 'UNKNOWN_ENTITY',
    trustScore,
    verdict: t.verdict,
    engagementQuality: 'ORGANIC',
    credibilityStrengths: t.credibilityStrengths,
    riskFactors: t.riskFactors,
    history: [],
    inputType: spec.type,
    originalInput: spec.input,
    normalizedInput: spec.type === 'URL'
      ? { url: spec.input, domain: (() => { try { return new URL(spec.input).hostname.replace(/^www\./, ''); } catch { return undefined; } })() }
      : { text: spec.input },
    scamProbability: prob,
    riskSignals: [{ type: spec.riskType, evidence: t.evidence, level: prob >= 70 ? 'CRITICAL' : prob >= 40 ? 'WARNING' : 'INFO' }],
    suggestedActions: buildActions(prob, language),
    seniorModeVerdict: prob >= 70
      ? (language === 'zh-TW' ? '⚠️ 這很可能是詐騙！請不要匯款或提供個人資料。建議撥打 165 諮詢。'
          : language === 'vi' ? '⚠️ Đây có khả năng là lừa đảo! Đừng chuyển tiền hoặc cung cấp thông tin cá nhân. Gọi 165.'
          : '⚠️ This is likely a SCAM! Do NOT send money or personal info. Call 165 for help.')
      : prob >= 40
      ? (language === 'zh-TW' ? '⚠️ 這有一些可疑跡象。請先向官方確認後再行動。'
          : language === 'vi' ? '⚠️ Có một số dấu hiệu đáng ngờ. Xác minh qua kênh chính thức trước.'
          : '⚠️ This has some suspicious signs. Please verify with official sources first.')
      : (language === 'zh-TW' ? '✅ 目前看起來還好,但請繼續保持警覺。'
          : language === 'vi' ? '✅ Trông ổn, nhưng hãy cảnh giác.'
          : '✅ Looks okay for now, but stay alert.'),
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
      label: '',
      rationale: '',
      lane: 'UNVERIFIED',
    },
    primaryActions: [],
    likelyLosses: [],
    trustSummary: [],
    groundedSearch: false,
    finalVerdict: deriveVerdict(prob),
    conclusion: t.conclusion,
    lastAnalyzed: new Date().toISOString(),
    source: 'example',
    degradation: { level: 'L0', score: 0, services: [] },
  };
}

const normalizedKey = (type: string, input: string) => `${type}:${input.trim()}`;

const EXAMPLE_KEYS: Set<string> = new Set(SPECS.map(s => normalizedKey(s.type, s.input)));

export function isExampleInput(input: string, type: InputType): boolean {
  return EXAMPLE_KEYS.has(normalizedKey(type, input));
}

export function getExampleResponse(input: string, type: InputType, language: string): any | null {
  const spec = SPECS.find(s => s.input === input.trim() && s.type === type);
  if (!spec) return null;
  const lang = (['en', 'zh-TW', 'vi'] as const).includes(language as Lang) ? (language as Lang) : 'en';
  return buildResponse(spec, lang);
}
