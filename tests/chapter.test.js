import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PerspectiveCamera, Scene, Texture, Vector3 } from 'three';
import { CAMERA, PLAYER } from '../src/game/settings.js';
import { createWorld } from '../src/game/world/createWorld.js';
import { SURFACES } from '../src/game/world/surfaceCatalog.js';
import { CANAL, districtAt, entryPoint, HOUSES, localPoint, pathEdge, worldPoint } from '../src/game/world/sceneryLayout.js';
import { InteractionController } from '../src/game/interaction/InteractionController.js';
import { FirstPersonCamera } from '../src/game/camera/FirstPersonCamera.js';
import { PlayerController } from '../src/game/player/PlayerController.js';
import { MissionGuide } from '../src/game/interaction/MissionGuide.js';
import { ChapterDirector } from '../src/game/story/ChapterDirector.js';
import { ChapterLog, CRETA_RETURN, ESCAPE_CHEAT_NUMBER, LETTER, MISSIONS, SAVE_KEY } from '../src/game/story/VillageChapter.js';
import { CAR_BEATS, CAR_CAPTIONS, INTRO } from '../src/game/story/IntroSequence.js';
import { REPAIR, REPAIR_CUES } from '../src/game/story/RepairSequence.js';
import { HOUSE_CLUES } from '../src/game/story/HouseClues.js';
import { approachCurve, CAR_EXIT, PARKED, REPAIR_STANCE } from '../src/game/story/StoryCar.js';
import { ESCAPE, ESCAPE_CUES, ESCAPE_END, escapeCurve, escapeMotion, FIX, FIX_CUES, FOREST_ESCAPE_LENGTH, IMPACT_TREE, MERGE_DISTANCE } from '../src/game/story/CretaFinale.js';
import { EXIT_LANE, HIGHWAY, spurEdge } from '../src/game/world/HighwayLayout.js';
import { poseBox, touchesBox } from '../src/game/world/physics/CollisionWorld.js';
import { createWatcherPlaces } from '../src/game/watcher/WatcherPlaces.js';
import { rememberPhotos } from '../src/ui/Phone.js';

const DT=1/60,SPAWN=new Vector3(CAR_EXIT.x,CAR_EXIT.y,CAR_EXIT.z);
const textures=()=>Object.fromEntries(Object.entries(SURFACES).map(([key,s])=>[key,{
  ...s,albedo:new Texture(),normal:s.type?undefined:new Texture(),orm:s.type?undefined:new Texture(),
}]));
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
function setup(log){
  const scene=new Scene(),world=createWorld(scene,textures(),{compact:true,chapter:log});
  const {collision}=world,{occlusion}=createWatcherPlaces(world);
  const sounds=[],events=[],tapes=[],chapter=new ChapterDirector({log,world,
    openTape:(id,confirm)=>tapes.push({id,confirm}),
    emit:(step,details)=>events.push({id:step.id,...details}),sound:(type,at)=>sounds.push([type,at?.clone()])});
  const player=new PlayerController({spawn:CAR_EXIT,collision}),view=new PerspectiveCamera(CAMERA.fov,1.6,.065,330);
  const camera=new FirstPersonCamera(view);
  let yaw=0;
  const interact=new InteractionController({actions:world.actions,collision,windowOcclusion:occlusion,
    priority:a=>a.id===chapter.target?.id,
    onUse:action=>chapter.use(action,player,yaw,view.position)});
  function look(feet,at){
    view.position.copy(feet).y+=CAMERA.eye;view.lookAt(at);yaw=Math.atan2(feet.x-at.x,feet.z-at.z);
  }
  function use(id,feet){
    const action=interact.index.get(id),aim=action.focusAt??action.at;
    player.position.copy(feet);player.grounded=true;look(feet,aim);
    assert.equal(interact.find(view)?.id,id,`aiming at ${id}`);
    return interact.activate(view,player);
  }
  const phone=(type,contact='meera')=>chapter.phoneAction(type,contact);
  return {scene,log,world,collision,occlusion,sounds,events,tapes,chapter,player,view,camera,interact,look,use,phone};
}

