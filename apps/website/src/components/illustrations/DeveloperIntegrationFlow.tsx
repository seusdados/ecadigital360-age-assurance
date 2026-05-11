import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const nodes = [
  'app cliente',
  'cria sessão',
  'widget · redirect',
  'verifica',
  'callback · evento',
  'valida comprovante',
  'libera recurso',
] as const;

export default function DeveloperIntegrationFlow({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  const nodeWidth = 132;
  const gap = 16;
  const startX = (1120 - (nodeWidth * nodes.length + gap * (nodes.length - 1))) / 2;
  return (
    <svg
      viewBox="0 0 1120 440"
      role="img"
      aria-label="Fluxo de integração técnica do AgeKey: app cliente cria sessão, abre widget, verifica, recebe callback e valida comprovante"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      <defs>
        <marker
          id="ak-di-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0 0 L9 5 L0 10 Z" fill={ak.foreground} opacity="0.5" />
        </marker>
      </defs>

      {/* Spine */}
      <line
        x1={startX + nodeWidth / 2}
        y1="160"
        x2={startX + nodeWidth * (nodes.length - 1) + gap * (nodes.length - 1) + nodeWidth / 2}
        y2="160"
        stroke={ak.border}
        strokeWidth="2"
      />
      <line
        x1={startX + nodeWidth / 2}
        y1="160"
        x2={startX + nodeWidth * (nodes.length - 1) + gap * (nodes.length - 1) + nodeWidth / 2}
        y2="160"
        stroke={ak.accent}
        strokeWidth="2"
        strokeDasharray="3 6"
        className="ak-flow-line"
      />

      {nodes.map((label, i) => {
        const x = startX + i * (nodeWidth + gap);
        const isLast = i === nodes.length - 1;
        return (
          <g key={label} transform={`translate(${x} 0)`} className="ak-soft-card">
            {/* node circle on spine */}
            <circle cx={nodeWidth / 2} cy="160" r="12" fill={isLast ? ak.success : ak.foreground} />
            <text
              x={nodeWidth / 2}
              y="164"
              textAnchor="middle"
              fill={isLast ? ak.successForeground : ak.background}
              fontSize="11"
              fontWeight="800"
            >
              {i + 1}
            </text>

            {/* card */}
            <rect
              x="0"
              y="208"
              width={nodeWidth}
              height="148"
              rx="14"
              fill={ak.card}
              stroke={ak.border}
            />
            {/* glyph */}
            <g transform={`translate(${nodeWidth / 2 - 22} 226)`}>
              <rect width="44" height="44" rx="10" fill={isLast ? ak.success : ak.muted} opacity={isLast ? '0.15' : '1'} stroke={isLast ? ak.success : ak.border} strokeOpacity={isLast ? '0.4' : '1'} />
              {i === 0 && <path d="M12 14 h20 v18 h-20z M16 32 h12" fill="none" stroke={ak.foreground} strokeWidth="1.8" />}
              {i === 1 && <text x="22" y="29" textAnchor="middle" fill={ak.foreground} fontSize="11" fontWeight="800">API</text>}
              {i === 2 && <path d="M10 12 h24 v22 h-24z M14 18 h12 M14 24 h8" fill="none" stroke={ak.foreground} strokeWidth="1.8" />}
              {i === 3 && <path d="M22 10 L34 16 V28 C34 38 28 44 22 46 C16 44 10 38 10 28 V16 Z" fill="none" stroke={ak.foreground} strokeWidth="2" />}
              {i === 4 && <path d="M10 18 h24 M30 12 l6 6 -6 6 M34 28 h-24 M14 22 l-6 6 6 6" fill="none" stroke={ak.foreground} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
              {i === 5 && <g><rect x="10" y="12" width="24" height="22" rx="4" fill="none" stroke={ak.foreground} strokeWidth="1.8" /><path d="M16 23 h12" stroke={ak.accent} strokeWidth="2" strokeLinecap="round" /></g>}
              {i === 6 && <path d="M12 24 l6 6 14 -16" fill="none" stroke={ak.success} strokeWidth="3" className="ak-check-pop" />}
            </g>
            <text
              x={nodeWidth / 2}
              y="294"
              textAnchor="middle"
              fill={ak.foreground}
              fontSize="11"
              fontWeight="700"
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* Bottom callout */}
      <g transform="translate(380 376)">
        <rect width="360" height="44" rx="12" fill={ak.foreground} />
        <circle cx="28" cy="22" r="6" fill={ak.accent} className="ak-pulse" />
        <text x="46" y="27" fill={ak.background} fontSize="13" fontWeight="700">
          comprovante assinado · resultado mínimo
        </text>
      </g>

      {/* Arrows from spine into the bottom callout */}
      <line x1="560" y1="172" x2="560" y2="372" stroke={ak.foreground} strokeOpacity="0.25" strokeWidth="1.5" markerEnd="url(#ak-di-arrow)" />
    </svg>
  );
}
