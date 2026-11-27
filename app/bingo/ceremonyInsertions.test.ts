import test from 'node:test';
import assert from 'node:assert/strict';
import {ceremonyAt,defaultCeremony,parseCeremony,parseCeremonyConfig} from '../rendering/ceremony/ceremony';
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
test('intro and round insertions retain independent configuration through JSON persistence',()=>{
 const state=defaultCeremony();state.config.insertions={[a]:{...defaultCeremony().config,welcome:'Nach A'},[b]:{...defaultCeremony().config,welcome:'Nach B'}};
 const saved=parseCeremony(JSON.parse(JSON.stringify(state)));
 const selected=ceremonyAt({...saved,placement:a});assert.equal(selected.config.welcome,'Nach A');
 selected.config.welcome='Nur A';assert.equal(saved.config.welcome,'Willkommen zum Bingoabend');assert.equal(saved.config.insertions![b].welcome,'Nach B');
 assert.equal(ceremonyAt({...saved,placement:b}).config.welcome,'Nach B');
 assert.throws(()=>parseCeremony({...saved,placement:'missing'}));
 assert.throws(()=>parseCeremonyConfig({...saved.config,insertions:{[a]:saved.config}}));
 assert.deepEqual(parseCeremony(defaultCeremony()),defaultCeremony());
});
