import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const events = [
  { key: 'aprovado', tone: 'success' as const },
  { key: 'negado', tone: 'neutral' as const },
  { key: 'expirado', tone: 'warning' as const },
  { key: 'revogado', tone: 'warning' as const },
  { key: 'emissor não confiável', tone: 'warning' as const },
];

export default function WebhookEventsFlow({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1000 480"
      role="img"
      aria-label="Fluxo de eventos assinados do AgeKey para o backend do cliente"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      <defs>
        <marker
          id="ak-wh-arrow"
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

      {/* ── LEFT: AgeKey Events publisher ───────────────────── */}
      <g transform="translate(48 144)" className="ak-float-slow">
        <rect width="240" height="192" rx="20" fill={ak.foreground} />
        <circle cx="120" cy="64" r="28" fill={ak.accent} opacity="0.22" className="ak-pulse" />
        <path
          d="M120 40 L140 48 V70 C140 86 130 98 120 104 C110 98 100 86 100 70 V48 Z"
          fill={ak.background}
        />
        <path
          d="M108 68 l8 8 14 -18"
          fill="none"
          stroke={ak.accent}
          strokeWidth="3.5"
        />
        <text
          x="120"
          y="138"
          textAnchor="middle"
          fill={ak.background}
          fontSize="15"
          fontWeight="800"
        >
          AgeKey
        </text>
        <text
          x="120"
          y="158"
          textAnchor="middle"
          fill={ak.background}
          opacity="0.7"
          fontSize="11"
        >
          publica eventos assinados
        </text>
      </g>

      {/* Connector */}
      <line
        x1="288"
        y1="240"
        x2="360"
        y2="240"
        stroke={ak.foreground}
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      <line
        x1="288"
        y1="240"
        x2="360"
        y2="240"
        stroke={ak.accent}
        strokeWidth="1.5"
        strokeDasharray="2 5"
        className="ak-flow-line"
        markerEnd="url(#ak-wh-arrow)"
      />

      {/* ── CENTER: Eventos card ────────────────────────────── */}
      <g transform="translate(364 60)" className="ak-card">
        <rect width="312" height="360" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="28" y="48" fill={ak.foreground} fontSize="15" fontWeight="800">
          Eventos
        </text>
        <text x="28" y="68" fill={ak.mutedForeground} fontSize="12">
          assinados com expiração
        </text>
        <g transform="translate(28 92)">
          {events.map((e, i) => {
            const dotColor =
              e.tone === 'success' ? ak.success : e.tone === 'warning' ? ak.warning : ak.mutedForeground;
            return (
              <g key={e.key} transform={`translate(0 ${i * 46})`}>
                <rect
                  width="256"
                  height="34"
                  rx="9"
                  fill={ak.muted}
                  stroke={ak.border}
                />
                <circle
                  cx="18"
                  cy="17"
                  r="5"
                  fill={dotColor}
                  className={e.tone === 'success' ? 'ak-pulse' : ''}
                />
                <text x="34" y="22" fill={ak.foreground} fontSize="12" fontWeight="600">
                  {e.key}
                </text>
              </g>
            );
          })}
        </g>
        <g transform="translate(28 326)">
          <rect width="256" height="22" rx="6" fill={ak.accent} opacity="0.16" />
          <text x="128" y="15" textAnchor="middle" fill={ak.foreground} fontSize="10" fontWeight="700">
            assinatura digital · expira
          </text>
        </g>
      </g>

      {/* Connector to backend */}
      <line
        x1="676"
        y1="240"
        x2="748"
        y2="240"
        stroke={ak.foreground}
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      <line
        x1="676"
        y1="240"
        x2="748"
        y2="240"
        stroke={ak.accent}
        strokeWidth="1.5"
        strokeDasharray="2 5"
        className="ak-flow-line"
        markerEnd="url(#ak-wh-arrow)"
      />

      {/* ── RIGHT: backend do cliente ───────────────────────── */}
      <g transform="translate(752 144)" className="ak-soft-card">
        <rect width="200" height="192" rx="20" fill={ak.card} stroke={ak.border} />
        {/* server stack icon */}
        <g transform="translate(80 36)">
          <rect width="40" height="14" rx="3" fill={ak.muted} stroke={ak.border} />
          <circle cx="8" cy="7" r="2" fill={ak.success} />
          <rect y="20" width="40" height="14" rx="3" fill={ak.muted} stroke={ak.border} />
          <circle cx="8" cy="27" r="2" fill={ak.success} />
          <rect y="40" width="40" height="14" rx="3" fill={ak.muted} stroke={ak.border} />
          <circle cx="8" cy="47" r="2" fill={ak.success} />
        </g>
        <text
          x="100"
          y="120"
          textAnchor="middle"
          fill={ak.foreground}
          fontSize="15"
          fontWeight="800"
        >
          Backend
        </text>
        <text
          x="100"
          y="140"
          textAnchor="middle"
          fill={ak.mutedForeground}
          fontSize="12"
        >
          do cliente
        </text>
        <g transform="translate(40 160)">
          <rect width="120" height="20" rx="6" fill={ak.success} opacity="0.16" />
          <circle cx="14" cy="10" r="3" fill={ak.success} />
          <text x="26" y="14" fill={ak.foreground} fontSize="10" fontWeight="700">
            recebido · 200
          </text>
        </g>
      </g>
    </svg>
  );
}
