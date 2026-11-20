import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PerspectiveCamera, Scene, Texture, Vector3 } from 'three';
import { CAMERA, PLAYER, WORLD } from '../src/game/settings.js';
import { InteractionController } from '../src/game/interaction/InteractionController.js';
import { MISSIONS } from '../src/game/interaction/MissionLog.js';
import { FirstPersonCamera } from '../src/game/camera/FirstPersonCamera.js';
import { PlayerController } from '../src/game/player/PlayerController.js';
import { createWorld } from '../src/game/world/createWorld.js';
import { SURFACES } from '../src/game/world/surfaceCatalog.js';
import { APPROACHES, CANAL, DISTRICTS, HOUSES, ROUTES, SITES, STYLES, WELL, districtAt, groundHeight, isEntrance, localPoint, worldPoint } from '../src/game/world/sceneryLayout.js';
import { BASE, BASEMENT, UPPER, wallPieces } from '../src/game/world/village/buildingPlans.js';
import { pulse } from '../src/game/world/village/atmosphere.js';
import { createWatcherPlaces, hasWatcherClearance } from '../src/game/watcher/WatcherPlaces.js';
import { WatcherSight } from '../src/game/watcher/WatcherSight.js';

const DT=1/120;
const tol=(value,expected,margin=.025)=>assert.ok(Math.abs(value-expected)<margin,`${value} ≉ ${expected}`);
const localPlayer=(world,site,x,z,y=BASE)=>{
  const [xx,zz]=worldPoint(site,x,z);
  return new PlayerController({spawn:{x:xx,y,z:zz},collision:world.collision});
};
function steadyWalk(p,forward,right,yaw,frames){
  for(let i=0;i<frames;i++)p.step(DT,{forward,right},yaw);
}

const mockMaps=()=>Object.fromEntries(Object.entries(SURFACES).map(([key,surface])=>[key,{
  ...surface,albedo:new Texture(),normal:!surface.type?new Texture():undefined,
  orm:!surface.type?new Texture():undefined,displacement:surface.height?new Texture():undefined,
}]));
const scene=new Scene();
const world=createWorld(scene,mockMaps(),{compact:true});

test('first-person view rests at eye height, clamps pitch, and damps sensitive mouse look',()=>{
  const view=new PerspectiveCamera(CAMERA.fov,16/9,.065,330), rig=new FirstPersonCamera(view);
  const player=new PlayerController({spawn:{x:3,y:0,z:-4}});
  rig.reset(player.position);
  assert.deepEqual(view.position.toArray(),[3,CAMERA.eye,-4]);
  const before=rig.targetYaw;rig.setSensitivity(1.5);rig.look(140,-4500);
  tol(rig.targetYaw,before-140*CAMERA.sensitivity*1.5,.0001);
  assert.equal(rig.targetPitch,CAMERA.maxPitch);
  rig.update(1/60,player,1);
  assert.ok(rig.targetYaw<rig.yaw&&rig.yaw<before);
  for(let j=0;j<45;j++)rig.update(1/60,player,1+j/60);
  tol(rig.yaw,rig.targetYaw,.001);
  tol(rig.pitch,CAMERA.maxPitch,.001);
  assert.equal(rig.torch.parent,view);
  assert.equal(rig.torch.target.parent,view);
  assert.equal(rig.toggle(),false);assert.equal(rig.torch.intensity,0);
  assert.equal(rig.toggle(),true);assert.ok(rig.torch.intensity>0);
});

test('sprint view stays at feet + eye height; reduced motion disables bob and wider framing',()=>{
  const view=new PerspectiveCamera(CAMERA.fov,1,.065,330);
  const rig=new FirstPersonCamera(view,{reducedMotion:true});
  const p=new PlayerController({spawn:{x:0,y:0,z:0}});
  rig.reset(p.position);
  for(let i=0;i<90;i++){
    p.step(1/60,{forward:1,sprint:true});
    rig.update(1/60,p,i/60);
    assert.equal(view.fov,CAMERA.fov);assert.equal(rig.bobWeight,0);
  }
  assert.equal(p.sprinting,true);assert.equal(view.position.x,p.position.x);assert.equal(view.position.z,p.position.z);
  tol(view.position.y,CAMERA.eye,.0001);
});

