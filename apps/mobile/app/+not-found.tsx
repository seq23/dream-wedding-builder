import { Text, View } from 'react-native';
import { GoButton } from '../src/ui';
import { HOME } from '../src/screens';
import { color, space, type } from '../src/theme';
// An address the app does not have (an old link, a mistyped one): a plain page and one way home.
export default function NotFound() {
  return <View style={{ flex: 1, padding: space[5], paddingTop: 64, gap: space[4], backgroundColor: color.ivory }}>
    <Text style={[type.label, { color: color.midnightMuted }]}>Dream Wedding</Text>
    <Text accessibilityRole="header" style={type.title}>That page is not here.</Text>
    <Text style={type.body}>The link may be old or mistyped. Your plan is safe on this phone.</Text>
    <GoButton href={HOME} label="Go to my plan ›" primary />
  </View>;
}
