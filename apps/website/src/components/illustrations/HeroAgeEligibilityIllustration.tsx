import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

export default function HeroAgeEligibilityIllustration({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  const notSent = ['nome', 'documento', 'data', 'selfie'] as const;
  return (
    <svg
      viewBox="0 0 640 440"
      role="img"
      aria-label="Sua plataforma envia uma política etária ao AgeKey e recebe uma decisão mínima sem identidade civil"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      <defs>
        <marker
          id="ak-hero-arrow"
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

      {/* Soft accent halo behind the shield */}
      <circle
        cx="320"
        cy="200"
        r="170"
        fill={ak.accent}
        opacity="0.07"
        className="ak-breathe"
      />

      {/* ── Platform card ───────────────────────────────────────── */}
      <g className="ak-soft-card">
        <rect
          x="24"
          y="96"
          width="160"
          height="208"
          rx="16"
          fill={ak.card}
          stroke={ak.border}
        />
        <text
          x="104"
          y="138"
          textAnchor="middle"
          fill={ak.foreground}
          fontSize="15"
          fontWeight="700"
        >
          Sua plataforma
        </text>
        <text
          x="104"
          y="160"
          textAnchor="middle"
          fill={ak.mutedForeground}
          fontSize="12"
        >
          site · app · backend
        </text>
        <rect
          x="40"
          y="200"
          width="128"
          height="44"
          rx="22"
          fill={ak.foreground}
        />
        <text
          x="104"
          y="227"
          textAnchor="middle"
          fill={ak.background}
          fontSize="15"
          fontWeight="800"
        >
          policy 18+
        </text>
        <text
          x="104"
          y="270"
          textAnchor="middle"
          fill={ak.mutedForeground}
          fontSize="12"
        >
          regra a verificar
        </text>
      </g>

      {/* ── Connector left → center ─────────────────────────────── */}
      <line
        x1="192"
        y1="200"
        x2="240"
        y2="200"
        stroke={ak.foreground}
        strokeWidth="1.5"
        className="ak-flow-line"
        markerEnd="url(#ak-hero-arrow)"
      />

      {/* ── AgeKey shield (center) ──────────────────────────────── */}
      <g transform="translate(256 96)" className="ak-float-slow">
        <circle
          cx="64"
          cy="88"
          r="78"
          fill={ak.background}
          stroke={ak.border}
        />
        <circle cx="64" cy="88" r="52" fill={ak.accent} opacity="0.14" />
        <path
          d="M64 50 L94 62 V94 C94 116 81 132 64 140 C47 132 34 116 34 94 V62 Z"
          fill={ak.foreground}
        />
        <path
          d="M50 92 l11 11 19 -26"
          fill="none"
          stroke={ak.accent}
          strokeWidth="6"
          className="ak-check-pop"
        />
        <text
          x="64"
          y="194"
          textAnchor="middle"
          fill={ak.foreground}
          fontSize="16"
          fontWeight="800"
        >
          AgeKey
        </text>
        <text
          x="64"
          y="214"
          textAnchor="middle"
          fill={ak.mutedForeground}
          fontSize="12"
        >
          minimiza · assina
        </text>
      </g>

      {/* ── Connector center → right ────────────────────────────── */}
      <line
        x1="400"
        y1="200"
        x2="448"
        y2="200"
        stroke={ak.foreground}
        strokeWidth="1.5"
        className="ak-flow-line"
        markerEnd="url(#ak-hero-arrow)"
      />

      {/* ── Decision card ───────────────────────────────────────── */}
      <g className="ak-soft-card">
        <rect
          x="456"
          y="96"
          width="160"
          height="208"
          rx="16"
          fill={ak.card}
          stroke={ak.border}
        />
        <text
          x="536"
          y="138"
          textAnchor="middle"
          fill={ak.foreground}
          fontSize="15"
          fontWeight="700"
        >
          Decisão
        </text>
        <text
          x="536"
          y="160"
          textAnchor="middle"
          fill={ak.mutedForeground}
          fontSize="12"
        >
          mínima e assinada
        </text>

        {/* approved */}
        <g transform="translate(480 184)">
          <rect width="112" height="32" rx="8" fill={ak.success} opacity="0.14" />
          <circle cx="14" cy="16" r="4" fill={ak.success} className="ak-pulse" />
          <text
            x="28"
            y="21"
            fill={ak.foreground}
            fontSize="13"
            fontWeight="700"
          >
            approved
          </text>
        </g>

        {/* denied */}
        <g transform="translate(480 224)">
          <rect width="112" height="32" rx="8" fill={ak.muted} stroke={ak.border} />
          <circle cx="14" cy="16" r="4" fill={ak.mutedForeground} opacity="0.35" />
          <text x="28" y="21" fill={ak.mutedForeground} fontSize="13">
            denied
          </text>
        </g>

        {/* needs_review */}
        <g transform="translate(480 264)">
          <rect width="112" height="32" rx="8" fill={ak.muted} stroke={ak.border} />
          <circle cx="14" cy="16" r="4" fill={ak.mutedForeground} opacity="0.35" />
          <text x="28" y="21" fill={ak.mutedForeground} fontSize="13">
            needs_review
          </text>
        </g>
      </g>

      {/* ── Bottom: what is NOT shared ──────────────────────────── */}
      <text
        x="320"
        y="354"
        textAnchor="middle"
        fill={ak.mutedForeground}
        fontSize="12"
        fontWeight="600"
      >
        nunca compartilhado
      </text>
      <g transform="translate(160 372)">
        {notSent.map((label, i) => (
          <g key={label} transform={`translate(${i * 84} 0)`}>
            <rect
              width="76"
              height="24"
              rx="6"
              fill="none"
              stroke={ak.border}
              strokeDasharray="3 4"
            />
            <text
              x="38"
              y="16"
              textAnchor="middle"
              fill={ak.mutedForeground}
              fontSize="11"
              opacity="0.75"
            >
              {label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