test('40 authored houses, 15 central homes, 12 distinct styles, and six districts',()=>{
  assert.equal(HOUSES.length,40);
  assert.equal(SITES.length,44);
  assert.equal(HOUSES.filter(h=>h.area==='centre').length,15);
  assert.equal(new Set(HOUSES.map(h=>h.style)).size,Object.keys(STYLES).length);
  assert.equal(new Set(HOUSES.map(({w,d,roof,plan,eave})=>[w,d,roof,plan,eave].join('/'))).size,40);
  assert.equal(new Set(HOUSES.map(h=>h.id)).size,40);
  assert.deepEqual(Object.values(DISTRICTS).map(d=>districtAt(d[1],d[2])),Object.values(DISTRICTS).map(d=>d[0]));
  assert.equal(APPROACHES.length,SITES.length);
  for(const path of APPROACHES)assert.ok(path.points.length>=3,`Connect ${path.id} to the network`);
});

test('every mesh and particle has an image, projected UVs and finite geometry',()=>{
  const p=new PlayerController({collision:world.collision});
  const view=new PerspectiveCamera();view.position.copy(p.position);view.position.y+=CAMERA.eye;
  world.update(0,view,p);
  assert.ok(scene.fog?.isFogExp2);
  assert.ok(world.collision.cells.size>180);
  assert.ok(world.collision.solids.length>2200);
  assert.ok(world.collision.floors.length>160);
  steadyWalk(p,0,0,0,120);
  assert.deepEqual(p.position.toArray(),[WORLD.spawn.x,WORLD.spawn.y,WORLD.spawn.z]);
  scene.traverse(o=>{
    if(!o.isMesh&&!o.isPoints)return;
    assert.ok(o.material.map||o.material.uniforms?.uNight||o.material.uniforms?.uCloud,`Untextured: ${o.name}`);
    if(o.isMesh)assert.ok(o.geometry.getAttribute('uv'),`No UVs: ${o.name}`);
    assert.ok(o.geometry.getAttribute('position').array.every(Number.isFinite),`Invalid placement: ${o.name}`);
  });
});

test('walk through all 44 entryways; each frontage also has a genuinely solid wall',()=>{
  for(const {site,plan} of world.buildings){
    const visitor=localPlayer(world,site,plan.entry.at,site.d*.5+2.16,0);
    steadyWalk(visitor,1,0,site.yaw,125);
    assert.equal(world.roomAt(visitor.position)?.site.id,site.id,site.id);
    tol(visitor.position.y,BASE,.032);
    const frontage=plan.walls.find(w=>w.front&&w.base===BASE);
    const solid=wallPieces(frontage).filter(s=>s.lo===0&&s.hi>=2.1&&s.b-s.a>.53).sort((a,b)=>(b.b-b.a)-(a.b-a.a))[0];
    assert.ok(solid,site.id);
    const outside=localPlayer(world,site,(solid.a+solid.b)*.5,site.d*.5+1.15,0);
    steadyWalk(outside,1,0,site.yaw,120);
    const [,z]=localPoint(site,outside.position.x,outside.position.z);
    assert.ok(z>=site.d*.5+.13,`Solid frontage must stop ${site.id}: ${z}`);
  }
});

