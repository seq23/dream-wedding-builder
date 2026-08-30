import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug, hubMetadata } from '@/lib/seo';
export const metadata = hubMetadata('amazon/wedding-seating-chart');
export default function Page(){ return <HubPage slug="amazon/wedding-seating-chart" page={hubBySlug('amazon/wedding-seating-chart')} />; }
