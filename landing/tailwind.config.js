/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0B5C2E',
          hover:   '#0D6E37',
          light:   '#E8F5EE',
          dim:     '#1A7A42',
        },
        accent: {
          DEFAULT: '#E8A400',
          hover:   '#D49400',
          light:   '#FFF8E1',
        },
        neutral: {
          50:  '#F7F9F6',
          100: '#F2F5F1',
          200: '#DDE5DA',
          300: '#BDC9B8',
          600: '#5A6B56',
          700: '#3A4A36',
          900: '#111D0F',
        },
      },
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body:    ['Plus Jakarta Sans', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
        xl3: '1.5rem',
      },
      boxShadow: {
        'green-sm': '0 1px 4px rgba(11,92,46,0.08)',
        'green-md': '0 4px 16px rgba(11,92,46,0.12)',
        'green-lg': '0 8px 32px rgba(11,92,46,0.15)',
      },
    },
  },
  plugins: [],
}
