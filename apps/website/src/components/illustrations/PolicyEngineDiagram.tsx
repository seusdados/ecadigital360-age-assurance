import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const inputs = ['aplicação', 'produto', 'jurisdição', 'contexto de risco'];
const rules = ['13+', '16+', '18+', '21+'];

export default function PolicyEngineDiagram({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 960 480"
      role="img"
      aria-label="Policy Engine recebe entradas de aplicação, produto, jurisdição e risco e devolve a regra etária aplicada"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      <defs>
        <marker
          id="ak-pe-arrow"
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

      {/* ── LEFT: inputs card ───────────────────────────────── */}
      <g className="ak-card">
        <rect
          x="48"
          y="80"
          width="232"
          height="320"
          rx="18"
          fill={ak.card}
          stroke={ak.border}
        />
        <text x="72" y="116" fill={ak.foreground} fontSize="16" fontWeight="800">
          Entradas
        </text>
        <text x="72" y="136" fill={ak.mutedForeground} fontSize="12">
          contexto da regra
        </text>
        <g transform="translate(72 160)">
          {inputs.map((label, i) => (
            <g key={label} transform={`translate(0 ${i * 52})`}>
              <rect width="184" height="36" rx="9" fill={ak.muted} stroke={ak.border} />
              <circle cx="20" cy="18" r="5" fill={ak.accent} />
              <text x="38" y="23" fill={ak.foreground} fontSize="13" fontWeight="600">
                {label}
              </text>
            </g>
          ))}
        </g>
      </g>

      {/* Connector left → engine */}
      <line
        x1="280"
        y1="240"
        x2="358"
        y2="240"
        stroke={ak.foreground}
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      <line
        x1="280"
        y1="240"
        x2="358"
        y2="240"
        stroke={ak.accent}
        strokeWidth="1.5"
        strokeDasharray="2 5"
        className="ak-flow-line"
        markerEnd="url(#ak-pe-arrow)"
      />

      {/* ── CENTER: Policy Engine ───────────────────────────── */}
      <g transform="translate(364 80)" className="ak-float-slow">
        <rect width="232" height="320" rx="20" fill={ak.foreground} />
        <text
          x="116"
          y="48"
          textAnchor="middle"
          fill={ak.background}
          fontSize="17"
          fontWeight="800"
        >
          Policy Engine
        </text>
        <text
          x="116"
          y="68"
          textAnchor="middle"
          fill={ak.background}
          opacity="0.7"
          fontSize="11"
        >
          regras configuráveis
        </text>
        <g transform="translate(28 96)">
          {rules.map((rule, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            return (
              <g key={rule} transform={`translate(${col * 88} ${row * 64})`}>
                <rect width="80" height="48" rx="12" fill={ak.accent} />
                <text
                  x="40"
                  y="30"
                  textAnchor="middle"
                  fill={ak.accentForeground}
                  fontSize="18"
                  fontWeight="900"
                >
                  {rule}
                </text>
              </g>
            );
          })}
          {/* faixa permitida row */}
          <rect y="128" width="168" height="48" rx="12" fill={ak.accent} opacity="0.4" />
          <text
            x="84"
            y="158"
            textAnchor="middle"
            fill={ak.accentForeground}
            fontSize="14"
            fontWeight="800"
          >
            faixa permitida
          </text>
        </g>
      </g>

      {/* Connector engine → output */}
      <line
        x1="596"
        y1="240"
        x2="674"
        y2="240"
        stroke={ak.foreground}
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      <line
        x1="596"
        y1="240"
        x2="674"
        y2="240"
        stroke={ak.accent}
        strokeWidth="1.5"
        strokeDasharray="2 5"
        className="ak-flow-line"
        markerEnd="url(#ak-pe-arrow)"
      />

      {/* ── RIGHT: output card ──────────────────────────────── */}
      <g className="ak-card">
        <rect
          x="680"
          y="120"
          width="232"
          height="240"
          rx="18"
          fill={ak.card}
          stroke={ak.border}
        />
        <text x="704" y="156" fill={ak.foreground} fontSize="16" fontWeight="800">
          Saída
        </text>
        <text x="704" y="176" fill={ak.mutedForeground} fontSize="12">
          regra resolvida
        </text>
        <g transform="translate(704 200)">
          <rect width="184" height="40" rx="10" fill={ak.muted} stroke={ak.border} />
          <text x="92" y="26" textAnchor="middle" fill={ak.foreground} fontSize="13" fontWeight="700">
            identificador da regra
          </text>
        </g>
        <g transform="translate(704 252)">
          <rect width="184" height="40" rx="10" fill={ak.accent} opacity="0.18" />
          <rect width="184" height="40" rx="10" fill="none" stroke={ak.accent} strokeOpacity="0.4" />
          <text x="92" y="26" textAnchor="middle" fill={ak.foreground} fontSize="14" fontWeight="800">
            18+
          </text>
        </g>
        <text
          x="796"
          y="320"
          textAnchor="middle"
          fill={ak.mutedForeground}
          fontSize="11"
        >
          regra da plataforma
        </text>
      </g>
    </svg>
  );
}
