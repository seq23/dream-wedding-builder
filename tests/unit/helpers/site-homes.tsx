// Renders each canonical host's real homepage component to HTML, so the seo-hygiene
// guards read what a crawler gets rather than what the code intends.
import { renderToStaticMarkup } from 'react-dom/server';
import ownership from '@/data/seo/route_ownership.json';
import HomePage from '@/app/page';
import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug } from '@/lib/seo';

export const HOSTS = Object.keys(ownership.hosts) as Array<keyof typeof ownership.hosts>;

export function renderHome(host: string): string {
  const cfg = (ownership.hosts as Record<string, { root_action: string; root_target: string }>)[host];
  if (cfg.root_action === 'render') return renderToStaticMarkup(<HomePage />);
  const slug = cfg.root_target.replace(/^\//, '');
  return renderToStaticMarkup(<HubPage slug={slug} page={hubBySlug(slug)} />);
}

export function renderHub(slug: string): string {
  return renderToStaticMarkup(<HubPage slug={slug} page={hubBySlug(slug)} />);
}

export function jsonLdNodes(html: string): Array<Record<string, unknown>> {
  const nodes: Array<Record<string, unknown>> = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const data = JSON.parse(m[1]);
    for (const node of Array.isArray(data) ? data : [data]) nodes.push(node);
  }
  return nodes;
}

export function typeSet(html: string): string[] {
  return [...new Set(jsonLdNodes(html).map((n) => String(n['@type'])))].sort();
}

export function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((b, i) => bytes[i] === b)) throw new Error('not a PNG');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
