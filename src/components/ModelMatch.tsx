'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ModelLogo } from './ModelLogo';
import { resolveModelMatch, matchScores, type MatchDecision, type MatchPack, type MatchPick } from '@/lib/model-match';
import { renderMarkdownSanitized } from '@/lib/chat-render';

const STORE = 'eigenbench-model-match-v1';

function ResponseText({ text }: { text: string }) {
  const [html, setHtml] = useState<{ text: string; html: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    renderMarkdownSanitized(text).then(html => { if (!cancelled && html !== null) setHtml({ text, html }); }).catch(() => { /* Keep the complete original response if formatting is unavailable. */ });
    return () => { cancelled = true; };
  }, [text]);
  return html?.text === text ? <div className="match-response-text match-response-markdown" dangerouslySetInnerHTML={{ __html: html.html }} /> : <div className="match-response-text">{text}</div>;
}

const RunButton = () => <a className="match-run-button" href="/evaluate/">Run EigenBench</a>;

function LiveMatch({ pack, answers }: { pack: MatchPack; answers: (MatchPick | null)[] }) {
  const list = useRef<HTMLOListElement>(null);
  const positions = useRef(new Map<string, number>());
  const scores = matchScores(pack, answers).filter(score => score.compared > 0).sort((a, b) => b.rate - a.rate || b.chosen - a.chosen || a.model.localeCompare(b.model));
  const counts = pack.models.map(model => ({ model, closer: 0, further: 0 }));
  pack.questions.forEach((question, i) => {
    const answer = answers[i];
    if (!answer || answer === 'skip') return;
    counts.find(c => c.model === question[answer].model)!.closer++;
    counts.find(c => c.model === question[answer === 'a' ? 'b' : 'a'].model)!.further++;
  });
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    list.current?.querySelectorAll<HTMLElement>('[data-model]').forEach(row => {
      const top = row.offsetTop, model = row.dataset.model!;
      next.set(model, top);
      const before = positions.current.get(model);
      if (before !== undefined && before !== top && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        row.getAnimations().forEach(animation => animation.cancel());
        row.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'translateY(0)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    });
    positions.current = next;
  }, [answers]);
  return <aside className="match-live" aria-label="Your live model ranking">
    <header><span className="match-live-signal" aria-hidden="true" /><h2>Your match, taking shape</h2><span>{answers.filter(Boolean).length}/10</span></header>
    <div className="match-buckets">{(['closer', 'further'] as const).map(kind => <section className={`match-bucket match-bucket-${kind}`} key={kind} aria-label={kind === 'closer' ? 'Closer to me' : 'Less like me'}>
      <h3>{kind === 'closer' ? 'Closer to me' : 'Less like me'}</h3>
      <div className="match-bucket-models">{counts.filter(c => c[kind] > 0).map(c => <span className="match-model-token" key={`${c.model}-${c[kind]}`} title={`${c.model}: ${c[kind]} ${kind === 'closer' ? 'chosen' : 'passed over'}`}><ModelLogo name={c.model} size={25} /><span>{c.model}</span><b>{c[kind]}</b></span>)}
      {!counts.some(c => c[kind] > 0) && <span className="match-bucket-empty" aria-hidden="true"><i /><i /><i /></span>}</div>
    </section>)}</div>
    <div className="match-live-ranking"><div className="match-live-columns"><span>Current ranking</span><span>Chosen / seen</span></div>
      {!scores.length && <p className="match-live-empty">Make a choice and watch the models find their places.</p>}
      <ol ref={list}>{scores.map(score => <li key={score.model} data-model={score.model}><span className="match-live-rank">{scores.findIndex(s => s.rate === score.rate) + 1}</span><ModelLogo name={score.model} size={22} /><span className="match-live-name">{score.model}<span className="match-live-meter"><i style={{ width: `${score.rate * 100}%` }} /></span></span><strong>{score.chosen}<span>/{score.compared}</span></strong></li>)}</ol>
    </div>
    <p className="match-live-note">Updates after each choice. Early rankings can change quickly.</p>
    <p className="sr-only" role="status" aria-live="polite">{scores.length ? `Current leading ${scores.filter(s => s.rate === scores[0].rate).length > 1 ? 'models' : 'model'}: ${scores.filter(s => s.rate === scores[0].rate).map(s => s.model).join(', ')}.` : 'Choose a response to start your ranking.'}</p>
  </aside>;
}

export function ModelMatch() {
  const [pack, setPack] = useState<MatchPack | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [answers, setAnswers] = useState<(MatchPick | null)[]>([]);
  const [flips, setFlips] = useState<boolean[]>([]);
  const [index, setIndex] = useState(0);
  const [screen, setScreen] = useState<'home' | 'quiz' | 'decider' | 'result'>('quiz');
  const [copied, setCopied] = useState(false);
  const [decisions, setDecisions] = useState<MatchDecision[]>([]);
  const [tiePick, setTiePick] = useState<'a' | 'b' | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch('/model-match.json', { signal: controller.signal }).then(r => {
      if (!r.ok) throw new Error('Could not load quiz');
      return r.json() as Promise<MatchPack>;
    }).then(data => {
      let picks: (MatchPick | null)[] = data.questions.map(() => null);
      let order = data.questions.map(() => Math.random() < .5);
      let savedDecisions: MatchDecision[] = [];
      try {
        const saved = JSON.parse(sessionStorage.getItem(STORE) || 'null');
        if (saved?.version === data.version && saved.answers?.length === picks.length && saved.answers.every((a: unknown) => a === null || ['a', 'b', 'skip'].includes(String(a))) && saved.flips?.length === order.length && saved.flips.every((f: unknown) => typeof f === 'boolean')) {
          picks = saved.answers; order = saved.flips;
          if (Array.isArray(saved.decisions)) savedDecisions = saved.decisions.filter((d: MatchDecision) => d && typeof d.question === 'string' && typeof d.model === 'string');
        }
      } catch { /* The quiz works without browser storage. */ }
      setAnswers(picks); setFlips(order); setDecisions(savedDecisions); setPack(data);
      const next = picks.findIndex(pick => pick === null);
      setIndex(next < 0 ? 0 : next); setScreen(new URLSearchParams(location.search).get('view') === 'home' ? 'home' : next < 0 ? resolveModelMatch(data, picks, savedDecisions).question ? 'decider' : 'result' : 'quiz');
    }).catch(e => { if (e.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (!pack) return;
    try { sessionStorage.setItem(STORE, JSON.stringify({ version: pack.version, answers, flips, decisions })); } catch { /* Optional persistence. */ }
  }, [pack, answers, flips, decisions]);
  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    heading.current?.focus({ preventScroll: true });
    if (screen === 'result' || (heading.current?.getBoundingClientRect().top ?? 0) < 76) heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [screen, index, decisions.length]);

  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [menuOpen]);
  const closeQuiz = () => {
    setMenuOpen(false); setScreen('home');
    history.replaceState(history.state, '', '/?view=home');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const resume = () => {
    if (!pack) return;
    history.replaceState(history.state, '', '/');
    const next = answers.findIndex(answer => answer === null);
    setIndex(next < 0 ? 0 : next); setScreen(next < 0 ? resolveModelMatch(pack, answers, decisions).question ? 'decider' : 'result' : 'quiz');
    focusNext.current = true;
  };
  const move = (next: number) => { focusNext.current = true; setIndex(next); };
  const choose = (pick: MatchPick) => {
    if (screen === 'decider') { if (pick !== 'skip') setTiePick(pick); return; }
    setDecisions([]);
    setAnswers(previous => previous.map((answer, i) => i === index ? pick : answer));
    setShowInfo(false);
  };
  const finish = () => { setMenuOpen(false); if (!pack) return; focusNext.current = true; setTiePick(null); setScreen(resolveModelMatch(pack, answers, decisions).question ? 'decider' : 'result'); };
  const restart = () => {
    if (!pack) return;
    setMenuOpen(false); history.replaceState(history.state, '', '/');
    setDecisions([]); setTiePick(null); setAnswers(pack.questions.map(() => null)); setFlips(pack.questions.map(() => Math.random() < .5)); setCopied(false); setIndex(0); focusNext.current = true; setScreen('quiz');
  };
  const completed = answers.filter(Boolean).length;

  if (!pack) return <section className="match-loading"><h1>Which model thinks most like you?</h1><RunButton />{error ? <p role="alert">Couldn’t load the saved responses. <button onClick={() => setAttempt(n => n + 1)}>Try again</button></p> : <p role="status">Opening your first scenario…</p>}</section>;
  if (screen === 'home') return <section className="model-match-intro">
    <div><h1>Which model thinks<br />most like you?</h1><p>Choose between real model responses and discover your closest match.</p>
      <div className="match-intro-meta"><span>10 scenarios</span><span>5 models</span><span>No signup</span></div>
      <div className="eigenbench-actions"><button className="eigenbench-primary" onClick={resume}>{completed === pack.questions.length ? 'View my result' : completed ? 'Resume quiz' : 'Start quiz'}</button>{completed > 0 && <button onClick={restart}>Restart quiz</button>}<RunButton /></div>
      {completed > 0 && <p className="match-saved-note">{completed} of {pack.questions.length} answered. Your progress is saved in this tab.</p>}
    </div><img className="match-intro-art" src="/assets/art/model-conversation-values.webp" width="320" height="240" alt="Three pixel computers around a table" />
  </section>;
  if (screen === 'result') {
    const scores = matchScores(pack, answers), outcome = resolveModelMatch(pack, answers, decisions), winners = outcome.winner ? [outcome.winner] : [];
    const decisive = answers.filter(answer => answer && answer !== 'skip').length;
    return <section className="model-match-results">
      <div className="match-result-toolbar"><span className="match-eyebrow">Your model match</span><RunButton /></div><div className="match-result-heading"><h1 ref={heading} tabIndex={-1}>{!winners.length ? 'A few more choices would help.' : <>Your closest match:<br />{winners[0].model}.</>}</h1>
        {winners.length > 0 && <div className="match-winners">{winners.map(w => <span key={w.model}><ModelLogo name={w.model} size={40} />{w.model}</span>)}</div>}
        <p>{winners.length ? outcome.brokeTie ? 'Your direct preference broke the tie.' : 'Based on the saved responses you preferred.' : 'Make a choice in at least six scenarios to see a match. “Neither / unsure” is left out of the comparison.'}</p>
      </div>
      <div className="match-standings"><header><h2>How your choices compared</h2><span>Responses you chose</span></header>{scores.map(score => <div className="match-standing" key={score.model}><div><ModelLogo name={score.model} size={22} /><span>{score.model}</span><strong>{score.chosen} / {score.compared}</strong></div><span className="match-score-track"><span style={{ width: `${score.rate * 100}%` }} /></span>{score.compared < 2 && <small>Too few comparisons to rank</small>}</div>)}<p>{decisive} choices · {answers.filter(answer => answer === 'skip').length} skipped · {answers.filter(Boolean).length < pack.questions.length && <>{pack.questions.length - answers.filter(Boolean).length} unanswered · </>}Based on these saved responses.</p></div>
      <div className="eigenbench-actions"><button className="eigenbench-primary" onClick={() => { focusNext.current = true; setIndex(0); setScreen('quiz'); }}>Review my choices</button><button onClick={restart}>Start again</button>{winners.length > 0 && <button onClick={async () => { try { await navigator.clipboard.writeText(`My closest model match is ${winners[0].model}, based on 10 saved-response scenarios on EigenBench. Try yours: ${location.origin}/eigenbench/`); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Copied' : 'Copy result'}</button>}</div>

    </section>;
  }

  const deciding = screen === 'decider';
  const question = deciding ? resolveModelMatch(pack, answers, decisions).question ?? pack.questions[index] : pack.questions[index];
  const selected = deciding ? tiePick : answers[index];
  const advance = () => {
    if (!deciding) { if (index === pack.questions.length - 1) finish(); else move(index + 1); return; }
    if (!tiePick) return;
    const next = [...decisions, { question: question.id, model: question[tiePick].model }];
    setDecisions(next); setTiePick(null); focusNext.current = true;
    setScreen(resolveModelMatch(pack, answers, next).question ? 'decider' : 'result');
  };
  const sides: ('a' | 'b')[] = flips[pack.questions.indexOf(question)] ? ['b', 'a'] : ['a', 'b'];
  return <section className="model-match-quiz" data-started={completed > 0 && !showInfo} aria-label="Model match quiz">
    <div className="match-workspace-title"><h1>Which model thinks most like you?</h1><div className="match-workspace-actions"><div className="match-quiz-menu" ref={menu}><button ref={menuButton} className="match-menu-trigger" aria-label="Quiz menu" aria-expanded={menuOpen} aria-controls="quiz-actions" onClick={() => setMenuOpen(!menuOpen)}><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="currentColor"><circle cx="4" cy="9" r="1.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="14" cy="9" r="1.5"/></svg></button>{menuOpen && <div className="match-menu-panel" id="quiz-actions" role="group" aria-label="Quiz actions"><button onClick={closeQuiz}>Close quiz<span>Keep your progress</span></button><button onClick={restart}>Restart quiz<span>Start from the first scenario</span></button><button onClick={finish}>End quiz<span>See your result so far</span></button><a href="/?view=home">Back to home</a></div>}</div><button onClick={() => setShowInfo(!showInfo)} aria-expanded={showInfo}>{showInfo ? 'Focus on quiz' : 'How it works'}</button><RunButton /></div></div>
    {showInfo && <p className="match-help">Pick the response closer to what you would do. Each model appears four times across ten saved scenarios. Names appear after you choose; “Neither / unsure” doesn’t affect the ranking. Your progress stays in this browser tab.</p>}
    <div className="match-workspace" data-revealed={answers.some(answer => answer === 'a' || answer === 'b')}>
    <div className="match-question-pane">
    <div className="match-progress-heading"><span>{deciding ? 'Final deciding choice' : `Scenario ${index + 1} of ${pack.questions.length}`}</span><span>{deciding ? 'Your top models have equal scores' : 'Choose what feels like you'}</span></div>
    <progress value={deciding ? pack.questions.length : index + 1} max={pack.questions.length} aria-label="Quiz progress" />
    <h2 className="match-scenario-heading sr-only" ref={heading} tabIndex={-1}>Scenario {index + 1}: what would you do?</h2><p className="match-scenario">{question.scenario}</p>
    <div className="match-response-grid" key={question.id}>{sides.map((side, i) => <article className="match-response" data-selected={selected === side} key={side}>
      <h3><span>{i === 0 ? 'A' : 'B'}</span>{selected ? <><ModelLogo name={question[side].model} size={18} />{question[side].model}</> : `Response ${i === 0 ? 'A' : 'B'}`}</h3>
      <div className="match-response-scroll" tabIndex={0} role="region" aria-label={`Response ${i === 0 ? 'A' : 'B'} full text`}><ResponseText text={question[side].response} /></div>
      <button className="match-pick" aria-pressed={selected === side} onClick={() => choose(side)}>{selected === side ? 'Selected' : `I’m closer to ${i === 0 ? 'A' : 'B'}`}</button>
    </article>)}</div>
    <div className="match-quiz-bottom">{deciding ? <button className="match-skip" onClick={() => { move(0); setScreen('quiz'); }}>Review my choices</button> : <button className="match-skip" aria-pressed={selected === 'skip'} onClick={() => choose('skip')}>Neither / unsure</button>}<div><button disabled={!deciding && index === 0} onClick={() => { if (deciding) { move(pack.questions.length - 1); setScreen('quiz'); } else move(index - 1); }}>Back</button><button className="eigenbench-primary" disabled={!selected} onClick={advance}>{deciding || index === pack.questions.length - 1 ? 'See my match' : 'Next scenario'}</button></div></div>
    </div>
    {answers.some(answer => answer === 'a' || answer === 'b') && <LiveMatch pack={pack} answers={answers} />}
    </div>
  </section>;
}
