import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug, hubMetadata } from '@/lib/seo';
export const metadata = hubMetadata('wedding-planning-checklist');
export default function Page(){ return <HubPage slug="wedding-planning-checklist" page={hubBySlug('wedding-planning-checklist')} />; }
