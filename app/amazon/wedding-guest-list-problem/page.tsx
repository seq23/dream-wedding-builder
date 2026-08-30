import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug, hubMetadata } from '@/lib/seo';
export const metadata = hubMetadata('amazon/wedding-guest-list-problem');
export default function Page(){ return <HubPage slug="amazon/wedding-guest-list-problem" page={hubBySlug('amazon/wedding-guest-list-problem')} />; }