// Find reachable, unoccluded interaction stances using the actual capsule,
// floor steps and hinges. Each vertical transition must be walkable.
function reachable(collision,start,goal,accept,range=3.1){
  const size=.34,epsilon=.008,probe=new Vector3(),velocity=new Vector3();
  const queue=[{i:0,j:0,p:start.clone()}],known=new Set(['0/0']);
  const x0=Math.min(start.x,goal.x)-7,x1=Math.max(start.x,goal.x)+7;
  const z0=Math.min(start.z,goal.z)-7,z1=Math.max(start.z,goal.z)+7;
  for(let k=0;k<queue.length;k++){
    const {i,j,p}=queue[k];
    if(Math.hypot(p.x-goal.x,p.z-goal.z)<range&&accept(p))return p;
    for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
      const ix=i+dx,iz=j+dz,key=`${ix}/${iz}`,x=start.x+ix*size,z=start.z+iz*size;
      if(known.has(key)||x<x0||x>x1||z<z0||z>z1)continue;
      let y=p.y,clear=true;
      for(let s=1;s<=3;s++){
        const u=p.x+(x-p.x)*s/3,v=p.z+(z-p.z)*s/3;
        probe.set(u,y,v);collision.resolve(probe,velocity.set(0,0,0));
        const floor=collision.supportAt(u,v,y+PLAYER.step);
        if(Math.hypot(probe.x-u,probe.z-v)>epsilon||Math.abs(floor-y)>PLAYER.step||!collision.headroomAt(u,v,floor+.003)){
          clear=false;break;
        }
        y=floor;
      }
      if(clear){known.add(key);queue.push({i:ix,j:iz,p:new Vector3(x,y,z)});}
    }
  }
  return null;
}

const opening=setup(new ChapterLog(null,{seed:()=>1}));

test('the one-minute forest drive ends in daylight and the automatic repair ends before night control',()=>{
  const {chapter,log,view,scene,player,camera,sounds,events,world}=opening;
  assert.equal(chapter.mode,'menu');assert.equal(chapter.start(),true);
  const cards=new Set([chapter.copy]);
  for(let i=0;i<INTRO.end/DT+2;i++){
    chapter.advance(DT);
    if(chapter.mode==='drive')cards.add(chapter.copy);
  }
  assert.equal(chapter.mode,'arrived');assert.equal(chapter.modeTime,60);assert.equal(chapter.daylight,1);
  assert.equal(chapter.clock,'16:40');assert.equal(log.hasSave,false);assert.equal(log.progress,0);
  assert.deepEqual([...cards],CAR_CAPTIONS);
  assert.ok(CAR_CAPTIONS.some(({text})=>text.includes(LETTER)));
  assert.deepEqual(sounds.map(([type])=>type),[...CAR_BEATS.map(([,type])=>type),'car-stop']);
  chapter.exit();assert.equal(chapter.mode,'repair');assert.equal(chapter.daylight,1);
  assert.equal(chapter.cinematic,true);assert.equal(log.opening,'repair');assert.equal(log.progress,0);
  const hood=scene.getObjectByName('खुलने वाला बोनट'),tool=scene.getObjectByName('मरम्मत करता हाथ और औज़ार');
  const repairCards=new Set([chapter.copy]);
  let day=1,dayFog;
  for(let i=1;i<REPAIR.end/DT+2;i++){
    chapter.advance(DT);
    if(!chapter.cinematic)break;
    repairCards.add(chapter.copy);
    assert.ok(chapter.daylight<=day);day=chapter.daylight;
    if(i===1||i===250||i===843){
      chapter.car.repair(view,chapter.modeTime,false);
      world.update(i*DT,view,player,false,true,{daylight:day,quiet:true,cinematic:true});
      if(i===1){dayFog=scene.fog.color.clone();assert.equal(hood.rotation.x,0);}
      if(i===250){assert.ok(hood.rotation.x>1);assert.equal(tool.visible,true);assert.equal(chapter.clock,'17:25');}
      if(i===843){assert.equal(day,0);assert.ok(scene.fog.color.r<dayFog.r*.1);}
    }
  }
  assert.equal(repairCards.size,4);assert.equal(chapter.mode,'play');assert.equal(chapter.daylight,0);
  assert.equal(chapter.clock,'19:10');assert.equal(log.current.id,MISSIONS[0].id);assert.equal(log.progress,0);
  assert.equal(hood.rotation.x,0);assert.equal(tool.visible,false);
  assert.deepEqual(sounds.slice(-1-REPAIR_CUES.length).map(([type])=>type),['car-door',...REPAIR_CUES.map(([,type])=>type)]);
  assert.deepEqual(events,[],'the prologue never counts as a mission');
  chapter.restorePlayer(player,camera);
  assert.ok(player.position.distanceTo(SPAWN)<.01);assert.ok(player.grounded);
});

