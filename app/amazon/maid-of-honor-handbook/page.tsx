import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug, hubMetadata } from '@/lib/seo';
export const metadata = hubMetadata('amazon/maid-of-honor-handbook');
export default function Page(){ return <HubPage slug="amazon/maid-of-honor-handbook" page={hubBySlug('amazon/maid-of-honor-handbook')} />; }
