/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Large text scaled down ~15-20%: steps grow by about x1.27 (half a golden-ratio step) from 16px.
      fontSize: {
        xl: ['1.125rem', { lineHeight: '1.5rem' }], // 18
        '2xl': ['1.3rem', { lineHeight: '1.75rem' }], // ~21
        '3xl': ['1.625rem', { lineHeight: '2rem' }], // 26
        '4xl': ['2.0625rem', { lineHeight: '2.25rem' }], // 33
        '5xl': ['2.625rem', { lineHeight: '1' }], // 42
      },
      colors: { brand: { DEFAULT: '#b91c1c', dark: '#991b1b' } },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Barlow Condensed"', '"Arial Narrow"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