test('the story car has UV-mapped painted sheet metal, including the movable bonnet',()=>{
  const {chapter,scene}=opening,paint=[];
  chapter.car.car.traverse(node=>{if(node.material?.name==='vehicle/oxidized-bodywork')paint.push(node);});
  assert.ok(paint.length>=4);
  const hood=scene.getObjectByName('खुलने वाला बोनट');
  assert.ok(paint.some(mesh=>mesh.parent===hood));
  for(const mesh of paint){
    assert.ok(mesh.geometry.getAttribute('uv').count>0);
    assert.ok(mesh.material.map&&mesh.material.normalMap&&mesh.material.roughnessMap&&mesh.material.metalnessMap);
  }
});

test('the car travels a curved, obstacle-free road from the forest to the village',()=>{
  const {chapter,view,collision}=opening;
  const {car}=chapter.car,parked=car.position.clone();
  const parkedBox=collision.solids.find(s=>s.tag==='story-car');
  assert.ok(approachCurve.getLength()>155);
  const headings=[];
  for(let i=0;i<=600;i++){
    const t=i/10;chapter.car.pose(view,t,'drive',false,1);
    const {x,y,z}=car.position,yaw=car.rotation.y;
    assert.ok(pathEdge(x,z)<-.85,`car is off the road at ${t}s`);
    assert.equal(collision.boxOccupied({x,z,w:.91,d:2.21,c:Math.cos(yaw),s:Math.sin(yaw),bottom:y+.06,top:y+1.80},parkedBox),false,`blocked at ${t}s`);
    if(i===0){
      assert.equal(districtAt(x,z),'जंगल');assert.ok(x<-120);
      assert.ok(collision.solids.filter(s=>s.tag==='trunk'&&Math.hypot(s.x-x,s.z-z)<17).length>=3);
    }
    if(i%40===0)headings.push(yaw);
  }
  assert.ok(Math.max(...headings)-Math.min(...headings)>1.5);
  assert.ok(car.position.distanceTo(parked)<.001);
  assert.ok(car.position.distanceTo(SPAWN)<2.5);
  chapter.car.park();
});

