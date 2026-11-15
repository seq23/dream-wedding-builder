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

export function TypingBox({ value, onChangeText, clean, onBlur, onEndEditing, onFocus, ...rest }: TypingBoxProps) {
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
    focused.current = false;
    if (typeof raw === 'string') {
      const next = cleaned(raw); hand(next);
      if (next !== raw) setBox(b => ({ text: next, n: b.n + 1 }));
    }
    // End of editing comes before blur, so the box's whole text is handed up before anyone waiting on it reads.
    for (const done of waiting.current.splice(0)) done();
  };
  const input = useRef<{ blur?(): void; isFocused?(): boolean } | null>(null);
  const focused = useRef(false);
  const waiting = useRef<(() => void)[]>([]);
  useEffect(() => {
    const me: OpenBox = {
      focused: () => focused.current || !!input.current?.isFocused?.(),
      finish: wait => new Promise<void>(done => {
        // No end of editing in time: go on with what was heard; the box was told to blur, so it is closed.
        const timer = setTimeout(() => { focused.current = false; done(); }, wait);
        waiting.current.push(() => { clearTimeout(timer); done(); });
        input.current?.blur?.();
      }),
    };
    openBoxes.add(me);
    return () => { openBoxes.delete(me); };
  }, []);
  return <TextInput {...rest} key={box.n} ref={input as never} defaultValue={box.text} onChangeText={raw => hand(cleaned(raw))}
    onFocus={e => { focused.current = true; onFocus?.(e); }}
    onEndEditing={e => { settle(e?.nativeEvent?.text); onEndEditing?.(e); }}
    onBlur={e => { settle((e?.nativeEvent as { text?: unknown } | undefined)?.text); onBlur?.(e); }} />;
}

/** A TypingBox on screen that a Next / Save / Send can make finish editing. */
interface OpenBox { focused(): boolean; finish(wait: number): Promise<void> }
const openBoxes = new Set<OpenBox>();
/** How long a Next waits for the box's end-of-editing text before going on with what it has. */
export const FLUSH_WAIT_MS = 500;
/** Call before reading any typed value on Next, Save, Send or Buy. When the phone is busy, the box can
 * hold letters whose change events have not reached the app yet (ApprovalPrep sim retest 2: "…shows the
 * payment cle" saved for "…cleared March 2"). This ends editing in the focused box and waits for its
 * end-of-editing event, which carries the box's whole text, so the screen has heard every letter when
 * it resolves. Read the value with a `useTypedState` getter after it, not from the render's closure. */
export function flushFields(wait = FLUSH_WAIT_MS): Promise<void> {
  return Promise.all([...openBoxes].filter(b => b.focused()).map(b => b.finish(wait))).then(() => {});
}
/** A screen's typed state, also readable at once (`now()`) after flushFields(), before the screen redraws. */
export function useTypedState<T>(initial: T): [T, (next: T | ((prev: T) => T)) => void, () => T] {
  const [value, setValue] = useState(initial);
  const latest = useRef(initial);
  const set = (next: T | ((prev: T) => T)) => { latest.current = typeof next === 'function' ? (next as (prev: T) => T)(latest.current) : next; setValue(latest.current); };
  return [value, set, () => latest.current];
}
