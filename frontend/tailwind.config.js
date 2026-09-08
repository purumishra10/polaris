/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#050608',
          900: '#0a0d12',
          850: '#0e1218',
          800: '#131822',
          700: '#1c2330',
          600: '#2a3344',
        },
        ice: {
          400: '#5eb8ff',
          500: '#2f8fe0',
          600: '#1c6fc2',
          700: '#134f8f',
        },
      },
      boxShadow: {
        glow: '0 0 20px rgba(47,143,224,0.35)',
      },
      keyframes: {
        pulseRed: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.6)' },
          '50%': { boxShadow: '0 0 0 10px rgba(239,68,68,0)' },
        },
      },
      animation: {
        'pulse-red': 'pulseRed 1.4s ease-out infinite',
      },
    },
  },
  plugins: [],
}