test('the CRETA hits the real forest trunk, stalls, reverses and follows connected roads to the highway',()=>{
  const {chapter,collision}=opening,{car,solid}=chapter.car;
  assert.ok(escapeCurve.getLength()>150);
  assert.equal(escapeMotion(0).position,0);
  assert.equal(escapeMotion(ESCAPE.end).position,1);
  assert.ok(escapeMotion(ESCAPE.impact-.01).velocity>2,'still moving into the tree');
  assert.equal(escapeMotion(ESCAPE.impact).velocity,0);
  assert.equal(escapeMotion(ESCAPE.catch).distance,IMPACT_TREE.distance);
  assert.ok(escapeMotion(ESCAPE.reverse+.4).velocity<-.5,'back up before taking the forest road');
  const tree=collision.solids.find(s=>s.tag==='trunk'&&Math.hypot(s.x-IMPACT_TREE.x,s.z-IMPACT_TREE.z)<.001);
  assert.ok(tree,'the tree must be an existing solid in the forest');
  const treeFeet=new Vector3(tree.x,tree.bottom,tree.z),target=new Vector3();
  for(const aspect of [1.72,320/568]){
    const view=new PerspectiveCamera(CAMERA.fov,aspect,.065,330),shots=new Set();
    let firstHit=null;
    for(let i=0;i<=ESCAPE.end*20;i++){
      const t=i/20,{shot,distance}=chapter.car.escape(view,t,false),{x,y,z}=car.position,yaw=car.rotation.y;
      shots.add(shot);
      const body={x,z,w:.91,d:2.222,c:Math.cos(yaw),s:Math.sin(yaw),bottom:y+.06,top:y+1.8};
      const hit=collision.boxOccupied(body,solid),treeHit=touchesBox(body,treeFeet,tree.radius,tree.top-tree.bottom);
      assert.equal(hit,treeHit,`unexpected obstruction at ${t}s`);
      if(hit)firstHit??=t;
      if(t<ESCAPE.skid||t>=ESCAPE.breakaway+.26){
        const edge=distance<FOREST_ESCAPE_LENGTH?pathEdge(x,z):distance<MERGE_DISTANCE?spurEdge(x,z):Math.abs(x-HIGHWAY.x)-HIGHWAY.halfWidth;
        assert.ok(edge<-.75,`off-road at ${t}s`);
      }
      assert.deepEqual([solid.x,solid.z,solid.c,solid.s],[x,z,body.c,body.s]);
      assert.ok(view.position.toArray().every(Number.isFinite));
      if(!['cockpit','restart','ranks','windshield'].includes(shot)){
        assert.equal(collision.blocksSight(view.position,target.set(x,y+1.1,z),[solid]),false,`occluded ${shot} at ${t}s`);
      }
    }
    assert.equal(firstHit,ESCAPE.impact);
    assert.deepEqual([...shots],['village','ranks','cockpit','headlamps','pursuit','skid','surround','restart','breakaway',
      'windshield','brush','last-shadows','dawn','junction','highway','tail']);
    assert.equal(car.position.x,EXIT_LANE.x);
    assert.ok(car.position.z>HIGHWAY.mergeZ+100);
    chapter.car.escape(view,ESCAPE.impact,false);
    const nose=car.localToWorld(target.set(0,.69,-2.2225));
    assert.ok(Math.abs(Math.hypot(tree.x-nose.x,tree.z-nose.z)-tree.radius)<.02,'visible bumper touches the trunk without crossing it');
    nose.project(view);assert.ok(Math.abs(nose.x)<.90&&Math.abs(nose.y)<.90,'the point of contact is visible');
  }
  chapter.car.park();
  assert.ok(car.position.equals(PARKED));
});

function entranceStance(site, collision){
  const [u,v]=entryPoint(site),[x,z]=worldPoint(site,u,v+(site.veranda?2.22:1.25));
  return new Vector3(x,collision.supportAt(x,z,.28),z);
}

