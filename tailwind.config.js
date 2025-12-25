/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./popup/**/*.{html,js}",
    "./blocked/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          400: '#FF8585',
          500: '#FF6B6B',
          600: '#FF5252',
        },
        teal: {
          400: '#6ED9D0',
          500: '#4ECDC4',
          600: '#3DBDB4',
        },
        sunny: {
          400: '#FFEC85',
          500: '#FFE66D',
          600: '#FFE055',
        },
        cream: '#FFF9F0',
        charcoal: '#2C3E50',
        purple: {
          deep: '#2D1B69',
        }
      },
      fontFamily: {
        display: ['Fredoka', 'sans-serif'],
        body: ['Nunito', 'sans-serif'],
      },
      animation: {
        'bounce-in': 'bounceIn 0.5s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'pulse-once': 'pulseOnce 0.3s ease-out',
        'confetti': 'confetti 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.3s ease-out',
        'wiggle': 'wiggle 0.5s ease-in-out',
      },
      keyframes: {
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseOnce: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        },
        confetti: {
          '0%': { transform: 'scale(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(180deg)', opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },
    },
  },
  plugins: [],
}

