import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// Modular type scale base 1rem * 1.35^n.
// xs ≈ 0.74rem, sm ≈ 0.86rem, base 1rem, md 1.35rem, lg ≈ 1.82rem,
// xl ≈ 2.46rem, 2xl ≈ 3.32rem, 3xl ≈ 4.49rem.
const scale = (steps: number) => `${(1.35 ** steps).toFixed(4)}rem`;

const config: Config = {
  darkMode: ['class', '[data-theme="obsidian"]'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    fontFamily: {
      // Inter is loaded via next/font/google in app/layout.tsx with weights 200/400.
      sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
    },
    fontSize: {
      xs: [scale(-2), { lineHeight: '1.5' }],
      sm: [scale(-1), { lineHeight: '1.5' }],
      base: [scale(0), { lineHeight: '1.6' }],
      md: [scale(1), { lineHeight: '1.4' }],
      lg: [scale(2), { lineHeight: '1.3' }],
      xl: [scale(3), { lineHeight: '1.25' }],
      '2xl': [scale(4), { lineHeight: '1.2' }],
      '3xl': [scale(5), { lineHeight: '1.15' }],
    },
    extend: {
      colors: {
        // All colors are CSS variables; the .obsidian / .bone / .zinc themes
        // in globals.css supply concrete values. Using HSL channels to allow
        // <alpha-value> modifiers like `bg-background/70`.
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          foreground: 'hsl(var(--success-foreground) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          foreground: 'hsl(var(--warning-foreground) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
      },
    },
  },
  plugins: [animate],
};

export default config;
