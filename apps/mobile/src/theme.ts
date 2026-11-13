// Dream Wedding tokens, copied from the approved design system's project/tokens.css
// (https://claude.ai/artifact/6ncBMWsGoHNHP16FzbmM9o). Light only. No colour is
// written anywhere else in the app: screens read these names.
export const color = {
  ivory: '#FAF7F2', ivoryRaised: '#FFFFFF', midnight: '#1B1F3B', midnightMuted: '#555A73', rule: '#E3DCCF',
  blue: '#2747D9', onBlue: '#FFFFFF', blueSoft: '#E8ECFC', coral: '#F28C6B', coralSoft: '#FDE9E1',
  redPen: '#B42318', done: '#2F6B4A', focus: '#1B1F3B',
} as const;
// blue = the one primary button, the active tab and links; coral = inactive binder tabs only;
// red-pen = a real error only; done = a ticked task only.
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48 } as const;
export const radius = { sm: 4, md: 10, pill: 999 } as const;
// Font family names as loaded in app/_layout.tsx (@expo-google-fonts).
export const font = {
  serif: 'InstrumentSerif_400Regular', serifItalic: 'InstrumentSerif_400Regular_Italic',
  sans: 'InstrumentSans_400Regular', sansBold: 'InstrumentSans_600SemiBold', mono: 'DMMono_500Medium',
} as const;
export const type = {
  display: { fontFamily: font.serif, fontSize: 40, lineHeight: 42 },
  title: { fontFamily: font.serif, fontSize: 26, lineHeight: 30 },
  section: { fontFamily: font.sansBold, fontSize: 18, lineHeight: 24 },
  subhead: { fontFamily: font.sansBold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: font.sans, fontSize: 15, lineHeight: 23 },
  sub: { fontFamily: font.sans, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: font.sansBold, fontSize: 16, lineHeight: 20 },
  label: { fontFamily: font.mono, fontSize: 12, lineHeight: 16, letterSpacing: 1.44, textTransform: 'uppercase' as const },
} as const;
