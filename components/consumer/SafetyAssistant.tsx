import React, { FormEvent, useMemo, useState } from 'react';
import { Bot, ExternalLink, PhoneCall, Send, ShieldAlert, UserRound } from 'lucide-react';
import { Language, TruthGuardAnalysis } from '../../types';
import { ConsumerExposureStage, ConsumerSituation } from './SituationIntake';

interface SafetyAssistantProps {
  analysis: TruthGuardAnalysis;
  situation: ConsumerSituation;
  language: Language;
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
}

type HelpTopic = 'NEXT' | 'OPENED' | 'SHARED' | 'PAID' | 'REPORT';

const COPY = {
  'zh-TW': {
    eyebrow: '安全對話助手 · 本機引導', title: '接下來該怎麼做？',
    body: '助手會依查核結果與你選擇的狀況整理下一步。對話只留在這個畫面，不會取代銀行、165 或警方的正式處置。',
    noSecrets: '請勿輸入密碼、完整卡號、OTP、身分證字號或真實金鑰。',
    placeholder: '例如：我剛剛已經輸入信用卡資料…', send: '送出', user: '你', assistant: 'VerifyFirst',
    urgent: '你選擇了已付款／轉帳，請先處理止付，不要等待聊天回覆。',
    call165: '撥打 165', call110: '緊急時撥 110',
    quick: { NEXT: '我現在先做什麼？', OPENED: '我已點開連結', SHARED: '我已提供個資／OTP', PAID: '我已經匯款', REPORT: '幫我整理報案重點' },
  },
  en: {
    eyebrow: 'Safety chat · on-device guidance', title: 'What should I do next?',
    body: 'The assistant uses the check result and your selected situation to organize next steps. This conversation stays on this screen and does not replace your bank, 165, or police.',
    noSecrets: 'Do not enter passwords, full card numbers, OTPs, ID numbers, or real keys.',
    placeholder: 'For example: I already entered my card details…', send: 'Send', user: 'You', assistant: 'VerifyFirst',
    urgent: 'You selected paid or transferred. Start the stop-payment steps now; do not wait for chat.',
    call165: 'Call 165', call110: 'Call 110 if urgent',
    quick: { NEXT: 'What do I do first?', OPENED: 'I opened the link', SHARED: 'I shared data / OTP', PAID: 'I sent money', REPORT: 'Prepare a report summary' },
  },
  vi: {
    eyebrow: 'Trợ lý an toàn · hướng dẫn trên thiết bị', title: 'Tiếp theo tôi nên làm gì?',
    body: 'Trợ lý dùng kết quả kiểm tra và tình trạng bạn chọn để sắp xếp các bước. Cuộc trò chuyện chỉ ở màn hình này và không thay thế ngân hàng, 165 hoặc cảnh sát.',
    noSecrets: 'Không nhập mật khẩu, số thẻ đầy đủ, OTP, số giấy tờ hoặc khóa thật.',
    placeholder: 'Ví dụ: Tôi đã nhập thông tin thẻ…', send: 'Gửi', user: 'Bạn', assistant: 'VerifyFirst',
    urgent: 'Bạn đã chọn là đã thanh toán. Hãy bắt đầu chặn giao dịch ngay, đừng chờ câu trả lời trò chuyện.',
    call165: 'Gọi 165', call110: 'Khẩn cấp gọi 110',
    quick: { NEXT: 'Tôi nên làm gì trước?', OPENED: 'Tôi đã mở liên kết', SHARED: 'Tôi đã cung cấp dữ liệu / OTP', PAID: 'Tôi đã chuyển tiền', REPORT: 'Chuẩn bị nội dung báo cáo' },
  },
} as const;

const stageTopic = (stage: ConsumerExposureStage): HelpTopic => ({
  RECEIVED: 'NEXT', OPENED: 'OPENED', SHARED: 'SHARED', PAID: 'PAID',
}[stage] as HelpTopic);

