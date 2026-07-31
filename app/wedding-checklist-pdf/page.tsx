import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug, hubMetadata } from '@/lib/seo';
export const metadata = hubMetadata('wedding-checklist-pdf');
export default function Page(){ return <HubPage slug="wedding-checklist-pdf" page={hubBySlug('wedding-checklist-pdf')} />; }
