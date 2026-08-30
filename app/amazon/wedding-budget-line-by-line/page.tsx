import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug, hubMetadata } from '@/lib/seo';
export const metadata = hubMetadata('amazon/wedding-budget-line-by-line');
export default function Page(){ return <HubPage slug="amazon/wedding-budget-line-by-line" page={hubBySlug('amazon/wedding-budget-line-by-line')} />; }
