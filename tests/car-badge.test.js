import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group } from 'three';
import { mountCretaBadges } from '../src/game/story/CarBadge.js';

test('front, rear and dash CRETA badges are real, outward-facing raised lettering',()=>{
  const car=new Group();mountCretaBadges(car);
  assert.equal(car.children.length,3);
  for(const [side,front] of [['front',true],['rear',false],['dash',false]]){
    const mesh=car.getObjectByName(`CRETA badge · ${side}`),geo=mesh.geometry;
    geo.computeBoundingBox();
    assert.ok(geo.boundingBox.max.z-geo.boundingBox.min.z>.004);
    const normals=geo.attributes.normal,positions=geo.attributes.position;
    const z=front?geo.boundingBox.min.z:geo.boundingBox.max.z;
    assert.ok(Array.from({length:positions.count},(_,i)=>i).some(i=>Math.abs(positions.getZ(i)-z)<1e-5&&normals.getZ(i)*(front?-1:1)>.95));
  }
});
