import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

test('hosted Bingo browser expressions are valid JavaScript before remote execution',()=>{
 const source=ts.createSourceFile('browser.mjs',readFileSync('scripts/testing/bingo-colors.http.browser.mjs','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 let checked=0;
 function visit(node:ts.Node){
  if(ts.isCallExpression(node)&&node.expression.getText(source)==='evaluate'){
   const value=node.arguments[1];
   if(value&&(ts.isStringLiteral(value)||ts.isNoSubstitutionTemplateLiteral(value))){
    assert.doesNotThrow(()=>new Function('return ('+value.text+')'),value.text);checked++;
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(source);assert.ok(checked>=15);
});
