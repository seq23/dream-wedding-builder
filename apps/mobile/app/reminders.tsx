import { PlannedScreen, GoButton } from '../src/ui';
export default function Reminders() {
  return <PlannedScreen route="/reminders"><GoButton primary href="/plan" label="Turn on reminders ›" /><GoButton href="/plan" label="Not now" /></PlannedScreen>;
}
