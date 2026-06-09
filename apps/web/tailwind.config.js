/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'pubg-dark': '#0a0a0f',
        'pubg-card': '#14141b',
        'pubg-border': '#2a2a35',
        'pubg-orange': '#ff9500',
        'pubg-yellow': '#ffc800',
        'pubg-red': '#ff3b30',
        'pubg-green': '#34c759',
        'pubg-blue': '#007aff',
        'pubg-text': '#e5e5e5',
        'pubg-muted': '#8e8e93',
      },
      fontFamily: {
        'esports': ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'pubg-gradient': 'linear-gradient(135deg, #ff9500 0%, #ffc800 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #ff9500' },
          '100%': { boxShadow: '0 0 20px #ff9500, 0 0 40px #ffc800' },
        },
      },
    },
  },
  plugins: [],
}
