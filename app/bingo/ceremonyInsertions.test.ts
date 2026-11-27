import test from 'node:test';
import assert from 'node:assert/strict';
import {ceremonyAt,defaultCeremony,outroConfig,parseCeremony,parseCeremonyConfig} from '../rendering/ceremony/ceremony';
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
test('outro persists independently and legacy root outro remains available without rewriting data',()=>{
 const state=defaultCeremony(),original=JSON.stringify(state);
 const outro=outroConfig(state.config);outro.announcements='Nur im Outro';
 assert.equal(JSON.stringify(state),original);
 assert.ok(!outro.enabled.includes('welcome'));
 state.config.outro=outro;
 const saved=parseCeremony(JSON.parse(JSON.stringify(state)));
 assert.equal(ceremonyAt({...saved,placement:'outro',slide:'announcements'}).config.announcements,'Nur im Outro');
 assert.equal(ceremonyAt({...saved,slide:'announcements'}).config.announcements,'Nur im Outro');
 assert.equal(saved.config.announcements,defaultCeremony().config.announcements);
 assert.throws(()=>parseCeremonyConfig({...saved.config,outro:{...outro,outro}}));
 assert.throws(()=>parseCeremonyConfig({...saved.config,outro:{...outro,insertions:{[a]:outro}}}));
});
