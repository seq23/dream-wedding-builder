import decisions from '@/data/seo/consolidated_decisions.json';

/** Useful authored actions from retired guides now live only at their final owner. */
export function ConsolidatedDecisions({ path }: { path: string }) {
  const rows = (decisions as Record<string, Array<{ situation: string; action: string }>>)[path];
  if (!rows?.length) return null;
  return <section className="overflow-x-auto rounded-2xl bg-white p-7 md:p-9">
    <h2 className="font-serif text-4xl">What changes in these planning situations?</h2>
    <table className="mt-6 w-full text-left text-sm leading-7"><thead><tr><th className="border-b p-3">Situation</th><th className="border-b p-3">What to do</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.situation}><th scope="row" className="border-b p-3 align-top">{row.situation}</th><td className="border-b p-3 align-top">{row.action}</td></tr>)}</tbody>
    </table>
  </section>;
}
