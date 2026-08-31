import React from 'react';
import { Language, ServiceDegradation } from '../types';

interface DegradationBannerProps {
  degradation?: ServiceDegradation;
  language?: Language;
}

const TEMPLATES: Record<Language, { l1: string; l2: string; l3: string; l4: string; l5: string }> = {
  en: {
    l1: '⚠️ {services} is currently unavailable. Results are still reliable.',
    l2: '⚠️ Several data sources unavailable ({services}). Analysis may be less complete than usual.',
    l3: '⚠️ Most external verification services are at capacity. AI analysis still works, but third-party cross-check was skipped this time.',
    l4: '⚠️ Verification is incomplete. Use the safety steps below, but do not treat this as a verified result.',
    l5: '⚠️ External and AI checks are unavailable. This page shows on-device pattern screening and safety guidance only — not a verified conclusion.',
  },
  'zh-TW': {
    l1: '⚠️ {services} 暫時無法使用，但分析結果仍然可靠。',
    l2: '⚠️ 多個資料來源暫時無法使用（{services}），分析可能不夠完整。',
    l3: '⚠️ 多項外部查核服務已達上限，AI 分析仍可使用，但本次跳過第三方交叉比對。',
    l4: '⚠️ 查核尚未完成。你仍可使用下方安全步驟，但不要把本次結果視為已查證結論。',
    l5: '⚠️ 外部與 AI 查核目前不可用。本頁僅顯示裝置端規則初篩與自救步驟，不是已查證結論。',
  },
  vi: {
    l1: '⚠️ {services} hiện không khả dụng. Kết quả vẫn đáng tin cậy.',
    l2: '⚠️ Nhiều nguồn dữ liệu không khả dụng ({services}). Phân tích có thể chưa đầy đủ.',
    l3: '⚠️ Hầu hết dịch vụ xác minh bên ngoài đã quá tải. AI phân tích vẫn hoạt động, nhưng lần này bỏ qua kiểm tra chéo.',
    l4: '⚠️ Việc xác minh chưa hoàn tất. Hãy dùng các bước an toàn bên dưới, nhưng đừng xem đây là kết quả đã xác minh.',
    l5: '⚠️ Kiểm tra bên ngoài và AI hiện không khả dụng. Trang này chỉ sàng lọc mẫu trên thiết bị và hướng dẫn an toàn, không phải kết luận đã xác minh.',
  },
};

const LEVEL_STYLES: Record<'L1' | 'L2' | 'L3' | 'L4' | 'L5', string> = {
  L1: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-200',
  L2: 'bg-orange-500/10 border-orange-500/40 text-orange-200',
  L3: 'bg-red-500/10 border-red-500/40 text-red-200',
  L4: 'bg-red-500/10 border-red-500/40 text-red-200',
  L5: 'bg-red-500/10 border-red-500/40 text-red-200',
};

export default function DegradationBanner({ degradation, language = 'en' }: DegradationBannerProps) {
  if (!degradation || degradation.level === 'L0') return null;

  const level = degradation.level as 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  const templates = TEMPLATES[language] ?? TEMPLATES.en;
  const serviceList = degradation.services.join(', ');
  const message = templates[level.toLowerCase() as 'l1' | 'l2' | 'l3' | 'l4' | 'l5'].replace('{services}', serviceList);

  return (
    <div
      role="status"
      className={`rounded-lg border px-4 py-3 text-sm ${LEVEL_STYLES[level]}`}
    >
      {message}
    </div>
  );
}
