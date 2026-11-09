import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { matchScores, closestModels } from '../src/lib/model-match.ts';
const pack=JSON.parse(readFileSync(new URL('../public/model-match.json',import.meta.url),'utf8'));
test('quiz uses unique saved scenarios and equal model exposure',()=>{
 assert.equal(pack.questions.length,10);
 assert.equal(new Set(pack.questions.map(q=>q.scenario)).size,10);
 assert.equal(new Set(pack.questions.map(q=>[q.a.model,q.b.model].sort().join('|'))).size,10);
 for(const model of pack.models)assert.equal(pack.questions.filter(q=>q.a.model===model||q.b.model===model).length,4);
 for(const q of pack.questions){assert.ok(q.a.response&&q.b.response&&q.run);for(const j of q.judges)assert.ok(j.line>0);}
});
test('preferences score the chosen model; skipped answers count for neither',()=>{
 const answers=pack.questions.map(()=> 'skip'); answers[0]='a';
 const scores=matchScores(pack,answers);
 assert.equal(scores.find(s=>s.model===pack.questions[0].a.model).chosen,1);
 assert.equal(scores.reduce((n,s)=>n+s.compared,0),2);
 assert.equal(scores.reduce((n,s)=>n+s.chosen,0),1);
 assert.deepEqual(closestModels(scores,answers),[]);
});
test('a consistently preferred model leads regardless of answer position',()=>{
 const wanted=pack.models[0];
 const answers=pack.questions.map(q=>q.a.model===wanted?'a':q.b.model===wanted?'b':'a');
 const scores=matchScores(pack,answers);
 assert.equal(scores[0].model,wanted);assert.equal(scores[0].rate,1);
 assert.equal(closestModels(scores,answers)[0].model,wanted);
});
test('ties remain ties and insufficiently compared models cannot win',()=>{
 const scores=[{model:'A',chosen:1,compared:1,rate:1},{model:'B',chosen:2,compared:3,rate:2/3},{model:'C',chosen:2,compared:3,rate:2/3}];
 assert.deepEqual(closestModels(scores,Array(6).fill('a')).map(s=>s.model),['B','C']);
 assert.deepEqual(closestModels(scores,Array(5).fill('a')),[]);
});

test('quiz responses and provenance match the original saved packs exactly',()=>{
 const ids=['kindness','lockean-rights','taoism','conservatism'];
 const originals=ids.map(id=>JSON.parse(readFileSync(new URL(`../public/judge/${id}.json`,import.meta.url),'utf8')));
 for(const question of pack.questions){
  const source=originals.find(p=>p.matchups.some(m=>m.id===question.id));
  const original=source.matchups.find(m=>m.id===question.id);
  assert.equal(question.scenario,original.scenario);assert.equal(question.run,source.run);
  assert.deepEqual(question.a,original.a);assert.deepEqual(question.b,original.b);
 }
});

test('a tied score resolves to the user’s direct head-to-head preference',async()=>{
 const {resolveModelMatch}=await import('../src/lib/model-match.ts');
 let checked=0;
 for(let mask=0;mask<1024;mask++){
  const answers=pack.questions.map((_,i)=>mask&(1<<i)?'a':'b');
  const tied=closestModels(matchScores(pack,answers),answers);
  if(tied.length!==2)continue;
  const index=pack.questions.findIndex(q=>tied.some(s=>s.model===q.a.model)&&tied.some(s=>s.model===q.b.model));
  assert.equal(resolveModelMatch(pack,answers).winner.model,pack.questions[index][answers[index]].model);checked++;
 }
 assert.ok(checked>0);
});

test('every completed binary quiz produces one winner after at most four explicit deciders',async()=>{
 const {resolveModelMatch}=await import('../src/lib/model-match.ts');
 let deciders=0;
 for(let mask=0;mask<1024;mask++){
  const answers=pack.questions.map((_,i)=>mask&(1<<i)?'a':'b');
  const decisions=[];let outcome=resolveModelMatch(pack,answers,decisions);
  while(outcome.question){
   decisions.push({question:outcome.question.id,model:outcome.question.a.model});
   assert.ok(decisions.length<=4);deciders++;
   outcome=resolveModelMatch(pack,answers,decisions);
  }
  assert.ok(outcome.winner);assert.equal(outcome.question,null);
  assert.deepEqual(answers,pack.questions.map((_,i)=>mask&(1<<i)?'a':'b'));
 }
 assert.ok(deciders>0);
 assert.equal(resolveModelMatch(pack,Array(10).fill('skip')).winner,null);
});
