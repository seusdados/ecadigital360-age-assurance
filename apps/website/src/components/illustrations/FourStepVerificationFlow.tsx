import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

type Step = {
  n: string;
  title: string;
  body: string;
};

const steps: Step[] = [
  { n: '1', title: 'Criar sessão', body: 'política + contexto' },
  { n: '2', title: 'Escolher método', body: 'gateway, credencial, prova' },
  { n: '3', title: 'Provar o necessário', body: 'sem identidade civil' },
  { n: '4', title: 'Receber resultado', body: 'token + decisão mínima' },
];

export default function FourStepVerificationFlow({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  // 4 nodes spaced on a 960-wide canvas, 80px side padding, ~200px per step.
  const stepWidth = 200;
  const gap = 16;
  const startX = 56;

  return (
    <svg
      viewBox="0 0 960 320"
      role="img"
      aria-label="Fluxo AgeKey em quatro passos: criar sessão, escolher método, provar o necessário e receber resultado mínimo"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      {/* Spine connecting the four step circles */}
      <line
        x1="100"
        y1="80"
        x2="860"
        y2="80"
        stroke={ak.border}
        strokeWidth="1.5"
      />
      <line
        x1="100"
        y1="80"
        x2="860"
        y2="80"
        stroke={ak.accent}
        strokeWidth="1.5"
        className="ak-flow-line"
        strokeDasharray="2 6"
      />

      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const cx = startX + i * (stepWidth + gap) + stepWidth / 2;
        return (
          <g key={s.n} transform={`translate(${cx - stepWidth / 2} 0)`}>
            {/* Numbered circle on the spine */}
            <circle
              cx={stepWidth / 2}
              cy="80"
              r="24"
              fill={isLast ? ak.success : ak.foreground}
            />
            <text
              x={stepWidth / 2}
              y="87"
              textAnchor="middle"
              fill={isLast ? ak.successForeground : ak.background}
              fontSize="16"
              fontWeight="800"
            >
              {s.n}
            </text>

            {/* Title */}
            <text
              x={stepWidth / 2}
              y="156"
              textAnchor="middle"
              fill={ak.foreground}
              fontSize="16"
              fontWeight="700"
            >
              {s.title}
            </text>

            {/* Body */}
            <text
              x={stepWidth / 2}
              y="180"
              textAnchor="middle"
              fill={ak.mutedForeground}
              fontSize="13"
            >
              {s.body}
            </text>

            {/* Glyph badge */}
            <g transform={`translate(${stepWidth / 2 - 28} 208)`}>
              <rect
                width="56"
                height="56"
                rx="14"
                fill={isLast ? ak.success : ak.muted}
                opacity={isLast ? '0.12' : '1'}
                stroke={isLast ? ak.success : ak.border}
                strokeOpacity={isLast ? '0.3' : '1'}
              />
              {i === 0 && (
                <path
                  d="M16 22 h24 v16 h-24z M22 38 h12"
                  fill="none"
                  stroke={ak.foreground}
                  strokeWidth="2"
                />
              )}
              {i === 1 && (
                <path
                  d="M28 16 l16 8 -16 8 -16 -8z M28 32 v14 M14 39 h28"
                  fill="none"
                  stroke={ak.foreground}
                  strokeWidth="2"
                />
              )}
              {i === 2 && (
                <path
                  d="M28 14 L44 22 V36 C44 46 36 53 28 56 C20 53 12 46 12 36 V22 Z"
                  fill="none"
                  stroke={ak.foreground}
                  strokeWidth="2.2"
                />
              )}
              {i === 3 && (
                <path
                  d="M16 30 l8 9 18 -22"
                  fill="none"
                  stroke={ak.success}
                  strokeWidth="4"
                  className="ak-check-pop"
                />
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
