import { SiteRedirect } from '@/components/SiteRedirect';
export const metadata = { title: 'ValueArena', robots: { index: false, follow: true } };
export default function Page() { return <SiteRedirect to="https://valuearena.github.io/compare/" label="ValueArena" />; }
