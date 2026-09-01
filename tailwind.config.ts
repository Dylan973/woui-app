import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '.light'], // presence of .light on <html> switches to light theme (see index.css)
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
        serif: ["'DM Serif Display'", 'serif'],
      },
      colors: {
        main: 'var(--bg-main)',
        sidebar: 'var(--bg-sidebar)',
        card: 'var(--bg-card)',
        input: 'var(--bg-input)',
        border: 'var(--border-color)',
        'border-light': 'var(--border-light)',
        text: {
          main: 'var(--text-main)',
          muted: 'var(--text-muted)',
          dark: 'var(--text-dark)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          light: 'var(--accent-light)',
        },
      },
      borderRadius: {
        card: '16px',
      },
    },
  },
  plugins: [],
} satisfies Config
