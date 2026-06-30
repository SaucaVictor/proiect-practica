import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Brand accent
        accent: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d5fe',
          300: '#a4b9fc',
          400: '#7c97f8',
          500: '#5c72f3',
          600: '#4453e7',
          700: '#3640ce',
          800: '#2e37a6',
          900: '#2b3383',
          950: '#1c2058',
        },
        // Dark surface palette (Claude-inspired)
        surface: {
          0:   '#0e0f11',
          50:  '#141517',
          100: '#1a1b1e',
          200: '#212328',
          300: '#2a2d33',
          400: '#363a42',
          500: '#464b55',
          600: '#565d6b',
          700: '#737c8e',
          800: '#9aa0b2',
          900: '#c4c9d4',
          950: '#e8eaf0',
        },
      },
      animation: {
        'fade-in':        'fadeIn 0.2s ease-out',
        'fade-up':        'fadeUp 0.3s ease-out',
        'slide-in-left':  'slideInLeft 0.25s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'pulse-dot':      'pulseDot 1.4s ease-in-out infinite',
        'shimmer':        'shimmer 1.5s infinite',
        'spin-slow':      'spin 3s linear infinite',
        'thinking':       'thinking 1.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseDot: {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.4' },
          '40%':           { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        thinking: {
          '0%, 100%': { opacity: '0.3' },
          '50%':      { opacity: '1' },
        },
      },
      boxShadow: {
        'glow':       '0 0 20px -5px rgba(92, 114, 243, 0.35)',
        'glow-lg':    '0 0 40px -10px rgba(92, 114, 243, 0.4)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255,255,255,0.06)',
      },
      borderRadius: {
        'xl2': '1rem',
        'xl3': '1.5rem',
      },
      typography: () => ({
        invert: {
          css: {
            '--tw-prose-body':         '#c4c9d4',
            '--tw-prose-headings':     '#e8eaf0',
            '--tw-prose-lead':         '#9aa0b2',
            '--tw-prose-links':        '#7c97f8',
            '--tw-prose-bold':         '#e8eaf0',
            '--tw-prose-counters':     '#9aa0b2',
            '--tw-prose-bullets':      '#565d6b',
            '--tw-prose-hr':           '#2a2d33',
            '--tw-prose-quotes':       '#e8eaf0',
            '--tw-prose-quote-borders':'#363a42',
            '--tw-prose-captions':     '#9aa0b2',
            '--tw-prose-code':         '#a4b9fc',
            '--tw-prose-pre-code':     '#c4c9d4',
            '--tw-prose-pre-bg':       '#141517',
            '--tw-prose-th-borders':   '#363a42',
            '--tw-prose-td-borders':   '#2a2d33',
          },
        },
      }),
    },
  },
  plugins: [typography],
} satisfies Config
