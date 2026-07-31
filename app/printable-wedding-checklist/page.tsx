import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug, hubMetadata } from '@/lib/seo';
export const metadata = hubMetadata('printable-wedding-checklist');
export default function Page(){ return <HubPage slug="printable-wedding-checklist" page={hubBySlug('printable-wedding-checklist')} />; }
