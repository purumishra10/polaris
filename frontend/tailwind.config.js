/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#030508',
          900: '#070b12',
          850: '#0c121d',
          800: '#111927',
          750: '#172235',
          700: '#1e2d45',
          600: '#2b3f5e',
          500: '#3d567c',
        },
        ice: {
          300: '#93d5ff',
          400: '#5eb8ff',
          500: '#2f8fe0',
          600: '#1c6fc2',
          700: '#134f8f',
          800: '#0c3562',
        },
        neon: {
          cyan: '#00f0ff',
          blue: '#3b82f6',
        },
      },
      boxShadow: {
        glow: '0 0 20px rgba(47,143,224,0.35)',
        'glow-cyan': '0 0 25px rgba(0,240,255,0.4)',
        'glow-red': '0 0 25px rgba(239,68,68,0.5)',
      },
      keyframes: {
        pulseRed: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.6)' },
          '50%': { boxShadow: '0 0 0 10px rgba(239,68,68,0)' },
        },
        pulseBlue: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'pulse-red': 'pulseRed 1.4s ease-out infinite',
        'pulse-blue': 'pulseBlue 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
