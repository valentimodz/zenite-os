/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#6A0DAD',
          purpleHover: '#500885',
        }
      }
    },
  },
  plugins: [],
}
