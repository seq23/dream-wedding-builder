import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug, hubMetadata } from '@/lib/seo';
export const metadata = hubMetadata('amazon/wedding-vendor-questions');
export default function Page(){ return <HubPage slug="amazon/wedding-vendor-questions" page={hubBySlug('amazon/wedding-vendor-questions')} />; }
