import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Matrix4, PerspectiveCamera, Raycaster, Scene, Texture, Vector3 } from 'three';
import { WORLD } from '../src/game/settings.js';
import { ESCAPE, escapeDaylight, escapeJolt, escapeMotion, escapeRoad, FINAL_RUN_SECONDS, FOREST_ESCAPE_LENGTH, MERGE_DISTANCE } from '../src/game/story/CretaFinale.js';
import { branchPose, BRANCH_REACH, createFinaleHazards } from '../src/game/story/FinaleHazards.js';
import { createImpactDust } from '../src/game/story/ImpactDust.js';
import { buildStoryCar } from '../src/game/story/StoryCar.js';
import { createHighwayScene } from '../src/game/world/HighwayScene.js';
import { EXIT_LANE, HIGHWAY, HIGHWAY_LANES, HIGHWAY_TRAFFIC, HIGHWAY_WALKERS, TRAFFIC_SIZE, trafficZ, walkerZ } from '../src/game/world/HighwayLayout.js';
import { CollisionWorld, poseBox, touchesBox } from '../src/game/world/physics/CollisionWorld.js';
import { SURFACES } from '../src/game/world/surfaceCatalog.js';
import { villagePalette } from '../src/game/world/village/palette.js';

function setup() {
  const resources=Object.fromEntries(Object.entries(SURFACES).map(([id,s])=>[id,{
    ...s,albedo:new Texture(),normal:s.type?undefined:new Texture(),orm:s.type?undefined:new Texture(),
  }]));
  const scene=new Scene(),collision=new CollisionWorld(),car=buildStoryCar(scene,villagePalette(resources),collision);
  return {scene,collision,car,resources};
}

test('the post-restart run lasts exactly 20 story seconds, with both hazards before the merge',()=>{
  assert.equal(FINAL_RUN_SECONDS,20);
  assert.equal(ESCAPE.merge,ESCAPE.breakaway+20);
  assert.ok(ESCAPE.breakaway<ESCAPE.scare&&ESCAPE.scare<ESCAPE.brush&&ESCAPE.brush<ESCAPE.dawn&&ESCAPE.dawn<ESCAPE.merge);
  assert.ok(ESCAPE.cut-ESCAPE.merge>7,'there is time to see live highway traffic before the ending');
  assert.equal(escapeMotion(ESCAPE.merge).distance,MERGE_DISTANCE);
  assert.ok(escapeMotion(ESCAPE.scare+.32).offset<-.5,'Krish steers away from the shadow');
  assert.ok(escapeJolt(ESCAPE.brush+.04)>.2,'the branch has its own impact recoil');
  assert.ok(escapeMotion(ESCAPE.brush+.1).velocity>7,'the branch strike does not stall the car again');
  let previous=escapeMotion(ESCAPE.breakaway).distance,lastLight=0;
  for(let i=1;i<=20*40;i++){
    const time=ESCAPE.breakaway+i/40, {distance,velocity}=escapeMotion(time),daylight=escapeDaylight(time);
    assert.ok(distance>previous&&velocity>0,`continuous getaway at ${time}s`);
    assert.ok(daylight>=lastLight);
    previous=distance;lastLight=daylight;
  }
  const p=new Vector3(),v=new Vector3(),end=new Vector3();
  escapeRoad(MERGE_DISTANCE-.01,p,v);escapeRoad(MERGE_DISTANCE,end,v);
  assert.ok(end.distanceTo(p)<.012);
  assert.deepEqual(end.toArray(),[EXIT_LANE.x,0,HIGHWAY.mergeZ]);
  assert.ok(-end.x>WORLD.halfSize&&-end.x>WORLD.limit,'cinematic extension does not change exploration');
});

