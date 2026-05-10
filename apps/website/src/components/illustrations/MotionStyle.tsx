export function MotionStyle() {
  return (
    <style>{`
      .ak-svg-root * { vector-effect: non-scaling-stroke; }
      .ak-card { filter: drop-shadow(0 10px 18px rgb(24 28 37 / 0.04)); }
      .ak-soft-card { filter: drop-shadow(0 8px 14px rgb(24 28 37 / 0.035)); }
      .ak-flow-line { stroke-dasharray: 8 10; }
      .ak-flow-line-short { stroke-dasharray: 4 8; }
      .ak-node, .ak-chip, .ak-token, .ak-ring, .ak-gate { transform-box: fill-box; transform-origin: center; }
      @media (prefers-reduced-motion: no-preference) {
        .ak-flow-line { animation: ak-dash 5.5s linear infinite; }
        .ak-flow-line-short { animation: ak-dash 4s linear infinite; }
        .ak-pulse { animation: ak-pulse 2.8s ease-in-out infinite; }
        .ak-pulse-slow { animation: ak-pulse 4.2s ease-in-out infinite; }
        .ak-float { animation: ak-float 4.8s ease-in-out infinite; }
        .ak-float-slow { animation: ak-float 6.6s ease-in-out infinite; }
        .ak-breathe { animation: ak-breathe 5.4s ease-in-out infinite; }
        .ak-scan { animation: ak-scan 4.8s ease-in-out infinite; }
        .ak-reveal-1 { animation: ak-reveal 5.4s ease-in-out infinite; }
        .ak-reveal-2 { animation: ak-reveal 5.4s ease-in-out .45s infinite; }
        .ak-reveal-3 { animation: ak-reveal 5.4s ease-in-out .9s infinite; }
        .ak-reveal-4 { animation: ak-reveal 5.4s ease-in-out 1.35s infinite; }
        .ak-reveal-5 { animation: ak-reveal 5.4s ease-in-out 1.8s infinite; }
        .ak-rotate-slow { transform-origin: center; animation: ak-rotate 16s linear infinite; }
        .ak-check-pop { transform-origin: center; animation: ak-check-pop 3.2s ease-in-out infinite; }
      }
      @keyframes ak-dash { to { stroke-dashoffset: -72; } }
      @keyframes ak-pulse { 0%, 100% { opacity: .55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
      @keyframes ak-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
      @keyframes ak-breathe { 0%, 100% { opacity: .52; } 50% { opacity: .92; } }
      @keyframes ak-scan { 0%, 100% { transform: translateX(-8px); opacity: .22; } 50% { transform: translateX(8px); opacity: .85; } }
      @keyframes ak-reveal { 0%, 28%, 100% { opacity: .48; transform: translateY(0); } 45%, 74% { opacity: 1; transform: translateY(-2px); } }
      @keyframes ak-rotate { to { transform: rotate(360deg); } }
      @keyframes ak-check-pop { 0%, 100% { transform: scale(1); } 38% { transform: scale(1.12); } 58% { transform: scale(1); } }
    `}</style>
  );
}
