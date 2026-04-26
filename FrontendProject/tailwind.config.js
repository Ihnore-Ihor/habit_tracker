/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rice: {
          DEFAULT: '#F9F6EE',
          50: '#FDFBF5',
          100: '#F9F6EE',
          200: '#F1ECDD',
          300: '#E6DEC6',
        },
        ink: {
          DEFAULT: '#2D2D2D',
          soft: '#4A4A48',
          mute: '#7A7670',
        },
        jade: {
          DEFAULT: '#8FBC8F',
          deep: '#6B9B6B',
          shadow: '#4F7A52',
          glow: '#B6D6B0',
        },
        crystal: {
          DEFAULT: 'rgba(168, 213, 226, 0.50)',
          solid: '#A8D5E2',
          deep: '#6FA9BC',
          shadow: '#3F7A8E',
        },
        garnet: {
          DEFAULT: '#C85A54',
          deep: '#9C3A36',
          shadow: '#6E1F1C',
          glow: '#E0827D',
        },
        diamond: {
          DEFAULT: '#B8A888',
          gold: '#D4B96A',
          bronze: '#8B6F47',
          glow: '#E8D7A8',
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', '"Noto Serif SC"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        seal: ['"Noto Serif SC"', '"Cormorant Garamond"', 'serif'],
      },
      backgroundImage: {
        'rice-paper':
          'radial-gradient(circle at 20% 10%, rgba(184,168,136,0.08), transparent 50%), radial-gradient(circle at 80% 90%, rgba(143,188,143,0.06), transparent 60%)',
      },
      boxShadow: {
        ink: '0 1px 0 rgba(45,45,45,0.04), 0 12px 30px -18px rgba(45,45,45,0.25)',
        seal: '0 0 0 1px rgba(200,90,84,0.25), 0 6px 18px -8px rgba(200,90,84,0.35)',
      },
      keyframes: {
        floatSlow: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        inkBloom: {
          '0%': { opacity: 0, filter: 'blur(6px)' },
          '100%': { opacity: 1, filter: 'blur(0)' },
        },
      },
      animation: {
        floatSlow: 'floatSlow 6s ease-in-out infinite',
        inkBloom: 'inkBloom 900ms ease-out both',
      },
    },
  },
  plugins: [],
};
