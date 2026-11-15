import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Script } from 'node:vm';
import ts from 'typescript';

// ApprovalPrep's sim retest (14 Nov 2026): fast typing on iOS saved "Capital One" for "Capital One,
// ending 4821", because a controlled `value` on a screen that redraws each key fights the native box.
// These tests run the real <TypingBox> with a small hook runtime and a model of the phone's text box:
// the box holds its own text, every key reports the box's text, and a `value` the app sends to the
// box replaces what is in it (that is what a controlled box does). The parent re-renders late, the
// way a busy screen does, and Next / Save reads whatever the parent last heard.
const TextInput = (props: any) => props;
function mountBox() {
  let slots: any[] = []; let at = 0; let dirty = false; let effects: (() => void)[] = [];
  const hooks = {
    createElement: (type: any, { key, ...props }: any = {}, ...children: any[]) => ({ type, key, props: children.length ? { ...props, children } : props }),
    useRef: (init: unknown) => { const k = at++; return (slots[k] ??= { current: init }); },
    useState: (init: unknown) => {
      const k = at++; const slot = (slots[k] ??= { v: init });
      return [slot.v, (u: any) => { const v = typeof u === 'function' ? u(slot.v) : u; if (!Object.is(v, slot.v)) { slot.v = v; dirty = true; } }];
    },
    useEffect: (fn: () => void, deps: unknown[]) => {
      const k = at++; const prev = slots[k];
      if (!prev || deps.some((d, j) => !Object.is(d, prev.deps[j]))) { slots[k] = { deps }; effects.push(fn); }
    },
  };
  const js = ts.transpileModule(readFileSync(resolve('src/TypingBox.tsx'), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const output = { exports: {} as any };
  const jsx = { jsx: (type: any, props: any, key: any) => ({ type, props, key }), jsxs: (type: any, props: any, key: any) => ({ type, props, key }) };
  new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()((id: string) => {
    if (id === 'react') return hooks;
    if (id === 'react/jsx-runtime') return jsx;
    if (id === 'react-native') return { TextInput };
    throw new Error(`unexpected import ${id}`);
  }, output, output.exports);
  const find = (node: any): any => !node || typeof node !== 'object' ? null : node.type === TextInput ? node : [node.props?.children].flat(9).map(find).find(Boolean) ?? null;
  // The phone's box: its own text, re-created when the app gives it a new key. Ending editing (blur)
  // sends end-of-editing and then blur, each carrying the box's whole text, `endLag` ms later (a busy
  // JS thread); `endLag: null` models a box whose end-of-editing never arrives.
  const phone = { text: '', key: undefined as unknown, props: {} as any, focused: false, endLag: 30 as number | null, instance: {} as any };
  phone.instance = {
    isFocused: () => phone.focused,
    blur: () => {
      if (!phone.focused) return; phone.focused = false;
      if (phone.endLag === null) return;
      setTimeout(() => { const text = phone.text; phone.props.onEndEditing?.({ nativeEvent: { text } }); phone.props.onBlur?.({ nativeEvent: { text } }); }, phone.endLag);
    },
  };
  const render = (props: any) => {
    do {
      at = 0; dirty = false; effects = [];
      const input = find(output.exports.TypingBox(props));
      if (input.key !== phone.key) { phone.key = input.key; phone.text = input.props.defaultValue ?? input.props.value ?? ''; }
      if (input.props.value !== undefined) phone.text = input.props.value;
      phone.props = input.props;
      if (input.props.ref && typeof input.props.ref === 'object') input.props.ref.current = phone.instance;
      for (const run of effects) run();
    } while (dirty);
  };
  return { render, phone, flushFields: (wait?: number): Promise<void> => output.exports.flushFields(wait) };
}

/** A parent that saves each change and redraws its box `lag` keys late, then taps Next / Save. */
function typeFast(words: string, opts: { lag?: number; dropAfter?: number; clean?: (raw: string) => string; multiline?: boolean } = {}) {
  const { render, phone, flushFields } = mountBox();
  let heard = '';
  const history: string[] = [''];
  const props = (value: string) => ({ accessibilityLabel: 'Answer', clean: opts.clean, multiline: opts.multiline, value, onChangeText: (v: string) => { heard = v; history.push(v); } });
  render(props(''));
  phone.focused = true; phone.props.onFocus?.({ nativeEvent: {} });
  [...words].forEach((ch, n) => {
    phone.text += ch;
    if (opts.dropAfter === undefined || n < opts.dropAfter) phone.props.onChangeText(phone.text);
    render(props(history[Math.max(0, history.length - 1 - (opts.lag ?? 0))]));
  });
  return { get heard() { return heard; }, phone, render, props, flushFields, blur: () => { phone.props.onEndEditing?.({ nativeEvent: { text: phone.text } }); phone.props.onBlur?.({ nativeEvent: { text: phone.text } }); render(props(heard)); } };
}

test('fast typing with the screen redrawing a few keys late saves every letter, and Save reads it at once', () => {
  for (const words of ['Capital One, ending 4821', 'Call the florist about the arch', 'Rosewood Catering', '1250.50']) {
    for (const lag of [0, 1, 2, 3]) {
      const typed = typeFast(words, { lag });
      assert.equal(typed.phone.text, words, `the box shows what she typed (lag ${lag})`);
      assert.equal(typed.heard, words, `Save keeps "${words}" whole (lag ${lag})`);
    }
  }
});

test('a change the phone never reported is still saved when she leaves the box', () => {
  const typed = typeFast('Rosewood Catering', { dropAfter: 'Rosewood'.length });
  assert.equal(typed.heard, 'Rosewood');
  typed.blur();
  assert.equal(typed.heard, 'Rosewood Catering');
});

test('a real new value from the screen (a cleared box, a loaded task) still replaces the box', () => {
  const typed = typeFast('Book the band', { lag: 2 });
  typed.render(typed.props(''));
  assert.equal(typed.phone.text, '');
  typed.render(typed.props('Loaded task'));
  assert.equal(typed.phone.text, 'Loaded task');
});

test('the guests box passes on digits only as she types fast and shows them once she leaves it', () => {
  // The real guests box's rule, read from feel.tsx; the cap is in it (a native maxLength would count stray letters).
  const rule = readFileSync('app/feel.tsx', 'utf8').match(/"About how many guests"[^>]*?clean=\{([^}]+)\}/)?.[1];
  assert.ok(rule, 'the guests box cleans what she types');
  assert.doesNotMatch(readFileSync('app/feel.tsx', 'utf8').match(/<TypingBox accessibilityLabel="About how many guests"[\s\S]*?\/>/)![0], /maxLength/);
  const digits = new Function(`return (${rule})`)() as (g: string) => string;
  for (const lag of [0, 1, 2]) {
    const typed = typeFast('1a2x0', { clean: digits, lag });
    assert.equal(typed.heard, '120', `lag ${lag}`);
    typed.blur();
    assert.equal(typed.phone.text, '120');
    assert.equal(typed.heard, '120');
  }
  assert.equal(digits('123456'), '1234');
});

test('no screen uses a bare TextInput: every box goes through TypingBox', () => {
  let checked = 0; const bare: string[] = [];
  const scan = (dir: string) => { for (const e of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) { scan(path); continue; }
    if (!/\.tsx?$/.test(e.name) || path.endsWith('TypingBox.tsx')) continue;
    const src = readFileSync(path, 'utf8'); checked++;
    if (/<TextInput\b/.test(src)) bare.push(path);
    if (/<TypingBox\b[^>]*\bdefaultValue=/.test(src)) bare.push(`${path} (defaultValue on TypingBox)`);
  } };
  scan('app'); scan('src');
  assert.ok(checked > 20, `scanned ${checked} files`);
  assert.deepEqual(bare, []);
});

