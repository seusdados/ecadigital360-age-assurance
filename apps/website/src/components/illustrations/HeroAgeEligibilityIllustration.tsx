import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

export default function HeroAgeEligibilityIllustration({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 960 560"
      role="img"
      aria-label="Fluxo AgeKey: plataforma envia política etária e recebe decisão mínima sem dados civis"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="960" height="560" rx="28" fill={ak.background} />
      <circle cx="805" cy="90" r="128" fill={ak.accent} opacity="0.08" className="ak-breathe" />
      <circle cx="110" cy="456" r="96" fill={ak.primary} opacity="0.04" />

      <g className="ak-soft-card">
        <rect x="72" y="116" width="250" height="280" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="104" y="160" fill={ak.foreground} fontSize="26" fontWeight="700">Sua plataforma</text>
        <text x="104" y="190" fill={ak.mutedForeground} fontSize="16">site, app ou comunidade</text>
        <rect x="104" y="236" width="188" height="86" rx="12" fill={ak.muted} stroke={ak.border} />
        <rect x="126" y="260" width="90" height="9" rx="5" fill={ak.mutedForeground} opacity="0.22" />
        <rect x="126" y="283" width="132" height="9" rx="5" fill={ak.mutedForeground} opacity="0.16" />
        <rect x="104" y="342" width="138" height="34" rx="9" fill={ak.accent} opacity="0.16" />
        <text x="122" y="364" fill={ak.foreground} fontSize="17" fontWeight="700">policy 18+</text>
      </g>

      <path d="M322 256 C386 256 408 256 460 256" fill="none" stroke={ak.accent} strokeWidth="2.2" className="ak-flow-line" />
      <circle cx="362" cy="256" r="5" fill={ak.accent} className="ak-pulse" />
      <text x="360" y="236" fill={ak.mutedForeground} fontSize="15" textAnchor="middle">política etária</text>

      <g className="ak-float-slow">
        <circle cx="480" cy="256" r="92" fill={ak.card} stroke={ak.border} strokeWidth="1.4" />
        <circle cx="480" cy="256" r="60" fill={ak.accent} opacity="0.12" />
        <path d="M480 182 L535 204 V250 C535 294 512 326 480 342 C448 326 425 294 425 250 V204 Z" fill={ak.primary} />
        <path d="M458 254 L474 270 L506 228" fill="none" stroke={ak.accent} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
        <text x="480" y="378" fill={ak.foreground} fontSize="22" fontWeight="800" textAnchor="middle">AgeKey</text>
        <text x="480" y="404" fill={ak.mutedForeground} fontSize="15" textAnchor="middle">minimiza e assina</text>
      </g>

      <path d="M560 256 C620 256 638 256 690 256" fill="none" stroke={ak.accent} strokeWidth="2.2" className="ak-flow-line" />
      <circle cx="636" cy="256" r="5" fill={ak.accent} className="ak-pulse" />
      <text x="626" y="236" fill={ak.mutedForeground} fontSize="15" textAnchor="middle">decisão mínima</text>

      <g className="ak-soft-card">
        <rect x="690" y="116" width="250" height="280" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="724" y="160" fill={ak.foreground} fontSize="26" fontWeight="700">Resultado</text>
        <text x="724" y="190" fill={ak.mutedForeground} fontSize="16">sem identidade civil</text>
        <rect x="724" y="236" width="154" height="34" rx="9" fill={ak.success} opacity="0.12" />
        <circle cx="742" cy="253" r="5" fill={ak.success} className="ak-pulse" />
        <text x="760" y="259" fill={ak.foreground} fontSize="16" fontWeight="700">approved</text>
        <rect x="724" y="286" width="130" height="34" rx="9" fill={ak.muted} stroke={ak.border} />
        <text x="744" y="308" fill={ak.mutedForeground} fontSize="15">denied</text>
        <rect x="724" y="336" width="174" height="34" rx="9" fill={ak.muted} stroke={ak.border} />
        <text x="744" y="358" fill={ak.mutedForeground} fontSize="15">needs_review</text>
      </g>

      <g transform="translate(178 448)">
        <rect width="584" height="56" rx="14" fill={ak.card} stroke={ak.border} />
        {['nome', 'documento', 'data de nascimento', 'selfie'].map((label, i) => (
          <g key={label} transform={`translate(${28 + i * 140} 16)`} className={`ak-reveal-${i + 1}`}>
            <rect width="118" height="24" rx="7" fill={ak.muted} stroke={ak.border} />
            <path d="M14 12 h15" stroke={ak.warning} strokeWidth="2" strokeLinecap="round" />
            <path d="M21 5 v14" stroke={ak.warning} strokeWidth="2" strokeLinecap="round" />
            <text x="38" y="17" fill={ak.mutedForeground} fontSize="13">{label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
