import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

export default function PolicyEngineDiagram({ className, ...props }: SVGProps<SVGSVGElement>) {
  const inputs = ['Aplicação', 'Produto', 'Jurisdição', 'Contexto de risco'];
  const rules = ['13+', '16+', '18+', '21+', 'faixa permitida'];
  return (
    <svg
      viewBox="0 0 980 520"
      role="img"
      aria-label="Policy Engine configura regras etárias por aplicação, produto, jurisdição e contexto"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="980" height="520" rx="28" fill={ak.background} />
      <g transform="translate(70 100)" className="ak-card">
        <rect width="230" height="300" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="30" y="48" fill={ak.foreground} fontSize="24" fontWeight="800">Entradas</text>
        {inputs.map((label, i) => (
          <g key={label} transform={`translate(30 ${86 + i * 52})`} className={`ak-reveal-${i + 1}`}>
            <rect width="170" height="34" rx="9" fill={ak.muted} stroke={ak.border} />
            <circle cx="20" cy="17" r="5" fill={ak.accent} />
            <text x="38" y="22" fill={ak.foreground} fontSize="14" fontWeight="650">{label}</text>
          </g>
        ))}
      </g>
      <path d="M300 250 H392" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" />
      <g transform="translate(392 86)" className="ak-float-slow">
        <rect width="260" height="328" rx="20" fill={ak.primary} />
        <text x="130" y="56" fill={ak.primaryForeground} fontSize="27" fontWeight="900" textAnchor="middle">Policy Engine</text>
        <text x="130" y="84" fill={ak.primaryForeground} opacity="0.75" fontSize="14" textAnchor="middle">threshold é regra da política</text>
        {rules.map((rule, i) => (
          <g key={rule} transform={`translate(${34 + (i % 2) * 104} ${118 + Math.floor(i / 2) * 58})`} className={`ak-reveal-${i + 1}`}>
            <rect width={i === 4 ? 194 : 78} height="38" rx="11" fill={ak.accent} opacity="0.95" />
            <text x={i === 4 ? 97 : 39} y="25" textAnchor="middle" fill={ak.accentForeground} fontSize="16" fontWeight="900">{rule}</text>
          </g>
        ))}
      </g>
      <path d="M652 250 H744" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" />
      <g transform="translate(744 152)" className="ak-card">
        <rect width="220" height="196" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="28" y="46" fill={ak.foreground} fontSize="23" fontWeight="800">Saída</text>
        <g transform="translate(28 82)">
          <rect width="164" height="34" rx="9" fill={ak.muted} stroke={ak.border} />
          <text x="82" y="22" textAnchor="middle" fill={ak.foreground} fontSize="14" fontWeight="700">policy_id</text>
        </g>
        <g transform="translate(28 132)">
          <rect width="164" height="34" rx="9" fill={ak.accent} opacity="0.16" stroke={ak.border} />
          <text x="82" y="22" textAnchor="middle" fill={ak.foreground} fontSize="14" fontWeight="700">threshold aplicado</text>
        </g>
      </g>
    </svg>
  );
}
