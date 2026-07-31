import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug, hubMetadata } from '@/lib/seo';
export const metadata = hubMetadata('wedding-guest-list-template');
export default function Page(){ return <HubPage slug="wedding-guest-list-template" page={hubBySlug('wedding-guest-list-template')} />; }
