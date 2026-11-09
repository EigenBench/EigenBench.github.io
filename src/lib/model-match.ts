export type MatchPick = 'a' | 'b' | 'skip';
export interface MatchQuestion {
  id: string;
  scenario: string;
  a: { model: string; response: string };
  b: { model: string; response: string };
  value: string;
  run: string;
  judges: { name: string; side: 'a' | 'b'; score: number; line: number }[];
}
export interface MatchPack { version: number; models: string[]; questions: MatchQuestion[] }
export interface MatchScore { model: string; chosen: number; compared: number; rate: number }

export function matchScores(pack: MatchPack, answers: (MatchPick | null)[]): MatchScore[] {
  return pack.models.map(model => {
    let chosen = 0, compared = 0;
    pack.questions.forEach((question, i) => {
      const answer = answers[i];
      if (!answer || answer === 'skip' || (question.a.model !== model && question.b.model !== model)) return;
      compared++;
      if (question[answer].model === model) chosen++;
    });
    return { model, chosen, compared, rate: compared ? chosen / compared : 0 };
  }).sort((a, b) => Number(b.compared >= 2) - Number(a.compared >= 2) || b.rate - a.rate || b.compared - a.compared || a.model.localeCompare(b.model));
}

export function closestModels(scores: MatchScore[], answers: (MatchPick | null)[]): MatchScore[] {
  if (answers.filter(a => a && a !== 'skip').length < 6) return [];
  const eligible = scores.filter(score => score.compared >= 2);
  return eligible.filter(score => score.rate === eligible[0]?.rate);
}

export interface MatchDecision { question: string; model: string }

/** Break equal scores with direct preferences, then explicit deciding choices. */
export function resolveModelMatch(pack: MatchPack, answers: (MatchPick | null)[], decisions: MatchDecision[] = []): { winner: MatchScore | null; question: MatchQuestion | null; brokeTie: boolean } {
  let tied = closestModels(matchScores(pack, answers), answers);
  const brokeTie = tied.length > 1;
  if (tied.length > 1) {
    const directWins = new Map(tied.map(score => [score.model, 0]));
    pack.questions.forEach((question, i) => {
      const pick = answers[i];
      if (!pick || pick === 'skip' || !directWins.has(question.a.model) || !directWins.has(question.b.model)) return;
      const model = question[pick].model;
      directWins.set(model, directWins.get(model)! + 1);
    });
    const best = Math.max(...directWins.values());
    tied = tied.filter(score => directWins.get(score.model) === best);
  }
  for (const decision of decisions) {
    if (tied.length < 2) break;
    const pair = tied.slice(0, 2).map(score => score.model);
    const question = pack.questions.find(q => pair.includes(q.a.model) && pair.includes(q.b.model));
    if (!question || decision.question !== question.id || !pair.includes(decision.model)) break;
    tied = tied.filter(score => !pair.includes(score.model) || score.model === decision.model);
  }
  const pair = tied.slice(0, 2).map(score => score.model);
  return {
    winner: tied.length === 1 ? tied[0] : null,
    question: tied.length > 1 ? pack.questions.find(q => pair.includes(q.a.model) && pair.includes(q.b.model)) ?? null : null,
    brokeTie,
  };
}
