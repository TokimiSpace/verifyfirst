import React from 'react';
import { AlertTriangle, BadgeCheck, ShieldAlert, Siren } from 'lucide-react';
import { FinalVerdict, Language } from '../types';

interface VerdictSummaryProps {
  conclusion: string;
  verdict: FinalVerdict;
  language?: Language;
}

const VERDICT_META: Record<FinalVerdict, { icon: React.ReactNode; tone: string; label: Record<Language, string> }> = {
  A_MARKETING: {
    icon: <BadgeCheck className="w-5 h-5" />,
    tone: 'vf-verdict-a',
    label: { en: 'A. General marketing', 'zh-TW': 'A. 一般行銷訊息', vi: 'A. Tiếp thị thông thường' },
  },
  B_RISKY_MARKETING: {
    icon: <AlertTriangle className="w-5 h-5" />,
    tone: 'vf-verdict-b',
    label: { en: 'B. Aggressive marketing / risky tactics', 'zh-TW': 'B. 高壓行銷 / 有風險手法', vi: 'B. Tiếp thị áp lực / có rủi ro' },
  },
  C_SUSPICIOUS_NEEDS_VERIFICATION: {
    icon: <ShieldAlert className="w-5 h-5" />,
    tone: 'vf-verdict-c',
    label: { en: 'C. Suspicious, needs verification', 'zh-TW': 'C. 可疑，需要驗證', vi: 'C. Đáng ngờ, cần xác minh' },
  },
  D_HIGH_RISK_SCAM: {
    icon: <Siren className="w-5 h-5" />,
    tone: 'vf-verdict-d',
    label: { en: 'D. High risk, likely scam', 'zh-TW': 'D. 高風險，疑似詐騙', vi: 'D. Rủi ro cao, nghi lừa đảo' },
  },
};

const VerdictSummary: React.FC<VerdictSummaryProps> = ({ conclusion, verdict, language = 'zh-TW' }) => {
  const meta = VERDICT_META[verdict];

  return (
    <section className="vf-verdict-card">
      <p className="vf-verdict-conclusion">
        {conclusion}
      </p>
      <div className={`vf-verdict-pill ${meta.tone}`}>
        {meta.icon}
        <span>{meta.label[language]}</span>
      </div>
    </section>
  );
};

export default VerdictSummary;