// Flood-fill meter-space stances with the real radius, collision resolution, floor
// and ceiling queries. Validate each tiny segment so the search can't tunnel through
// a thin frame or jump across an opening in the upper or lower floor slab.
function reachableRooms(building){
  const {site,plan}=building, {collision}=world, gap=.265;
  const entryX=plan.entry.at,entryZ=site.d*.5+2.17;
  const probe={x:0,y:0,z:0},vel={x:0,z:0};
  const move=(x,z,a,b,y)=>{
    for(let i=1;i<=4;i++){
      const f=i*.25, [wx,wz]=worldPoint(site,x+(a-x)*f,z+(b-z)*f);
      probe.x=wx;probe.y=y;probe.z=wz;vel.x=0;vel.z=0;
      collision.resolve(probe,vel);
      if(Math.hypot(probe.x-wx,probe.z-wz)>.037)return null;
      const floor=collision.supportAt(wx,wz,y+PLAYER.step);
      if(!Number.isFinite(floor)||Math.abs(y-floor)>PLAYER.step)return null;
      if(collision.ceilingAt(wx,wz,floor+.055,floor+PLAYER.height-.026)<Infinity)return null;
      y=floor;
    }
    return y;
  };
  const y=collision.supportAt(...worldPoint(site,entryX,entryZ),PLAYER.step);
  const stack=[{i:0,j:0,y}],visited=new Set([`0/0/${Math.round(y*12)}`]),rooms=new Map();
  const directions=[[1,0],[-1,0],[0,1],[0,-1]];
  for(let k=0;k<stack.length;k++){
    const n=stack[k],u=entryX+n.i*gap,v=entryZ+n.j*gap;
    for(const r of plan.rooms){
      if(Math.abs(n.y-r.base)<.15&&u>r.x0+.09&&u<r.x1-.09&&v>r.z0+.09&&v<r.z1-.09)rooms.set(r.id,(rooms.get(r.id)??0)+1);
    }
    for(const [di,dj] of directions){
      const i=n.i+di,j=n.j+dj,x=entryX+i*gap,z=entryZ+j*gap;
      if(Math.abs(x)>site.w*.5+.64||z < -site.d*.5-.64||z>entryZ+.58)continue;
      const expected=collision.supportAt(...worldPoint(site,x,z),n.y+PLAYER.step);
      const key=`${i}/${j}/${Math.round(expected*12)}`;
      if(visited.has(key))continue;
      const ground=move(u,v,x,z,n.y);
      if(ground!=null&&Math.abs(ground-expected)<.04){visited.add(key);stack.push({i,j,y:ground});}
    }
  }
  return rooms;
}

test('all 176 unlocked rooms and landings are connected to a public entrance and furnished',()=>{
  let unlocked=0,locked=0;
  for(const b of world.buildings){
    const reachable=reachableRooms(b);
    for(const r of b.plan.rooms){
      const msg=`${b.site.name}: ${r.id}`;
      if(r.locked){assert.equal(reachable.has(r.id),false,msg);locked++;continue;}
      assert.ok((reachable.get(r.id)??0)>=3,`Unreachable ${msg}`);
      const dressing=b.dressed.find(d=>d.room===r);
      assert.ok(dressing,`Missing staging plan for ${msg}`);
      if(r.type!=='landing'&&r.type!=='courtyard')assert.ok(dressing.objects>0,`Empty ${msg}`);
      unlocked++;
    }
  }
  assert.equal(unlocked,176);assert.equal(locked,2);
});

test('fixed-step sprint climbs and descends all real stair runs, with separate supporting levels',()=>{
  let flights=0;
  for(const {site,plan} of world.buildings)for(const {id,x,start,end,front,back} of plan.stairs){
    flights++;
    const p=localPlayer(world,site,x,start+.37,front);
    const frames=Math.ceil((start-end+.70)/PLAYER.sprintSpeed/DT)+10;
    for(let i=0;i<frames;i++)p.step(DT,{forward:1,sprint:true},site.yaw);
    tol(p.position.y,back,.029);
    assert.equal(p.grounded,true,`${site.id} ${id}`);
    p.velocity.set(0,0,0);
    steadyWalk(p,-1,0,site.yaw,Math.ceil((start-end+1.06)/PLAYER.speed/DT));
    tol(p.position.y,front,.029);
    assert.equal(p.grounded,true);
  }
  assert.equal(flights,7); // five large homes, the mansion's upper floor and its basement.
});

test('mansion floors are vertically isolated and locked leaves stop movement',()=>{
  const b=world.buildings.find(b=>b.site.plan==='mansion'),{site,plan}=b;
  const {collision}=world;
  const [x,z]=worldPoint(site,0,-1.60);
  assert.equal(groundHeight(x,z),BASEMENT);
  tol(collision.supportAt(x,z,.3),BASE);
  tol(collision.supportAt(x,z,3.2),BASE+UPPER);
  tol(collision.ceilingAt(x,z,-1.1,.01),BASE-.15,.001);
  const basement=localPlayer(world,site,-.1,1.20,BASEMENT);
  for(let i=0;i<100;i++)basement.step(DT,{jump:i===0},site.yaw);
  tol(basement.position.y,BASEMENT,.001);
  const locked=plan.walls.filter(w=>w.base===BASE+UPPER).flatMap(w=>w.openings.filter(o=>o.locked).map(o=>[w,o]));
  assert.equal(locked.length,2);
  for(const [wall,o] of locked){
    const p=localPlayer(world,site,wall.at-.72,o.at,BASE+UPPER);
    steadyWalk(p,0,1,site.yaw,120);
    const [a]=localPoint(site,p.position.x,p.position.z);
    assert.ok(a<wall.at-.22,`Walked through a locked door (${a})`);
  }
});

