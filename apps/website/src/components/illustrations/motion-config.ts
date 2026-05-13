import type { MotionProps } from 'framer-motion';

/**
 * Shared motion presets for the AgeKey illustration set.
 *
 * Strategy
 * --------
 * The original SVGs position elements via the attribute `transform="..."`.
 * When framer-motion animates the same element, its inline style transform
 * OVERWRITES the attribute (per CSS spec) and the element jumps to (0,0).
 *
 * To avoid that, each illustration keeps its outer `<g transform="...">`
 * for static positioning and wraps the animated subtree in a child
 * `<motion.g>`. The motion-g only adds the deltas (y, scale, rotate)
 * relative to its parent's frame — composition just works.
 *
 * Easings (cubic-bezier arrays)
 * -----------------------------
 * - easeOutQuart   – decelerated, "settling" feel
 * - easeInOutQuart – refined symmetric sweep
 * - backOut        – gentle overshoot for confirmations and reveals
 * - linear         – constant motion for dash flows and rotations
 */

const easeOutQuart = [0.25, 1, 0.5, 1] as const;
const easeInOutQuart = [0.76, 0, 0.24, 1] as const;
const easeInOutSmooth = [0.45, 0, 0.55, 1] as const;
const easeOutSettle = [0.4, 0, 0.2, 1] as const;
const backOut = [0.34, 1.56, 0.64, 1] as const;

const loop = { repeat: Infinity, repeatType: 'loop' as const };

/* ── Floats: vertical idle hover ─────────────────────────────────── */
export const floatGentle: MotionProps = {
  animate: { y: [0, -10, -10, 0] },
  transition: {
    duration: 4.4,
    ease: easeInOutSmooth,
    times: [0, 0.45, 0.55, 1],
    ...loop,
  },
};

export const floatStrong: MotionProps = {
  animate: { y: [0, -14, -14, 0] },
  transition: {
    duration: 5.2,
    ease: easeInOutSmooth,
    times: [0, 0.45, 0.55, 1],
    ...loop,
  },
};

/* ── Tilt: organic sway, pairs with float for a physical feel ───── */
export const tilt: MotionProps = {
  animate: { rotate: [-1.6, 1.6, -1.6] },
  transition: { duration: 6.4, ease: easeInOutSmooth, ...loop },
};

/* ── Pulse: a single status dot expanding/fading ────────────────── */
export const pulse: MotionProps = {
  animate: {
    scale: [1, 1.22, 1.06, 1],
    opacity: [0.45, 1, 0.9, 0.45],
  },
  transition: {
    duration: 2.4,
    ease: easeInOutSmooth,
    times: [0, 0.35, 0.55, 1],
    ...loop,
  },
};

export const pulseSlow: MotionProps = {
  animate: {
    scale: [1, 1.22, 1.06, 1],
    opacity: [0.4, 1, 0.9, 0.4],
  },
  transition: {
    duration: 3.6,
    ease: easeInOutSmooth,
    times: [0, 0.35, 0.55, 1],
    ...loop,
  },
};

/* ── Breathe: opacity + subtle scale on halos ──────────────────── */
export const breathe: MotionProps = {
  animate: {
    scale: [1, 1.08, 1],
    opacity: [0.3, 1, 0.3],
  },
  transition: { duration: 5.2, ease: easeOutSettle, ...loop },
};

/* ── Glow: expanding ring that fades out (radiating halo) ──────── */
export const glow: MotionProps = {
  animate: {
    scale: [0.7, 1, 1.6],
    opacity: [0, 0.55, 0],
  },
  transition: {
    duration: 3.4,
    ease: easeOutSettle,
    times: [0, 0.35, 1],
    ...loop,
  },
};

/* ── Check pop: anticipate -> snap -> overshoot -> settle ──────── */
export const checkPop: MotionProps = {
  animate: { scale: [1, 0.92, 1.32, 0.98, 1] },
  transition: {
    duration: 2.8,
    ease: backOut,
    times: [0, 0.15, 0.45, 0.7, 1],
    ...loop,
  },
};

/* ── Reveal: anticipation + lift, used on chip rows ────────────── */
export const reveal = (delay = 0): MotionProps => ({
  animate: {
    y: [0, -5, -3, -3, 0],
    opacity: [0.35, 1, 1, 1, 0.35],
  },
  transition: {
    duration: 4.6,
    ease: backOut,
    times: [0, 0.3, 0.5, 0.8, 1],
    delay,
    ...loop,
  },
});

/* ── Dash flow: stroke-dashoffset cycle on connectors ──────────── */
export const dashFlow: MotionProps = {
  animate: { strokeDashoffset: [0, -140] },
  transition: { duration: 2.4, ease: 'linear', ...loop },
};

export const dashFlowShort: MotionProps = {
  animate: { strokeDashoffset: [0, -100] },
  transition: { duration: 1.8, ease: 'linear', ...loop },
};

/* ── Scan: horizontal sweep with edge fades ───────────────────── */
export const scan: MotionProps = {
  animate: {
    x: [-16, 16, -16],
    opacity: [0, 0.9, 1, 0.9, 0],
  },
  transition: {
    duration: 3.2,
    ease: easeInOutQuart,
    times: [0, 0.4, 0.5, 0.6, 1],
    ...loop,
  },
};

/* ── Rotate: slow constant rotation for orbital elements ───────── */
export const rotateSlow: MotionProps = {
  animate: { rotate: 360 },
  transition: { duration: 14, ease: 'linear', ...loop },
};

/* ── Entrance variant for stagger orchestration ────────────────── */
export const enterStagger = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.55, ease: easeOutQuart },
  }),
};
