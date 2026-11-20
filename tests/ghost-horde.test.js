import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, Matrix4, PerspectiveCamera, Scene, Texture, Vector3 } from 'three';
import { createGhostHorde, ghostEnvelope, ghostRanks } from '../src/game/watcher/GhostHorde.js';
import { GHOST_COUNT, GHOST_REGIMENTS, hordeGeometry } from '../src/game/watcher/HordeGeometry.js';
import { ESCAPE, escapeMotion, MERGE_DISTANCE } from '../src/game/story/CretaFinale.js';
import { SURFACES } from '../src/game/world/surfaceCatalog.js';

test('1,200 ghosts in five mixed regiments have distinct UV-mapped, animated silhouettes',()=>{
  assert.equal(GHOST_COUNT,1200);
  const ranks=ghostRanks(111), counts=Array(5).fill(0);
  for(const {style} of ranks)counts[style]++;
  assert.deepEqual(counts,GHOST_REGIMENTS.map(style=>style.count));
  assert.deepEqual(ghostRanks(111),ranks);
  assert.notDeepEqual(ghostRanks(112),ranks);
  for(const {id} of GHOST_REGIMENTS){
    const detailed=hordeGeometry(id,true),distant=hordeGeometry(id,false);
    assert.ok(detailed.body.index.count>distant.body.index.count,id);
    for(const geometry of [...Object.values(detailed),...Object.values(distant)]){
      assert.equal(geometry.getAttribute('uv').count,geometry.getAttribute('position').count);
      assert.equal(geometry.getAttribute('aStride').count,geometry.getAttribute('position').count);
      geometry.dispose();
    }
  }
});

test('the horde runs toward the parked CRETA, closes at the stall, and clears at dawn',()=>{
  const resources=Object.fromEntries(Object.entries(SURFACES).map(([key,surface])=>[key,{
    ...surface,albedo:new Texture(),normal:surface.type?undefined:new Texture(),orm:surface.type?undefined:new Texture(),
  }]));
  const scene=new Scene(), car=new Group();car.position.set(.72,0,13.12);
  const view=new PerspectiveCamera(66,.6,.065,330);view.position.set(.69,2.24,14);view.lookAt(.69,1.4,-4);view.updateMatrixWorld();
  const horde=createGhostHorde(scene,resources,{seed:111,compact:true});
  const matrix=new Matrix4(),point=new Vector3();
  const frontOfMesh=()=>{
    let z=-Infinity;
    for(const {near,far} of horde.regiments)for(const {meshes} of [near,far]){
      const {mesh,phases}=meshes[0];
      assert.ok(mesh.isInstancedMesh&&mesh.count<=mesh.instanceMatrix.count);
      for(let i=0;i<mesh.count;i++){
        mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);
        assert.ok(point.distanceTo(car.position)>3);
        assert.ok(Number.isFinite(phases.getY(i)));
        z=Math.max(z,point.z);
      }
    }
    return z;
  };
  horde.update(2.45,view,car,{...escapeMotion(2.45),shot:'village'});
  assert.equal(horde.activeCount,1200);assert.ok(horde.visibleCount>500);
  assert.ok(horde.group.children.filter(o=>o.isInstancedMesh).length<=25);
  const before=frontOfMesh();
  horde.update(4.96,view,car,{...escapeMotion(4.96),shot:'ranks'});
  assert.ok(frontOfMesh()>before+5,'the actual instance transforms run down the lane');
  view.lookAt(.69,1.4,40);view.updateMatrixWorld();
  horde.update(5.39,view,car,{...escapeMotion(5.39),shot:'cockpit'});
  assert.equal(horde.visibleCount,0,'cull the horde behind the cockpit');assert.equal(horde.activeCount,1200);
  const stall=escapeMotion(ESCAPE.impact).distance;
  assert.ok(ghostEnvelope(ESCAPE.impact+3,stall).front>ghostEnvelope(ESCAPE.impact,stall).front+1);
  for(const t of [ESCAPE.dawn,ESCAPE.merge,ESCAPE.highway,ESCAPE.tail]){
    const motion=escapeMotion(t),envelope=ghostEnvelope(t,motion.distance);
    assert.ok(envelope.front<MERGE_DISTANCE-45);
    horde.update(t,view,car,motion);
    assert.equal(horde.activeCount,0);assert.equal(horde.group.visible,false);
  }
  horde.hide();assert.equal(horde.visibleCount,0);
  for(const node of horde.group.children)if(node.isInstancedMesh){node.dispose();node.geometry.dispose();node.material.dispose();}
});
