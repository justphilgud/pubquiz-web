import test from "node:test";
import assert from "node:assert/strict";
import { questionDurationPreview } from "./questionDuration";
import { estimateReadingDuration } from "@/app/fragen/editor/readingDuration";

test("search uses the editor reading estimate without inventing duration for other questions", () => {
  const text = "Ein Text mit genau sechs Wörtern";
  assert.equal(questionDurationPreview("standard", text, null, []), null);
  const result = questionDurationPreview("uebersetzt_vorgelesen", text, null, []);
  assert.equal(result?.questionSeconds, estimateReadingDuration(text).seconds);
  assert.equal(result?.translationSeconds, null);
  assert.deepEqual(result?.audioUrls, []);
  for (const id of ["musik", "musik_rueckwaerts", "eight_bit"]) {
    const audio = questionDurationPreview(id, text, null, [{datei:"song.mp3",slot_key:null},{datei:"cover.png",slot_key:null}]);
    assert.equal(audio?.questionSeconds, null);
    assert.deepEqual(audio?.audioUrls, [{url:"/medien/song.mp3",label:"Audiodatei"}]);
  }
  assert.equal(questionDurationPreview("uebersetzt_vorgelesen", "", null, [])?.questionSeconds, null);
  const translated=questionDurationPreview("uebersetzt_vorgelesen",text,{templateData:{kind:"TRANSLATION_READ_ALOUD",originalText:"Original",sourceLanguage:"en",targetLanguage:"de",translation:text,speed:0.5}},[]);
  assert.equal(translated?.translationSeconds,estimateReadingDuration(text,0.5).seconds);
});
