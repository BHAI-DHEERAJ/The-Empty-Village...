import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { MissionGuide } from '../src/game/interaction/MissionGuide.js';
import { CANAL, entryPoint, localPoint, SITES } from '../src/game/world/sceneryLayout.js';
import { mapViewBox, playerTransform, routePolyline } from '../src/ui/VillageMap.js';

const barn = { site: 'farmland-04', at: new Vector3(108, 1, 22) };
const fieldGuide = () => new MissionGuide(SITES.map(site => ({ site })));
const pointAt = (guide, x, z, target = barn) => {
  const point = guide.update(new Vector3(x, 0, z), target, null);
  return [point.x, point.z];
};

test('mission guidance advances through the main road fork without flipping back on small steps', () => {
  const guide = fieldGuide();
  assert.deepEqual(pointAt(guide, 2.13, -21), [1.3, -12]);
  assert.deepEqual(pointAt(guide, 1.3, -12.57), [9, -4]);
  const afterTurn = guide.distance, remaining = guide.remainingPath;
  assert.notDeepEqual(remaining[0], [1.3, -12]);
  for (let i = 0; i < 240; i++) {
    // Drift either side of the junction while looking around it. The previous
    // junction should not become the waypoint again just because it's closer.
    assert.deepEqual(pointAt(guide, 1.6 + Math.sin(i) * .6, -12 + Math.cos(i) * .9), [9, -4]);
    assert.equal(guide.remainingPath, remaining, 'small steps do not replan the polyline');
  }
  assert.deepEqual(pointAt(guide, 7.4, -5.5), [9, -4]);
  assert.ok(guide.distance < afterTurn - 6);
  assert.deepEqual(pointAt(guide, 9.7, -3.1), [23, -2]);
});

test('taking a different road or switching missions rebuilds guidance; finishing clears it', () => {
  const guide = fieldGuide();
  pointAt(guide, 2.13, -21);
  assert.deepEqual(pointAt(guide, 1.3, -12.57), [9, -4]);
  assert.deepEqual(pointAt(guide, .74, -4.4), [1.3, -12], 'return to the fork from the wrong road');
  assert.deepEqual(guide.remainingPath[0], [1.3, -12]);
  const diary = { site: 'centre-01', at: new Vector3(9.7, 1, -12.4) };
  assert.notDeepEqual(pointAt(guide, 1.3, -12, diary), [9, -4]);
  assert.equal(guide.update(new Vector3(), null, null), null);
  assert.equal(guide.remainingPath.length, 0);
});

test('a new route begins inside the previous house, crosses a bridge, and ends at the next door', () => {
  const guide = fieldGuide(), feet = new Vector3(-94, .065, -16);
  guide.update(feet, barn, 'forest-04');
  assert.equal(guide.kind, 'exit');
  const points = guide.remainingPath;
  assert.ok(points.length > 10, 'the full route is already visible indoors');
  const forest = SITES.find(site => site.id === 'forest-04');
  const [u, v] = localPoint(forest, ...points[0]), [du, dv] = entryPoint(forest);
  assert.ok(Math.abs(du - u) < .001 && v > dv, 'first leave through the entrance');
  const crossings = points.filter(([x]) => Math.abs(x - CANAL.x) < .001);
  assert.equal(crossings.length, 1);
  assert.ok(CANAL.bridgeZ.includes(crossings[0][1]));
  const field = SITES.find(site => site.id === barn.site);
  const [x, z] = localPoint(field, ...points.at(-1));
  const [doorX, doorZ] = entryPoint(field);
  assert.ok(Math.abs(x - doorX) < .001 && Math.abs(z - (doorZ - .60)) < .001);
});

test('a detour by the canal approaches a bridge from dry land, not through its rails', () => {
  const guide = fieldGuide(), feet = new Vector3(85, 0, 19);
  const diary = { site:'centre-01', at:new Vector3(9.7, 1, -12.4) };
  guide.update(feet, diary, null);
  const route = guide.remainingPath, [firstX,firstZ] = route[0];
  assert.ok(firstX > CANAL.x + CANAL.half + 1, 'walk out from beside the rail');
  assert.equal(firstZ, feet.z);
  for (let i = 1; i < route.length; i++) {
    const [x,z] = route[i];
    if ((x < CANAL.x) !== (route[i - 1][0] < CANAL.x)) assert.ok(CANAL.bridgeZ.includes(z) || CANAL.bridgeZ.includes(route[i - 1][1]));
  }
  assert.ok(route.some(([x,z]) => x === CANAL.x && CANAL.bridgeZ.includes(z)));
});

test('the mini-map follows world position and heading, not camera perspective', () => {
  const feet = new Vector3(9.2, 3, -14.12);
  assert.deepEqual(mapViewBox(feet), [-16.8, -31.12, 52, 34]);
  assert.equal(playerTransform(feet, 89.125), 'translate(9.2 -14.12) rotate(89.13) scale(1)');
  assert.equal(routePolyline(feet, [[4, -14.12], [4, -21]]), '9.2,-14.12 4,-14.12 4,-21');
  assert.equal(routePolyline(feet, []), '', 'no line in free roam');
  const far = new Vector3(157, 0, 155);
  const [left, top, width, height] = mapViewBox(far, true);
  assert.ok(left + width > far.x && top + height > far.z, 'overview also includes a player far off the roads');
});
