import type { Config } from 'tailwindcss';
// Dream Wedding design system (approved 6 Nov 2026,
// https://claude.ai/artifact/6ncBMWsGoHNHP16FzbmM9o): a planner's tabbed binder in
// "something blue". The old palette's names are kept so every page restyles at once:
// ivory is the ground, charcoal is now midnight (text), linen is the raised white of a
// card. blue is the one primary button; coral only the other binder tabs.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './data/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#FAF7F2', charcoal: '#1B1F3B', linen: '#FFFFFF',
        midnight: '#1B1F3B', 'midnight-muted': '#555A73', rule: '#E3DCCF',
        blue: { DEFAULT: '#2747D9', soft: '#E8ECFC', deep: '#1E38B0' },
        coral: { DEFAULT: '#F28C6B', soft: '#FDE9E1' },
        'red-pen': '#B42318', done: '#2F6B4A',
        // Retired names, mapped onto the new palette so nothing renders in the old look.
        champagne: '#2747D9', sage: '#2F6B4A', rose: '#F28C6B'
      },
      fontFamily: {
        sans: ['Instrument Sans', 'ui-sans-serif', 'system-ui'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
        mono: ['DM Mono', 'ui-monospace', 'Menlo', 'monospace']
      },
      borderRadius: { xl: '10px', '2xl': '10px', '3xl': '12px' },
      boxShadow: { soft: '0 1px 0 #E3DCCF, 0 12px 28px rgba(27, 31, 59, 0.08)' }
    }
  },
  plugins: []
};
export default config;
