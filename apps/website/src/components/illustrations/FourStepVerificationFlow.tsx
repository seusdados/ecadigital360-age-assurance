import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

/**
 * Four-step verification flow — each step is a mini UI mockup inside a
 * card, with a numbered badge on the spine that connects all four.
 *
 *   1. Create session     (form-style card with policy chip)
 *   2. Choose method      (router with 4 method options)
 *   3. Prove minimally    (shield + minimization indicator)
 *   4. Receive result     (success badge with token)
 */
export default function FourStepVerificationFlow({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  const cardW = 230;
  const cardH = 240;
  const gap = 28;
  const startX = (1080 - (cardW * 4 + gap * 3)) / 2;
  const spineY = 64;
  const cardY = spineY + 40;

  const steps = [
    { n: '1', title: 'Criar sessão', body: 'política + contexto' },
    { n: '2', title: 'Escolher método', body: 'gateway · credencial · prova' },
    { n: '3', title: 'Provar o necessário', body: 'sem identidade civil' },
    { n: '4', title: 'Receber resultado', body: 'comprovante + decisão mínima' },
  ];

  return (
    <svg
      viewBox="0 0 1080 400"
      role="img"
      aria-label="Fluxo AgeKey em quatro passos: criar sessão, escolher método, provar o necessário e receber resultado mínimo"
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

      {steps.map((s, i) => {
        const x = startX + i * (cardW + gap);
        const isLast = i === steps.length - 1;
        const numCx = cardW / 2;

        return (
          <g key={s.n} transform={`translate(${x} 0)`}>
            {/* Numbered badge on spine */}
            <circle
              cx={numCx}
              cy={spineY}
              r="22"
              fill={isLast ? ak.success : ak.foreground}
            />
            <text
              x={numCx}
              y={spineY + 6}
              textAnchor="middle"
              fill={isLast ? ak.successForeground : ak.background}
              fontSize="15"
              fontWeight="800"
            >
              {s.n}
            </text>

            {/* Card */}
            <g className="ak-card">
              <rect
                x="0"
                y={cardY}
                width={cardW}
                height={cardH}
                rx="16"
                fill={ak.card}
                stroke={ak.border}
              />

              {/* Mini UI mockup per step (top half of card) */}
              {i === 0 && <Step1Form cardW={cardW} cardY={cardY} />}
              {i === 1 && <Step2Router cardW={cardW} cardY={cardY} />}
              {i === 2 && <Step3Shield cardW={cardW} cardY={cardY} />}
              {i === 3 && <Step4Success cardW={cardW} cardY={cardY} />}

              {/* Divider before titles */}
              <line
                x1="24"
                y1={cardY + 148}
                x2={cardW - 24}
                y2={cardY + 148}
                stroke={ak.border}
              />

              {/* Title + body */}
              <text
                x={cardW / 2}
                y={cardY + 178}
                textAnchor="middle"
                fill={ak.foreground}
                fontSize="15"
                fontWeight="700"
              >
                {s.title}
              </text>
              <text
                x={cardW / 2}
                y={cardY + 200}
                textAnchor="middle"
                fill={ak.mutedForeground}
                fontSize="12"
              >
                {s.body}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Per-step mini-mockups (rendered inside each step card) ─────── */

function Step1Form({ cardW, cardY }: { cardW: number; cardY: number }) {
  return (
    <g transform={`translate(28 ${cardY + 20})`}>
      {/* Mini form card */}
      <rect width={cardW - 56} height="100" rx="10" fill={ak.background} stroke={ak.border} />
      {/* Row label */}
      <rect x="16" y="16" width="48" height="6" rx="3" fill={ak.mutedForeground} opacity="0.35" />
      {/* Pill (policy) */}
      <rect x="16" y="30" width="80" height="22" rx="11" fill={ak.foreground} />
      <text
        x="56"
        y="44"
        textAnchor="middle"
        fill={ak.background}
        fontSize="10"
        fontWeight="800"
      >
        política 18+
      </text>
      {/* Faux input rows */}
      <rect x="16" y="64" width={cardW - 88} height="8" rx="4" fill={ak.muted} />
      <rect x="16" y="78" width={cardW - 120} height="8" rx="4" fill={ak.muted} opacity="0.6" />
    </g>
  );
}

function Step2Router({ cardW, cardY }: { cardW: number; cardY: number }) {
  const methods = ['gateway', 'credencial', 'prova', 'fallback'];
  return (
    <g transform={`translate(28 ${cardY + 20})`}>
      <rect width={cardW - 56} height="100" rx="10" fill={ak.background} stroke={ak.border} />
      {methods.map((m, i) => {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const isPrimary = i === 0;
        return (
          <g key={m} transform={`translate(${12 + col * 80} ${14 + row * 36})`}>
            <rect
              width="74"
              height="26"
              rx="7"
              fill={isPrimary ? ak.accent : ak.muted}
              opacity={isPrimary ? '0.2' : '1'}
              stroke={isPrimary ? ak.accent : ak.border}
              strokeOpacity={isPrimary ? '0.5' : '1'}
            />
            <circle cx="13" cy="13" r="3" fill={isPrimary ? ak.accent : ak.mutedForeground} opacity={isPrimary ? '1' : '0.4'} />
            <text x="22" y="17" fill={ak.foreground} fontSize="10" fontWeight={isPrimary ? '700' : '500'} opacity={isPrimary ? '1' : '0.7'}>
              {m}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function Step3Shield({ cardW, cardY }: { cardW: number; cardY: number }) {
  return (
    <g transform={`translate(28 ${cardY + 20})`}>
      <rect width={cardW - 56} height="100" rx="10" fill={ak.background} stroke={ak.border} />
      {/* Shield centered */}
      <g transform={`translate(${(cardW - 56) / 2 - 22} 14)`}>
        <circle cx="22" cy="32" r="30" fill={ak.accent} opacity="0.14" />
        <path
          d="M22 12 L40 20 V36 C40 50 32 60 22 64 C12 60 4 50 4 36 V20 Z"
          fill={ak.foreground}
        />
        <path
          d="M14 36 l6 7 12 -16"
          fill="none"
          stroke={ak.accent}
          strokeWidth="3.2"
        />
      </g>
      {/* Privacy label */}
      <rect
        x="32"
        y="76"
        width={cardW - 120}
        height="16"
        rx="4"
        fill="none"
        stroke={ak.border}
        strokeDasharray="3 3"
      />
      <text
        x={(cardW - 56) / 2}
        y="87"
        textAnchor="middle"
        fill={ak.mutedForeground}
        fontSize="9"
        fontWeight="600"
        letterSpacing="0.06em"
      >
        SEM IDENTIDADE CIVIL
      </text>
    </g>
  );
}

function Step4Success({ cardW, cardY }: { cardW: number; cardY: number }) {
  return (
    <g transform={`translate(28 ${cardY + 20})`}>
      <rect width={cardW - 56} height="100" rx="10" fill={ak.background} stroke={ak.border} />
      {/* Big check */}
      <g transform={`translate(${(cardW - 56) / 2 - 18} 10)`}>
        <circle cx="18" cy="18" r="18" fill={ak.success} opacity="0.14" />
        <path
          d="M9 19 l6 6 12 -16"
          fill="none"
          stroke={ak.success}
          strokeWidth="3.6"
          className="ak-check-pop"
        />
      </g>
      {/* Approved pill */}
      <rect
        x={(cardW - 56) / 2 - 36}
        y="56"
        width="72"
        height="20"
        rx="6"
        fill={ak.success}
        opacity="0.14"
      />
      <text
        x={(cardW - 56) / 2}
        y="69"
        textAnchor="middle"
        fill={ak.foreground}
        fontSize="11"
        fontWeight="700"
      >
        aprovado
      </text>
      {/* Token line */}
      <rect
        x="20"
        y="84"
        width={cardW - 96}
        height="8"
        rx="4"
        fill={ak.muted}
      />
      <circle cx="26" cy="88" r="2.5" fill={ak.accent} className="ak-pulse" />
    </g>
  );
}
