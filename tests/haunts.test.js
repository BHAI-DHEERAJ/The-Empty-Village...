import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, PerspectiveCamera, Scene, Texture, Vector3 } from 'three';
import { Haunts } from '../src/game/watcher/Haunts.js';
import { createRoadCrossings } from '../src/game/watcher/WatcherRoad.js';
import { CollisionWorld } from '../src/game/world/physics/CollisionWorld.js';
import { Storm } from '../src/game/world/Storm.js';
import { createIllusionModels } from '../src/game/watcher/IllusionModels.js';
import { SURFACES } from '../src/game/world/surfaceCatalog.js';
import { createVillageSounds } from '../src/game/audio/VillageSounds.js';

const DT=1/60;
function setup({enabled=true,reducedMotion=false,roads,random=()=>.38}={}){
  const collision=new CollisionWorld(),view=new PerspectiveCamera(64,1.5,.065,330);
  const actors=Object.fromEntries(['jump','wraith','crawler','twins','sentinel'].map(key=>{
    const group=new Group();group.visible=false;
    return [key,{group,poses:0,pose(){this.poses++;},veil(alpha){this.alpha=alpha;}}];
  }));
  const shadow={visible:false,show(feet,forward){this.visible=true;this.origin=feet.clone();this.forward=forward.clone();},
    alpha(amount){this.opacity=amount;},hide(){this.visible=false;}};
  const sounds=[],feet=new Vector3(),speed=new Vector3();
  const haunts=new Haunts({collision,actors,shadow,roads,onCue:(cue,at)=>sounds.push({cue,at:at.clone(),time:haunts.time,shown:actors.jump.group.visible}),enabled,reducedMotion,random});
  function orient(at){view.position.copy(feet).y+=1.61;view.lookAt(at);}
  const ahead=()=>orient(feet.clone().add(new Vector3(0,1.61,-20)));
  ahead();
  const tick=(n=1)=>{for(let i=0;i<n;i++)haunts.update(DT,{view,feet,velocity:speed});};
  const until=(accept,n=4000)=>{for(let i=0;i<n;i++){tick();if(accept())return true;}return false;};
  return {collision,view,actors,shadow,feet,speed,haunts,sounds,orient,ahead,tick,until};
}

test('a heavy shadow and directional sound precede the mask; ignoring it leaves another chance',()=>{
  const {collision,feet,actors,shadow,haunts,sounds,orient,ahead,tick,until}=setup();
  const before=feet.clone(),bodies=collision.solids.length;
  assert.ok(until(()=>haunts.encounter?.type==='jump',520));
  assert.equal(haunts.phase,'warning');assert.equal(sounds[0].cue,'omen-shadow');
  assert.ok(sounds[0].at.z>feet.z+4);
  assert.equal(shadow.visible,true);assert.ok(shadow.forward.z<-.99);
  tick(80);assert.ok(shadow.opacity>.9);assert.equal(actors.jump.group.visible,false);
  assert.ok(until(()=>haunts.phase==='idle',300));
  assert.equal(shadow.visible,false);assert.equal(actors.jump.group.visible,false);
  assert.equal(sounds.some(s=>s.cue==='haunt-impact'),false);
  assert.ok(haunts.nextAt-haunts.time>=18);
  assert.ok(until(()=>haunts.encounter?.type==='jump',4500));
  const pos=haunts.encounter.mark.pos.clone(),back=pos.clone().add(new Vector3(0,1.6,0));
  orient(back);tick(20);
  assert.equal(actors.jump.group.visible,false,'a fast turn cannot beat the warning sound');
  assert.ok(until(()=>haunts.phase==='showing',60));
  assert.equal(sounds.at(-1).cue,'haunt-impact');
  assert.ok(sounds.at(-1).time-sounds.findLast(s=>s.cue==='omen-shadow').time>=.95);
  assert.equal(shadow.visible,false);assert.equal(actors.jump.group.visible,true);
  assert.ok(actors.jump.group.position.distanceTo(feet)>4.5);
  for(let i=0;i<24;i++){tick();assert.deepEqual(actors.jump.group.position.toArray(),pos.toArray());}
  ahead();tick(60);
  assert.equal(actors.jump.group.visible,false);assert.equal(haunts.phase,'idle');
  assert.deepEqual(feet.toArray(),before.toArray());assert.equal(collision.solids.length,bodies);
});

