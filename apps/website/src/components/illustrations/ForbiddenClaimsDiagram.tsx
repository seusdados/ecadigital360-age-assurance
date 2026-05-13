import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const allowed = ['aprovado', 'política', 'método', 'nível de garantia', 'expira em', 'comprovante'];
const blocked = ['data de nascimento', 'idade exata', 'documento', 'CPF', 'nome', 'foto', 'biometria', 'identidade civil'];

export default function ForbiddenClaimsDiagram({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1040 520"
      role="img"
      aria-label="Privacy Guard libera claims permitidas e bloqueia claims proibidas no payload público do AgeKey"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      <defs>
        <marker
          id="ak-fc-arrow-ok"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M0 0 L9 5 L0 10 Z" fill={ak.success} />
        </marker>
        <marker
          id="ak-fc-arrow-bad"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M0 0 L9 5 L0 10 Z" fill={ak.warning} />
        </marker>
      </defs>

      {/* ── LEFT: Permitidas ─────────────────────────────────── */}
      <g className="ak-card">
        <rect x="32" y="48" width="288" height="392" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="56" y="84" fill={ak.foreground} fontSize="15" fontWeight="800">
          Permitidas
        </text>
        <text x="56" y="104" fill={ak.mutedForeground} fontSize="12">
          aparecem no payload público
        </text>
        <g transform="translate(56 124)">
          {allowed.map((label, i) => (
            <g key={label} transform={`translate(0 ${i * 44})`}>
              <rect
                width="240"
                height="32"
                rx="9"
                fill={i === allowed.length - 1 ? ak.accent : ak.muted}
                opacity={i === allowed.length - 1 ? '0.16' : '1'}
                stroke={ak.border}
              />
              <circle
                cx="18"
                cy="16"
                r="4.5"
                fill={i === allowed.length - 1 ? ak.accent : ak.success}
              />
              <text x="34" y="21" fill={ak.foreground} fontSize="12" fontWeight="600">
                {label}
              </text>
            </g>
          ))}
        </g>
      </g>

      {/* Pass arrow */}
      <line
        x1="324"
        y1="248"
        x2="376"
        y2="248"
        stroke={ak.success}
        strokeOpacity="0.5"
        strokeWidth="1.6"
        markerEnd="url(#ak-fc-arrow-ok)"
      />

      {/* ── CENTER: Privacy Guard ────────────────────────────── */}
      <g transform="translate(380 132)" className="ak-float-slow">
        <rect width="216" height="232" rx="20" fill={ak.foreground} />
        <circle cx="108" cy="72" r="44" fill={ak.accent} opacity="0.22" />
        <path
          d="M108 38 L138 50 V78 C138 100 124 118 108 126 C92 118 78 100 78 78 V50 Z"
          fill={ak.background}
        />
        <path
          d="M92 76 l11 11 19 -25"
          fill="none"
          stroke={ak.accent}
          strokeWidth="4.5"
          className="ak-check-pop"
        />
        <text
          x="108"
          y="162"
          textAnchor="middle"
          fill={ak.background}
          fontSize="15"
          fontWeight="800"
        >
          Privacy Guard
        </text>
        <text
          x="108"
          y="180"
          textAnchor="middle"
          fill={ak.background}
          opacity="0.7"
          fontSize="11"
        >
          regra contratual
        </text>
        <g transform="translate(28 198)">
          <rect width="160" height="22" rx="6" fill={ak.background} opacity="0.1" />
          <text x="80" y="15" textAnchor="middle" fill={ak.background} fontSize="10" fontWeight="700">
            payload validado
          </text>
        </g>
      </g>

      {/* Block arrow */}
      <line
        x1="596"
        y1="248"
        x2="648"
        y2="248"
        stroke={ak.warning}
        strokeOpacity="0.55"
        strokeWidth="1.6"
        markerEnd="url(#ak-fc-arrow-bad)"
      />

      {/* ── RIGHT: Bloqueadas ────────────────────────────────── */}
      <g className="ak-card">
        <rect x="652" y="32" width="360" height="448" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="676" y="68" fill={ak.foreground} fontSize="15" fontWeight="800">
          Bloqueadas
        </text>
        <text x="676" y="88" fill={ak.mutedForeground} fontSize="12">
          nunca aparecem no payload
        </text>
        <g transform="translate(676 108)">
          {blocked.map((label, i) => (
            <g key={label} transform={`translate(0 ${i * 42})`}>
              <rect
                width="312"
                height="32"
                rx="9"
                fill={ak.muted}
                stroke={ak.border}
              />
              <path d="M16 16 h14" stroke={ak.warning} strokeWidth="2.4" strokeLinecap="round" />
              <path d="M23 9 v14" stroke={ak.warning} strokeWidth="2.4" strokeLinecap="round" />
              <text x="42" y="21" fill={ak.mutedForeground} fontSize="12" fontWeight="600">
                {label}
              </text>
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}
