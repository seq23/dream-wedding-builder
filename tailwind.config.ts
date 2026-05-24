import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './data/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#F8F2EA', champagne: '#D7B98E', charcoal: '#27231F', sage: '#9EAD9A', rose: '#CFA7A1', linen: '#FFFDF9'
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'], serif: ['Georgia', 'serif'] },
      boxShadow: { soft: '0 20px 50px rgba(70, 53, 33, 0.10)' }
    }
  },
  plugins: []
};
export default config;
