import React from 'react';

type BrandMarkProps = React.SVGProps<SVGSVGElement> & {
  title?: string;
};

/**
 * VerifyFirst threshold monogram.
 * V = verify, the amber stem = the policy gate, and the two bars = action only
 * after that gate. Keep this geometry aligned with public/verifyfirst-mark.svg.
 */
const BrandMark: React.FC<BrandMarkProps> = ({ title, ...props }) => (
  <svg
    viewBox="0 0 32 32"
    xmlns="http://www.w3.org/2000/svg"
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
    focusable="false"
    {...props}
  >
    {title ? <title>{title}</title> : null}
    <path fill="currentColor" d="M3.5 7h4.25L13 20.75 18.25 7h4.25l-7.2 18h-4.6L3.5 7Z" />
    <path fill="var(--vf-warning, #f2c14e)" d="M22.5 7h3.25v18H22.5z" />
    <path fill="currentColor" d="M25.75 7H30v3.25h-4.25zM25.75 14h3.5v3.25h-3.5z" />
  </svg>
);

export default BrandMark;
