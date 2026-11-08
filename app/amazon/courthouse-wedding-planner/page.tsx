import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug, hubMetadata } from '@/lib/seo';
export const metadata = hubMetadata('amazon/courthouse-wedding-planner');
export default function Page(){ return <HubPage slug="amazon/courthouse-wedding-planner" page={hubBySlug('amazon/courthouse-wedding-planner')} />; }
