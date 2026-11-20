import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Scene, Texture, Vector3 } from 'three';
import { MissionHighlight } from '../src/game/interaction/MissionHighlight.js';
import { CollisionWorld } from '../src/game/world/physics/CollisionWorld.js';

test('the active prop itself shines, preserving textures and leaving neighbouring models alone',()=>{
  const scene=new Scene(),collision=new CollisionWorld(),view={position:new Vector3(0,1,3)};
  const original=new MeshStandardMaterial({map:new Texture(),normalMap:new Texture()});
  const geom=new BoxGeometry(.4,.28,.1),a=new Mesh(geom,original),b=new Mesh(geom,original);
  const aa=new Group(),bb=new Group();aa.add(a);bb.add(b);scene.add(aa,bb);
  const first={model:aa,at:new Vector3(0,1,0)},second={model:bb,at:new Vector3(1,1,0)};
  const glow=new MissionHighlight(scene,collision,null);
  glow.update(1,first,view);
  assert.ok(glow.light.intensity>1);assert.notEqual(a.material,original);assert.equal(b.material,original);
  assert.equal(a.material.map,original.map);assert.equal(a.material.normalMap,original.normalMap);assert.ok(a.material.depthTest);
  const shader={uniforms:{},vertexShader:'#include <fog_vertex>',fragmentShader:'#include <emissivemap_fragment>\n#include <fog_fragment>'};
  a.material.onBeforeCompile(shader);assert.equal(shader.uniforms.uMissionShine,glow.shine);
  assert.match(shader.fragmentShader,/totalEmissiveRadiance \+= uMissionShine/);
  const highlighted=a.material;
  glow.update(2,second,view);assert.equal(a.material,original);assert.equal(b.material,highlighted);
  glow.update(3,null,view);assert.equal(b.material,original);assert.equal(glow.light.intensity,0);
  glow.dispose();assert.equal(glow.light.parent,null);
});

test('glow does not light the other side of a wall and the reduced-motion intensity is steady',()=>{
  const scene=new Scene(),collision=new CollisionWorld(),view={position:new Vector3(0,1,3)};
  const target={at:new Vector3(0,1,0),model:new Group()};
  const glow=new MissionHighlight(scene,collision,null,{reducedMotion:true});
  glow.update(1,target,view);assert.ok(glow.light.intensity>1);
  const before=glow.shine.value;
  collision.addBox(0,1,4,.14,0,0,2);
  glow.update(2,target,view);assert.equal(glow.light.intensity,0);assert.equal(glow.shine.value,before);
});
