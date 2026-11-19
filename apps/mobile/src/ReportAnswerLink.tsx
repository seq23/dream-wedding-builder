import { useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { REPORT_ADDRESS, reportAnswerLink, reportAnswerShown } from './reportAnswer';
import { color, font, type } from './theme';

/** A quiet link under an AI answer. Nothing renders where the switch is off (iOS 1.0). */
export function ReportAnswer({ answer, where }: { answer: string; where: string }) {
  const [fallback, setFallback] = useState(false);
  if (!reportAnswerShown(Platform.OS)) return null;
  const open = () => { Linking.openURL(reportAnswerLink(answer, where)).catch(() => setFallback(true)); };
  return <View>
    <Pressable accessibilityRole="link" accessibilityLabel="Report this answer" onPress={open} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <Text style={[type.sub, { fontFamily: font.sansBold, color: color.midnightMuted, textDecorationLine: 'underline' }]}>Report this answer</Text>
    </Pressable>
    {fallback ? <Text style={[type.sub, { color: color.midnightMuted }]}>No email app found. Write to {REPORT_ADDRESS} and say what was wrong.</Text> : null}
  </View>;
}
