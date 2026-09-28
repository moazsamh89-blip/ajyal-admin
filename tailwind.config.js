/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#14213D',
          light: '#2a3b5c',
          dark: '#0c1426',
        },
        gold: {
          DEFAULT: '#FCA311',
          light: '#ffb74d',
          dark: '#c77a00',
        },
        turquoise: {
          DEFAULT: '#2EC4B6',
          light: '#6ff2e6',
          dark: '#009386',
        }
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