test('the cinematic spur is physically paved, keeps the trees clear and feeds into a real traffic gap',()=>{
  const {scene,collision,car,resources}=setup();
  const highway=createHighwayScene(scene,resources,{compact:true,collision});
  assert.equal(highway.group.visible,false);
  assert.ok(collision.solids.some(s=>s.tag==='trunk'&&s.x<-WORLD.halfSize));
  scene.updateMatrixWorld(true);
  const ray=new Raycaster(new Vector3(0,3,0),new Vector3(0,-1,0),0,3.1),p=new Vector3(),v=new Vector3();
  const surfaces=highway.group.children.filter(o=>o.isMesh&&!o.isInstancedMesh);
  for(let d=FOREST_ESCAPE_LENGTH;d<=MERGE_DISTANCE+106;d+=2.9){
    escapeRoad(d,p,v);ray.ray.origin.set(p.x,3,p.z);
    const hit=ray.intersectObjects(surfaces)[0];
    assert.ok(hit&&hit.point.y>=0&&hit.point.y<.055,`continuous drivable mesh at ${d.toFixed(2)}m`);
  }
  const trafficCollision=new CollisionWorld();
  const vehicles=HIGHWAY_TRAFFIC.map(({kind,lane})=>{
    const {halfWidth,halfLength}=TRAFFIC_SIZE[kind];
    return trafficCollision.addMobileBox(lane.x,0,(halfWidth+.16)*2,(halfLength+.09)*2,0,0,2.4);
  });
  const view=new PerspectiveCamera(64,1.72,.065,330),target=new Vector3();
  for(let t=ESCAPE.brushShot;t<ESCAPE.end;t+=.05){
    const {shot}=car.escape(view,t,false),p=car.car.position;
    assert.equal(collision.boxOccupied(car.solid,car.solid),false,`new tree in the route at ${t.toFixed(2)}s`);
    assert.equal(collision.blocksSight(view.position,target.copy(p).add(v.set(0,1.1,0)),[car.solid]),false,`view blocked: ${shot} at ${t.toFixed(2)}s`);
    if(t>=ESCAPE.junction){
      HIGHWAY_TRAFFIC.forEach((spec,i)=>poseBox(vehicles[i],spec.lane.x,trafficZ(spec,t-ESCAPE.merge),0));
      assert.equal(trafficCollision.boxOccupied(car.solid),false,`the CRETA must merge without clipping traffic at ${t.toFixed(2)}s`);
    }
  }
  highway.dispose();
});

test('the headlight shadow is framed in portrait and the branch moves away from the actual bumper contact',()=>{
  const {scene,car,resources}=setup(),hazards=createFinaleHazards(scene,resources),dust=createImpactDust(scene,{compact:true});
  const particles=scene.getObjectByName('Forest strikes · bark and dust');
  const tip=new Vector3(),base=new Vector3(),direction=new Vector3(),p=new Vector3();
  branchPose(base,tip,direction);
  for(const aspect of [1.72,320/568]){
    const view=new PerspectiveCamera(64,aspect,.065,330);
    car.escape(view,ESCAPE.scare+.12,false);hazards.update(ESCAPE.scare+.12,car.car);
    assert.ok(hazards.shade.group.visible);
    p.copy(hazards.shade.group.position).y+=1.35;p.project(view);
    assert.ok(Math.abs(p.x)<.98&&Math.abs(p.y)<.9&&p.z<1,'shadow face must be inside the windshield shot');
    hazards.update(ESCAPE.scare+.12,car.car,{scares:false,reduced:true});
    assert.equal(hazards.shade.group.visible,false);

    car.escape(view,ESCAPE.brush,false);hazards.update(ESCAPE.brush,car.car);
    assert.ok(hazards.branch.visible);
    assert.ok(hazards.branch.localToWorld(p.set(-BRANCH_REACH,.866,0)).distanceTo(tip)<.0001);
    assert.ok(touchesBox(car.solid,tip,.041,.050),'the rendered tip reaches the bumper footprint');
    p.copy(tip).project(view);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<.9&&p.z<1);
    hazards.update(ESCAPE.brush+.36,car.car);
    assert.ok(hazards.branch.localToWorld(p.set(-BRANCH_REACH,.866,0)).distanceTo(tip)>.8,'branch folds out of the lane');
    dust.update(ESCAPE.brush+.12,false);assert.ok(particles.visible);
    p.fromBufferAttribute(particles.geometry.getAttribute('position'),0);
    assert.ok(p.distanceTo(tip)<2,'new splinters originate at the branch strike, not the original trunk');
    car.escape(view,ESCAPE.brush+.04,true);assert.equal(car.car.rotation.x,0,'reduced motion disables the kick');
    dust.update(ESCAPE.brush+.12,true);assert.equal(particles.visible,false);
    hazards.update(ESCAPE.merge,car.car);assert.ok(!hazards.branch.visible&&!hazards.shade.group.visible);
  }
});

