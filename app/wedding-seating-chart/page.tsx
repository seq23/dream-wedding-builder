import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug, hubMetadata } from '@/lib/seo';
export const metadata = hubMetadata('wedding-seating-chart');
export default function Page(){ return <HubPage slug="wedding-seating-chart" page={hubBySlug('wedding-seating-chart')} />; }
