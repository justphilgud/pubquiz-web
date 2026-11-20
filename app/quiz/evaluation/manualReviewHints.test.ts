import assert from "node:assert/strict";
import test from "node:test";
import { buildManualReviewHints, filterManualReview, isNearReviewText, type ReviewHintEntry } from "./manualReviewHints";
import { filterEvaluationAnswers, DEFAULT_EVALUATION_ANSWER_FILTERS } from "./evaluationAnswerFilter";

const row = (id: number, changes: Partial<ReviewHintEntry> = {}): ReviewHintEntry => ({
  quiz_fragen_id: 1, team_antwort_id: id, templateId: null, antwortText: "Berlin", ausgewaehlteAntwort: null,
  istOffeneFrage: true, istUnbeantwortet: false, istNichtGespielt: false, bewertungAusstehend: false,
  bewertungsstatus: "REVIEW_REQUIRED", bewertungsquelle: "AUTO", ...changes,
});

test("case-insensitive groups retain original text, never cross assignments or field IDs", () => {
  const entries = [row(1),row(2,{antwortText:"BERLIN"}),row(3,{quiz_fragen_id:2}),
    row(4,{reviewFields:[{id:1,label:"A",answer:"Berlin",solutions:[]}]}),
    row(5,{reviewFields:[{id:2,label:"B",answer:"Berlin",solutions:[]}]})];
  const snapshot = JSON.stringify(entries);
  const hints = buildManualReviewHints(entries);
  assert.ok(hints.get(1)?.some(h=>h.kind==="SAME"));
  assert.ok(hints.get(2)?.some(h=>h.kind==="SAME"));
  for(const id of [3,4,5])assert.equal(hints.get(id),undefined);
  assert.equal(JSON.stringify(entries),snapshot);
  assert.ok(buildManualReviewHints([row(8,{antwortText:"Straße"}),row(9,{antwortText:"STRASSE"})]).get(8)?.some(h=>h.kind==="SAME"));
});

test("one letter, duplicated letter and Unicode differences are suggestions, not equality", () => {
  for(const [a,b] of [["Berlin","Berlinn"],["Beatles","Beetles"],["Müller","Müler"]])assert.equal(isNearReviewText(a,b),true);
  assert.equal(isNearReviewText("BERLIN","Berlin"),false);
  assert.equal(isNearReviewText("2025","2026"),false);
  assert.equal(isNearReviewText("ab","ac"),false);
  assert.equal(isNearReviewText("Berlin","Paris"),false);
  assert.equal(isNearReviewText("a".repeat(513),"a".repeat(512)),false);
  const hints=buildManualReviewHints([row(1),row(2,{antwortText:"Berlinn"}),row(3,{antwortText:"Pariss",reviewSolutions:["Paris"]})]);
  assert.ok(hints.get(1)?.some(h=>h.kind==="SIMILAR"));
  assert.ok(hints.get(3)?.some(h=>h.kind==="SOLUTION"));
});

test("FaceMorph detects full and partial swaps by stable canonical field solutions only", () => {
  const fields=[{id:10,label:"Person A",answer:"BOB",solutions:["Alice"]},{id:11,label:"Person B",answer:"Alice",solutions:["Bob"]}];
  const entries=[row(1,{templateId:"face_morph",reviewFields:fields}),row(2,{templateId:"face_morph",reviewFields:[fields[0],{...fields[1],answer:null}]})];
  const hints=buildManualReviewHints(entries);
  assert.match(hints.get(1)!.find(h=>h.kind==="FACE_SWAP")!.text,/vertauscht/);
  assert.match(hints.get(2)!.find(h=>h.kind==="FACE_SWAP")!.text,/andere.*Person/);
  const own=fields.map(field=>({...field,solutions:["Alice","Bob"]}));
  assert.ok(!buildManualReviewHints([row(3,{templateId:"face_morph",reviewFields:own})]).get(3)?.some(h=>h.kind==="FACE_SWAP"));
  assert.ok(!buildManualReviewHints([row(4,{reviewFields:fields})]).get(4)?.some(h=>h.kind==="FACE_SWAP"));
});

test("ordinary review excludes Meme/Ordering, retains manual closed decisions and pending calculations", () => {
  const entries=[row(1),row(2,{templateId:"meme_beschriften"}),row(3,{templateId:"reihenfolge"}),
    row(4,{istOffeneFrage:false,bewertungsstatus:"WRONG"}),row(5,{istOffeneFrage:false,bewertungsstatus:"WRONG",bewertungsquelle:"MANUAL"}),
    row(6,{bewertungAusstehend:true}),row(7,{istUnbeantwortet:true})];
  assert.deepEqual(filterManualReview(entries,{pendingOnly:false,hideClearClosedWrong:false}).map(r=>r.team_antwort_id),[1,4,5,6,7]);
  assert.deepEqual(filterManualReview(entries,{pendingOnly:false,hideClearClosedWrong:true}).map(r=>r.team_antwort_id),[1,5,6,7]);
  assert.deepEqual(filterManualReview(entries,{pendingOnly:true,hideClearClosedWrong:true}).map(r=>r.team_antwort_id),[1]);
  const composed=filterEvaluationAnswers(entries.map(r=>({...r,teamname:"Team",abschnittId:1,istGespielt:true,istAutomatischRichtig:false})),{
    ...DEFAULT_EVALUATION_ANSWER_FILTERS,scope:"SECTION:1",selectedTeam:"Team",openQuestionsOnly:true,includeUnanswered:false,
  });
  assert.ok(filterManualReview(composed,{pendingOnly:true,hideClearClosedWrong:true}).every(r=>r.istOffeneFrage));
});

test("unanswered, unplayed, pending, numeric, special scoring and closed rows produce no fuzzy hints", () => {
  const rows=[row(1,{istUnbeantwortet:true}),row(2,{istNichtGespielt:true}),row(3,{bewertungAusstehend:true}),row(4,{istOffeneFrage:false}),
    ...["meme_beschriften","reihenfolge","pixelbild","paare_bilden","fakten_land","fakten_jahr","schaetzfrage","umfrage_einfach"].map((templateId,i)=>row(i+5,{templateId}))];
  assert.equal(buildManualReviewHints(rows).size,0);
});
