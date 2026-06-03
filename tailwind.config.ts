import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1A5632',
          50:  '#f0f7f4',
          100: '#d6ece1',
          200: '#afd9c5',
          300: '#7abfa1',
          400: '#479e7c',
          500: '#287d5e',
          600: '#1A5632',
          700: '#154428',
          800: '#11361f',
          900: '#0d2c19',
        },
        coral: {
          DEFAULT: '#E04854',
          50:  '#fdf2f3',
          100: '#fce4e6',
          200: '#f9cdd1',
          300: '#f4a8ae',
          400: '#ee7882',
          500: '#e3505d',
          600: '#E04854',
          700: '#c22e3b',
          800: '#a22835',
          900: '#86252f',
        },
        cream: '#FFF8F0',
      },
    },
  },
  plugins: [],
};

export default config;
