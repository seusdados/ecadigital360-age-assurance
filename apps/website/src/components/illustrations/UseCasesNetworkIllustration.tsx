import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const cases = [
  ['Edtechs', 116, 88],
  ['Marketplaces', 654, 88],
  ['Publishers', 96, 344],
  ['Jogos', 672, 344],
  ['Comunidades', 356, 58],
  ['Apps digitais', 360, 402],
] as const;

export default function UseCasesNetworkIllustration({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 960 560"
      role="img"
      aria-label="AgeKey conectado a edtechs, marketplaces, publishers, jogos, comunidades e apps digitais"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="960" height="560" rx="28" fill={ak.background} />
      <path d="M480 280 L226 160 M480 280 L764 160 M480 280 L206 416 M480 280 L782 416 M480 280 L470 136 M480 280 L482 430" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" opacity="0.7" />
      <g transform="translate(362 198)" className="ak-float-slow">
        <rect width="236" height="164" rx="22" fill={ak.primary} />
        <circle cx="118" cy="58" r="34" fill={ak.accent} opacity="0.22" />
        <path d="M118 31 L144 42 V66 C144 85 131 99 118 106 C105 99 92 85 92 66 V42 Z" fill={ak.primaryForeground} />
        <text x="118" y="126" fill={ak.primaryForeground} fontSize="28" fontWeight="900" textAnchor="middle">AgeKey</text>
      </g>
      {cases.map(([label, x, y], i) => (
        <g key={label} transform={`translate(${x} ${y})`} className={`ak-card ak-reveal-${(i % 5) + 1}`}>
          <rect width="170" height="96" rx="17" fill={ak.card} stroke={ak.border} />
          <circle cx="38" cy="48" r="18" fill={ak.accent} opacity="0.15" />
          <path d="M30 48 h16 M38 40 v16" stroke={ak.accent} strokeWidth="2.4" strokeLinecap="round" />
          <text x="66" y="54" fill={ak.foreground} fontSize="18" fontWeight="800">{label}</text>
        </g>
      ))}
    </svg>
  );
}
