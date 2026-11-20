/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#030712',
          900: '#070d18',
          850: '#0a1221',
          800: '#0f172a',
          750: '#131e33',
          700: '#1e293b',
          600: '#334155',
          500: '#475569',
        },
        occ: {
          cyan: '#00f0ff',
          'cyan-glow': 'rgba(0, 240, 255, 0.25)',
          amber: '#f59e0b',
          'amber-glow': 'rgba(245, 158, 11, 0.25)',
          red: '#ef4444',
          'red-glow': 'rgba(239, 68, 68, 0.25)',
          green: '#10b981',
          'green-glow': 'rgba(16, 185, 129, 0.25)',
          panel: '#0d1527',
          surface: '#111c34',
          border: '#1b2a47',
          borderLight: '#263b61',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'occ-card': '0 4px 20px -2px rgba(0, 0, 0, 0.6), 0 0 1px 1px rgba(255, 255, 255, 0.05)',
        'cyan-sm': '0 0 10px rgba(0, 240, 255, 0.3)',
        'red-sm': '0 0 10px rgba(239, 68, 68, 0.3)',
      }
    },
  },
  plugins: [],
}
