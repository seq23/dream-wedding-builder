import type { StoredIdea } from '@/lib/trend-ideas';

// The ideas visitors sent from the homepage's standout-idea form (lib/trend-ideas.ts), newest
// first, on the owner-signed-in /admin page only. null = the store could not be read: that is
// said plainly and never shown as "no ideas yet". Untrusted text is rendered as text (React
// escapes it) and a source link is shown, never made clickable.

export type IdeasView = { ideas: StoredIdea[]; total: number; older: number | null } | null;

const when = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
function shown(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${when.format(d)} CT`;
}

export function AdminIdeas({ view, paged }: { view: IdeasView; paged: boolean }) {
  const heading = <><p className="text-xs font-bold uppercase tracking-[.25em] text-midnight-muted">Standout-idea form</p><h2 className="mt-2 font-serif text-4xl">Ideas visitors sent</h2></>;
  if (view === null) {
    return <section data-testid="admin-ideas" className="rounded-2xl border border-amber-400 bg-amber-50 p-5 md:p-6">{heading}<p data-testid="admin-ideas-unreadable" className="mt-3 text-sm">The ideas could not be read just now, so this list is unknown, not empty. Reload in a minute.</p></section>;
  }
  return <section data-testid="admin-ideas" className="min-w-0">
    {heading}
    <p className="mt-2 text-sm text-midnight-muted" data-testid="admin-ideas-total">{view.total === 0 ? 'No ideas have been sent yet.' : `${view.total} idea${view.total === 1 ? '' : 's'} in all, newest first.`}</p>
    {paged ? <p className="mt-2 text-sm"><a href="/admin#ideas" className="font-bold text-blue underline underline-offset-4">Back to the newest ideas</a></p> : null}
    <ol className="mt-4 grid gap-3" id="ideas">
      {view.ideas.map((idea) => <li key={idea.id} data-testid="admin-idea" className="min-w-0 rounded-2xl bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="min-w-0 break-words font-serif text-2xl">{idea.idea_name}</h3>
          <p className="font-mono text-xs text-midnight-muted">{shown(idea.submitted_at)}</p>
        </div>
        <p className="mt-1 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-ivory px-3 py-1 font-bold">{idea.category}</span>
          {idea.budget_feel ? <span className="rounded-full bg-ivory px-3 py-1">Budget: {idea.budget_feel}</span> : null}
          {idea.price_this_out ? <span className="rounded-full bg-ivory px-3 py-1">Asked us to price it</span> : null}
          {idea.is_test ? <span data-testid="admin-idea-test" className="rounded-full border border-charcoal/30 px-3 py-1 font-bold">TEST</span> : null}
        </p>
        <p className="mt-3 whitespace-pre-line break-words text-sm leading-6">{idea.description}</p>
        {idea.why_cool ? <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-charcoal/70"><span className="font-bold">Why it is cool: </span>{idea.why_cool}</p> : null}
        {idea.source_type || idea.source_url ? <p className="mt-2 break-all text-xs text-midnight-muted">Seen on {idea.source_type || 'unknown'}{idea.source_url ? <>: <span className="font-mono">{idea.source_url}</span></> : null}</p> : null}
      </li>)}
    </ol>
    {view.older ? <p className="mt-4"><a href={`/admin?ideas_before=${view.older}#ideas`} className="inline-flex min-h-11 items-center font-bold text-blue underline underline-offset-4">Older ideas ›</a></p> : null}
  </section>;
}
