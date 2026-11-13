import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { Text } from 'react-native';
import { savedDate } from '../src/savedDate';
export default function Start() {
  const [date, setDate] = useState<string | null | undefined>();
  const [error, setError] = useState(false);
  useEffect(() => { savedDate.read().then(setDate).catch(() => setError(true)); }, []);
  if (error) return <Text>Could not read your saved plan. Please reopen the app.</Text>;
  if (date === undefined) return <Text>Opening your plan…</Text>;
  return <Redirect href={date === null ? '/welcome' : '/plan'} />;
}
