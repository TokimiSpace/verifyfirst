import React from 'react';
import { Banknote, Link2, MessageCircleWarning, Send, Smartphone } from 'lucide-react';
import { Language } from '../../types';

export type ConsumerExposureStage = 'RECEIVED' | 'OPENED' | 'SHARED' | 'PAID';
export type ConsumerContactChannel = 'LINE' | 'SMS' | 'PHONE' | 'SOCIAL' | 'OTHER';

export interface ConsumerSituation {
  stage: ConsumerExposureStage;
  channel: ConsumerContactChannel;
}

interface SituationIntakeProps {
  language: Language;
  value: ConsumerSituation;
  onChange: (value: ConsumerSituation) => void;
  isSeniorMode?: boolean;
}

const COPY = {
  'zh-TW': {
    step: '步驟 1／2',
    title: '你目前做到哪一步？',
    body: '這會改變後續建議。請選最接近的狀況，不需要填姓名或帳號。',
    channel: '對方從哪裡聯絡你？',
    stages: {
      RECEIVED: ['只收到內容', '還沒點擊或回覆'],
      OPENED: ['已點開連結', '但沒有輸入資料'],
      SHARED: ['已提供資料', '包含密碼、卡號或 OTP'],
      PAID: ['已付款／轉帳', '需要優先止付與求助'],
    },
    channels: { LINE: 'LINE', SMS: '簡訊', PHONE: '電話', SOCIAL: '社群', OTHER: '其他' },
  },
  en: {
    step: 'Step 1 of 2',
    title: 'How far did this go?',
    body: 'This changes the next steps. Choose the closest situation; no name or account number is needed.',
    channel: 'How did they contact you?',
    stages: {
      RECEIVED: ['Received only', 'No click or reply yet'],
      OPENED: ['Opened the link', 'No information entered'],
      SHARED: ['Shared information', 'Password, card, or OTP included'],
      PAID: ['Paid or transferred', 'Stop payment and get help first'],
    },
    channels: { LINE: 'LINE', SMS: 'SMS', PHONE: 'Call', SOCIAL: 'Social', OTHER: 'Other' },
  },
  vi: {
    step: 'Bước 1/2',
    title: 'Bạn đã thực hiện đến bước nào?',
    body: 'Thông tin này sẽ thay đổi hướng dẫn tiếp theo. Không cần nhập tên hay số tài khoản.',
    channel: 'Họ liên hệ với bạn qua đâu?',
    stages: {
      RECEIVED: ['Chỉ mới nhận', 'Chưa nhấp hay trả lời'],
      OPENED: ['Đã mở liên kết', 'Chưa nhập thông tin'],
      SHARED: ['Đã cung cấp dữ liệu', 'Gồm mật khẩu, thẻ hoặc OTP'],
      PAID: ['Đã thanh toán', 'Ưu tiên chặn tiền và cầu cứu'],
    },
    channels: { LINE: 'LINE', SMS: 'SMS', PHONE: 'Điện thoại', SOCIAL: 'Mạng xã hội', OTHER: 'Khác' },
  },
} as const;

const STAGES: ConsumerExposureStage[] = ['RECEIVED', 'OPENED', 'SHARED', 'PAID'];
const CHANNELS: ConsumerContactChannel[] = ['LINE', 'SMS', 'PHONE', 'SOCIAL', 'OTHER'];
const STAGE_ICONS = [MessageCircleWarning, Link2, Smartphone, Banknote];

const SituationIntake: React.FC<SituationIntakeProps> = ({ language, value, onChange, isSeniorMode = false }) => {
  const t = COPY[language];
  return (
    <section className={`vf-situation-intake ${isSeniorMode ? 'is-senior' : ''}`} aria-labelledby="situation-title">
      <div className="vf-situation-head">
        <span>{t.step}</span>
        <div>
          <h2 id="situation-title">{t.title}</h2>
          <p>{t.body}</p>
        </div>
      </div>
      <div className="vf-stage-grid" role="group" aria-label={t.title}>
        {STAGES.map((stage, index) => {
          const Icon = STAGE_ICONS[index];
          const [title, description] = t.stages[stage];
          return (
            <button
              key={stage}
              type="button"
              className={value.stage === stage ? 'is-active' : ''}
              aria-pressed={value.stage === stage}
              onClick={() => onChange({ ...value, stage })}
            >
              <Icon size={17} />
              <span><strong>{title}</strong><small>{description}</small></span>
            </button>
          );
        })}
      </div>
      <div className="vf-channel-row">
        <span>{t.channel}</span>
        <div role="group" aria-label={t.channel}>
          {CHANNELS.map(channel => (
            <button
              key={channel}
              type="button"
              className={value.channel === channel ? 'is-active' : ''}
              aria-pressed={value.channel === channel}
              onClick={() => onChange({ ...value, channel })}
            >
              {t.channels[channel]}
            </button>
          ))}
        </div>
      </div>
      <div className="vf-intake-next"><Send size={13} />{language === 'zh-TW' ? '接著貼上內容，讓我們一起判斷' : language === 'vi' ? 'Tiếp theo, dán nội dung để cùng kiểm tra' : 'Next, paste the content so we can check it together'}</div>
    </section>
  );
};

export default SituationIntake;
