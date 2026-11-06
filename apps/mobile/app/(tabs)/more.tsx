import { PlannedScreen, GoButton } from '../../src/ui';
export default function More() {
  return <PlannedScreen route="/more"><GoButton href="/full-plan" label="The full plan ›" /><GoButton href="/welcome" label="Change the wedding date ›" /></PlannedScreen>;
}