test('five single-use missions cover the village, western forest, far bank, school and northern mansion',()=>{
  const disk=storage(),log=new ChapterLog(disk,{seed:()=>1});log.beginRepair();log.finishOpening();
  const {world,chapter,interact,look,use,view,tapes,events,collision,player,phone}=setup(log);
  const guide=new MissionGuide(world.buildings,collision);
  assert.ok(chapter.start());
  assert.equal(log.steps.length,5);
  assert.deepEqual(log.steps.map(m=>m.site),['centre-01','forest-04','farmland-04','school','mansion-01']);
  assert.equal(world.story.anchors.size,6,'five mission anchors and one unnumbered car goal');
  assert.equal(new Set(world.actions.map(a=>a.id)).size,world.actions.length);
  assert.equal(world.actions.filter(a=>a.kind==='chapter').length,5);
  assert.equal(world.actions.filter(a=>a.kind==='house-clue').length,37);
  assert.ok(world.actions.every(a=>!['start-creta','spare-fuse','band/102','relay/1'].includes(a.id)));
  assert.ok(world.buildings.find(b=>b.site.id==='farmland-04').site.x>CANAL.x);
  assert.ok(world.buildings.find(b=>b.site.id==='forest-04').site.x<-90);
  assert.match(phone('call').message,/सिग्नल नहीं/);
  const repair=interact.index.get(CRETA_RETURN.id),standing=world.story.anchors.get(CRETA_RETURN.id).stance;
  for(const mission of log.steps){
    player.position.copy(standing);look(standing,repair.at);
    assert.equal(log.hasWrench,false);
    assert.equal(repair.available(),false);
    assert.notEqual(interact.find(view)?.id,repair.id,'the bonnet is locked until all five missions are done');
    interact.activate(view,player);
    assert.equal(chapter.mode,'play');
    assert.equal(world.story.wrench.visible,true);
    const {id,site:siteId}=mission;
    const {site,actions,interior}=world.buildings.find(b=>b.site.id===siteId);
    const door=actions.find(action=>action.id===`${siteId}/entry`);
    assert.ok(door&&!door.locked?.());
    const action=interact.index.get(id),outside=entranceStance(site,collision);
    assert.equal(chapter.target.id,id);assert.ok(action.available());
    for(const future of log.steps.slice(log.progress+1))assert.equal(interact.index.get(future.id).available(),false);
    assert.ok(interior.getObjectById(chapter.target.model.id),'batching retains the real mission prop');
    assert.ok(chapter.target.model.children.every(mesh=>mesh.geometry.hasAttribute('uv')));
    const waypoint=guide.update(outside,chapter.target,null),[u,v]=localPoint(site,waypoint.x,waypoint.z);
    assert.ok(Math.abs(u-entryPoint(site)[0])<.07&&Math.abs(v-site.d*.5)<.82,'nearby guidance leads through the frontage');
    look(outside,action.at);assert.equal(action.eligible(view),false);
    door.setOpen(1);
    const stance=reachable(collision,outside,action.at,feet=>{
      look(feet,action.at);return world.roomAt(feet)?.site.id===siteId&&interact.find(view)?.id===id;
    });
    assert.ok(stance,`${id} reachable from the open entry`);
    const previous=log.progress;use(id,stance);
    if(mission.tape){
      assert.equal(tapes.at(-1).id,mission.tape);
      assert.equal(log.progress,previous,'opening the recorder alone does not count');
      tapes.at(-1).confirm();tapes.at(-1).confirm();
    }
    assert.equal(log.progress,previous+1,`${id} counts exactly once`);
    assert.equal(new ChapterLog(disk).progress,log.progress);
    assert.equal(chapter.mode,'play');
    const exit=reachable(collision,stance,outside,p=>p.distanceTo(outside)<.48&&!world.roomAt(p));
    assert.ok(exit,`${id} leaves a walkable exit`);
  }
  assert.equal(log.finished,true);assert.equal(chapter.target.id,CRETA_RETURN.id);assert.equal(chapter.cinematic,false);
  assert.equal(log.current,null);assert.equal(chapter.clock,'19:42');assert.ok(events.at(-1).finished);
  assert.equal(world.story.wrench.visible,false,'the offered wrench has been picked up');
  assert.ok(log.hasWrench&&new ChapterLog(disk).hasWrench);
  assert.equal(log.complete('mansion-signal'),null,'reading it again cannot award a second wrench');
  assert.match(phone('call').message,/रिंच से CRETA/);

  // The map aims at a playable stance, but Use still requires the real
  // world-space bonnet, facing, a clear ray and the player on the ground.
  look(standing,repair.at);assert.equal(interact.find(view)?.id,repair.id);
  look(standing.clone().setZ(1),repair.at);assert.notEqual(interact.find(view)?.id,repair.id);
  look(standing.clone().setZ(PARKED.z+2.5),repair.at);assert.notEqual(interact.find(view)?.id,repair.id);
  look(standing,standing.clone().setZ(2));assert.notEqual(interact.find(view)?.id,repair.id);
  const obstacle=collision.addMobileBox(standing.x,standing.z+.65,2,.13,0,0,2,'test-obstruction');
  look(standing,repair.at);assert.notEqual(interact.find(view)?.id,repair.id);
  poseBox(obstacle,150,150,0);
  player.position.copy(standing);player.grounded=false;look(standing,repair.at);
  assert.match(interact.activate(view,player),/ज़मीन/);
  assert.ok(log.hasWrench&&chapter.mode==='play');
  assert.equal(use(repair.id,standing),null);
  assert.equal(chapter.mode,'final-repair');assert.equal(chapter.target,null);
  assert.equal(new ChapterLog(disk).ending,'repairing');
  world.dispose();
});

