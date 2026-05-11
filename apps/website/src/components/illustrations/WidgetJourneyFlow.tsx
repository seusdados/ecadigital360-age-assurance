import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const screens = [
  { title: 'Confirmar elegibilidade', chip: 'consentimento' },
  { title: 'Compartilhar mínimo', chip: 'prova' },
  { title: 'Verificação concluída', chip: 'resultado' },
  { title: 'Voltar à plataforma', chip: 'retorno' },
] as const;

export default function WidgetJourneyFlow({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  const cardW = 220;
  const cardH = 320;
  const gap = 40;
  const startX = (1120 - (cardW * 4 + gap * 3)) / 2;
  const spineY = 56;
  const cardY = 96;

  return (
    <svg
      viewBox="0 0 1120 480"
      role="img"
      aria-label="Jornada do widget AgeKey: consentimento, prova mínima, conclusão e retorno à plataforma"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      {/* Spine */}
      <line
        x1={startX + cardW / 2}
        y1={spineY}
        x2={startX + cardW * 3 + gap * 3 + cardW / 2}
        y2={spineY}
        stroke={ak.border}
        strokeWidth="2"
      />
      <line
        x1={startX + cardW / 2}
        y1={spineY}
        x2={startX + cardW * 3 + gap * 3 + cardW / 2}
        y2={spineY}
        stroke={ak.accent}
        strokeWidth="2"
        strokeDasharray="3 6"
        className="ak-flow-line"
      />

      {screens.map((s, i) => {
        const x = startX + i * (cardW + gap);
        const isSuccess = i === 2;
        return (
          <g key={s.title} transform={`translate(${x} 0)`}>
            {/* Number circle on spine */}
            <circle
              cx={cardW / 2}
              cy={spineY}
              r="22"
              fill={isSuccess ? ak.success : ak.foreground}
            />
            <text
              x={cardW / 2}
              y={spineY + 6}
              textAnchor="middle"
              fill={isSuccess ? ak.successForeground : ak.background}
              fontSize="14"
              fontWeight="800"
            >
              {i + 1}
            </text>

            <g className={`ak-card ak-reveal-${i + 1}`}>
              {/* Device frame */}
              <rect
                x="0"
                y={cardY}
                width={cardW}
                height={cardH}
                rx="20"
                fill={ak.card}
                stroke={ak.border}
              />
              <rect
                x="8"
                y={cardY + 8}
                width={cardW - 16}
                height={cardH - 16}
                rx="14"
                fill={ak.background}
              />
              {/* status dots */}
              <circle cx="20" cy={cardY + 24} r="3" fill={ak.foreground} opacity="0.45" />
              <circle cx="30" cy={cardY + 24} r="3" fill={ak.foreground} opacity="0.22" />
              <circle cx="40" cy={cardY + 24} r="3" fill={ak.foreground} opacity="0.22" />
              {/* url pill */}
              <rect x="56" y={cardY + 18} width="140" height="12" rx="6" fill={ak.muted} />
              {/* divider */}
              <line
                x1="16"
                y1={cardY + 40}
                x2={cardW - 16}
                y2={cardY + 40}
                stroke={ak.border}
              />

              {/* title */}
              <text
                x={cardW / 2}
                y={cardY + 72}
                textAnchor="middle"
                fill={ak.foreground}
                fontSize="14"
                fontWeight="800"
              >
                {s.title}
              </text>

              {/* glyph */}
              <g transform={`translate(${cardW / 2 - 32} ${cardY + 100})`}>
                {i === 0 && (
                  <>
                    <rect width="64" height="48" rx="10" fill={ak.muted} />
                    <rect x="22" y="22" width="20" height="16" rx="2.5" fill={ak.foreground} />
                    <path
                      d="M26 22 v-6 a6 6 0 0 1 12 0 v6"
                      fill="none"
                      stroke={ak.foreground}
                      strokeWidth="2"
                    />
                  </>
                )}
                {i === 1 && (
                  <g transform="translate(16 0)">
                    <path
                      d="M16 0 L40 10 V32 C40 48 30 58 16 64 C2 58 -8 48 -8 32 V10 Z"
                      fill="none"
                      stroke={ak.foreground}
                      strokeWidth="2.4"
                    />
                    <path
                      d="M4 32 l8 8 14 -18"
                      fill="none"
                      stroke={ak.accent}
                      strokeWidth="3"
                    />
                  </g>
                )}
                {i === 2 && (
                  <g transform="translate(8 0)">
                    <circle cx="24" cy="24" r="24" fill={ak.success} opacity="0.18" />
                    <path
                      d="M13 26 l8 8 15 -22"
                      fill="none"
                      stroke={ak.success}
                      strokeWidth="4.5"
                      className="ak-check-pop"
                    />
                  </g>
                )}
                {i === 3 && (
                  <g transform="translate(0 16)">
                    <path
                      d="M6 16 h44 M40 6 l14 10 -14 10"
                      fill="none"
                      stroke={ak.foreground}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                )}
              </g>

              {/* chip */}
              <g transform={`translate(${cardW / 2 - 56} ${cardY + 192})`}>
                <rect
                  width="112"
                  height="28"
                  rx="9"
                  fill={isSuccess ? ak.success : ak.accent}
                  opacity="0.16"
                />
                <text
                  x="56"
                  y="19"
                  textAnchor="middle"
                  fill={ak.foreground}
                  fontSize="11"
                  fontWeight="700"
                >
                  {s.chip}
                </text>
              </g>

              {/* footnote */}
              <text
                x={cardW / 2}
                y={cardY + 250}
                textAnchor="middle"
                fill={ak.mutedForeground}
                fontSize="11"
              >
                sem identidade civil
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