test('four lanes and a protected footpath render moving vehicles and walking people, even in portrait',()=>{
  const {scene,car,resources}=setup(),highway=createHighwayScene(scene,resources,{compact:true});
  const t=ESCAPE.highway+.78,view=new PerspectiveCamera(64,320/568,.065,330),p=new Vector3(),matrix=new Matrix4();
  assert.equal(HIGHWAY_LANES.length,4);
  assert.equal(highway.traffic.count,38);
  assert.ok(highway.walkers.count>=16);
  assert.ok(HIGHWAY_LANES.some(l=>l.direction===1)&&HIGHWAY_LANES.some(l=>l.direction===-1));
  for(const spec of HIGHWAY_TRAFFIC){
    const z=trafficZ(spec,0),next=trafficZ(spec,.11);
    assert.ok(z>=HIGHWAY.zMin&&z<HIGHWAY.zMax);
    const wrapped=HIGHWAY.zMax-HIGHWAY.zMin;
    assert.ok(Math.min(...[-wrapped,0,wrapped].map(shift=>Math.abs(next-z+shift-spec.lane.direction*spec.lane.speed*.11)))<1e-8);
  }
  const paintwork=()=>highway.traffic.group.children.filter(o=>o.name.endsWith('paintwork'));
  car.escape(view,ESCAPE.merge+.70,false);highway.update(ESCAPE.merge+.70,view,false);
  assert.ok(paintwork().reduce((count,pool)=>count+pool.count,0)>=6,'the merge reveal shows multiple lanes of traffic');
  const snapshots=[];
  for(const time of [t,t+.37]){
    car.escape(view,time,false);highway.update(time,view,false);
    const locations=paintwork().flatMap(mesh=>Array.from({length:mesh.count},(_,i)=>{
      mesh.getMatrixAt(i,matrix);return p.setFromMatrixPosition(matrix).toArray();
    }));
    assert.ok(locations.some(([x])=>x<HIGHWAY.x+HIGHWAY.halfWidth),'the roadside cut also shows moving traffic');
    const heads=highway.walkers.group.getObjectByName('Faces'),legs=highway.walkers.group.getObjectByName('Walking legs');
    const walkers=[];let inFrame=0;
    HIGHWAY_WALKERS.forEach((w,i)=>{
      heads.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix);
      const {z}=walkerZ(w,time-ESCAPE.merge);
      assert.ok(Math.abs(z-p.z)<.00002&&p.x>HIGHWAY.x+HIGHWAY.halfWidth+3);
      assert.ok(z>=HIGHWAY.laybyZ-24&&z<=HIGHWAY.laybyZ+30);
      walkers.push(p.z);
      p.project(view);
      if(Math.abs(p.x)<.99&&p.y>-.3&&p.y<.76&&p.z<1)inFrame++;
    });
    assert.ok(inFrame>=5,`at least five pedestrians in the portrait shot (${inFrame})`);
    legs.getMatrixAt(0,matrix);
    snapshots.push({locations,walkers,gait:matrix.toArray()});
  }
  assert.notDeepEqual(snapshots[0].locations,snapshots[1].locations);
  assert.notDeepEqual(snapshots[0].gait,snapshots[1].gait);
  for(const [i,w] of HIGHWAY_WALKERS.entries()){
    assert.equal(snapshots[0].walkers[i]===snapshots[1].walkers[i],w.idle);
  }
  highway.hide();assert.equal(highway.group.visible,false);
  highway.dispose();
});
