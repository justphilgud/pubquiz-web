import ts from "typescript";
import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
test("actual browser acceptance expressions remain valid JavaScript after selector escaping",()=>{
 let count=0;
 function visit(node:ts.Node){
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='evaluate'){
   const expression=node.arguments[1];let text:string|undefined;
   if(expression&&(ts.isStringLiteral(expression)||ts.isNoSubstitutionTemplateLiteral(expression)))text=expression.text;
   else if(expression&&ts.isTemplateExpression(expression))text=expression.head.text+expression.templateSpans.map(span=>'0'+span.literal.text).join('');
   if(text!==undefined){assert.doesNotThrow(()=>new Function(text),text);count++;}
  }
  ts.forEachChild(node,visit);
 }
 for(const path of ['scripts/testing/bingo-event.browser.mjs','scripts/testing/event-settings.browser.mjs'])visit(ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS));assert.ok(count>=50,'browser expression coverage unexpectedly missing');
});
