import assert from 'node:assert/strict';
import test from 'node:test';
import {matchingReadableWhere,matchingMediaWhere,matchingTemplateWhere} from './sourceQuery';
import {canViewScopedQuestion} from '@/app/fragen/editor/questionScopePolicy';
import type {AuthorizationActor} from '@/app/roles/roleAssignmentPolicy';

test('approved-source SQL scope matches canonical policy, including Bingo-only and multi-series sources',()=>{
 const actors:AuthorizationActor[]=[{userId:1,assignments:[{role:'ADMIN',scopeType:'GLOBAL',eventSeriesId:null}]},{userId:2,assignments:[{role:'EDITOR',scopeType:'GLOBAL',eventSeriesId:null}]},{userId:3,assignments:[{role:'EVENT_MANAGER',scopeType:'EVENT_SERIES',eventSeriesId:10}]},{userId:4,assignments:[],eventTypeAssignments:[{eventSeriesId:10,eventType:'BINGO',role:'EVENT_MANAGER',enabled:true}]},{userId:5,assignments:[],managedEventSeriesIds:[10]}];
 for(const actor of actors){const where=matchingReadableWhere(actor) as {OR?:({geltungsbereich:string;eventreihen?:{some:{eventreihe_id:{in:number[]}}}})[]};
  for(const scope of ['GLOBAL','EVENT_SERIES'] as const)for(const ids of [[],[10],[20],[10,20]]){
   const projected=!where.OR||where.OR.some(part=>part.geltungsbereich===scope&&(!part.eventreihen||ids.some(id=>part.eventreihen!.some.eventreihe_id.in.includes(id))));
   assert.equal(projected,canViewScopedQuestion(actor,{scope,eventSeriesIds:ids,createdByUserId:1,reviewStatus:'APPROVED',isArchived:false,isApproved:true}));
  }
 }
});
test('media search respects existing slot scopes, correct-answer images and name classification priority',()=>{
 const audio=JSON.stringify(matchingMediaWhere('AUDIO')),image=JSON.stringify(matchingMediaWhere('IMAGE')),video=JSON.stringify(matchingMediaWhere('VIDEO'));
 assert.match(audio,/music_original_audio/);assert.match(audio,/music_reverse_audio/);assert.match(audio,/lyrics_tts_audio/);assert.doesNotMatch(audio,/answer_image/);
 assert.match(image,/answer_image/);assert.match(image,/ist_richtig":true/);assert.match(image,/pixel_original_image/);assert.match(image,/"slot_key":null/);assert.match(image,/"datei":\{"not":""\}/);
 assert.match(audio,/NOT.*bild.*image/);assert.match(video,/NOT.*audio/);assert.match(video,/question_video/);
 assert.deepEqual(matchingTemplateWhere('__general__'),{source_vorlage_id:null,vorlage_id:null});
 assert.deepEqual(matchingTemplateWhere('original'),{OR:[{source_vorlage:{code:'original'}},{source_vorlage_id:null,vorlage:{code:'original'}}]});
});