test('the shadow needs a clear view, and disabling jumpscares leaves the distant illusions',()=>{
  const {collision,actors,haunts,sounds,shadow,feet,orient,ahead,tick,until}=setup();
  assert.ok(until(()=>haunts.encounter?.type==='jump',520));
  const pos=haunts.encounter.mark.pos;
  collision.addBox(pos.x*.54,pos.z*.54,4,.25,0,0,3,'opaque door');
  orient(pos.clone().add(new Vector3(0,1.6,0)));
  tick(85);assert.equal(actors.jump.group.visible,false);assert.equal(haunts.phase,'warning');
  haunts.setEnabled(false);assert.equal(shadow.visible,false);assert.equal(haunts.level,0);
  ahead();const found=new Set();
  for(let n=0;n<9600&&found.size<4;n++){
    tick();
    if(haunts.phase==='showing'){
      const {type,mark,shownAt,profile}=haunts.encounter;
      assert.notEqual(type,'jump');
      assert.ok(actors[type].group.position.distanceTo(feet)>=3.12);
      assert.ok(shownAt-sounds.findLast(s=>s.cue===profile.cue).time>=profile.lead);
      assert.ok(mark.pos.distanceTo(feet)>4.8);
      found.add(type);
    }
  }
  assert.deepEqual([...found].sort(),['crawler','sentinel','twins','wraith']);
  assert.ok(!sounds.some(s=>s.cue==='haunt-impact'));
});

test('with reduced motion the drop-in has no camera effect and still cannot chase or touch',()=>{
  const {feet,actors,haunts,orient,tick,until}=setup({reducedMotion:true});
  assert.ok(until(()=>haunts.phase==='warning',520));
  const pos=haunts.encounter.mark.pos;
  orient(pos.clone().add(new Vector3(0,1.65,0)));
  assert.ok(until(()=>haunts.phase==='showing',90));
  tick(15);assert.equal(haunts.level,0);assert.ok(actors.jump.alpha>0&&actors.jump.alpha<1);
  feet.copy(pos);tick();assert.equal(haunts.phase,'idle');assert.equal(actors.jump.group.visible,false);
});

