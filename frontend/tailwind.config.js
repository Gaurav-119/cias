/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Preserved brand palette from the original Claim Nova app
        brand: {
          DEFAULT: '#00C1D4',
          dark: '#00A6B5',
        },
        navy: '#002147',
        ink: '#1e293b',
        slatey: '#64748b',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 20px rgba(0, 0, 0, 0.08)',
        cardhover: '0 20px 40px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
};
