/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), panel: v('panel'), elev: v('elev'), line: v('line'), line2: v('line2'),
        fg: v('fg'), muted: v('muted'), faint: v('faint'), accent: v('accent'), 'accent-fg': v('accent-fg'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: { '2xs': ['11px', '16px'] },
      boxShadow: {
        card: '0 1px 0 0 rgb(var(--shadow) / 0.04), 0 1px 2px 0 rgb(var(--shadow) / 0.06)',
        pop: '0 0 0 1px rgb(var(--line) / 1), 0 16px 48px -12px rgb(var(--shadow) / 0.35), 0 4px 12px -4px rgb(var(--shadow) / 0.12)',
        ring: '0 0 0 3px rgb(var(--accent) / 0.18)',
      },
      keyframes: {
        in: { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { from: { opacity: 0, transform: 'scale(.98) translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        in: 'in .32s cubic-bezier(.2,.8,.2,1) both',
        pop: 'pop .18s cubic-bezier(.2,.8,.2,1) both',
        fade: 'fade .2s ease both',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};
