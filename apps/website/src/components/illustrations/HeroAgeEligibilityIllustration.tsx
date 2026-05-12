import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

/**
 * Hero illustration — mockup-grade story in three panes:
 *
 *   [ Platform UI ]  →  [ AgeKey shield ]  →  [ Result UI ]
 *
 * The two side panes are stylized device screens (window chrome, URL pill,
 * divider, content area) so the diagram reads as an actual product flow,
 * not an abstract schematic. Typography is locked to 3 sizes (10/11/14)
 * for legibility at the hero column width (~470px on desktop).
 */
export default function HeroAgeEligibilityIllustration({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 560 400"
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
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M0 0 L9 5 L0 10 Z" fill={ak.foreground} />
        </marker>
      </defs>

      {/* Soft accent halo behind the shield only (not the whole illustration) */}
      <circle
        cx="280"
        cy="190"
        r="98"
        fill={ak.accent}
        opacity="0.12"
        className="ak-breathe"
      />

      {/* ── LEFT: platform screen ───────────────────────────────── */}
      <g className="ak-card">
        {/* Device frame */}
        <rect
          x="20"
          y="56"
          width="160"
          height="288"
          rx="18"
          fill={ak.card}
          stroke={ak.border}
        />
        {/* Inner screen */}
        <rect
          x="28"
          y="64"
          width="144"
          height="272"
          rx="12"
          fill={ak.background}
        />
        {/* Window controls */}
        <circle cx="40" cy="80" r="3" fill={ak.foreground} opacity="0.4" />
        <circle cx="50" cy="80" r="3" fill={ak.foreground} opacity="0.22" />
        <circle cx="60" cy="80" r="3" fill={ak.foreground} opacity="0.22" />
        {/* URL pill */}
        <rect x="76" y="74" width="84" height="12" rx="6" fill={ak.muted} />
        {/* Divider */}
        <line
          x1="36"
          y1="96"
          x2="164"
          y2="96"
          stroke={ak.border}
          strokeWidth="1"
        />

        {/* Headline */}
        <text
          x="100"
          y="124"
          textAnchor="middle"
          fill={ak.foreground}
          fontSize="14"
          fontWeight="700"
        >
          Acesso restrito
        </text>
        <text
          x="100"
          y="142"
          textAnchor="middle"
          fill={ak.mutedForeground}
          fontSize="11"
        >
          conteúdo 18+
        </text>

        {/* Lock glyph */}
        <g transform="translate(76 160)">
          <rect width="48" height="44" rx="9" fill={ak.muted} />
          <rect
            x="14"
            y="20"
            width="20"
            height="16"
            rx="2.5"
            fill={ak.foreground}
          />
          <path
            d="M18 20 v-6 a6 6 0 0 1 12 0 v6"
            fill="none"
            stroke={ak.foreground}
            strokeWidth="2.2"
          />
        </g>

        {/* Policy chip */}
        <rect
          x="44"
          y="222"
          width="112"
          height="32"
          rx="16"
          fill={ak.foreground}
        />
        <text
          x="100"
          y="242"
          textAnchor="middle"
          fill={ak.background}
          fontSize="13"
          fontWeight="800"
        >
          política 18+
        </text>
        <text
          x="100"
          y="270"
          textAnchor="middle"
          fill={ak.mutedForeground}
          fontSize="10"
        >
          regra da plataforma
        </text>

        {/* CTA */}
        <rect
          x="44"
          y="288"
          width="112"
          height="32"
          rx="9"
          fill={ak.accent}
          opacity="0.18"
        />
        <rect
          x="44"
          y="288"
          width="112"
          height="32"
          rx="9"
          fill="none"
          stroke={ak.accent}
          strokeOpacity="0.4"
        />
        <text
          x="100"
          y="308"
          textAnchor="middle"
          fill={ak.foreground}
          fontSize="11"
          fontWeight="700"
        >
          verificar idade
        </text>
      </g>

      {/* Connector left → shield */}
      <line
        x1="184"
        y1="200"
        x2="218"
        y2="200"
        stroke={ak.foreground}
        strokeOpacity="0.25"
        strokeWidth="1.5"
      />
      <line
        x1="184"
        y1="200"
        x2="218"
        y2="200"
        stroke={ak.accent}
        strokeWidth="1.5"
        strokeDasharray="2 5"
        className="ak-flow-line"
        markerEnd="url(#ak-hero-arrow)"
      />

      {/* ── CENTER: AgeKey shield ───────────────────────────────── */}
      <g transform="translate(224 132)" className="ak-float-slow">
        {/* Expanding glow ring (drawn first so the shield sits on top) */}
        <circle cx="56" cy="60" r="58" fill={ak.accent} opacity="0" className="ak-glow" />
        <circle
          cx="56"
          cy="60"
          r="58"
          fill={ak.background}
          stroke={ak.border}
        />
        <circle cx="56" cy="60" r="42" fill={ak.accent} opacity="0.18" />
        <g className="ak-tilt">
          <path
            d="M56 30 L82 42 V68 C82 88 71 104 56 112 C41 104 30 88 30 68 V42 Z"
            fill={ak.foreground}
          />
          <path
            d="M44 64 l9 9 17 -23"
            fill="none"
            stroke={ak.accent}
            strokeWidth="5"
            className="ak-check-pop"
          />
        </g>
        <text
          x="56"
          y="148"
          textAnchor="middle"
          fill={ak.foreground}
          fontSize="14"
          fontWeight="800"
        >
          AgeKey
        </text>
        <text
          x="56"
          y="166"
          textAnchor="middle"
          fill={ak.mutedForeground}
          fontSize="10"
        >
          minimiza · assina
        </text>
      </g>

      {/* Connector shield → right */}
      <line
        x1="342"
        y1="200"
        x2="376"
        y2="200"
        stroke={ak.foreground}
        strokeOpacity="0.25"
        strokeWidth="1.5"
      />
      <line
        x1="342"
        y1="200"
        x2="376"
        y2="200"
        stroke={ak.accent}
        strokeWidth="1.5"
        strokeDasharray="2 5"
        className="ak-flow-line"
        markerEnd="url(#ak-hero-arrow)"
      />

      {/* ── RIGHT: result screen ────────────────────────────────── */}
      <g className="ak-card">
        <rect
          x="380"
          y="56"
          width="160"
          height="288"
          rx="18"
          fill={ak.card}
          stroke={ak.border}
        />
        <rect
          x="388"
          y="64"
          width="144"
          height="272"
          rx="12"
          fill={ak.background}
        />
        <circle cx="400" cy="80" r="3" fill={ak.foreground} opacity="0.4" />
        <circle cx="410" cy="80" r="3" fill={ak.foreground} opacity="0.22" />
        <circle cx="420" cy="80" r="3" fill={ak.foreground} opacity="0.22" />
        <rect x="436" y="74" width="84" height="12" rx="6" fill={ak.muted} />
        <line
          x1="396"
          y1="96"
          x2="524"
          y2="96"
          stroke={ak.border}
          strokeWidth="1"
        />

        {/* Success badge */}
        <g transform="translate(424 116)">
          <circle cx="36" cy="36" r="36" fill={ak.success} opacity="0.14" />
          <path
            d="M22 38 l10 10 20 -26"
            fill="none"
            stroke={ak.success}
            strokeWidth="5"
            className="ak-check-pop"
          />
        </g>

        <text
          x="460"
          y="212"
          textAnchor="middle"
          fill={ak.foreground}
          fontSize="16"
          fontWeight="800"
        >
          Aprovado
        </text>
        <text
          x="460"
          y="230"
          textAnchor="middle"
          fill={ak.mutedForeground}
          fontSize="11"
        >
          decisão assinada
        </text>

        {/* Token row */}
        <rect
          x="404"
          y="252"
          width="112"
          height="30"
          rx="8"
          fill={ak.muted}
        />
        <circle cx="418" cy="267" r="4" fill={ak.accent} className="ak-pulse" />
        <text
          x="428"
          y="271"
          fill={ak.foreground}
          fontSize="11"
          fontWeight="700"
        >
          comprovante assinado
        </text>

        {/* Expiry chip */}
        <rect
          x="404"
          y="290"
          width="112"
          height="24"
          rx="6"
          fill="none"
          stroke={ak.border}
          strokeDasharray="3 3"
        />
        <text
          x="460"
          y="306"
          textAnchor="middle"
          fill={ak.mutedForeground}
          fontSize="10"
        >
          expira em 24h
        </text>
      </g>

      {/* ── Footnote: data NOT shared (separated from the halo) ── */}
      <line
        x1="180"
        y1="364"
        x2="380"
        y2="364"
        stroke={ak.border}
      />
      <text
        x="280"
        y="380"
        textAnchor="middle"
        fill={ak.mutedForeground}
        fontSize="9"
        fontWeight="700"
        letterSpacing="0.12em"
      >
        NUNCA COMPARTILHADO
      </text>
      <text
        x="280"
        y="394"
        textAnchor="middle"
        fill={ak.mutedForeground}
        fontSize="10"
      >
        nome · documento · data de nascimento · foto
      </text>
    </svg>
  );
}
