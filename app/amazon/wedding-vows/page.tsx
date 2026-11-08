import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug, hubMetadata } from '@/lib/seo';
export const metadata = hubMetadata('amazon/wedding-vows');
export default function Page(){ return <HubPage slug="amazon/wedding-vows" page={hubBySlug('amazon/wedding-vows')} />; }
