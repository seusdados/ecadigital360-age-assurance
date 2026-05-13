import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const layers = ['Política aplicada', 'Decisão registrada', 'Auditoria minimizada'];
const blocked = ['nome', 'documento', 'data de nascimento', 'foto'];

export default function ComplianceWithoutIdentityDiagram({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1000 480"
      role="img"
      aria-label="Compliance AgeKey: política aplicada, decisão registrada e auditoria minimizada sem identidade civil no payload"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      <defs>
        <marker
          id="ak-co-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M0 0 L9 5 L0 10 Z" fill={ak.foreground} />
        </marker>
      </defs>

      {/* Stairs on the left */}
      <g transform="translate(56 64)">
        {layers.map((label, i) => {
          const isLast = i === layers.length - 1;
          return (
            <g key={label} transform={`translate(${i * 40} ${i * 96})`} className={`ak-card ak-reveal-${i + 1}`}>
              <rect
                width="460"
                height="80"
                rx="16"
                fill={isLast ? ak.foreground : ak.card}
                stroke={isLast ? ak.foreground : ak.border}
              />
              <g transform="translate(28 28)">
                <circle cx="14" cy="14" r="14" fill={ak.accent} opacity={isLast ? '0.25' : '0.18'} />
                <text
                  x="14"
                  y="18"
                  textAnchor="middle"
                  fill={isLast ? ak.background : ak.foreground}
                  fontSize="12"
                  fontWeight="800"
                >
                  {i + 1}
                </text>
              </g>
              <text
                x="84"
                y="40"
                fill={isLast ? ak.background : ak.foreground}
                fontSize="17"
                fontWeight="800"
              >
                {label}
              </text>
              <text
                x="84"
                y="60"
                fill={isLast ? ak.background : ak.mutedForeground}
                opacity={isLast ? '0.7' : '1'}
                fontSize="12"
              >
                {i === 0 && 'regra resolvida pelo Policy Engine'}
                {i === 1 && 'comprovante assinado · expira'}
                {i === 2 && 'sem identidade civil no payload'}
              </text>
            </g>
          );
        })}
      </g>

      {/* Connector to right card */}
      <line
        x1="600"
        y1="280"
        x2="660"
        y2="280"
        stroke={ak.foreground}
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      <line
        x1="600"
        y1="280"
        x2="660"
        y2="280"
        stroke={ak.accent}
        strokeWidth="1.5"
        strokeDasharray="2 5"
        className="ak-flow-line"
        markerEnd="url(#ak-co-arrow)"
      />

      {/* Right: Sem payload civil */}
      <g transform="translate(664 88)" className="ak-card">
        <rect width="296" height="336" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="28" y="48" fill={ak.foreground} fontSize="16" fontWeight="800">
          Sem payload civil
        </text>
        <text x="28" y="68" fill={ak.mutedForeground} fontSize="12">
          decisão auditável sem identidade
        </text>
        <g transform="translate(28 96)">
          {blocked.map((label, i) => (
            <g key={label} transform={`translate(0 ${i * 44})`}>
              <rect
                width="240"
                height="34"
                rx="9"
                fill={ak.muted}
                stroke={ak.border}
              />
              <path d="M16 17 h14" stroke={ak.warning} strokeWidth="2.4" strokeLinecap="round" />
              <path d="M23 10 v14" stroke={ak.warning} strokeWidth="2.4" strokeLinecap="round" />
              <text x="44" y="22" fill={ak.mutedForeground} fontSize="13" fontWeight="600">
                {label}
              </text>
            </g>
          ))}
        </g>
        <g transform="translate(28 290)">
          <rect width="240" height="32" rx="16" fill={ak.accent} opacity="0.18" />
          <rect width="240" height="32" rx="16" fill="none" stroke={ak.accent} strokeOpacity="0.4" />
          <text
            x="120"
            y="21"
            textAnchor="middle"
            fill={ak.foreground}
            fontSize="12"
            fontWeight="800"
          >
            privacy by design
          </text>
        </g>
      </g>
    </svg>
  );
}
