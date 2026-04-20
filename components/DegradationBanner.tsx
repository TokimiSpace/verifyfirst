import React from 'react';
import { Language, ServiceDegradation } from '../types';

interface DegradationBannerProps {
  degradation?: ServiceDegradation;
  language?: Language;
}

const TEMPLATES: Record<Language, { l1: string; l2: string; l3: string }> = {
  en: {
    l1: '⚠️ {services} is currently unavailable. Results are still reliable.',
    l2: '⚠️ Several data sources unavailable ({services}). Analysis may be less complete than usual.',
    l3: '⚠️ Most external verification services are at capacity. AI analysis still works, but third-party cross-check was skipped this time.',
  },
  'zh-TW': {
    l1: '⚠️ {services} 暫時無法使用，但分析結果仍然可靠。',
    l2: '⚠️ 多個資料來源暫時無法使用（{services}），分析可能不夠完整。',
    l3: '⚠️ 多項外部查核服務已達上限，AI 分析仍可使用，但本次跳過第三方交叉比對。',
  },
  vi: {
    l1: '⚠️ {services} hiện không khả dụng. Kết quả vẫn đáng tin cậy.',
    l2: '⚠️ Nhiều nguồn dữ liệu không khả dụng ({services}). Phân tích có thể chưa đầy đủ.',
    l3: '⚠️ Hầu hết dịch vụ xác minh bên ngoài đã quá tải. AI phân tích vẫn hoạt động, nhưng lần này bỏ qua kiểm tra chéo.',
  },
};

const LEVEL_STYLES: Record<'L1' | 'L2' | 'L3', string> = {
  L1: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-200',
  L2: 'bg-orange-500/10 border-orange-500/40 text-orange-200',
  L3: 'bg-red-500/10 border-red-500/40 text-red-200',
};

export default function DegradationBanner({ degradation, language = 'en' }: DegradationBannerProps) {
  if (!degradation || degradation.level === 'L0') return null;

  // L4 and L5 are surfaced as full-page errors, not banners — skip here.
  if (degradation.level === 'L4' || degradation.level === 'L5') return null;

  const level = degradation.level as 'L1' | 'L2' | 'L3';
  const templates = TEMPLATES[language] ?? TEMPLATES.en;
  const serviceList = degradation.services.join(', ');
  const message = templates[level.toLowerCase() as 'l1' | 'l2' | 'l3'].replace('{services}', serviceList);

  return (
    <div
      role="status"
      className={`rounded-lg border px-4 py-3 text-sm ${LEVEL_STYLES[level]}`}
    >
      {message}
    </div>
  );
}
