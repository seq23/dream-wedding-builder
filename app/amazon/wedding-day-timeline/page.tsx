import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug, hubMetadata } from '@/lib/seo';
export const metadata = hubMetadata('amazon/wedding-day-timeline');
export default function Page(){ return <HubPage slug="amazon/wedding-day-timeline" page={hubBySlug('amazon/wedding-day-timeline')} />; }
