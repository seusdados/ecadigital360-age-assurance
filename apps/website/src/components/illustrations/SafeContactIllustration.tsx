import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

export default function SafeContactIllustration({ className, ...props }: SVGProps<SVGSVGElement>) {
  const fields = ['Empresa', 'Email corporativo', 'Segmento', 'Volume estimado'];
  const blocked = ['CPF', 'documento', 'data de nascimento', 'selfie'];
  return (
    <svg
      viewBox="0 0 960 560"
      role="img"
      aria-label="Formulário corporativo do AgeKey com aviso para não enviar dados sensíveis"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="960" height="560" rx="28" fill={ak.background} />
      <circle cx="158" cy="146" r="116" fill={ak.accent} opacity="0.08" className="ak-breathe" />
      <circle cx="820" cy="438" r="86" fill={ak.primary} opacity="0.035" />
      <g transform="translate(68 72)" className="ak-card">
        <rect width="402" height="434" rx="20" fill={ak.card} stroke={ak.border} />
        <text x="34" y="62" fill={ak.foreground} fontSize="34" fontWeight="900">Fale com o AgeKey</text>
        <text x="34" y="92" fill={ak.mutedForeground} fontSize="15">Aceitamos apenas informações corporativas.</text>
        {fields.map((field, i) => (
          <g key={field} transform={`translate(34 ${132 + i * 62})`} className={`ak-reveal-${i + 1}`}>
            <text x="0" y="0" fill={ak.foreground} fontSize="13" fontWeight="800">{field}</text>
            <rect y="12" width="330" height="34" rx="9" fill={ak.background} stroke={ak.border} />
            <circle cx="18" cy="29" r="6" fill={ak.accent} opacity="0.2" />
            <rect x="36" y="25" width="156" height="8" rx="4" fill={ak.input} />
          </g>
        ))}
        <g transform="translate(34 386)">
          <rect width="230" height="44" rx="10" fill={ak.primary} />
          <text x="115" y="28" textAnchor="middle" fill={ak.primaryForeground} fontSize="15" fontWeight="850">Solicitar demonstração</text>
        </g>
      </g>
      <path d="M470 286 H560" stroke={ak.accent} strokeWidth="2.2" className="ak-flow-line" />
      <g transform="translate(540 238)" className="ak-float-slow">
        <circle cx="54" cy="54" r="54" fill={ak.card} stroke={ak.border} />
        <path d="M54 20 L83 33 V60 C83 82 68 97 54 104 C40 97 25 82 25 60 V33 Z" fill={ak.primary} />
        <path d="M40 61 l12 12 28 -38" fill="none" stroke={ak.accent} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <text x="54" y="138" textAnchor="middle" fill={ak.foreground} fontSize="15" fontWeight="800">Privacy Guard</text>
      </g>
      <path d="M650 286 H716" stroke={ak.warning} strokeWidth="2" className="ak-flow-line-short" opacity="0.6" />
      <g transform="translate(694 102)" className="ak-card">
        <rect width="286" height="404" rx="20" fill={ak.card} stroke={ak.border} />
        <circle cx="143" cy="62" r="30" fill={ak.accent} opacity="0.16" className="ak-pulse-slow" />
        <path d="M143 38 L166 48 V68 C166 85 154 97 143 102 C132 97 120 85 120 68 V48 Z" fill={ak.primary} />
        <text x="143" y="128" textAnchor="middle" fill={ak.foreground} fontSize="25" fontWeight="900">Não envie</text>
        <text x="143" y="158" textAnchor="middle" fill={ak.foreground} fontSize="25" fontWeight="900">dados sensíveis</text>
        <line x1="34" y1="186" x2="252" y2="186" stroke={ak.border} />
        {blocked.map((item, i) => (
          <g key={item} transform={`translate(34 ${214 + i * 50})`} className={`ak-reveal-${i + 1}`}>
            <rect width="218" height="34" rx="9" fill={ak.background} stroke={ak.border} />
            <path d="M20 17 h18" stroke={ak.warning} strokeWidth="2.1" strokeLinecap="round" />
            <path d="M29 8 v18" stroke={ak.warning} strokeWidth="2.1" strokeLinecap="round" />
            <text x="52" y="22" fill={ak.mutedForeground} fontSize="14" fontWeight="700">{item}</text>
            <rect x="192" y="11" width="10" height="13" rx="2" fill={ak.primary} opacity="0.9" />
          </g>
        ))}
        <line x1="34" y1="420" x2="252" y2="420" stroke={ak.border} />
        <text x="143" y="452" textAnchor="middle" fill={ak.mutedForeground} fontSize="13">Privacidade por design.</text>
      </g>
    </svg>
  );
}
