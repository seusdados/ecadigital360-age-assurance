import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const plans = [
  ['Sandbox', 'testar integração', 90, 270],
  ['Growth', 'operar verificações', 370, 198],
  ['Enterprise', 'escala, SLA e compliance', 650, 126],
] as const;

export default function PricingMaturityDiagram({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 960 520"
      role="img"
      aria-label="Progressão dos planos AgeKey de sandbox para growth e enterprise"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="960" height="520" rx="28" fill={ak.background} />
      <path d="M260 312 C350 292 356 252 426 240 M540 238 C622 220 630 174 706 166" stroke={ak.accent} strokeWidth="2.2" fill="none" className="ak-flow-line" />
      {plans.map(([title, subtitle, x, y], i) => (
        <g key={title} transform={`translate(${x} ${y})`} className={`ak-card ak-reveal-${i + 1}`}>
          <rect width="230" height={152 + i * 32} rx="20" fill={i === 2 ? ak.primary : ak.card} stroke={i === 2 ? ak.primary : ak.border} />
          <circle cx="46" cy="48" r="20" fill={ak.accent} opacity={i === 2 ? '0.25' : '0.15'} />
          <text x="74" y="44" fill={i === 2 ? ak.primaryForeground : ak.foreground} fontSize="24" fontWeight="850">{title}</text>
          <text x="74" y="70" fill={i === 2 ? ak.primaryForeground : ak.mutedForeground} opacity={i === 2 ? '0.74' : '1'} fontSize="14">{subtitle}</text>
          <rect x="28" y="104" width="174" height="34" rx="9" fill={i === 2 ? ak.primaryForeground : ak.muted} opacity={i === 2 ? '0.1' : '1'} stroke={i === 2 ? ak.accent : ak.border} />
          <text x="115" y="126" textAnchor="middle" fill={i === 2 ? ak.primaryForeground : ak.foreground} fontSize="13" fontWeight="700">maturidade {i + 1}</text>
        </g>
      ))}
    </svg>
  );
}
