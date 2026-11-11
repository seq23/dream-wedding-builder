import { useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { color, type } from './theme';
export function WeddingDatePicker({ value, onChange }: { value: string; onChange(value: string): void }) {
  const [open, setOpen] = useState(false);
  const date = new Date(value + 'T12:00:00');
  return <>
    {Platform.OS === 'android' ? <Pressable accessibilityRole="button" accessibilityLabel="Choose wedding date" onPress={() => setOpen(true)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.body, { color: color.blue }]}>{date.toLocaleDateString()}</Text></Pressable> : null}
    {Platform.OS !== 'android' || open ? <DateTimePicker accessibilityLabel="Wedding date" mode="date" value={date} onChange={(_event, selected) => {
      setOpen(false);
      if (selected) onChange(`${selected.getFullYear()}-${String(selected.getMonth()+1).padStart(2,'0')}-${String(selected.getDate()).padStart(2,'0')}`);
    }} /> : null}
  </>;
}