test('a walker can follow the drawn route through all five missions and back to the CRETA',()=>{
  const log=new ChapterLog(null,{seed:()=>1});log.beginRepair();log.finishOpening();
  const {world,collision,chapter,player,interact,look,view,tapes}=setup(log);
  const guide=new MissionGuide(world.buildings,collision),dt=1/30;
  let bridgeCrossings=0;
  chapter.start();
  function walk(target,door,tape) {
    let distance=0,still=0;
    for(let i=0;i<5400;i++){
      const feet=player.position,room=world.roomAt(feet);
      look(feet,target.at);
      if(interact.find(view)?.id===target.id&&player.grounded){
        interact.activate(view,player);if(tape)tapes.at(-1).confirm();
        assert.ok(distance>12&&distance<280,`${distance.toFixed(1)} metres to ${target.id}`);
        return;
      }
      if(door?.target===0&&Math.hypot(door.at.x-feet.x,door.at.z-feet.z)<2.22)door.use({player,cue:()=>{}});
      interact.tick(dt,player);
      guide.update(feet,target,room?.site.id);
      const path=guide.remainingPath, [nextX,nextZ]=path[0];
      const x=feet.x,z=feet.z,range=Math.hypot(nextX-x,nextZ-z);
      // Follow the same path drawn on both maps, with normal steering drift.
      const yaw=Math.atan2(x-nextX,z-nextZ)+.07*Math.sin(i/8);
      player.step(dt,{forward:Math.min(1,range*2),sprint:range>4},yaw);
      const moved=Math.hypot(feet.x-x,feet.z-z);distance+=moved;
      still=moved<.005?still+1:0;
      assert.ok(still<120,`${target.id} stops near ${feet.toArray()} toward ${path[0]}`);
      if((x<CANAL.x)!==(feet.x<CANAL.x)){
        assert.ok(CANAL.bridgeZ.some(z=>Math.abs(z-feet.z)<1.9),'cross the canal using a bridge');bridgeCrossings++;
      }
    }
    assert.fail(`never reached ${target.id} from the map path; last position ${player.position.toArray()}`);
  }
  for(const mission of log.steps){
    walk(chapter.target,interact.index.get(`${mission.site}/entry`),mission.tape);
    assert.ok(log.has(mission.id),`${mission.id} is reached by walking`);
  }
  const room=world.roomAt(player.position),target=chapter.target;
  assert.equal(room.site.id,'mansion-01');assert.equal(target.model,chapter.car.hood);
  guide.update(player.position,target,room.site.id);
  assert.equal(guide.kind,'exit');assert.ok(guide.remainingPath.length>10);
  assert.deepEqual(guide.remainingPath.at(-1),[REPAIR_STANCE.x,REPAIR_STANCE.z]);
  walk(target,interact.index.get('mansion-01/entry'));
  assert.equal(chapter.mode,'final-repair');assert.equal(log.progress,5);
  assert.equal(bridgeCrossings,2);
  world.dispose();
});

test('all 40 house exhibits remain readable without adding missions or blocking their exits',()=>{
  const log=opening.log;
  for(const mission of log.steps) if(!log.has(mission.id))log.complete(mission.id);
  const {world,collision,interact,look,view,use,events}=opening;
  assert.deepEqual(HOUSE_CLUES.map(c=>c.site).sort(),HOUSES.map(s=>s.id).sort());
  for(const clue of HOUSE_CLUES){
    const {site,actions}=world.buildings.find(b=>b.site.id===clue.site);
    const door=actions.find(action=>action.id===`${site.id}/entry`),before=door.progress;
    try{
      assert.ok(!door.locked?.());door.setOpen(1);
      const action=interact.index.get(clue.id),outside=entranceStance(site,collision);
      const stance=reachable(collision,outside,action.at,p=>{
        look(p,action.at);return world.roomAt(p)?.site.id===site.id&&interact.find(view)?.id===clue.id;
      });
      assert.ok(stance,`optional exhibit reachable in ${site.id}`);
      use(clue.id,stance);
      assert.deepEqual(events.at(-1),{id:clue.id,readAgain:true});
      assert.equal(log.progress,5);
    }finally{door.setOpen(before);}
  }
});

