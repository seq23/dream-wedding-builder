import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { buildDatedPlan, localToday } from '@core/dated-plan';
import { savedDate } from '../../../src/savedDate';
import { PlannedScreen } from '../../../src/ui';
export default function Plan() {
  const [date, setDate] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => { savedDate.read().then(d => setDate(d ?? '')).catch(() => setError(true)); }, []);
  const plan = buildDatedPlan(date, localToday());
  return <PlannedScreen route="/plan"><Text>{error ? 'Could not read your saved date. Please reopen the app.' : plan.headline}</Text>
    {plan.windows.map(w => <Text key={w.id}>{w.label}</Text>)}
  </PlannedScreen>;
}
