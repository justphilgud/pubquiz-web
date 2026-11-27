import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromeEndpoint,waitForChromeEndpoint} from './chrome-endpoint';

test('Chrome endpoint rejects incomplete or malformed startup evidence',()=>{
 for(const text of ['', '1234', '1234\n', '0\n/devtools/browser/id','65536\n/devtools/browser/id','abc\n/devtools/browser/id','1234\n/foreign','1234\n/devtools/browser/id\nextra'])assert.equal(chromeEndpoint(text),null);
 assert.equal(chromeEndpoint('1234\r\n/devtools/browser/test-id\r\n'),'ws://127.0.0.1:1234/devtools/browser/test-id');
});
test('Chrome startup waits through absent, empty and partial files; timeout and exit fail closed',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pubquiz-chrome-endpoint-')),file=join(directory,'DevToolsActivePort');
 try{
  const waiting=waitForChromeEndpoint(file,{timeoutMs:2000,pollMs:5});
  for(const text of ['', '1234\n']){await writeFile(file,text);await new Promise(resolve=>setTimeout(resolve,30));}
  await writeFile(file,'1234\n/devtools/browser/test-id\n');
  assert.equal(await waiting,'ws://127.0.0.1:1234/devtools/browser/test-id');
  await writeFile(file,'1234\n');
  await assert.rejects(waitForChromeEndpoint(file,{timeoutMs:30,pollMs:5}),/timeout/);
  await assert.rejects(waitForChromeEndpoint(file,{exited:()=>true}),/exited/);
  await assert.rejects(waitForChromeEndpoint(directory),error=>(error as NodeJS.ErrnoException).code==='EISDIR');
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('Chrome readiness tolerates delayed process startup within its explicit budget',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pubquiz-chrome-delayed-')),file=join(directory,'DevToolsActivePort');
 try{
  const ready=waitForChromeEndpoint(file,{timeoutMs:2000,pollMs:5});
  await new Promise(resolve=>setTimeout(resolve,120));
  await writeFile(file,'4321\n/devtools/browser/delayed-start\n');
  assert.equal(await ready,'ws://127.0.0.1:4321/devtools/browser/delayed-start');
 }finally{await rm(directory,{recursive:true,force:true});}
});
