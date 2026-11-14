import { useEffect, useRef, useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

/** Every text box in the app. The phone's box owns the text (uncontrolled, `defaultValue`): the app
 * never writes text back into it while she types. A controlled `value` on a screen that re-renders on
 * each key fights the native box on the new architecture, and the native side then drops change
 * events (ApprovalPrep saved "Capital One" for "Capital One, ending 4821"). The parent hears every
 * change, and again on blur / end of editing with the box's own text, so a change event the phone
 * never sent is still saved. `clean` (digits only, a length cap) is applied to what the parent hears
 * on every key, but written into the box only when she leaves it, so it never fights her keys. Only a
 * genuinely new value from the parent (a cleared box, a loaded record) is put back, by re-creating
 * the box; the parent echoing something she typed a few keys ago is never mistaken for one. */
export type TypingBoxProps = Omit<TextInputProps, 'value' | 'defaultValue' | 'onChangeText'> & {
  value: string;
  onChangeText: (value: string) => void;
  clean?: (raw: string) => string;
};

export function TypingBox({ value, onChangeText, clean, onBlur, onEndEditing, ...rest }: TypingBoxProps) {
  // What the box holds now, as last reported by the phone (after `clean`).
  const typed = useRef(value);
  // Values handed up since the parent last caught up: an echo of one of these is not a new value.
  const handed = useRef(new Set<string>());
  // The text a re-created box starts with, and its key.
  const [box, setBox] = useState({ text: value, n: 0 });
  useEffect(() => {
    if (value === typed.current) { handed.current.clear(); return; }
    if (handed.current.has(value)) return;
    typed.current = value; handed.current.clear(); setBox(b => ({ text: value, n: b.n + 1 }));
  }, [value]);
  const hand = (next: string) => { if (next === typed.current) return; typed.current = next; handed.current.add(next); onChangeText(next); };
  const cleaned = (raw: string) => clean ? clean(raw) : raw;
  const settle = (raw: unknown) => {
    if (typeof raw !== 'string') return;
    const next = cleaned(raw); hand(next);
    if (next !== raw) setBox(b => ({ text: next, n: b.n + 1 }));
  };
  return <TextInput {...rest} key={box.n} defaultValue={box.text} onChangeText={raw => hand(cleaned(raw))}
    onEndEditing={e => { settle(e?.nativeEvent?.text); onEndEditing?.(e); }}
    onBlur={e => { settle((e?.nativeEvent as { text?: unknown } | undefined)?.text); onBlur?.(e); }} />;
}
