import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0EA5E9',
          50:  '#f0f9ff',
          100: '#e0f2fe',
          500: '#0EA5E9',
          600: '#0284c7',
          700: '#0369a1',
        },
        secondary: {
          DEFAULT: '#06B6D4',
          500: '#06B6D4',
          600: '#0891b2',
        },
        accent: {
          DEFAULT: '#22C55E',
          500: '#22C55E',
          600: '#16a34a',
        },
        warning: {
          DEFAULT: '#F59E0B',
          500: '#F59E0B',
        },
        danger: {
          DEFAULT: '#EF4444',
          500: '#EF4444',
        },
        base: '#F8FAFC',
      },
      fontFamily: {
        sans: ['Pretendard', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 1s ease-in-out infinite alternate',
        'count-up': 'count-up 0.6s ease-out',
      },
      keyframes: {
        glow: {
          '0%':   { boxShadow: '0 0 0px #0EA5E9' },
          '100%': { boxShadow: '0 0 20px #0EA5E9, 0 0 40px #0EA5E9' },
        },
      },
    },
  },
  plugins: [],
}

export default config
