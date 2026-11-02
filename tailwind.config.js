/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: { colors: { brand: { DEFAULT: '#b91c1c', dark: '#991b1b' } } } },
  plugins: [],
};
