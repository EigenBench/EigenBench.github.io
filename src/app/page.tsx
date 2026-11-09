import { EigenBenchHome } from '@/components/EigenBenchHome';
import { pageMetadata } from '@/lib/metadata';
export const metadata = pageMetadata('EigenBench | Find your model match', 'Find the model closest to your choices, explore saved responses, or run your own evaluation.', '/');
export default function HomePage() { return <EigenBenchHome />; }
