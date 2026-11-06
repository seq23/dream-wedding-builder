import { PlannedScreen, GoButton } from '../src/ui';
export default function AddTask() {
  return <PlannedScreen route="/add-task"><GoButton href="/plan" label="✕ Close" /></PlannedScreen>;
}
