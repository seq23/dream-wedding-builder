import { Text } from 'react-native';
import { buildDatedPlan, localToday } from '@core/dated-plan';
import { PlannedScreen, GoButton } from '../../src/ui';
import { color, type } from '../../src/theme';

// Scaffold proof that the app runs the live Builder's own date maths (lib/dated-plan.ts):
// a sample date until Codex task 2 saves the couple's real one.
const SAMPLE_DATE = '2027-06-12';
export default function Plan() {
  const plan = buildDatedPlan(SAMPLE_DATE, localToday());
  return (
    <PlannedScreen route="/plan">
      <Text style={[type.sub, { color: color.midnightMuted }]}>Sample wedding date, Sat 12 Jun 2027: {plan.headline} {plan.windows.length} planning windows.</Text>
      <GoButton href="/add-task" label="+ Add your own task" />
      <GoButton href="/ai-draft" label="Draft my plan from a sentence ›" />
    </PlannedScreen>
  );
}
