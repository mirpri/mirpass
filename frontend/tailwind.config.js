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
          100: '#e6f4fb',
          300: '#85ccf2',
          500: '#3aaeed',
          700: '#235a8a',
          900: '#0b2330',
        },
      },
    },
  },
}