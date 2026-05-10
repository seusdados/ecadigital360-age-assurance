import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

export default function NotKycComparisonDiagram({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 960 500"
      role="img"
      aria-label="Comparação entre KYC, que identifica uma pessoa, e AgeKey, que valida elegibilidade etária"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="960" height="500" rx="28" fill={ak.background} />
      <g className="ak-card">
        <rect x="64" y="82" width="392" height="324" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="96" y="134" fill={ak.foreground} fontSize="30" fontWeight="800">KYC tradicional</text>
        <text x="96" y="166" fill={ak.mutedForeground} fontSize="16">objetivo: identificação civil</text>
        <rect x="96" y="216" width="296" height="64" rx="14" fill={ak.muted} stroke={ak.border} />
        <text x="120" y="255" fill={ak.foreground} fontSize="20" fontWeight="700">Quem é essa pessoa?</text>
        <path d="M244 294 v34" stroke={ak.border} strokeWidth="2" />
        <rect x="116" y="328" width="256" height="44" rx="12" fill={ak.muted} stroke={ak.border} />
        <text x="148" y="356" fill={ak.mutedForeground} fontSize="17">identidade civil</text>
      </g>

      <g className="ak-card">
        <rect x="504" y="82" width="392" height="324" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="536" y="134" fill={ak.foreground} fontSize="30" fontWeight="800">AgeKey</text>
        <text x="536" y="166" fill={ak.mutedForeground} fontSize="16">objetivo: elegibilidade etária</text>
        <rect x="536" y="216" width="296" height="64" rx="14" fill={ak.accent} opacity="0.14" stroke={ak.border} />
        <text x="560" y="244" fill={ak.foreground} fontSize="18" fontWeight="700">A política etária</text>
        <text x="560" y="268" fill={ak.foreground} fontSize="18" fontWeight="700">foi satisfeita?</text>
        <path d="M684 294 v34" stroke={ak.accent} strokeWidth="2" className="ak-flow-line-short" />
        <rect x="568" y="328" width="232" height="44" rx="12" fill={ak.card} stroke={ak.accent} />
        <circle cx="592" cy="350" r="7" fill={ak.success} className="ak-pulse" />
        <text x="612" y="356" fill={ak.foreground} fontSize="17" fontWeight="700">decisão mínima</text>
      </g>

      <g transform="translate(338 430)">
        <rect width="284" height="42" rx="21" fill={ak.primary} />
        <text x="142" y="27" textAnchor="middle" fill={ak.primaryForeground} fontSize="16" fontWeight="700">Identificação civil ≠ elegibilidade etária</text>
      </g>
      <path d="M472 242 h16" stroke={ak.accent} strokeWidth="2" strokeLinecap="round" className="ak-flow-line" />
    </svg>
  );
}
