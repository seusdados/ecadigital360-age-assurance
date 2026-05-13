import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

/**
 * KYC tradicional vs AgeKey — two side-by-side product cards stating the
 * objective and the resulting payload, with a center pill summarising the
 * core distinction. UI-mockup framing instead of abstract schematic.
 */
export default function NotKycComparisonDiagram({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 960 480"
      role="img"
      aria-label="Comparação entre KYC tradicional, que identifica uma pessoa, e AgeKey, que valida apenas elegibilidade etária"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      {/* ── LEFT: KYC tradicional ─────────────────────────────── */}
      <g className="ak-card">
        <rect
          x="48"
          y="40"
          width="392"
          height="328"
          rx="20"
          fill={ak.card}
          stroke={ak.border}
        />
        {/* Header */}
        <text
          x="80"
          y="86"
          fill={ak.foreground}
          fontSize="22"
          fontWeight="800"
        >
          KYC tradicional
        </text>
        <text
          x="80"
          y="110"
          fill={ak.mutedForeground}
          fontSize="13"
        >
          objetivo: identificação civil
        </text>

        {/* Question card */}
        <rect
          x="80"
          y="140"
          width="328"
          height="56"
          rx="12"
          fill={ak.muted}
          stroke={ak.border}
        />
        <text
          x="244"
          y="174"
          textAnchor="middle"
          fill={ak.foreground}
          fontSize="15"
          fontWeight="700"
        >
          Quem é essa pessoa?
        </text>

        {/* Output stack — many fields */}
        <g transform="translate(80 220)">
          {[
            'nome civil',
            'documento',
            'data de nascimento',
            'biometria',
          ].map((label, i) => (
            <g key={label} transform={`translate(0 ${i * 32})`}>
              <rect
                width="328"
                height="24"
                rx="6"
                fill={ak.muted}
                stroke={ak.border}
              />
              <circle cx="16" cy="12" r="3" fill={ak.foreground} opacity="0.55" />
              <text x="30" y="16" fill={ak.foreground} fontSize="12" fontWeight="600">
                {label}
              </text>
            </g>
          ))}
        </g>
      </g>

      {/* ── RIGHT: AgeKey ────────────────────────────────────── */}
      <g className="ak-card">
        <rect
          x="520"
          y="40"
          width="392"
          height="328"
          rx="20"
          fill={ak.card}
          stroke={ak.border}
        />
        <text
          x="552"
          y="86"
          fill={ak.foreground}
          fontSize="22"
          fontWeight="800"
        >
          AgeKey
        </text>
        <text
          x="552"
          y="110"
          fill={ak.mutedForeground}
          fontSize="13"
        >
          objetivo: elegibilidade etária
        </text>

        {/* Question card (highlighted) */}
        <rect
          x="552"
          y="140"
          width="328"
          height="56"
          rx="12"
          fill={ak.accent}
          opacity="0.14"
        />
        <rect
          x="552"
          y="140"
          width="328"
          height="56"
          rx="12"
          fill="none"
          stroke={ak.accent}
          strokeOpacity="0.5"
        />
        <text
          x="716"
          y="174"
          textAnchor="middle"
          fill={ak.foreground}
          fontSize="15"
          fontWeight="700"
        >
          A política etária foi satisfeita?
        </text>

        {/* Output: single decision row */}
        <g transform="translate(552 226)">
          <rect
            width="328"
            height="34"
            rx="9"
            fill={ak.success}
            opacity="0.14"
          />
          <circle cx="20" cy="17" r="5" fill={ak.success} className="ak-pulse" />
          <text x="36" y="22" fill={ak.foreground} fontSize="13" fontWeight="700">
            decisão mínima · assinada
          </text>
        </g>

        {/* Footnote: nothing else */}
        <g transform="translate(552 280)">
          <rect
            width="328"
            height="34"
            rx="9"
            fill="none"
            stroke={ak.border}
            strokeDasharray="3 4"
          />
          <text
            x="164"
            y="22"
            textAnchor="middle"
            fill={ak.mutedForeground}
            fontSize="12"
          >
            sem nome · documento · data · foto
          </text>
        </g>
      </g>

      {/* ── Center summary pill ──────────────────────────────── */}
      <g transform="translate(304 408)">
        <rect width="352" height="44" rx="22" fill={ak.foreground} />
        <text
          x="176"
          y="29"
          textAnchor="middle"
          fill={ak.background}
          fontSize="14"
          fontWeight="700"
        >
          identificação civil ≠ elegibilidade etária
        </text>
      </g>
    </svg>
  );
}
