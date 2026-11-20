import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { loadLetteringFont } from '../src/game/world/village/lettering.js';

const html=readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script=html.match(/<script id="startup-guard">([\s\S]*?)<\/script>/)?.[1];

function boot(protocol='https:') {
  const timers=new Map(), errors=new Map(), docEvents=new Map(), nodes=new Map();
  let next=0, stage='pending';
  const document={
    documentElement:{setAttribute(attr,state){assert.equal(attr,'data-boot-state');stage=state;}},
    getElementById:id=>nodes.get(id)??null,
    addEventListener:(name,fn)=>docEvents.set(name,fn), removeEventListener:name=>docEvents.delete(name),
  };
  const window={addEventListener:(name,fn)=>errors.set(name,fn),removeEventListener:name=>errors.delete(name)};
  runInNewContext(script,{
    document,window,location:{protocol},
    setTimeout(fn,ms){timers.set(++next,{fn,ms});return next;},
    clearTimeout:id=>timers.delete(id),
  });
  for(const id of ['startup-screen','loading-note','startup-progress','startup-track','startup-percent','startup-actions','game-shell']){
    nodes.set(id,{hidden:false,inert:id==='game-shell',removeAttribute(key){delete this[key];}});
  }
  docEvents.get('readystatechange')?.();
  return {
    get stage(){return stage;},window,startup:window.villageStartup,node:id=>nodes.get(id),timers,
    error:target=>errors.get('error')?.({target}),
    fire(ms){for(const [id,timer] of timers)if(timer.ms===ms){timers.delete(id);timer.fn();return;}}
  };
}

test('startup exposes real texture progress, then reveals the game only when the menu is ready',()=>{
  const entry=boot(),{startup,node,timers}=entry;
  assert.equal(entry.stage,'loading');assert.equal(node('game-shell').inert,true);
  assert.equal(node('startup-screen').hidden,false);
  assert.equal(node('startup-actions').hidden,true);
  assert.equal(node('startup-track').hidden,false);
  assert.equal(node('startup-percent').hidden,true,'unknown duration is indeterminate');
  startup.progress(0,40);
  assert.equal(node('startup-percent').textContent,'0%');
  startup.progress(17,40);
  assert.equal(node('startup-progress').value,17);
  assert.equal(node('startup-progress').max,40);
  assert.equal(node('startup-percent').hidden,false);
  assert.equal(node('startup-percent').textContent,'42%');
  startup.progress(40,40);
  assert.equal(node('startup-percent').textContent,'100%');
  assert.equal(entry.stage,'loading','loaded textures are not yet a playable scene');
  startup.stage('गाँव तैयार हो रहा है…');
  assert.equal(node('startup-progress').value,undefined);
  assert.equal(node('startup-percent').hidden,true);
  assert.equal(startup.ready(),true);
  assert.equal(entry.stage,'ready');assert.equal(node('startup-screen').hidden,true);
  assert.equal(node('game-shell').inert,undefined);
  assert.equal(timers.size,0);
});

test('a directly opened source file gets launch instructions before any game module runs',()=>{
  const {stage,startup,node,timers}=boot('file:');
  assert.equal(stage,'error');assert.equal(startup.blocked,true);
  assert.match(node('loading-note').textContent,/सीधे HTML फ़ाइल/);
  assert.equal(node('startup-actions').hidden,false);
  assert.equal(node('game-shell').inert,true);
  assert.equal(timers.size,0);
  assert.ok(html.includes('<code>npm run dev</code>'));
});

test('missing module bundles or styles cannot leave a useless loading screen',()=>{
  for(const target of [{tagName:'SCRIPT',type:'module',src:'https://example.test/branch/assets/app.js'},{tagName:'LINK',rel:'stylesheet'}]){
    const entry=boot(),{startup,node,timers}=entry;
    entry.error({tagName:'IMG'});
    entry.error({tagName:'SCRIPT',type:'module',src:'https://example.test/@vite/client'});
    assert.equal(entry.stage,'loading');
    entry.error(target);
    assert.equal(entry.stage,'error');assert.equal(timers.size,0);
    assert.equal(node('startup-actions').hidden,false);
    assert.match(node('loading-note').textContent,/फ़ाइलें लोड नहीं हुईं/);
    assert.equal(startup.ready(),false);
    assert.equal(node('game-shell').inert,true);
  }
  const raw=boot();raw.error(raw.window);
  assert.equal(raw.stage,'error','unbundled imports can fail before the entry module executes');
});

test('a stalled download offers retry, but a late response can still start the game',()=>{
  const entry=boot(),{startup,node}=entry;
  startup.progress(2,10);entry.fire(12000);
  assert.equal(entry.stage,'slow');assert.equal(node('startup-actions').hidden,false);
  assert.equal(node('startup-percent').textContent,'20%');
  assert.equal(node('startup-track').hidden,false);
  entry.fire(45000);
  assert.equal(entry.stage,'stalled');assert.equal(startup.blocked,false);
  assert.equal(node('startup-progress').hidden,true);
  assert.equal(node('startup-track').hidden,true);
  assert.equal(node('startup-percent').hidden,true);
  startup.progress(3,10);
  assert.equal(entry.stage,'loading');assert.equal(node('startup-progress').value,3);
  assert.equal(node('startup-track').hidden,false);
  assert.equal(node('startup-percent').hidden,false);
  assert.equal(node('startup-percent').textContent,'30%');
  assert.equal(startup.ready(),true);
});

test('a missing optional font does not prevent world creation', async t=>{
  const saved=globalThis.document;
  t.after(()=>{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;});
  globalThis.document={fonts:{load:()=>Promise.reject(new Error('Font unavailable'))}};
  await assert.doesNotReject(loadLetteringFont());
});
