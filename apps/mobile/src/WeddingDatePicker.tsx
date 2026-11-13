import { useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { plainDate } from '@core/dated-plan';
import { color, type } from './theme';
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
/** An empty value shows "Choose …" and no date: nothing is picked until she picks it. */
export function WeddingDatePicker({ value, onChange, label = 'Wedding date' }: { value: string; onChange(value: string): void; label?: string }) {
  const [open, setOpen] = useState(false);
  // Where the calendar opens when she has no date yet; it becomes her date only when she picks it.
  const date = value ? new Date(value + 'T12:00:00') : new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate(), 12);
  const closed = Platform.OS === 'android' ? true : !value;
  return <>
    {closed && !(Platform.OS !== 'android' && open) ? <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${label.toLowerCase()}`} onPress={() => setOpen(true)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>{value ? plainDate(value) : `Choose ${label.toLowerCase()} ›`}</Text></Pressable> : null}
    {(Platform.OS !== 'android' && (value || open)) || (Platform.OS === 'android' && open) ? <DateTimePicker accessibilityLabel={label} mode="date" value={date} display={Platform.OS === 'ios' && !value ? 'inline' : 'default'} onChange={(_event, selected) => {
      setOpen(false);
      if (selected) onChange(iso(selected));
    }} /> : null}
  </>;
}
