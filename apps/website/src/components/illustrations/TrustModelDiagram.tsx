import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const actors = [
  { title: 'Emissor', body: 'emite credencial', x: 48, isCore: false },
  { title: 'Portador', body: 'apresenta prova', x: 280, isCore: false },
  { title: 'AgeKey', body: 'valida · minimiza', x: 512, isCore: true },
  { title: 'Plataforma', body: 'recebe decisão', x: 744, isCore: false },
] as const;

const handoffs = ['credencial · atestado', 'prova', 'decisão mínima'];

export default function TrustModelDiagram({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1000 480"
      role="img"
      aria-label="Modelo de confiança AgeKey: emissor, portador, AgeKey e plataforma cliente, mediados pelo Trust Registry"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      <defs>
        <marker
          id="ak-tm-arrow"
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

      {/* Connectors between actors */}
      {[0, 1, 2].map((i) => {
        const startX = actors[i].x + 192;
        const endX = actors[i + 1].x + 16;
        const y = 196;
        return (
          <g key={`hand-${i}`}>
            <text
              x={(startX + endX) / 2}
              y={y - 14}
              textAnchor="middle"
              fill={ak.mutedForeground}
              fontSize="11"
            >
              {handoffs[i]}
            </text>
            <line
              x1={startX}
              y1={y}
              x2={endX}
              y2={y}
              stroke={ak.foreground}
              strokeOpacity="0.25"
              strokeWidth="1.5"
            />
            <line
              x1={startX}
              y1={y}
              x2={endX}
              y2={y}
              stroke={ak.accent}
              strokeWidth="1.5"
              strokeDasharray="2 5"
              className="ak-flow-line"
              markerEnd="url(#ak-tm-arrow)"
            />
          </g>
        );
      })}

      {/* Actor cards */}
      {actors.map((a) => (
        <g key={a.title} transform={`translate(${a.x} 84)`} className={a.isCore ? 'ak-card ak-float-slow' : 'ak-soft-card'}>
          <rect
            width="208"
            height="224"
            rx="18"
            fill={a.isCore ? ak.foreground : ak.card}
            stroke={a.isCore ? ak.foreground : ak.border}
          />
          {/* Avatar */}
          <g transform="translate(70 36)">
            <circle cx="34" cy="34" r="34" fill={a.isCore ? ak.accent : ak.accent} opacity={a.isCore ? '0.22' : '0.16'} />
            {a.isCore ? (
              <>
                <path
                  d="M34 12 L54 22 V44 C54 60 44 72 34 78 C24 72 14 60 14 44 V22 Z"
                  fill={ak.background}
                />
                <path
                  d="M22 42 l8 8 14 -18"
                  fill="none"
                  stroke={ak.accent}
                  strokeWidth="3.5"
                  className="ak-check-pop"
                />
              </>
            ) : (
              <>
                <circle cx="34" cy="28" r="11" fill={ak.foreground} />
                <path
                  d="M14 60 c4 -12 14 -18 20 -18 s16 6 20 18"
                  fill={ak.foreground}
                />
              </>
            )}
          </g>
          <text
            x="104"
            y="142"
            textAnchor="middle"
            fill={a.isCore ? ak.background : ak.foreground}
            fontSize="15"
            fontWeight="800"
          >
            {a.title}
          </text>
          <text
            x="104"
            y="164"
            textAnchor="middle"
            fill={a.isCore ? ak.background : ak.mutedForeground}
            opacity={a.isCore ? '0.7' : '1'}
            fontSize="12"
          >
            {a.body}
          </text>
          {/* status row */}
          <g transform="translate(28 184)">
            <rect
              width="152"
              height="24"
              rx="7"
              fill={a.isCore ? ak.background : ak.muted}
              opacity={a.isCore ? '0.1' : '1'}
              stroke={a.isCore ? ak.accent : ak.border}
              strokeOpacity={a.isCore ? '0.4' : '1'}
            />
            <circle cx="14" cy="12" r="3.5" fill={a.isCore ? ak.accent : ak.success} className={a.isCore ? 'ak-pulse' : ''} />
            <text
              x="28"
              y="16"
              fill={a.isCore ? ak.background : ak.foreground}
              fontSize="10"
              fontWeight="600"
            >
              confiável
            </text>
          </g>
        </g>
      ))}

      {/* Trust Registry callout */}
      <line
        x1="616"
        y1="308"
        x2="616"
        y2="364"
        stroke={ak.accent}
        strokeWidth="1.5"
        strokeDasharray="2 5"
        className="ak-flow-line"
      />
      <g transform="translate(372 364)" className="ak-card">
        <rect width="488" height="76" rx="16" fill={ak.card} stroke={ak.border} />
        <circle cx="40" cy="38" r="18" fill={ak.accent} opacity="0.18" />
        <path
          d="M40 24 L54 30 V44 C54 56 48 64 40 68 C32 64 26 56 26 44 V30 Z"
          fill={ak.foreground}
          opacity="0.85"
        />
        <text x="72" y="34" fill={ak.foreground} fontSize="15" fontWeight="800">
          Registro de Confiança
        </text>
        <text x="72" y="56" fill={ak.mutedForeground} fontSize="12">
          define emissores e métodos confiáveis
        </text>
      </g>
    </svg>
  );
}
