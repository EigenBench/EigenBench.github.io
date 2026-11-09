import { Experiments } from '@/components/Experiments';
import { pageMetadata } from '@/lib/metadata';
import savedRuns from '@/lib/data/saved-runs-index.json';

export const metadata = pageMetadata('Saved runs | EigenBench', 'Browse previous EigenBench evaluations, scores, and judgments from the ValueArena archive.', '/experiments/');

export default function SavedRunsPage() {
  return <div className="research-index saved-runs-page">
    <header className="research-page-head saved-runs-heading">
      <div><h1>Saved runs</h1><p>Past evaluations, their scores, and the judgments behind them.</p></div>
      <img src="/assets/art/experiment-archive.webp" width="640" height="608" alt="" aria-hidden="true" />
    </header>
    <Experiments initialRuns={savedRuns.runs} compact />
  </div>;
}