test('walking along the forest road can trigger an audible, distant crossing independent of missions',()=>{
  const roads=createRoadCrossings(new CollisionWorld());
  assert.ok(roads.filter(x=>x.road==='arrival').length>=30);
  const {haunts,actors,feet,speed,sounds,orient,tick,until}=setup({roads});
  feet.set(-130,0,9.4);speed.set(3.18,0,.57);orient(new Vector3(-109,1.61,19));
  assert.ok(until(()=>haunts.phase==='warning',520));
  assert.equal(haunts.encounter.type,'road');assert.match(haunts.lastRoad,/^arrival\//);
  assert.equal(sounds.at(-1).cue,'omen-road');assert.equal(actors.sentinel.group.visible,false);
  tick(42);assert.equal(actors.sentinel.group.visible,false);
  assert.ok(until(()=>haunts.phase==='showing',100));
  const start=actors.sentinel.group.position.clone();tick(87);
  assert.ok(actors.sentinel.group.position.distanceTo(start)>2.5);assert.ok(actors.sentinel.group.position.distanceTo(feet)>8.2);
  tick(180);assert.equal(actors.sentinel.group.visible,false);assert.equal(haunts.phase,'idle');
});

test('storms are intermittent, flashes lead thunder, and motion reduction keeps the sound',()=>{
  function run(reducedMotion){
    const thunders=[],flash=[],wet=[];
    const storm=new Storm({random:()=>.5,reducedMotion,onThunder:(point,strength)=>thunders.push({at:storm.time,point:point.clone(),strength})});
    const eye=new Vector3(28,1.61,-32);
    assert.deepEqual(storm.update(0,eye),{rain:0,flash:0});
    for(let i=0;i<1200;i++){
      const s=storm.update(.1,eye,true);
      if(s.flash>.05)flash.push(storm.time);
      if(s.rain>.07)wet.push(storm.time);
      assert.ok(s.rain<=.84&&s.flash<=.66);
    }
    assert.ok(wet[0]>14&&wet[0]<17);assert.ok(wet.some((t,i)=>i&&t-wet[i-1]>32));
    assert.ok(thunders.length>=3);
    assert.equal(thunders[0].strength,.51);
    assert.ok(thunders[0].point.distanceTo(new Vector3(18,5.81,-39))<1e-8);
    return {thunders,flash};
  }
  const full=run(false),reduced=run(true);
  assert.ok(full.thunders[0].at-full.flash[0]>=1.2);
  assert.equal(reduced.flash.length,0);
  assert.deepEqual(full.thunders,reduced.thunders);
});

test('warnings, repair and thunder use distinct finite local sound samples',()=>{
  const typeList=['omen-shadow','omen-whisper','omen-skitter','omen-double','omen-watcher','omen-road','haunt-impact','thunder-roll','repair-hood','repair-ratchet','repair-crank','repair-catch','repair-stall'];
  const peaks=[],kinds=new Set();
  const node=(props={})=>({connect(next){return next;},disconnect(){},...props});
  const context={state:'running',sampleRate:12000,
    createBuffer(_,samples){const data=new Float32Array(samples);return {getChannelData:()=>data};},
    createBufferSource:()=>node({start(){
      const samples=this.buffer.getChannelData(0);let peak=0,energy=0;
      for(const n of samples){assert.ok(Number.isFinite(n));peak=Math.max(peak,Math.abs(n));energy+=n*n;}
      peaks.push(peak);kinds.add(`${samples.length}/${energy.toFixed(2)}`);
    }}),
    createGain:()=>node({gain:{set value(s){assert.ok(s>0&&s<1);}}}),
    createPanner:()=>node({setPosition(x,y,z){assert.deepEqual([x,y,z],[2,4,6]);}}),
  };
  const sound=createVillageSounds(context,node());
  for(const type of typeList)sound.cue(type,new Vector3(2,4,6),1);
  assert.equal(kinds.size,typeList.length);
  assert.ok(peaks.every(p=>p>.06&&p<1));
});


test('all apparition bodies are UV-mapped PBR meshes; the scare reuses a real skeletal sculpt',()=>{
  const textures=Object.fromEntries(Object.entries(SURFACES).map(([id,surface])=>[id,{
    ...surface,albedo:new Texture(),normal:new Texture(),orm:new Texture(),
  }]));
  const actors=createIllusionModels(new Scene(),textures,{compact:true});
  for(const {group} of Object.values(actors)){
    let count=0;
    group.traverse(node=>{
      if(!node.isMesh)return;
      count++;
      assert.ok(node.geometry.getAttribute('uv')?.count>0,node.name);
      for(const m of [].concat(node.material))assert.ok(m.map&&m.normalMap&&m.roughnessMap,node.name);
    });
    assert.ok(count>0);
  }
  const mask=actors.jump.group.getObjectByName('Cracked ceramic face · relief and UVs');
  assert.equal(mask.parent.isBone,true);assert.equal(mask.material.map,textures.hauntMask.albedo);
  const shroud=actors.wraith.group.getObjectByName('Weathered woven shroud');
  assert.equal(shroud.material.map,textures.hauntCloth.albedo);
});
