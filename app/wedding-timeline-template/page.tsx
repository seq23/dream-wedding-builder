import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug, hubMetadata } from '@/lib/seo';
export const metadata = hubMetadata('wedding-timeline-template');
export default function Page(){ return <HubPage slug="wedding-timeline-template" page={hubBySlug('wedding-timeline-template')} />; }
