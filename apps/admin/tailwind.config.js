/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#0F6B5C',
          primaryHover: '#0B5749',
          primaryPressed: '#084338',
          accent: '#C2703B',
        },
        surface: {
          page: '#FFFFFF',
          pageMuted: '#F7F8F7',
          sunken: '#F1F3F2',
        },
        status: {
          draft: '#8A928F',
          pending: '#B4791F',
          offered: '#1F6FB2',
          confirmed: '#0F6B5C',
          inProgress: '#0F6B5C',
          completed: '#4A7C59',
          cancelled: '#8C2F2F',
        },
      },
    },
  },
  plugins: [],
}
