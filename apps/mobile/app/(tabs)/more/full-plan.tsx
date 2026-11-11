import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { PlannedScreen } from '../../../src/ui';
import { offersFor, type ProductId } from '../../../src/billing/offers';
import { purchases } from '../../../src/billing/current';
import { color, type, space, radius } from '../../../src/theme';
const names: Partial<Record<ProductId, string>> = { dw_planner_printables: 'Planner + printables', dw_full_plan: 'Full plan' };
export default function FullPlan() {
  const offers = offersFor([]);
  const [selected, setSelected] = useState(offers[0]);
  return <PlannedScreen route="/more/full-plan" implemented>
    <Text accessibilityRole="header" style={type.title}>Your full wedding plan</Text>
    <Text style={type.body}>Paid once for this wedding. No subscription.</Text>
    <Text accessibilityRole="status" style={type.body}>Purchases are not set up yet.</Text>
    <View style={{ gap: space[2] }}>
      <Text style={type.sub}>Payments and final-payment schedule</Text>
      <Text style={type.sub}>Wedding-week sheet</Text>
      <Text style={type.sub}>Printable hand-over packet</Text>
      <Text style={type.sub}>Tradition packs</Text>
      <Text style={type.sub}>Reminders for your dated tasks</Text>
    </View>
    {offers.map((id, i) => <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: selected === id }} onPress={() => setSelected(id)}
      style={{ minHeight: 64, padding: space[3], borderRadius: radius.md, borderWidth: selected === id ? 2 : 1, borderColor: selected === id ? color.blue : color.rule, gap: space[1] }}>
      <Text style={type.button}>{names[id]}</Text>
      <Text style={type.sub}>{i === 0 ? 'Includes printables' : 'For this wedding'}</Text>
      <Text style={type.sub}>Price available when the store is ready</Text>
    </Pressable>)}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: true }} disabled={!purchases.available}
      style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: color.blue, borderRadius: radius.md, opacity: 0.5 }}>
      <Text style={[type.button, { color: color.onBlue }]}>Purchases unavailable</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: true }} disabled style={{ minHeight: 44, justifyContent: 'center' }}><Text style={type.sub}>Restore purchase · unavailable</Text></Pressable>
    <View style={{ flexDirection: 'row', gap: space[4] }}>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://weddingchecklistpdf.com/terms')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={type.sub}>Terms</Text></Pressable>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://weddingchecklistpdf.com/privacy')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={type.sub}>Privacy</Text></Pressable>
    </View>
  </PlannedScreen>;
}
