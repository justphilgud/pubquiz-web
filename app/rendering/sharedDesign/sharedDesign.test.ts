import assert from 'node:assert/strict';
import test from 'node:test';
import { getPresentationTemplate } from '../templateRegistry';
import { parseSharedDesign, parseQuizDesignSnapshot, parseDesignSelection, sharedDesignTokens, supportsSharedDesign } from './sharedDesign';
import { parsePresentationTemplateConfig, type PresentationTemplateConfig } from '../presentationTemplates/presentationTemplate';
import { inspectRow } from '@/scripts/operations/acceptance-policy';
function config(id:string):PresentationTemplateConfig {const t=getPresentationTemplate(id)!;return {version:1,tokens:structuredClone(t.tokens),design:structuredClone(t.design),surfaces:{presentation:t.variant,answerForm:'BRANDED',moderation:'BRANDED'}};}
for(const id of ['phil-gud','lovd-ungegoogelt'])test(id+' shares validated identity without changing legacy tokens',()=>{
 const template=getPresentationTemplate(id)!;
 assert.equal(sharedDesignTokens(template),template.tokens);
 const c=config(id);assert.ok(supportsSharedDesign(c));assert.ok(parsePresentationTemplateConfig(c));
 const design={version:1,templateId:id,name:id,config:c};assert.ok(parseSharedDesign(design));
 assert.doesNotThrow(()=>inspectRow({theme_config_json:c},new Set(),'pubquiz','presentation_templates'));
 const snapshot={version:1,design,answerForm:{id,name:id,config:c}};
 assert.ok(parseQuizDesignSnapshot(snapshot));assert.equal(parseQuizDesignSnapshot({...snapshot,extra:true}),null);assert.equal(parseQuizDesignSnapshot({...snapshot,version:2}),null);
 assert.doesNotThrow(()=>inspectRow({shared_design_snapshot:snapshot},new Set(),'pubquiz','quiz'));
 assert.throws(()=>inspectRow({shared_design_snapshot:design},new Set(),'pubquiz','game_drafts'));
 for(const bad of [{...design,version:2},{...design,extra:true},{...design,config:{...c,tokens:{...c.tokens,typography:{...c.tokens.typography,displayFamily:'evil-font'}}}}])assert.equal(parseSharedDesign(bad),null);
 const invalid=structuredClone(c) as unknown as {tokens:{typography:Record<string,unknown>}};
 invalid.tokens.typography.extra='unknown';assert.throws(()=>inspectRow({theme_config_json:invalid},new Set(),'pubquiz','presentation_templates'));
 invalid.tokens.typography={family:'not-allowed',displayWeight:400,bodyWeight:400};assert.throws(()=>inspectRow({theme_config_json:invalid},new Set(),'pubquiz','presentation_templates'));
});
test('shared support is explicit; unrelated legacy worlds remain Quiz-only',()=>{for(const id of ['birthday-reference','ungegoogelt-default','komm-one-pubquiz'])assert.equal(supportsSharedDesign(config(id)),false);});
test('selection uses explicit inheritance and bounded template IDs',()=>{
 assert.equal(parseDesignSelection(null),null);assert.equal(parseDesignSelection('INHERIT',true),'INHERIT');
 for(const value of ['INHERIT','../other','https://evil.example/',{},7,'x'.repeat(65)])assert.throws(()=>parseDesignSelection(value));
});
