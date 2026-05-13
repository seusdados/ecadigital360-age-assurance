import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const layers = [
  { title: 'Cliente', body: 'app · site · backend' },
  { title: 'Integração', body: 'API · Widget · SDK · eventos' },
  { title: 'AgeKey Core', body: 'Verifier · Policy Engine · Comprovante', isCore: true },
  { title: 'Confiança & evidência', body: 'Registro · Evidências · Revogação' },
  { title: 'Infraestrutura', body: 'Supabase · Vercel · GitHub' },
];

export default function PlatformArchitectureDiagram({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1040 560"
      role="img"
      aria-label="Arquitetura pública do AgeKey em cinco camadas: cliente, integração, core, confiança e infraestrutura"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      <defs>
        <marker
          id="ak-pa2-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0 0 L9 5 L0 10 Z" fill={ak.foreground} opacity="0.6" />
        </marker>
      </defs>

      {/* Vertical accent rail */}
      <line
        x1="520"
        y1="80"
        x2="520"
        y2="500"
        stroke={ak.accent}
        strokeWidth="2"
        strokeDasharray="3 6"
        className="ak-flow-line"
      />

      {layers.map((l, i) => {
        const y = 56 + i * 96;
        const isCore = 'isCore' in l && l.isCore;
        return (
          <g key={l.title} transform={`translate(120 ${y})`} className={`ak-card ak-reveal-${(i % 5) + 1}`}>
            <rect
              width="800"
              height="72"
              rx="16"
              fill={isCore ? ak.foreground : ak.card}
              stroke={isCore ? ak.foreground : ak.border}
            />
            {/* Layer index badge */}
            <g transform="translate(28 24)">
              <rect
                width="40"
                height="24"
                rx="6"
                fill={isCore ? ak.accent : ak.muted}
                opacity={isCore ? '1' : '1'}
                stroke={isCore ? ak.accent : ak.border}
                strokeOpacity={isCore ? '0' : '1'}
              />
              <text
                x="20"
                y="16"
                textAnchor="middle"
                fill={isCore ? ak.accentForeground : ak.foreground}
                fontSize="11"
                fontWeight="800"
              >
                L{i + 1}
              </text>
            </g>
            <text
              x="84"
              y="32"
              fill={isCore ? ak.background : ak.foreground}
              fontSize="16"
              fontWeight="800"
            >
              {l.title}
            </text>
            <text
              x="84"
              y="52"
              fill={isCore ? ak.background : ak.mutedForeground}
              opacity={isCore ? '0.7' : '1'}
              fontSize="12"
            >
              {l.body}
            </text>
            {/* status dot */}
            <circle
              cx="760"
              cy="36"
              r="5"
              fill={isCore ? ak.accent : ak.success}
              className={isCore ? 'ak-pulse' : ''}
            />
          </g>
        );
      })}

      {/* Side callout */}
      <g transform="translate(848 240)">
        <rect width="156" height="44" rx="10" fill={ak.card} stroke={ak.border} />
        <text x="78" y="20" textAnchor="middle" fill={ak.foreground} fontSize="11" fontWeight="700">
          comprovante
        </text>
        <text x="78" y="34" textAnchor="middle" fill={ak.mutedForeground} fontSize="10">
          retorno do core
        </text>
      </g>
      <path
        d="M848 262 C800 262 800 360 848 360"
        fill="none"
        stroke={ak.foreground}
        strokeOpacity="0.25"
        strokeWidth="1.5"
        markerEnd="url(#ak-pa2-arrow)"
      />
    </svg>
  );
}
