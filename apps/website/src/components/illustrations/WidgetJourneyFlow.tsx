import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const screens = [
  ['Confirmar elegibilidade', 'consentimento'],
  ['Compartilhar o necessário', 'prova'],
  ['Verificação concluída', 'resultado'],
  ['Retornar à plataforma', 'retorno'],
] as const;

export default function WidgetJourneyFlow({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1040 520"
      role="img"
      aria-label="Jornada do widget AgeKey: consentimento mínimo, prova necessária, conclusão e retorno à plataforma"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="1040" height="520" rx="28" fill={ak.background} />
      <path d="M190 260 H850" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" />
      {screens.map(([title, chip], i) => {
        const x = 72 + i * 246;
        return (
          <g key={title} transform={`translate(${x} 108)`} className={`ak-card ak-reveal-${i + 1}`}>
            <rect width="196" height="304" rx="18" fill={ak.card} stroke={ak.border} />
            <rect x="18" y="26" width="160" height="224" rx="13" fill={ak.background} stroke={ak.border} />
            <circle cx="40" cy="44" r="4" fill={ak.accent} />
            <circle cx="54" cy="44" r="4" fill={ak.accent} opacity="0.6" />
            <circle cx="68" cy="44" r="4" fill={ak.accent} opacity="0.35" />
            <text x="98" y="96" textAnchor="middle" fill={ak.foreground} fontSize="17" fontWeight="800">{title}</text>
            <rect x="44" y="134" width="108" height="32" rx="9" fill={i === 2 ? ak.success : ak.accent} opacity="0.14" />
            <text x="98" y="155" textAnchor="middle" fill={ak.foreground} fontSize="13" fontWeight="700">{chip}</text>
            {i === 0 && <path d="M78 188 h40 M78 206 h40" stroke={ak.mutedForeground} opacity="0.55" strokeWidth="2.2" strokeLinecap="round" />}
            {i === 1 && <path d="M98 180 L124 190 V214 C124 232 112 244 98 250 C84 244 72 232 72 214 V190 Z" fill="none" stroke={ak.foreground} strokeWidth="2.6" />}
            {i === 2 && <path d="M70 210 l18 18 42 -58" stroke={ak.success} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" className="ak-check-pop" />}
            {i === 3 && <path d="M68 188 h62 M112 170 l26 26 -26 26" stroke={ak.foreground} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
            <text x="98" y="280" textAnchor="middle" fill={ak.mutedForeground} fontSize="12">sem dados civis</text>
          </g>
        );
      })}
    </svg>
  );
}
