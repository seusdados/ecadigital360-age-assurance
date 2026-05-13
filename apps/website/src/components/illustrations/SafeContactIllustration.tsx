import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const accepted = ['Empresa', 'Email corporativo', 'Segmento', 'Volume estimado'];
const rejected = ['CPF', 'documento', 'data de nascimento', 'foto'];

export default function SafeContactIllustration({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 960 520"
      role="img"
      aria-label="Formulário corporativo do AgeKey: aceita dados de empresa, rejeita dados pessoais sensíveis"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      {/* ── LEFT: form mockup ────────────────────────────────── */}
      <g className="ak-card">
        <rect x="40" y="48" width="400" height="424" rx="20" fill={ak.card} stroke={ak.border} />
        <text x="64" y="92" fill={ak.foreground} fontSize="22" fontWeight="800">
          Fale com o AgeKey
        </text>
        <text x="64" y="116" fill={ak.mutedForeground} fontSize="13">
          aceitamos apenas dados corporativos
        </text>

        <g transform="translate(64 144)">
          {accepted.map((field, i) => (
            <g key={field} transform={`translate(0 ${i * 56})`} className={`ak-reveal-${i + 1}`}>
              <text fill={ak.foreground} fontSize="11" fontWeight="800">
                {field}
              </text>
              <rect y="10" width="352" height="34" rx="9" fill={ak.background} stroke={ak.border} />
              <circle cx="18" cy="27" r="5" fill={ak.accent} opacity="0.4" />
              <rect x="32" y="22" width="200" height="8" rx="4" fill={ak.input} />
            </g>
          ))}
        </g>

        <g transform="translate(64 396)">
          <rect width="240" height="44" rx="11" fill={ak.foreground} />
          <text
            x="120"
            y="28"
            textAnchor="middle"
            fill={ak.background}
            fontSize="14"
            fontWeight="800"
          >
            Solicitar demonstração
          </text>
        </g>
      </g>

      {/* ── CENTER: privacy guard badge ─────────────────────── */}
      <g transform="translate(456 184)" className="ak-float-slow">
        <circle cx="56" cy="56" r="56" fill={ak.card} stroke={ak.border} />
        <circle cx="56" cy="56" r="40" fill={ak.accent} opacity="0.18" />
        <path
          d="M56 26 L80 36 V62 C80 82 70 96 56 104 C42 96 32 82 32 62 V36 Z"
          fill={ak.foreground}
        />
        <path
          d="M44 60 l8 8 14 -18"
          fill="none"
          stroke={ak.accent}
          strokeWidth="4.5"
          className="ak-check-pop"
        />
        <text
          x="56"
          y="138"
          textAnchor="middle"
          fill={ak.foreground}
          fontSize="13"
          fontWeight="800"
        >
          Privacy Guard
        </text>
      </g>

      {/* ── RIGHT: blocked list ─────────────────────────────── */}
      <g className="ak-card">
        <rect x="600" y="48" width="320" height="424" rx="20" fill={ak.card} stroke={ak.border} />
        <text x="624" y="92" fill={ak.foreground} fontSize="18" fontWeight="800">
          Não envie
        </text>
        <text x="624" y="116" fill={ak.foreground} fontSize="18" fontWeight="800">
          dados sensíveis
        </text>
        <line x1="624" y1="136" x2="896" y2="136" stroke={ak.border} />

        <g transform="translate(624 164)">
          {rejected.map((item, i) => (
            <g key={item} transform={`translate(0 ${i * 56})`} className={`ak-reveal-${i + 1}`}>
              <rect width="272" height="40" rx="9" fill={ak.background} stroke={ak.border} />
              <path d="M18 20 h14" stroke={ak.warning} strokeWidth="2.4" strokeLinecap="round" />
              <path d="M25 13 v14" stroke={ak.warning} strokeWidth="2.4" strokeLinecap="round" />
              <text x="48" y="25" fill={ak.mutedForeground} fontSize="13" fontWeight="600">
                {item}
              </text>
            </g>
          ))}
        </g>
        <line x1="624" y1="416" x2="896" y2="416" stroke={ak.border} />
        <text x="760" y="448" textAnchor="middle" fill={ak.mutedForeground} fontSize="11">
          privacidade por design
        </text>
      </g>
    </svg>
  );
}
