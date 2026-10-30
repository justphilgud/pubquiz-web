import assert from "node:assert/strict";
import test from "node:test";
import {eventSeriesSettingsRevision as revision} from "./settingsRevision";
test("CAS includes legacy product-only updates and logo changes without hiding uneditable values",()=>{
 const at="2026-10-30T00:00:00.000Z",a={eventart:"BINGO",ist_freigeschaltet:true},b={eventart:"QUIZ",ist_freigeschaltet:true};
 assert.equal(revision(at,[a,b],null),revision(at,[b,a],null));
 assert.notEqual(revision(at,[a,b],null),revision(at,[{...a,ist_freigeschaltet:false},b],null));
 assert.notEqual(revision(at,[a,b],null),revision(at,[a,b],"https://example.invalid/logo"));
 assert.notEqual(revision(at,[a,b],null),revision("2026-10-30T00:00:00.001Z",[a,b],null));
});
