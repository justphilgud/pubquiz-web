import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { candidateDigest, parseEditorialPool, previewEditorialImport, sha256, validateEditorialCandidate, type EditorialSource } from "./editorialImport";

const base = new URL("../../../../editorial/paule-oktober-2026/", import.meta.url);
const files = ["anagrams.json", "estimates.json"].map(name => ({name,raw:readFileSync(new URL(name,base),"utf8")}));
export const fixtureSource: EditorialSource = { provider:"Editorial:PR93", files:files.map(f=>({name:f.name,sha256:sha256(f.raw)})), candidates:files.flatMap(f=>parseEditorialPool(f.name,f.raw)) };
const categories = new Set(fixtureSource.candidates.flatMap(c=>c.categories));
const run = (source=fixtureSource) => previewEditorialImport(source,[],new Map(),categories);

test("100 immutable approved rows validate, including all 50 exact anagrams and 50 numeric estimates",()=>{
  assert.equal(fixtureSource.candidates.length,100);
  assert.equal(fixtureSource.candidates.filter(c=>c.templateId==="anagramm").length,50);
  assert.equal(fixtureSource.candidates.filter(c=>c.templateId==="schaetzfrage").length,50);
  for(const c of fixtureSource.candidates) assert.deepEqual(validateEditorialCandidate(c),[],c.externalId);
  assert.equal(files[0].raw.includes("Clint Eastwood"),true);
  assert.equal(fixtureSource.files[0].sha256,"631f16376a39a5a6b5d6d98fce593c064ccff7524235809f4740470867988c9b");
  assert.equal(fixtureSource.files[1].sha256,"85af63d465b2457093fd62be1129241b82d430700ebfa3616d2222ab4058373c");
});
test("different people with shared anagram boilerplate do not become semantic duplicates",()=>{
  assert.ok(run().slice(0,50).every(d=>d.action==="IMPORTIEREN"));
});
test("approximation/source boilerplate cannot make unrelated measurements semantic duplicates",()=>{
  const decisions=run();
  for(const id of ["EST-13","EST-40"]) assert.equal(decisions.find(d=>d.candidate.externalId===id)?.action,"IMPORTIEREN",id);
});
test("identical text duplicate is skipped, regardless of existing template",()=>{
  const c=fixtureSource.candidates[0];
  const d=previewEditorialImport({...fixtureSource,candidates:[c]},[{id:17,question:c.question.toUpperCase(),templateId:null,solutions:[c.solution],templateData:null}],new Map(),categories)[0];
  assert.equal(d.action,"ÜBERSPRINGEN");assert.equal(d.duplicates[0].questionId,17);
  assert.equal(d.existingQuestionId,17);
});
test("identical prompt with missing or conflicting solution requires manual review",()=>{
  const c=fixtureSource.candidates[0];
  for(const solutions of [[],["Another person"]]) {
    const d=previewEditorialImport({...fixtureSource,candidates:[c]},[{id:17,question:c.question,templateId:null,solutions,templateData:null}],new Map(),categories)[0];
    assert.equal(d.action,"MANUELL PRÜFEN");
  }
});
test("explicit measurement and reference period detect equivalent facts even with unrelated wording",()=>{
  const c={...fixtureSource.candidates[50],metadata:{measurementKey:"adult-human-bones",referenceDate:"2026"}};
  for(const period of ["2026","2025"]) {
    const d=previewEditorialImport({...fixtureSource,candidates:[c]},[{id:21,question:"Skelettbestand?",templateId:null,solutions:[],templateData:null,metadata:{measurementKey:"adult-human-bones",referenceDate:period}}],new Map(),categories)[0];
    assert.equal(d.action,"MANUELL PRÜFEN");assert.equal(d.duplicates[0].reason,period==="2026"?"SAME_MEASUREMENT_PERIOD":"MEASUREMENT_PERIOD_REVIEW");
  }
});
test("same personality in a differently phrased existing question requires manual review",()=>{
  const c=fixtureSource.candidates[0];
  const d=previewEditorialImport({...fixtureSource,candidates:[c]},[{id:18,question:"Wer führte bei Gran Torino Regie?",templateId:null,solutions:["Clint Eastwood"],templateData:null}],new Map(),categories)[0];
  assert.equal(d.action,"MANUELL PRÜFEN");assert.equal(d.duplicates[0].reason,"SAME_PERSON_OR_SOLUTION");
});
test("same normalized anagram with another prompt is skipped",()=>{
  const c=fixtureSource.candidates[0];
  const d=previewEditorialImport({...fixtureSource,candidates:[c]},[{id:19,question:"Gesuchte Person?",templateId:c.templateId,solutions:[c.solution],templateData:c.templateConfig.templateData}],new Map(),categories)[0];
  assert.equal(d.action,"ÜBERSPRINGEN");
});
test("semantic estimate paraphrase and same value/unit are conservative review candidates",()=>{
  const c=fixtureSource.candidates[50];
  const d=previewEditorialImport({...fixtureSource,candidates:[c]},[{id:20,question:"Wie viele Knochen hat ein typischer erwachsener Mensch?",templateId:c.templateId,solutions:[c.solution],templateData:c.templateConfig.templateData}],new Map(),categories)[0];
  assert.equal(d.action,"MANUELL PRÜFEN");assert.ok(d.duplicates.length);
});
test("repeat import resolves original ID; changed payload under same ID is blocked",()=>{
  const c=fixtureSource.candidates[0], imported=new Map([[c.externalId,{questionId:44,digest:candidateDigest(c)}]]);
  const d=previewEditorialImport({...fixtureSource,candidates:[c]},[],imported,categories)[0];
  assert.equal(d.action,"ÜBERSPRINGEN");assert.equal(d.existingQuestionId,44);
  const changed=previewEditorialImport({...fixtureSource,candidates:[{...c,question:"Changed"}]},[],imported,categories)[0];
  assert.equal(changed.action,"MANUELL PRÜFEN");assert.ok(changed.validation.includes("IMPORT_ID_CONTENT_CONFLICT"));
});
test("duplicate source IDs, missing category and invalid unit cannot silently import",()=>{
  const c=fixtureSource.candidates[0];assert.throws(()=>run({...fixtureSource,candidates:[c,c]}),/DUPLICATE_ID/);
  const missing=previewEditorialImport({...fixtureSource,candidates:[c]},[],new Map(),new Set())[0];assert.equal(missing.action,"MANUELL PRÜFEN");
  const estimate=structuredClone(fixtureSource.candidates[50]);estimate.templateConfig.templateData={kind:"ESTIMATE",correctValue:206,unit:"",numberFormat:"INTEGER",explanation:"",tolerance:null};
  assert.ok(validateEditorialCandidate(estimate).length);
});
test("metadata and approved wording are preserved, not rewritten",()=>{
  for(const c of fixtureSource.candidates){const original=c.metadata.original as Record<string,unknown>;assert.equal(c.question,original.question);assert.deepEqual(c.templateConfig,original.templateConfig);assert.equal(c.difficulty,original.difficulty);assert.equal(c.categories[0],original.category);}
});
