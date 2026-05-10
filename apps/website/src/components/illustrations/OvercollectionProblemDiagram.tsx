import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

export default function OvercollectionProblemDiagram({ className, ...props }: SVGProps<SVGSVGElement>) {
  const heavy = ['documento', 'selfie', 'nome civil', 'data de nascimento', 'idade exata'];
  const minimal = ['política etária', 'decisão mínima'];
  return (
    <svg
      viewBox="0 0 960 540"
      role="img"
      aria-label="Comparação entre coleta excessiva de dados e decisão mínima com AgeKey"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="960" height="540" rx="28" fill={ak.background} />
      <g className="ak-card">
        <rect x="70" y="72" width="360" height="392" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="102" y="122" fill={ak.foreground} fontSize="29" fontWeight="800">Coleta excessiva</text>
        <text x="102" y="154" fill={ak.mutedForeground} fontSize="16">muitos dados para uma regra simples</text>
        <circle cx="348" cy="116" r="28" fill={ak.warning} opacity="0.12" className="ak-pulse-slow" />
        <path d="M348 98 v25" stroke={ak.warning} strokeWidth="4" strokeLinecap="round" />
        <circle cx="348" cy="137" r="3" fill={ak.warning} />
        {heavy.map((label, i) => (
          <g key={label} transform={`translate(102 ${205 + i * 48})`} className={`ak-reveal-${i + 1}`}>
            <rect width="242" height="34" rx="9" fill={ak.muted} stroke={ak.border} />
            <line x1="18" y1="17" x2="36" y2="17" stroke={ak.warning} strokeWidth="2.2" strokeLinecap="round" />
            <text x="52" y="22" fill={ak.mutedForeground} fontSize="15">{label}</text>
          </g>
        ))}
      </g>
      <path d="M455 264 C490 264 510 264 545 264" fill="none" stroke={ak.accent} strokeWidth="2.4" className="ak-flow-line" />
      <circle cx="500" cy="264" r="22" fill={ak.card} stroke={ak.accent} />
      <path d="M493 255 L503 264 L493 273" fill="none" stroke={ak.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <g className="ak-card">
        <rect x="560" y="72" width="360" height="392" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="592" y="122" fill={ak.foreground} fontSize="29" fontWeight="800">AgeKey</text>
        <text x="592" y="154" fill={ak.mutedForeground} fontSize="16">confirma apenas o necessário</text>
        <g className="ak-float-slow">
          <circle cx="740" cy="226" r="64" fill={ak.accent} opacity="0.12" />
          <path d="M740 178 L780 194 V231 C780 261 763 284 740 296 C717 284 700 261 700 231 V194 Z" fill={ak.primary} />
          <path d="M724 232 L736 244 L760 214" fill="none" stroke={ak.accent} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        {minimal.map((label, i) => (
          <g key={label} transform={`translate(620 ${340 + i * 48})`} className={`ak-reveal-${i + 1}`}>
            <rect width="230" height="34" rx="9" fill={ak.accent} opacity="0.14" stroke={ak.border} />
            <circle cx="22" cy="17" r="5" fill={ak.accent} />
            <text x="40" y="22" fill={ak.foreground} fontSize="15" fontWeight="700">{label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
