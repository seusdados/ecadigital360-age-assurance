import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const allowed = [
  'aprovado',
  'identificador da regra',
  'limite etário',
  'método',
  'nível de garantia',
  'expira em',
];

const forbidden = [
  'data de nascimento',
  'idade exata',
  'documento',
  'CPF',
  'nome',
  'foto',
];

export default function TokenAnatomyDiagram({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1040 480"
      role="img"
      aria-label="Anatomia do comprovante AgeKey: claims permitidas à esquerda, comprovante assinado no centro, claims proibidas à direita"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      {/* ── LEFT: permitidas ─────────────────────────────────── */}
      <g className="ak-card">
        <rect x="40" y="48" width="288" height="384" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="64" y="84" fill={ak.foreground} fontSize="15" fontWeight="800">
          Claims permitidas
        </text>
        <text x="64" y="104" fill={ak.mutedForeground} fontSize="12">
          aparecem no comprovante
        </text>
        <g transform="translate(64 124)">
          {allowed.map((label, i) => (
            <g key={label} transform={`translate(0 ${i * 44})`}>
              <rect
                width="240"
                height="32"
                rx="9"
                fill={ak.muted}
                stroke={ak.border}
              />
              <circle cx="18" cy="16" r="4.5" fill={ak.success} />
              <text x="34" y="21" fill={ak.foreground} fontSize="12" fontWeight="600">
                {label}
              </text>
            </g>
          ))}
        </g>
      </g>

      {/* ── CENTER: comprovante token ───────────────────────── */}
      <g transform="translate(360 64)" className="ak-float-slow">
        <rect width="320" height="352" rx="20" fill={ak.foreground} />
        {/* Inner display */}
        <rect x="24" y="40" width="272" height="240" rx="14" fill={ak.background} />
        <text
          x="160"
          y="76"
          textAnchor="middle"
          fill={ak.foreground}
          fontSize="13"
          fontWeight="700"
        >
          AgeKey
        </text>
        <text
          x="160"
          y="98"
          textAnchor="middle"
          fill={ak.mutedForeground}
          fontSize="11"
        >
          comprovante assinado
        </text>
        {/* Big check */}
        <g transform="translate(124 116)">
          <circle cx="36" cy="36" r="32" fill={ak.success} opacity="0.16" />
          <path
            d="M22 38 l10 10 22 -28"
            fill="none"
            stroke={ak.success}
            strokeWidth="5"
            className="ak-check-pop"
          />
        </g>
        <text
          x="160"
          y="220"
          textAnchor="middle"
          fill={ak.foreground}
          fontSize="14"
          fontWeight="800"
        >
          aprovado
        </text>
        <text
          x="160"
          y="244"
          textAnchor="middle"
          fill={ak.mutedForeground}
          fontSize="10"
        >
          18+ é regra da plataforma, não idade
        </text>
        <text
          x="160"
          y="262"
          textAnchor="middle"
          fill={ak.mutedForeground}
          fontSize="10"
        >
          do usuário
        </text>
        {/* Signed footer */}
        <g transform="translate(48 296)">
          <rect width="224" height="36" rx="10" fill={ak.accent} />
          <circle cx="24" cy="18" r="4" fill={ak.accentForeground} className="ak-pulse" />
          <text
            x="112"
            y="23"
            textAnchor="middle"
            fill={ak.accentForeground}
            fontSize="12"
            fontWeight="800"
          >
            assinatura digital
          </text>
        </g>
      </g>

      {/* ── RIGHT: proibidas ─────────────────────────────────── */}
      <g className="ak-card">
        <rect x="712" y="48" width="288" height="384" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="736" y="84" fill={ak.foreground} fontSize="15" fontWeight="800">
          Claims proibidas
        </text>
        <text x="736" y="104" fill={ak.mutedForeground} fontSize="12">
          nunca no comprovante
        </text>
        <g transform="translate(736 124)">
          {forbidden.map((label, i) => (
            <g key={label} transform={`translate(0 ${i * 44})`}>
              <rect
                width="240"
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
