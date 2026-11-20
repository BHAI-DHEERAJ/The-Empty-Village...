import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { CRETA_RETURN, MISSIONS } from '../src/game/story/VillageChapter.js';
import { CarWaypoint } from '../src/ui/CarWaypoint.js';

const bonnet = { ...CRETA_RETURN, at: new Vector3(1.92, .99, 6.10), ignore: [{}] };
const clear = { blocksSight: () => false };

function setup(aspect = 1.7) {
  const element = { hidden: true, style: {} };
  const waypoint = new CarWaypoint(element);
  const view = new PerspectiveCamera(64, aspect, .065, 330);
  view.position.set(1.82, 1.64, 2.4);
  view.lookAt(bonnet.at);
  return { view, waypoint, element };
}

for (const aspect of [1110 / 650, 320 / 568]) {
  test(`CRETA waypoint projects the actual bonnet at aspect ${aspect.toFixed(2)}`, () => {
    const { view, waypoint, element } = setup(aspect);
    waypoint.update(view, bonnet, clear);
    assert.equal(element.hidden, false);
    assert.deepEqual(element.style, { left: '50.00%', top: '50.00%' });
    view.rotateY(.1); // Update the aim before any render; projection must use this frame's view.
    waypoint.update(view, bonnet, clear);
    const point = bonnet.at.clone().project(view);
    assert.ok(Math.abs(parseFloat(element.style.left) - (1 + point.x) * 50) < .01);
    assert.notEqual(element.style.left, '50.00%');
    assert.deepEqual(bonnet.at.toArray(), [1.92, .99, 6.10]);
  });
}

test('waypoint is scoped to the return goal, in front of the camera and not behind walls', () => {
  const { view, waypoint, element } = setup();
  const show = () => waypoint.update(view, bonnet, clear);
  show();
  waypoint.update(view, MISSIONS[0], clear);
  assert.equal(element.hidden, true);
  show();
  const wall = { blocksSight: (eye, target, ignore) => {
    assert.deepEqual(eye.toArray(), view.position.toArray());
    assert.equal(target, bonnet.at);
    assert.equal(ignore, bonnet.ignore, 'the bonnet is allowed to be inside its own car collider');
    return true;
  } };
  waypoint.update(view, bonnet, wall);
  assert.equal(element.hidden, true);
  show();
  waypoint.update(view, bonnet, clear, { blocksSight: () => true });
  assert.equal(element.hidden, true);
  view.rotateY(Math.PI);
  waypoint.update(view, bonnet, { blocksSight: () => assert.fail('offscreen targets need no ray test') });
  assert.equal(element.hidden, true);
  view.rotateY(-Math.PI / 2);
  show();
  assert.equal(element.hidden, true);
  view.lookAt(bonnet.at);
  show();
  assert.equal(element.hidden, false);
  waypoint.update(view, null, clear);
  assert.equal(element.hidden, true, 'removed as soon as the repair begins');
});
