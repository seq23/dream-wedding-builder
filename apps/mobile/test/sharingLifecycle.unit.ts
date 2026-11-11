import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sharingLifecycle } from '../src/sharing/lifecycle';
import { sharingRoute } from '../src/sharing/link';
import { sharingDetails } from '../src/sharing/details';
import { SHARED_PAYMENTS_KEY } from '../src/sharing/active';

test('foreground and reconnect retries run within a minute, never overlap, and stop on unmount', async()=>{
  let calls=0, release=()=>{}, timer=()=>{}, cancelled=false;
  const lifecycle=sharingLifecycle(async()=>{calls++;await new Promise<void>(r=>{release=r;});},(run,ms)=>{assert.ok(ms<=20000);timer=run;return()=>{cancelled=true;};});
  assert.equal(calls,1);
  timer(); await lifecycle.foreground(); assert.equal(calls,1);
  release(); await Promise.resolve(); await Promise.resolve();
  timer(); assert.equal(calls,2); release(); await Promise.resolve(); await Promise.resolve();
  await Promise.resolve();
  lifecycle.stop(); timer(); await lifecycle.foreground();
  assert.equal(calls,2); assert.equal(cancelled,true);
});

test('fragment keys are routed locally for native and HTTPS links; unrelated routes stay untouched',()=>{
  const id='a'.repeat(64),key='b'.repeat(64);
  for (const url of [`https://weddingchecklistpdf.com/two-phones?id=${id}#${key}`,`dreamwedding://two-phones?id=${id}#${key}`]) {
    const route=new URL(sharingRoute(url),'https://local.test');
    assert.equal(route.pathname,'/more/sharing');
    assert.equal(new URL(route.searchParams.get('invite')!).hash,`#${key}`);
  }
  assert.equal(sharingRoute('/payments'),'/payments');
  assert.equal(sharingRoute(`dreamwedding://two-phones?id=${id}#wrong`),'/more/sharing?invite=invalid');
});

test('shared payment details are isolated by event and never overwrite personal amounts',async()=>{
  const data=new Map([['dw.payments.v1','personal']]);
  const storage={async getItem(k:string){return data.get(k)??null;},async setItem(k:string,v:string){data.set(k,v);}};
  const a=sharingDetails(storage,SHARED_PAYMENTS_KEY,'one',()=>({amount:0}));
  const b=sharingDetails(storage,SHARED_PAYMENTS_KEY,'two',()=>({amount:0}));
  await a.save({amount:123});
  assert.equal((await a.read()).amount,123);assert.equal((await b.read()).amount,0);
  assert.equal(data.get('dw.payments.v1'),'personal');
});
