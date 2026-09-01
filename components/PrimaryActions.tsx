import React from 'react';
import { ExternalLink, Flag, ShieldCheck } from 'lucide-react';
import { Language, OfficialRouteResolution, PrimaryAction } from '../types';

interface PrimaryActionsProps {
  actions: PrimaryAction[];
  officialRoute: OfficialRouteResolution;
  language?: Language;
  onReport?: () => void;
}

const LABELS = {
  en: {
    official: 'Verify the official-route candidate',
    report: 'Report this suspicious content now',
  },
  'zh-TW': {
    official: '核對官方入口候選',
    report: '立即回報這則可疑內容',
  },
  vi: {
    official: 'Kiểm tra ứng viên lối vào chính thức',
    report: 'Báo cáo nội dung đáng ngờ ngay',
  },
};

const PrimaryActions: React.FC<PrimaryActionsProps> = ({ actions, officialRoute, language = 'zh-TW', onReport }) => {
  const t = LABELS[language];
  const officialAction = actions.find((item) => item.kind === 'OFFICIAL_ROUTE') ?? {
    label: t.official,
    kind: 'OFFICIAL_ROUTE',
    emphasis: officialRoute.status === 'OFFICIAL_UNKNOWN' ? 'disabled' : 'primary',
    actionUrl: officialRoute.url,
    description: officialRoute.rationale,
  };
  const reportAction = actions.find((item) => item.kind === 'REPORT') ?? {
    label: t.report,
    kind: 'REPORT',
    emphasis: 'secondary',
    actionUrl: 'https://165.npa.gov.tw/#/report/call/02',
    description: '',
  };

  return (
    <section className="vf-primary-actions">
      {[officialAction, reportAction].map((action) => {
        const isDisabled = action.emphasis === 'disabled' || (!action.actionUrl && action.kind !== 'REPORT');
        const icon = action.kind === 'REPORT'
          ? <Flag className="w-5 h-5" />
          : <ShieldCheck className="w-5 h-5" />;

        const actionClass = `vf-primary-action ${
          isDisabled ? 'is-disabled' : action.emphasis === 'primary' ? 'is-primary' : action.kind === 'REPORT' ? 'is-report' : ''
        }`;
        const content = (
          <div className={actionClass}>
            <div className="vf-primary-action-title">
              {icon}
              <span>{action.label}</span>
              {!isDisabled && <ExternalLink className="ml-auto w-4 h-4 opacity-70" />}
            </div>
            <p>{action.description}</p>
          </div>
        );

        // REPORT: use the modal callback when provided
        if (action.kind === 'REPORT' && onReport) {
          return (
            <button key={action.kind} onClick={onReport} className="text-left w-full">
              {content}
            </button>
          );
        }

        if (isDisabled) {
          return <div key={action.kind}>{content}</div>;
        }

        return (
          <a key={action.kind} href={action.actionUrl} target="_blank" rel="noopener noreferrer">
            {content}
          </a>
        );
      })}
    </section>
  );
};

export default PrimaryActions;
