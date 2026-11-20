import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Group, PerspectiveCamera, Scene, Texture, Vector3 } from 'three';
import { test } from 'node:test';
import { VOICE_LINES } from '../src/game/audio/VoiceLines.js';
import { CollisionWorld } from '../src/game/world/physics/CollisionWorld.js';
import { SURFACES } from '../src/game/world/surfaceCatalog.js';
import { createStalkerModel, StalkerDirector } from '../src/game/watcher/Stalker.js';
import { ChapterLog } from '../src/game/story/VillageChapter.js';

const assets=()=>Object.fromEntries(Object.entries(SURFACES).map(([id,s])=>[id,{...s,albedo:new Texture(),normal:new Texture(),orm:new Texture()}]));
const logAfter=id=>{
  const log=new ChapterLog(null,{seed:()=>1});
  log.beginRepair();log.finishOpening();
  for(const step of log.steps){assert.ok(log.complete(step.id));if(step.id===id)break;}
  return log;
};
function encounter(enabled,reducedMotion,obstacle=false){
  const collision=new CollisionWorld(),actor={group:new Group(),hide(){this.group.visible=false;},
    hold(){},eyes(){},veil(){},tilt(){},run(){},contort(){}};
  actor.group.visible=false;
  const cues=[],lines=[],stalker=new StalkerDirector({collision,actor,log:logAfter('clue/centre-01'),cue:id=>cues.push(id),
    voice:id=>lines.push(id),enabled,reducedMotion});
  const view=new PerspectiveCamera(64,1,.065,330),feet=new Vector3(.4,0,11.2);
  view.position.set(feet.x,1.61,feet.z);view.lookAt(.4,1.61,-40);
  const advance=(seconds,room=null)=>{for(let i=0;i<Math.ceil(seconds*60);i++)stalker.update(1/60,{view,feet,grounded:true,room});};
  advance(5.9);assert.equal(stalker.phase,'warning');assert.deepEqual(lines,['stalker-first']);assert.deepEqual(cues,['stalker-footfall']);
  const start=actor.group.position.distanceTo(feet);
  assert.ok(start>=10);assert.equal(actor.group.visible,false);
  if(obstacle)collision.addBox(.4,18.68,5,.18,0,0,1.13,'low masonry');
  view.lookAt(actor.group.position.clone().add(new Vector3(0,4.75,0)));
  advance(1.35);assert.equal(stalker.phase,'seen');assert.equal(actor.group.visible,true);
  advance(1.31);
  return {stalker,actor,feet,start,advance};
}

test('the tall Stalker warns then approaches, but respects walls, the safety radius and scare settings',()=>{
  const full=encounter(true,false);
  assert.ok(full.stalker.blackout>.8);assert.ok(full.actor.group.position.distanceTo(full.feet)<full.start-3);
  assert.ok(full.actor.group.position.distanceTo(full.feet)>4.9);
  full.advance(.1,{site:{id:'centre-01'}});assert.equal(full.stalker.active,false);assert.equal(full.actor.group.visible,false);
  const blocked=encounter(true,false,true);
  assert.ok(blocked.actor.group.position.z>19.69,'the boss cannot phase through a solid knee wall');
  for(const [enabled,reduced] of [[false,false],[true,true]]){
    const {actor,start,feet,stalker}=encounter(enabled,reduced);
    assert.equal(stalker.blackout,0);assert.equal(stalker.level,0);
    assert.equal(actor.group.position.distanceTo(feet),start);
  }
});

test('the 7.6-metre roaming Stalker retains its textured mesh and animated crown',()=>{
  const scene=new Scene(),textures=assets();
  const boss=createStalkerModel(scene,textures,{compact:true});
  assert.ok(boss.group.scale.y*3.05>7.5);
  assert.equal(boss.mesh.isSkinnedMesh,true);assert.equal(boss.mesh.material[0].map,textures.hauntCloth.albedo);
  assert.ok(boss.mesh.skeleton.bones.find(b=>b.name==='skull').children.length>0);

});

test('all Hindi tape messages and Stalker lines bundle local audio; the named lead is Krish',()=>{
  for(const [id,line] of Object.entries(VOICE_LINES)){
    const path=new URL(line.src),data=readFileSync(path);
    assert.match(path.pathname,new RegExp(`/voices/${id}\\.mp3$`));assert.ok(data.length>20_000);
    assert.ok(data.toString('ascii',0,3)==='ID3'||data[0]===0xff&&(data[1]&0xe0)===0xe0);
    assert.doesNotMatch(line.text,/आरव|Aarav/);
  }
  assert.ok(VOICE_LINES['tape-intro'].title);
  assert.match(VOICE_LINES['stalker-first'].text,/कृष/);
});
