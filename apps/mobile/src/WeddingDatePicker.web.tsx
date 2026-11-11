import React from 'react';
import { color, font } from './theme';
export function WeddingDatePicker({ value, onChange }: { value: string; onChange(value: string): void }) {
  return <input aria-label="Wedding date" type="date" value={value} onChange={event => onChange(event.target.value)} style={{ minHeight: 48, padding: 12, border: `1px solid ${color.rule}`, background: color.ivoryRaised, color: color.midnight, fontFamily: font.sans, fontSize: 16 }} />;
}
