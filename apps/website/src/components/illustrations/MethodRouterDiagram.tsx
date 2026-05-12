import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const methods = [
  { title: 'Gateway', body: 'atestadores externos', x: 64, y: 96 },
  { title: 'Credencial', body: 'verificável', x: 64, y: 256 },
  { title: 'Prova', body: 'preparado para ZKP', x: 736, y: 96 },
  { title: 'Alternativa', body: 'fricção proporcional', x: 736, y: 256 },
] as const;

const outputs = [
  'política satisfeita',
  'nível de garantia',
  'expira em',
  'comprovante assinado',
];

export default function MethodRouterDiagram({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1000 480"
      role="img"
      aria-label="Verifier Core do AgeKey roteia gateway, credencial, prova ou alternativa para um resultado mínimo padronizado"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      <defs>
        <marker
          id="ak-mr-arrow"
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

      {/* Connectors from each method into the core */}
      {methods.map((m) => {
        const startX = m.x < 500 ? m.x + 200 : m.x;
        const endX = m.x < 500 ? 410 : 590;
        const cy = m.y + 36;
        const controlX = (startX + endX) / 2;
        return (
          <g key={`${m.title}-line`}>
            <path
              d={`M${startX} ${cy} C${controlX} ${cy} ${controlX} 240 ${endX} 240`}
              fill="none"
              stroke={ak.foreground}
              strokeOpacity="0.25"
              strokeWidth="1.5"
            />
            <path
              d={`M${startX} ${cy} C${controlX} ${cy} ${controlX} 240 ${endX} 240`}
              fill="none"
              stroke={ak.accent}
              strokeWidth="1.5"
              strokeDasharray="2 6"
              className="ak-flow-line"
            />
          </g>
        );
      })}

      {/* Method cards */}
      {methods.map((m) => (
        <g key={m.title} transform={`translate(${m.x} ${m.y})`} className="ak-card">
          <rect
            width="200"
            height="128"
            rx="14"
            fill={ak.card}
            stroke={ak.border}
          />
          <circle cx="36" cy="36" r="14" fill={ak.accent} opacity="0.2" />
          <circle cx="36" cy="36" r="6" fill={ak.accent} />
          <text x="60" y="32" fill={ak.foreground} fontSize="16" fontWeight="800">
            {m.title}
          </text>
          <text x="60" y="52" fill={ak.mutedForeground} fontSize="12">
            {m.body}
          </text>
          {/* Faux UI rows */}
          <rect x="20" y="76" width="160" height="6" rx="3" fill={ak.muted} />
          <rect x="20" y="90" width="120" height="6" rx="3" fill={ak.muted} opacity="0.6" />
        </g>
      ))}

      {/* Center: Verifier Core */}
      <g transform="translate(410 168)" className="ak-float-slow">
        <rect width="180" height="144" rx="20" fill={ak.foreground} />
        <circle cx="90" cy="50" r="34" fill={ak.accent} opacity="0" className="ak-glow" />
        <circle cx="90" cy="50" r="26" fill={ak.accent} opacity="0.22" />
        <g className="ak-tilt">
          <path
            d="M90 28 L110 36 V58 C110 74 100 86 90 92 C80 86 70 74 70 58 V36 Z"
            fill={ak.background}
          />
          <path
            d="M80 56 l8 8 14 -18"
            fill="none"
            stroke={ak.accent}
            strokeWidth="3.5"
            className="ak-check-pop"
          />
        </g>
        <text
          x="90"
          y="116"
          textAnchor="middle"
          fill={ak.background}
          fontSize="14"
          fontWeight="800"
        >
          Verifier Core
        </text>
        <text
          x="90"
          y="132"
          textAnchor="middle"
          fill={ak.background}
          opacity="0.7"
          fontSize="10"
        >
          normaliza
        </text>
      </g>

      {/* Connector core → output */}
      <line
        x1="500"
        y1="320"
        x2="500"
        y2="364"
        stroke={ak.foreground}
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      <line
        x1="500"
        y1="320"
        x2="500"
        y2="364"
        stroke={ak.accent}
        strokeWidth="1.5"
        strokeDasharray="2 5"
        className="ak-flow-line"
        markerEnd="url(#ak-mr-arrow)"
      />

      {/* Output card */}
      <g transform="translate(284 376)" className="ak-card">
        <rect
          width="432"
          height="80"
          rx="16"
          fill={ak.card}
          stroke={ak.border}
        />
        <text x="24" y="32" fill={ak.foreground} fontSize="13" fontWeight="800">
          Resultado mínimo
        </text>
        <g transform="translate(24 44)">
          {outputs.map((label, i) => (
            <g key={label} transform={`translate(${i * 100} 0)`}>
              <rect
                width="92"
                height="22"
                rx="6"
                fill={i === 3 ? ak.accent : ak.muted}
                opacity={i === 3 ? '0.16' : '1'}
                stroke={ak.border}
              />
              <text
                x="46"
                y="15"
                textAnchor="middle"
                fill={ak.foreground}
                fontSize="10"
                fontWeight={i === 3 ? '700' : '500'}
              >
                {label}
              </text>
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}
