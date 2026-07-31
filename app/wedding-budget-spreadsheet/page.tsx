import { HubPage } from '@/components/seo/HubPage';
import { hubBySlug, hubMetadata } from '@/lib/seo';
export const metadata = hubMetadata('wedding-budget-spreadsheet');
export default function Page(){ return <HubPage slug="wedding-budget-spreadsheet" page={hubBySlug('wedding-budget-spreadsheet')} />; }
