export function MotionStyle() {
  return (
    <style>{`
      .ak-svg-root * { vector-effect: non-scaling-stroke; }
      .ak-card { filter: drop-shadow(0 10px 18px rgb(24 28 37 / 0.04)); }
      .ak-soft-card { filter: drop-shadow(0 8px 14px rgb(24 28 37 / 0.035)); }
      .ak-flow-line { stroke-dasharray: 8 10; }
      .ak-flow-line-short { stroke-dasharray: 4 8; }

      /* Scale/rotate animations need fill-box origin so the element scales/rotates
       * from its own bounding-box center instead of the SVG viewport (0,0).
       */
      .ak-pulse, .ak-pulse-slow, .ak-check-pop, .ak-rotate-slow {
        transform-box: fill-box;
        transform-origin: center;
      }

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
        .ak-rotate-slow { animation: ak-rotate 16s linear infinite; }
        .ak-check-pop { animation: ak-check-pop 3.2s ease-in-out infinite; }
      }

      /* Use the independent CSS transform properties (translate/scale/rotate)
       * instead of the shorthand "transform" so animations compose additively
       * with the SVG transform="..." attribute on each <g>. Without this,
       * CSS transform replaces the attribute transform, snapping the group
       * back to (0,0) and causing overlapping elements.
       */
      @keyframes ak-dash { to { stroke-dashoffset: -72; } }
      @keyframes ak-pulse {
        0%, 100% { opacity: .55; scale: 1; }
        50%      { opacity: 1;   scale: 1.08; }
      }
      @keyframes ak-float {
        0%, 100% { translate: 0 0; }
        50%      { translate: 0 -7px; }
      }
      @keyframes ak-breathe {
        0%, 100% { opacity: .52; }
        50%      { opacity: .92; }
      }
      @keyframes ak-scan {
        0%, 100% { translate: -8px 0; opacity: .22; }
        50%      { translate: 8px 0;  opacity: .85; }
      }
      @keyframes ak-reveal {
        0%, 28%, 100% { opacity: .48; translate: 0 0; }
        45%, 74%      { opacity: 1;   translate: 0 -2px; }
      }
      @keyframes ak-rotate { to { rotate: 360deg; } }
      @keyframes ak-check-pop {
        0%, 100% { scale: 1; }
        38%      { scale: 1.12; }
        58%      { scale: 1; }
      }
    `}</style>
  );
}