const answerFor = (topic: HelpTopic, analysis: TruthGuardAnalysis, language: Language): string => {
  const risk = analysis.scamProbability;
  const source = analysis.normalizedInput?.domain || analysis.displayName || (language === 'zh-TW' ? '這則內容' : language === 'vi' ? 'nội dung này' : 'this content');
  const isHigh = risk >= 70 || analysis.finalVerdict === 'D_HIGH_RISK_SCAM';

  if (language === 'zh-TW') {
    const answers: Record<HelpTopic, string> = {
      NEXT: isHigh
        ? `先停止與「${source}」互動，不要點連結、不要回覆，也不要付款。保留對話與交易畫面截圖，接著撥 165 核對；若對方冒充機構，請自己搜尋官方電話回撥。`
        : `目前風險判定為 ${risk}／100。先不要從訊息內的連結登入或付款，改用你自己收藏或搜尋到的官方入口再次確認；資訊不足時仍可撥 165。`,
      OPENED: '先關閉頁面，不要下載檔案或允許通知。若曾下載 App 或描述檔，請先斷開網路、移除它並檢查裝置；若只開啟而未輸入資料，先不要恐慌，保留網址與截圖即可。',
      SHARED: '立即更改「已提供資料所屬服務」的密碼，從官方入口登出其他裝置並開啟雙因素驗證。若提供過 OTP、卡號或網銀資料，立刻聯絡銀行停卡或凍結；不要再把任何驗證碼告訴對方。',
      PAID: '立刻聯絡銀行或支付業者要求止付、圈存或凍結，準備交易時間、金額、收款帳號與對話截圖；同時撥 165。若資金仍在移動或有人身安全疑慮，直接撥 110。不要再匯「保證金」或「解凍費」。',
      REPORT: `報案時可依序說明：1）接觸管道；2）對方自稱身分；3）網址或帳號；4）你做過的操作；5）交易時間、金額與收款資料；6）目前保留的截圖。查核摘要：${analysis.conclusion}`,
    };
    return answers[topic];
  }

  if (language === 'vi') {
    const answers: Record<HelpTopic, string> = {
      NEXT: isHigh
        ? `Dừng liên hệ với “${source}”, không nhấp liên kết, trả lời hay thanh toán. Giữ ảnh chụp cuộc trò chuyện và gọi 165; nếu họ giả danh tổ chức, tự tìm số chính thức để gọi lại.`
        : `Mức rủi ro hiện tại là ${risk}/100. Không đăng nhập hay thanh toán từ liên kết trong tin nhắn; hãy tự mở kênh chính thức để kiểm tra lại.`,
      OPENED: 'Đóng trang, không tải tệp hay cho phép thông báo. Nếu đã cài ứng dụng hoặc hồ sơ cấu hình, hãy ngắt mạng, gỡ bỏ và kiểm tra thiết bị. Nếu chỉ mở mà chưa nhập dữ liệu, hãy giữ URL và ảnh chụp.',
      SHARED: 'Đổi ngay mật khẩu của dịch vụ liên quan qua trang chính thức, đăng xuất thiết bị khác và bật xác thực hai lớp. Nếu đã đưa OTP, số thẻ hoặc ngân hàng điện tử, liên hệ ngân hàng để khóa ngay.',
      PAID: 'Liên hệ ngân hàng hoặc dịch vụ thanh toán ngay để yêu cầu chặn hoặc đóng băng giao dịch. Chuẩn bị thời gian, số tiền, tài khoản nhận và ảnh chụp; đồng thời gọi 165. Trường hợp khẩn cấp gọi 110.',
      REPORT: `Khi báo cáo, hãy nêu: 1) kênh liên hệ; 2) danh tính họ tự xưng; 3) URL hoặc tài khoản; 4) thao tác bạn đã làm; 5) thời gian, số tiền và người nhận; 6) ảnh chụp đã giữ. Tóm tắt kiểm tra: ${analysis.conclusion}`,
    };
    return answers[topic];
  }

  const answers: Record<HelpTopic, string> = {
    NEXT: isHigh
      ? `Stop interacting with “${source}”. Do not click, reply, or pay. Keep screenshots of the conversation and transaction, then call 165. If they claim to be an institution, find its official number yourself.`
      : `The current risk reading is ${risk}/100. Do not log in or pay through a message link. Open the official service independently and confirm there; call 165 if evidence remains unclear.`,
    OPENED: 'Close the page and do not download files or allow notifications. If you installed an app or configuration profile, disconnect, remove it, and check the device. If you only opened the page, keep the URL and screenshots.',
    SHARED: 'Change the affected service password from its official site, sign out other sessions, and enable two-factor authentication. If you shared an OTP, card, or banking details, contact the bank immediately to block access.',
    PAID: 'Contact the bank or payment provider immediately to stop or freeze the transaction. Prepare the time, amount, recipient, and screenshots, and call 165. Call 110 for an active emergency. Do not send a recovery or release fee.',
    REPORT: `Report these points in order: 1) contact channel; 2) claimed identity; 3) URL or account; 4) what you did; 5) time, amount, and recipient; 6) saved screenshots. Check summary: ${analysis.conclusion}`,
  };
  return answers[topic];
};

