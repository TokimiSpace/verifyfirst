import React from 'react';
import { Analytics } from '@vercel/analytics/react';

/** Self-hosted deployments send no analytics unless the operator opts in. */
const OptionalAnalytics: React.FC = () => (
  import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS === 'true' ? <Analytics /> : null
);

export default OptionalAnalytics;
