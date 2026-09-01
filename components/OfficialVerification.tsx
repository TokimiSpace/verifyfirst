import React from 'react';
import { ExternalLink, ShieldCheck, ShieldQuestion, TriangleAlert } from 'lucide-react';
import { Language, OfficialRouteResolution } from '../types';

interface OfficialVerificationProps {
  officialRoute: OfficialRouteResolution;
  language?: Language;
}

const COPY = {
  en: {
    title: 'Official route resolution',
    confirmed: 'Confirmed official entry',
    candidate: 'Possible official route — verify independently',
    unknown: 'Could not confidently confirm an official route',
  },
  'zh-TW': {
    title: '官方入口解析',
    confirmed: '已確認官方入口',
    candidate: '可能的官方入口，仍需獨立核對',
    unknown: '無法高可信確認官方入口',
  },
  vi: {
    title: 'Đường dẫn chính thức',
    confirmed: 'Đã xác nhận lối vào chính thức',
    candidate: 'Có thể là lối vào chính thức — cần kiểm tra độc lập',
    unknown: 'Không thể xác nhận chắc chắn lối vào chính thức',
  },
};

const OfficialVerification: React.FC<OfficialVerificationProps> = ({ officialRoute, language = 'zh-TW' }) => {
  const t = COPY[language];
  const statusLabel = officialRoute.status === 'OFFICIAL_CONFIRMED'
    ? t.confirmed
    : officialRoute.status === 'OFFICIAL_CANDIDATE'
    ? t.candidate
    : t.unknown;
  const statusStyle = officialRoute.status === 'OFFICIAL_CONFIRMED'
    ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-200'
    : officialRoute.status === 'OFFICIAL_CANDIDATE'
    ? 'border-amber-700/50 bg-amber-950/30 text-amber-200'
    : 'border-gray-700 bg-gray-900 text-gray-300';
  const icon = officialRoute.status === 'OFFICIAL_CONFIRMED'
    ? <ShieldCheck className="w-5 h-5" />
    : officialRoute.status === 'OFFICIAL_CANDIDATE'
    ? <TriangleAlert className="w-5 h-5" />
    : <ShieldQuestion className="w-5 h-5" />;

  return (
    <section className="mb-6 rounded-3xl border border-gray-800 bg-gray-900/60 p-5">
      <h3 className="mb-4 text-lg font-semibold text-white">{t.title}</h3>
      <div className={`rounded-2xl border p-4 ${statusStyle}`}>
        <div className="mb-2 flex items-center gap-2 font-semibold">
          {icon}
          <span>{statusLabel}</span>
        </div>
        <p className="mb-3 text-sm opacity-90">{officialRoute.rationale}</p>
        {officialRoute.url && (
          <a
            href={officialRoute.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            <span>{officialRoute.label || officialRoute.url}</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </section>
  );
};

export default OfficialVerification;