test('all district routes are continuous, and the well and three canal crossings work',()=>{
  const {collision}=world;
  const roads=new Set(ROUTES[0].path.map(String));
  const todo=ROUTES.slice(1);
  while(todo.length){
    const i=todo.findIndex(route=>route.path.some(pt=>roads.has(String(pt))));
    assert.ok(i>=0,`Disconnected route: ${todo.map(r=>r.id).join(', ')}`);
    todo.splice(i,1)[0].path.forEach(pt=>roads.add(String(pt)));
  }
  for(const {id,path} of ROUTES)for(let i=1;i<path.length;i++){
    const [a,b]=path[i-1],[c,d]=path[i],n=Math.ceil(Math.hypot(c-a,d-b)/.47);
    for(let j=0;j<=n;j++){
      const x=a+(c-a)*j/n,z=b+(d-b)*j/n,y=collision.supportAt(x,z,.3),p={x,y,z};
      collision.resolve(p,{x:0,z:0});
      assert.ok(Math.hypot(p.x-x,p.z-z)<.072,`Obstructed ${id} at ${x.toFixed(2)},${z.toFixed(2)}`);
      assert.ok(y>=-.07,`Route dips off walkable ground at ${id}`);
    }
  }
  for(const z of CANAL.bridgeZ){
    const p=new PlayerController({spawn:{x:CANAL.x-4.0,y:0,z},collision});
    steadyWalk(p,0,1,0,325);
    assert.ok(p.position.x>CANAL.x+4);
    tol(p.position.y,0,.05);
  }
  const p=new PlayerController({spawn:{x:WELL.x,y:0,z:WELL.z+2.54},collision});
  steadyWalk(p,1,0,0,200);
  assert.ok(p.position.z-WELL.z>WELL.r+PLAYER.radius-.026);
});

test('real doors close and reopen from the approach without changing the map’s locked rooms', () => {
  const view = new PerspectiveCamera(CAMERA.fov, 1.5);
  const interaction = new InteractionController({ actions: world.actions, collision: world.collision });
  for (const id of ['centre-01', 'school', 'temple', 'mansion-01']) {
    const {site, plan} = world.buildings.find((b) => b.site.id === id);
    const door = interaction.index.get(`${id}/entry`);
    const p = localPlayer(world, site, plan.entry.at, site.d*.5+1.65, BASE);
    view.position.copy(p.position).y+=CAMERA.eye;view.lookAt(door.focusAt);
    assert.equal(interaction.find(view), door);
    const roomBehind = new Vector3();
    const [bx,bz] = worldPoint(site,plan.entry.at-.30,site.d*.5-.31);roomBehind.set(bx,BASE+1.61,bz);
    assert.equal(world.collision.blocksSight(view.position,roomBehind),false,id);
    assert.equal(interaction.activate(view, p),null);
    for(let j=0;j<60;j++)interaction.tick(1/60,p);
    assert.equal(door.progress,0,id);
    assert.equal(door.proxy.visible,true);
    assert.equal(world.collision.blocksSight(view.position,roomBehind),true,id);
    assert.equal(interaction.activate(view, p),null);
    for(let j=0;j<60;j++)interaction.tick(1/60,p);
    assert.equal(door.progress,1,id);
    assert.equal(door.proxy.visible,false);
    assert.equal(world.collision.blocksSight(view.position,roomBehind),false,id);
  }
  assert.equal(world.actions.filter((a)=>a.kind==='locked').length,2);
});

