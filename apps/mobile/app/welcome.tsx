import { PlannedScreen, GoButton } from '../src/ui';
export default function Welcome() {
  return <PlannedScreen route="/welcome"><GoButton primary href="/reminders" label="Make my dated plan ›" /></PlannedScreen>;
}
