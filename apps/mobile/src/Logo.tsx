import { Text, View } from 'react-native';
import { color, font } from './theme';

// The approved mark (design system https://claude.ai/artifact/6ncBMWsGoHNHP16FzbmM9o; the same
// geometry scripts/make-icons.mjs draws the icon from): two stepped binder tabs, coral behind,
// blue in front, then "Dream Wedding" with "BUILDER" beneath.
export function Logo({ size = 30 }: { size?: number }) {
  const u = size / 64;
  const tab = (x0: number, x1: number, y0: number, y1: number, c: string) =>
    <View style={{ position: 'absolute', left: x0 * u, top: y0 * u, width: (x1 - x0) * u, height: (y1 - y0) * u, backgroundColor: c, borderTopRightRadius: 8 * u }} />;
  return <View accessible accessibilityRole="image" accessibilityLabel="Dream Wedding Builder" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <View style={{ width: size, height: size }}>{tab(24, 52, 8, 56, color.coral)}{tab(12, 40, 18, 64, color.blue)}</View>
    <View>
      <Text style={{ fontFamily: font.serif, fontSize: 22, lineHeight: 24, color: color.midnight }}>Dream <Text style={{ fontFamily: font.serifItalic }}>Wedding</Text></Text>
      <Text style={{ fontFamily: font.mono, fontSize: 8, lineHeight: 10, letterSpacing: 2, color: color.midnightMuted }}>BUILDER</Text>
    </View>
  </View>;
}
