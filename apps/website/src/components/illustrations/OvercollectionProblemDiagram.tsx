import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const heavy = ['documento', 'foto', 'nome civil', 'data de nascimento', 'idade exata'];
const minimal = ['política etária satisfeita', 'decisão mínima'];

export default function OvercollectionProblemDiagram({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 960 480"
      role="img"
      aria-label="Comparação entre coleta excessiva de dados pessoais e a abordagem mínima do AgeKey"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      <defs>
        <marker
          id="ak-ov-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth="9"
          markerHeight="9"
          orient="auto"
        >
          <path d="M0 0 L9 5 L0 10 Z" fill={ak.foreground} />
        </marker>
      </defs>

      {/* ── LEFT: Coleta excessiva ──────────────────────────── */}
      <g className="ak-card">
        <rect x="48" y="40" width="368" height="392" rx="20" fill={ak.card} stroke={ak.border} />
        <text x="80" y="86" fill={ak.foreground} fontSize="20" fontWeight="800">
          Coleta excessiva
        </text>
        <text x="80" y="108" fill={ak.mutedForeground} fontSize="13">
          muitos dados para uma regra simples
        </text>
        {/* Warning badge */}
        <g transform="translate(336 60)">
          <circle cx="20" cy="20" r="20" fill={ak.warning} opacity="0.16" className="ak-pulse-slow" />
          <path d="M20 10 v14" stroke={ak.warning} strokeWidth="3" strokeLinecap="round" />
          <circle cx="20" cy="30" r="2.4" fill={ak.warning} />
        </g>

        {/* Stack of fields */}
        <g transform="translate(80 144)">
          {heavy.map((label, i) => (
            <g key={label} transform={`translate(0 ${i * 50})`} className={`ak-reveal-${(i % 5) + 1}`}>
              <rect width="304" height="36" rx="9" fill={ak.muted} stroke={ak.border} />
              <line x1="20" y1="18" x2="38" y2="18" stroke={ak.warning} strokeWidth="2.4" strokeLinecap="round" />
              <text x="52" y="23" fill={ak.foreground} fontSize="13" fontWeight="600">{label}</text>
            </g>
          ))}
        </g>
      </g>

      {/* Connector */}
      <line x1="416" y1="240" x2="544" y2="240" stroke={ak.foreground} strokeOpacity="0.25" strokeWidth="1.5" />
      <line x1="416" y1="240" x2="544" y2="240" stroke={ak.accent} strokeWidth="1.5" strokeDasharray="2 5" className="ak-flow-line" markerEnd="url(#ak-ov-arrow)" />

      {/* ── RIGHT: AgeKey minimal ───────────────────────────── */}
      <g className="ak-card">
        <rect x="544" y="40" width="368" height="392" rx="20" fill={ak.card} stroke={ak.border} />
        <text x="576" y="86" fill={ak.foreground} fontSize="20" fontWeight="800">
          AgeKey
        </text>
        <text x="576" y="108" fill={ak.mutedForeground} fontSize="13">
          confirma apenas o necessário
        </text>

        {/* Shield centerpiece */}
        <g transform="translate(660 152)" className="ak-float-slow">
          <circle cx="68" cy="60" r="56" fill={ak.accent} opacity="0.14" />
          <path
            d="M68 26 L96 36 V62 C96 82 84 96 68 104 C52 96 40 82 40 62 V36 Z"
            fill={ak.foreground}
          />
          <path d="M52 60 l11 11 19 -25" fill="none" stroke={ak.accent} strokeWidth="5" className="ak-check-pop" />
        </g>

        {/* Minimal output */}
        <g transform="translate(584 312)">
          {minimal.map((label, i) => (
            <g key={label} transform={`translate(0 ${i * 44})`}>
              <rect
                width="288"
                height="36"
                rx="9"
                fill={i === 1 ? ak.accent : ak.success}
                opacity={i === 1 ? '0.14' : '0.14'}
                stroke={ak.border}
              />
              <circle cx="20" cy="18" r="5" fill={i === 1 ? ak.accent : ak.success} className={i === 1 ? 'ak-pulse' : ''} />
              <text x="36" y="23" fill={ak.foreground} fontSize="13" fontWeight="700">{label}</text>
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}
