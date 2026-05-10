import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

export default function TrustModelDiagram({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1040 560"
      role="img"
      aria-label="Modelo de confiança com emissor, usuário, AgeKey Verifier e plataforma cliente"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="1040" height="560" rx="28" fill={ak.background} />
      <path d="M246 238 H392" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" />
      <path d="M520 238 H666" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" />
      <path d="M794 238 H920" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" />
      <text x="316" y="218" fill={ak.mutedForeground} fontSize="14" textAnchor="middle">credencial/atestado</text>
      <text x="590" y="218" fill={ak.mutedForeground} fontSize="14" textAnchor="middle">prova/atestado</text>
      <text x="855" y="218" fill={ak.mutedForeground} fontSize="14" textAnchor="middle">decisão mínima</text>
      {[
        ['Issuer / Attestor', 'emite credencial ou atestado', 72, 150],
        ['Holder', 'apresenta prova', 346, 150],
        ['AgeKey Verifier', 'valida e minimiza', 620, 150],
        ['Relying Party', 'recebe resultado', 846, 150],
      ].map(([title, subtitle, x, y], i) => (
        <g key={title} transform={`translate(${x} ${y})`} className={`ak-card ak-reveal-${i + 1}`}>
          <rect width="174" height="176" rx="18" fill={ak.card} stroke={ak.border} />
          <circle cx="87" cy="58" r="34" fill={i === 2 ? ak.primary : ak.accent} opacity={i === 2 ? '1' : '0.14'} />
          {i === 2 ? <path d="M87 32 L111 42 V64 C111 82 99 96 87 102 C75 96 63 82 63 64 V42 Z" fill={ak.primaryForeground} /> : <circle cx="87" cy="58" r="15" fill={ak.accent} opacity="0.65" />}
          <text x="87" y="122" textAnchor="middle" fill={ak.foreground} fontSize="18" fontWeight="800">{title}</text>
          <text x="87" y="148" textAnchor="middle" fill={ak.mutedForeground} fontSize="13">{subtitle}</text>
        </g>
      ))}
      <path d="M707 326 V394" stroke={ak.accent} strokeWidth="2" className="ak-flow-line-short" />
      <g transform="translate(562 394)" className="ak-card">
        <rect width="290" height="82" rx="17" fill={ak.card} stroke={ak.border} />
        <circle cx="40" cy="41" r="16" fill={ak.accent} opacity="0.16" />
        <text x="66" y="38" fill={ak.foreground} fontSize="19" fontWeight="800">Trust Registry</text>
        <text x="66" y="60" fill={ak.mutedForeground} fontSize="13">emissores e métodos confiáveis</text>
      </g>
    </svg>
  );
}