test('Continue restores the opening state, mission index and position; starting a new game clears them',()=>{
  const disk=storage();let seed=93;const log=new ChapterLog(disk,{seed:()=>seed++});
  assert.equal(log.hasSave,false);assert.equal(log.complete(MISSIONS[0].id),null);
  log.beginRepair();assert.equal(new ChapterLog(disk).opening,'repair');
  log.finishOpening();assert.equal(new ChapterLog(disk).opening,'play');
  assert.equal(log.complete(MISSIONS[1].id),null,'cannot bypass the first mission');
  const checkpoint=[.4,0,-6.4,.49];assert.ok(log.complete(MISSIONS[0].id,checkpoint));
  const loaded=new ChapterLog(disk,{seed:()=>seed++});
  assert.equal(loaded.seed,93);assert.deepEqual(loaded.checkpoint,checkpoint);assert.equal(loaded.current.id,MISSIONS[1].id);
  const {chapter,player,camera,world}=setup(loaded);chapter.start();chapter.restorePlayer(player,camera);
  assert.deepEqual(player.position.toArray(),checkpoint.slice(0,3));assert.equal(camera.yaw,.49);
  loaded.restart();assert.equal(loaded.hasSave,false);assert.equal(loaded.seed,94);assert.equal(loaded.checkpoint,null);
  assert.equal(disk.getItem(SAVE_KEY),undefined);assert.equal(loaded.progress,0);
  world.dispose();
});

test('completed older saves get the wrench and Continue remembers every finale checkpoint',()=>{
  const disk=storage(),checkpoint=[-51.583,.065,-119.482,.145];
  disk.setItem(SAVE_KEY,JSON.stringify({version:2,seed:1,opening:'play',progress:5,checkpoint}));
  const migrated=new ChapterLog(disk),{world,chapter,player,camera,view,use,scene}=setup(migrated);
  assert.ok(migrated.finished&&migrated.hasWrench&&!migrated.escaped);
  assert.equal(migrated.beginEscape(),false);assert.equal(migrated.finishEscape(),false);
  chapter.start();chapter.restorePlayer(player,camera);
  assert.deepEqual(player.position.toArray(),checkpoint.slice(0,3));
  assert.equal(world.roomAt(player.position).site.id,'mansion-01');
  assert.equal(chapter.target.id,CRETA_RETURN.id);
  use(CRETA_RETURN.id,chapter.target.stance);

  const cues=[];
  const resume=()=>{
    const story=new ChapterDirector({log:new ChapterLog(disk),world,sound:(type,at)=>cues.push([type,at])});
    assert.ok(story.start());return story;
  };
  const advance=(story,seconds)=>{for(let i=0;i<Math.ceil(seconds/DT);i++)story.advance(DT);};
  const repairing=resume();assert.equal(repairing.mode,'final-repair');
  assert.equal(repairing.daylight,0);assert.equal(repairing.target,null);
  advance(repairing,2);
  repairing.car.finalRepair(view,repairing.modeTime,false,repairing.repairFrom);
  const hand=scene.getObjectByName('मरम्मत करता हाथ और औज़ार'),wrench=scene.getObjectByName('हवेली से मिला रिंच');
  assert.ok(hand.visible&&wrench.visible&&repairing.car.hood.rotation.x>1);
  advance(repairing,3.45);
  repairing.car.finalRepair(view,repairing.modeTime,false,repairing.repairFrom);
  assert.equal(hand.visible,false);assert.equal(repairing.car.hood.rotation.x,0);
  assert.ok(repairing.car.lamps.every(lamp=>lamp.intensity>150));
  assert.match(repairing.copy.title,/इंजन चल पड़ा/);
  advance(repairing,FIX.end-repairing.modeTime+.05);
  assert.equal(repairing.mode,'escape');
  assert.deepEqual(cues.map(([type])=>type),FIX_CUES.map(([,type])=>type));
  assert.ok(cues.every(([,at])=>at?.isVector3),'repair sounds come from the bonnet');

  cues.length=0;
  const departing=resume();assert.equal(departing.mode,'escape');
  advance(departing,ESCAPE.merge+.02);
  assert.equal(departing.mode,'escape');assert.equal(departing.clock,'05:12');
  assert.equal(new ChapterLog(disk).ending,'escaping','keep the pending save until the highway shots finish');
  advance(departing,ESCAPE.end-departing.modeTime+.02);
  assert.equal(departing.mode,'ending');assert.equal(departing.copy,ESCAPE_END);
  assert.deepEqual(cues.map(([type,at])=>[type,at]),ESCAPE_CUES.map(([,type])=>[type,undefined]));
  const ended=resume();assert.equal(ended.mode,'ending');
  assert.ok(ended.log.escaped&&ended.cinematic&&!ended.log.hasWrench);
  assert.equal(ended.log.progress,5);assert.equal(ended.target,null);
  assert.equal(JSON.parse(disk.getItem(SAVE_KEY)).version,3);
  assert.equal(ended.clock,'05:12');assert.ok(ended.daylight>.6);
  const finishedSave=disk.getItem(SAVE_KEY);
  advance(ended,ESCAPE.end+.02);
  assert.equal(ended.mode,'ending','continuing a completed save never restarts the chase');
  assert.equal(disk.getItem(SAVE_KEY),finishedSave);
  ended.log.restart();assert.equal(disk.getItem(SAVE_KEY),undefined);
  assert.equal(ended.log.ending,'none');assert.equal(ended.log.progress,0);
  world.dispose();
});