const detectTopic = (message: string): HelpTopic => {
  const text = message.toLowerCase();
  if (/匯|轉帳|付款|錢|銀行|paid|pay|transfer|money|bank|chuyển|thanh toán|ngân hàng/.test(text)) return 'PAID';
  if (/otp|密碼|卡號|個資|資料|password|card|data|mật khẩu|thẻ|dữ liệu/.test(text)) return 'SHARED';
  if (/點|打開|下載|安裝|click|open|download|install|nhấp|mở|tải|cài/.test(text)) return 'OPENED';
  if (/報案|165|警察|report|police|báo|cảnh sát/.test(text)) return 'REPORT';
  return 'NEXT';
};

const SafetyAssistant: React.FC<SafetyAssistantProps> = ({ analysis, situation, language }) => {
  const t = COPY[language];
  const firstAnswer = useMemo(() => answerFor(stageTopic(situation.stage), analysis, language), [analysis, language, situation.stage]);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'initial', role: 'assistant', text: firstAnswer }]);
  const [input, setInput] = useState('');
  const addTopic = (topic: HelpTopic, userText?: string) => {
    const now = Date.now().toString(36);
    setMessages(current => [
      ...current,
      { id: `u-${now}`, role: 'user', text: userText || t.quick[topic] },
      { id: `a-${now}`, role: 'assistant', text: answerFor(topic, analysis, language) },
    ].slice(-10));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim().slice(0, 500);
    if (!message) return;
    setInput('');
    addTopic(detectTopic(message), message);
  };

  return (
    <section className="vf-safety-assistant" aria-labelledby="safety-chat-title">
      <div className="vf-assistant-head">
        <span className="vf-assistant-avatar"><Bot size={20} /></span>
        <div><span className="vf-agent-kicker">{t.eyebrow}</span><h2 id="safety-chat-title">{t.title}</h2><p>{t.body}</p></div>
      </div>
      {situation.stage === 'PAID' && <div className="vf-assistant-urgent"><ShieldAlert size={18} /><strong>{t.urgent}</strong><a href="tel:165"><PhoneCall size={15} />{t.call165}</a></div>}
      <div className="vf-chat-log" role="log" aria-live="polite">
        {messages.map(message => (
          <article key={message.id} className={`is-${message.role}`}>
            <span>{message.role === 'assistant' ? <Bot size={15} /> : <UserRound size={15} />}</span>
            <div><small>{message.role === 'assistant' ? t.assistant : t.user}</small><p>{message.text}</p></div>
          </article>
        ))}
      </div>
      <div className="vf-chat-quick" aria-label={t.title}>
        {(Object.keys(t.quick) as HelpTopic[]).map(topic => <button type="button" key={topic} onClick={() => addTopic(topic)}>{t.quick[topic]}</button>)}
      </div>
      <form className="vf-chat-form" onSubmit={submit}>
        <label htmlFor="safety-chat-input">{t.noSecrets}</label>
        <div><input id="safety-chat-input" value={input} onChange={event => setInput(event.target.value)} maxLength={500} placeholder={t.placeholder} /><button type="submit" disabled={!input.trim()}><Send size={16} /><span>{t.send}</span></button></div>
      </form>
      <div className="vf-chat-escalation"><a href="tel:165"><PhoneCall size={15} />{t.call165}</a><a href="tel:110">{t.call110}<ExternalLink size={13} /></a></div>
    </section>
  );
};

export default SafetyAssistant;
