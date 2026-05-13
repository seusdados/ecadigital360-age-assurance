import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const inputs = ['prova', 'atestado', 'credencial', 'desafio'];
const allowed = [
  'aprovado',
  'política',
  'método',
  'nível de garantia',
  'expira em',
  'comprovante',
];

export default function PrivacyArchitectureDiagram({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 960 480"
      role="img"
      aria-label="Privacy Guard recebe artefatos abstratos, filtra dados civis e libera apenas o payload mínimo"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      <defs>
        <marker
          id="ak-pa-arrow"
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

      {/* ── LEFT: inputs ────────────────────────────────────── */}
      <g className="ak-card">
        <rect x="48" y="80" width="216" height="280" rx="16" fill={ak.card} stroke={ak.border} />
        <text x="72" y="116" fill={ak.foreground} fontSize="15" fontWeight="800">Entradas</text>
        <text x="72" y="136" fill={ak.mutedForeground} fontSize="12">artefatos abstratos</text>
        <g transform="translate(72 156)">
          {inputs.map((label, i) => (
            <g key={label} transform={`translate(0 ${i * 44})`}>
              <rect width="168" height="32" rx="9" fill={ak.muted} stroke={ak.border} />
              <circle cx="18" cy="16" r="5" fill={ak.accent} />
              <text x="34" y="21" fill={ak.foreground} fontSize="12" fontWeight="600">{label}</text>
            </g>
          ))}
        </g>
      </g>

      {/* Connector left → guard */}
      <line x1="264" y1="220" x2="346" y2="220" stroke={ak.foreground} strokeOpacity="0.3" strokeWidth="1.5" />
      <line x1="264" y1="220" x2="346" y2="220" stroke={ak.accent} strokeWidth="1.5" strokeDasharray="2 5" className="ak-flow-line" markerEnd="url(#ak-pa-arrow)" />

      {/* ── CENTER: Privacy Guard ───────────────────────────── */}
      <g transform="translate(352 100)" className="ak-float-slow">
        <rect width="216" height="280" rx="20" fill={ak.foreground} />
        <circle cx="108" cy="78" r="46" fill={ak.accent} opacity="0.22" />
        <path
          d="M108 42 L138 54 V82 C138 106 124 124 108 132 C92 124 78 106 78 82 V54 Z"
          fill={ak.background}
        />
        <path
          d="M92 80 l11 11 19 -25"
          fill="none"
          stroke={ak.accent}
          strokeWidth="4.5"
          className="ak-check-pop"
        />
        <text x="108" y="170" textAnchor="middle" fill={ak.background} fontSize="16" fontWeight="800">
          Privacy Guard
        </text>
        <text x="108" y="190" textAnchor="middle" fill={ak.background} opacity="0.7" fontSize="11">
          filtra claims públicas
        </text>
        {/* status row */}
        <g transform="translate(28 212)">
          <rect width="160" height="28" rx="8" fill={ak.background} opacity="0.1" />
          <circle cx="16" cy="14" r="4" fill={ak.success} className="ak-pulse" />
          <text x="30" y="18" fill={ak.background} fontSize="11" fontWeight="600">payload validado</text>
        </g>
      </g>

      {/* Connector guard → output */}
      <line x1="568" y1="220" x2="650" y2="220" stroke={ak.foreground} strokeOpacity="0.3" strokeWidth="1.5" />
      <line x1="568" y1="220" x2="650" y2="220" stroke={ak.accent} strokeWidth="1.5" strokeDasharray="2 5" className="ak-flow-line" markerEnd="url(#ak-pa-arrow)" />

      {/* ── RIGHT: payload público ─────────────────────────── */}
      <g className="ak-card">
        <rect x="656" y="80" width="256" height="320" rx="16" fill={ak.card} stroke={ak.border} />
        <text x="680" y="116" fill={ak.foreground} fontSize="15" fontWeight="800">Payload público</text>
        <text x="680" y="136" fill={ak.mutedForeground} fontSize="12">apenas dados minimizados</text>
        <g transform="translate(680 156)">
          {allowed.map((label, i) => (
            <g key={label} transform={`translate(0 ${i * 36})`}>
              <rect
                width="208"
                height="26"
                rx="7"
                fill={i === allowed.length - 1 ? ak.accent : ak.muted}
                opacity={i === allowed.length - 1 ? '0.18' : '1'}
                stroke={ak.border}
              />
              <circle cx="16" cy="13" r="4" fill={i === allowed.length - 1 ? ak.accent : ak.success} />
              <text x="30" y="17" fill={ak.foreground} fontSize="11" fontWeight="600">{label}</text>
            </g>
          ))}
        </g>
      </g>

      {/* Bottom: blocked strip */}
      <g transform="translate(48 416)">
        <rect width="864" height="40" rx="10" fill={ak.card} stroke={ak.border} />
        <text x="20" y="25" fill={ak.mutedForeground} fontSize="10" fontWeight="700" letterSpacing="0.1em">
          BLOQUEADO
        </text>
        <text x="432" y="25" textAnchor="middle" fill={ak.mutedForeground} fontSize="11">
          nome · documento · foto · data de nascimento · idade exata
        </text>
        <path
          d="M120 22 H812"
          stroke={ak.warning}
          strokeWidth="1.5"
          strokeOpacity="0.45"
          strokeDasharray="3 4"
          className="ak-scan"
        />
      </g>
    </svg>
  );
}