// ApprovalPrep sim retest 2 (14 Nov 2026, a heavily loaded Mac): a long answer typed fast with Next
// tapped at once was saved as "…shows the payment cle". The box held the rest; its change events had
// not reached the app when Next read it. Every Next / Save / Send / Buy now ends editing first and
// waits for the box's text (flushFields), the same gap Dream Wedding's TypingBox had.
test('letters still in flight when she taps Next are saved from the end-of-editing text (long multiline answer)', async () => {
  const words = 'Call the florist about the arch and confirm the final payment cleared March 2';
  for (const lag of [0, 2]) {
    const typed = typeFast(words, { multiline: true, lag, dropAfter: words.indexOf('cle') + 3 });
    assert.equal(typed.heard, 'Call the florist about the arch and confirm the final payment cle', 'the app is behind the box when Next is tapped');
    await typed.flushFields();
    assert.equal(typed.heard, words, `Next saves the whole answer (lag ${lag})`);
    assert.equal(typed.phone.focused, false, 'the box has finished editing');
  }
});

test('Next still goes on when the box never sends its end-of-editing text, and at once when no box is open', async () => {
  const typed = typeFast('Rosewood Catering', { dropAfter: 8 });
  typed.phone.endLag = null;
  const started = Date.now();
  await typed.flushFields(40);
  assert.ok(Date.now() - started < 1000, 'the wait is bounded');
  assert.equal(typed.heard, 'Rosewood', 'it goes on with what it heard');
  const idle = Date.now();
  await typed.flushFields(5000);
  assert.ok(Date.now() - idle < 1000, 'no focused box: no wait');
});