test('dialing 123450 skips investigation once, persists the wrench, and leaves the normal bonnet interaction',()=>{
  const disk=storage(),log=new ChapterLog(disk,{seed:()=>71});
  assert.equal(log.skipInvestigation(),false,'the shortcut cannot skip the opening');
  log.beginRepair();log.finishOpening();
  log.complete(MISSIONS[0].id,[.4,0,5,.26]);
  const {world,chapter,player,camera,use}=setup(log),call=number=>chapter.phoneAction('dial',number,player,camera.yaw);
  const original=disk.getItem(SAVE_KEY);
  assert.equal(call('123450').skipped,undefined,'no dialer from the menu');
  chapter.start();chapter.restorePlayer(player,camera);
  for(const number of ['', '12345', '123451', '1234500', '0123450', 123450])assert.equal(call(number).skipped,undefined);
  assert.equal(disk.getItem(SAVE_KEY),original);
  assert.equal(chapter.target.id,MISSIONS[1].id);

  player.position.set(.8,0,4.73);camera.yaw=.22;
  assert.equal(call(ESCAPE_CHEAT_NUMBER).skipped,true);
  assert.deepEqual(player.position.toArray(),[.8,0,4.73],'no player teleport');
  assert.equal(chapter.mode,'play');
  assert.equal(chapter.target.id,CRETA_RETURN.id);
  assert.ok(log.hasWrench&&!log.escaped&&MISSIONS.every(mission=>log.has(mission.id)));
  assert.equal(world.story.wrench.visible,false);
  const saved=new ChapterLog(disk);
  assert.equal(saved.progress,5);assert.equal(saved.ending,'wrench');assert.equal(saved.seed,71);
  assert.deepEqual(saved.checkpoint,[.8,0,4.73,.22]);

  const awarded=disk.getItem(SAVE_KEY);player.position.set(.2,0,2);
  assert.equal(call('123450').skipped,undefined);
  assert.equal(disk.getItem(SAVE_KEY),awarded,'repeat calls must not reset the ending or checkpoint');
  use(CRETA_RETURN.id,chapter.target.stance);
  assert.equal(chapter.mode,'final-repair');assert.equal(log.ending,'repairing');
  assert.equal(call('123450').skipped,undefined);
  assert.equal(new ChapterLog(disk).ending,'repairing');
  world.dispose();
});

test('old saves resume on the five-mission route',()=>{
  const disk=storage();
  for(const [lastStep,phase,count] of [['leave-car','repair',0],['send-report','play',0],['clue/centre-01','play',1],['clue/forest-04','play',4],['escape-forest','play',4]]){
    disk.setItem(SAVE_KEY,JSON.stringify({seed:5,lastStep}));
    const log=new ChapterLog(disk);assert.equal(log.opening,phase);assert.equal(log.progress,count);assert.equal(log.finished,false);assert.equal(log.seed,5);
  }
  disk.setItem(SAVE_KEY,'{"version":2,"opening":"play","progress":69}');
  assert.equal(new ChapterLog(disk).hasSave,false);
});

test('the optional phone gallery stays bounded and preserves a legacy pinned photo',()=>{
  let photos=rememberPhotos([],{id:'code',src:'evidence'});
  for(let i=0;i<12;i++)photos=rememberPhotos(photos,{id:`shot-${i}`});
  assert.deepEqual(photos.map(p=>p.id),['code','shot-11','shot-10','shot-9']);
});
