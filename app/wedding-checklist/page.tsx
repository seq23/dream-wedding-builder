import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug, hubMetadata } from '@/lib/seo';
export const metadata = hubMetadata('wedding-checklist');
export default function Page(){ return <HubPage slug="wedding-checklist" page={hubBySlug('wedding-checklist')} />; }
