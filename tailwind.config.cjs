/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './apps/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'PingFang TC', 'Microsoft JhengHei', 'sans-serif'],
        display: ['Avenir Next', 'Segoe UI', 'PingFang TC', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        crypto: {
          dark: '#0D100F',
          card: '#151917',
          accent: '#89D4BF',
          muted: '#53B49A',
          success: '#69C5A8',
          danger: '#EF765F',
          text: '#ADB7B2',
        },
      },
    },
  },
  plugins: [],
};