test('every clue and playground ride has a legal, visible stance in the real village', () => {
  const {collision} = world;
  const view = new PerspectiveCamera(CAMERA.fov,1.5), { occlusion } = createWatcherPlaces(world);
  const interaction = new InteractionController({actions:world.actions,collision,windowOcclusion:occlusion});
  assert.equal(interaction.index.size,world.actions.length,'All interaction IDs must be unique');
  const ids = MISSIONS.map(({id}) => id).concat('yard-swing-west','yard-swing-east','yard-seesaw-west','yard-seesaw-east','tractor-green');
  const position = new Vector3(), probe = new Vector3(), velocity = new Vector3();
  for (const id of ids) {
    const action = interaction.index.get(id);
    assert.ok(action,id);
    const at = action.focusAt ?? action.at;
    let canUse = false;
    for (const r of [.9,1.4,1.9,2.2]) for (let k=0;k<24&&!canUse;k++) {
      const heading=k*Math.PI/12, x=at.x+Math.sin(heading)*r,z=at.z+Math.cos(heading)*r;
      const y=collision.supportAt(x,z,.29);
      if(!Number.isFinite(y)||y<-.05||!collision.headroomAt(x,z,y))continue;
      position.set(x,y,z);
      if(id==='school-register'&&world.roomAt(position)?.site.id!=='school'||
         id==='mansion-radio'&&world.roomAt(position)?.site.id!=='mansion-01')continue;
      probe.copy(position);collision.resolve(probe,velocity.set(0,0,0));
      if(probe.distanceToSquared(position)>.00001)continue;
      view.position.copy(position).y+=CAMERA.eye;view.lookAt(at);
      canUse=interaction.find(view)===action;
    }
    assert.ok(canUse,`No clear stance from which to use ${id}`);
  }
});

test('map labels, action prompts, names and evidence are in Hindi', () => {
  for (const text of [
    ...SITES.map(site=>site.name), ...Object.values(DISTRICTS).map(([name])=>name),
    ...world.actions.flatMap(({name,label})=>[name,label]),
    ...MISSIONS.flatMap(({title,hint,item,text})=>[title,hint,item,text]),
  ]) {
    assert.match(text, /\p{Script=Devanagari}/u);
    assert.doesNotMatch(text, /[A-Za-z]/);
  }
});

test('lighting events are sparse, and the scenery factory does not instantiate the Watcher',()=>{
  assert.equal(pulse(47,0),0);assert.ok(pulse(49,0)>.8);
  assert.equal(scene.getObjectByName('Traveler'),undefined);
  world.dispose();
});


test('Watcher marks are grounded clear pockets across the real map, including broken upstairs windows', () => {
  const collision = world.collision, solids = collision.solids.length, slabs = collision.floors.length;
  const { spots, occlusion } = createWatcherPlaces(world);
  assert.equal(collision.solids.length, solids);
  assert.equal(collision.floors.length, slabs);
  assert.equal(new Set(spots.map((s) => s.id)).size, spots.length);
  assert.equal(new Set(spots.map((s) => s.district)).size, 6);
  for (const kind of ['road','verge','field','well','tree','wall','roof','doorway','upper-window','broken-window','window-side','hall']) {
    assert.ok(spots.some((s) => s.kind === kind), `Missing ${kind} marks`);
  }
  for (const spot of spots) {
    assert.ok(hasWatcherClearance(collision, spot.pos, spot.scale), spot.id);
    if (!spot.pose && spot.kind !== 'roof') assert.ok(!isEntrance(spot.pos.x, spot.pos.z), spot.id);
    if (spot.kind === 'hall') assert.equal(world.roomAt(spot.pos)?.site.id, spot.siteId);
  }
  const view = new PerspectiveCamera(CAMERA.fov, 1.55, .065, 330), sight = new WatcherSight(collision, occlusion);
  const broken = spots.find((s) => s.id === 'centre-05/window/x/1/2.925/0');
  const yaw = broken.facing;
  view.position.set(18.57549, CAMERA.eye, -14.62275);
  view.lookAt(broken.pos.x, broken.pos.y + 2.81 * broken.scale, broken.pos.z);
  sight.capture(view);
  assert.equal(sight.observe({ ...broken, yaw }).gaze, true, 'A real upstairs slit has a clear sight line');
  const { site, plan } = world.buildings.find((b) => b.site.id === 'centre-01');
  const wall = plan.walls.find((w) => w.finish === 'outer' && w.openings.some((op) => op.window && !op.broken));
  const intact = wall.openings.find((op) => op.window && !op.broken);
  const pt = (distance) => {
    const u = intact.at + intact.w * .14;
    const [x, z] = worldPoint(site, ...(wall.axis === 'x' ? [wall.at + distance, u] : [u, wall.at + distance]));
    return new Vector3(x, wall.base + intact.low + (intact.high - intact.low) * .77, z);
  };
  assert.equal(collision.blocksSight(pt(-.23), pt(.23)), false, 'The architectural opening itself is unobstructed');
  assert.equal(occlusion.blocksSight(pt(-.23), pt(.23)), true, 'Watchers are not recognised through intact opaque glazing');
});
