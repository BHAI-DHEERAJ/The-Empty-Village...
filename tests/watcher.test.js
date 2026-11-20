import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, PerspectiveCamera, Texture, Vector3 } from 'three';
import { FirstPersonCamera } from '../src/game/camera/FirstPersonCamera.js';
import { PlayerController } from '../src/game/player/PlayerController.js';
import { CollisionWorld } from '../src/game/world/physics/CollisionWorld.js';
import { seededRandom } from '../src/game/world/random.js';
import { Watcher } from '../src/game/watcher/Watcher.js';
import { createWatcherModel } from '../src/game/watcher/WatcherModel.js';
import { clearWithdrawal, hasWatcherClearance } from '../src/game/watcher/WatcherPlaces.js';
import { WatcherSight } from '../src/game/watcher/WatcherSight.js';

const v = (x, y, z) => new Vector3(x, y, z);
const spot = (id, x, z, details = {}) => ({ id, kind: 'verge', pos: v(x, 0, z), scale: 1, ...details });
const turn = (view, feet, position) => {
  view.position.copy(feet).add(v(0, 1.61, 0));
  view.lookAt(position);
};
const eyes = (place) => place.pos.clone().add(v(0, 2.81 * place.scale, 0));
const elapsed = (watcher, state, seconds) => {
  for (let i = 0; i < Math.ceil(seconds * 20); i++) watcher.update(.05, state);
};

function harness(spots = [spot('side', 24, 0)], options = {}) {
  const collision = options.collision ?? new CollisionWorld();
  const view = new PerspectiveCamera(64, 16 / 10, .065, 330);
  const feet = options.feet ?? v(0, 0, 0);
  turn(view, feet, feet.clone().add(v(0, 1.61, -5)));
  const model = { group: new Group(), amount: 0, steps: 0, hold() { this.group.visible = false; },
    tilt(value) { this.amount = value; }, step() { this.steps++; } };
  if (options.walk) model.walk = (travel) => { model.travel = travel; };
  model.group.visible = false;
  const cues = [];
  const watcher = new Watcher({ collision, spots }, model, {
    random: options.random ?? (() => .5), reducedMotion: options.reducedMotion, onReveal: options.onReveal,
    onCue: (kind, position, clarity) => cues.push({ kind, position: position.clone(), clarity }),
  });
  const state = { view, feet, torch: options.torch ?? true };
  return { watcher, state, collision, view, feet, model, cues, run: (seconds) => elapsed(watcher, state, seconds) };
}

test('segment sight queries respect rotated openings, solid trunks and vertically stacked floors', () => {
  const c = new CollisionWorld();
  const yaw = Math.PI / 4, a = Math.cos(yaw), b = Math.sin(yaw);
  const point = (u, y, v) => new Vector3(-8 + a * u + b * v, y, -14 - b * u + a * v);
  const wall = (at, width, low, high) => {
    const p = point(at, 0, 0);
    c.addBox(p.x, p.z, width, .25, yaw, low, high);
  };
  wall(-1.78, 2.6, 0, 3); wall(1.78, 2.6, 0, 3);
  wall(0, .96, 0, .95); wall(0, .96, 2.15, 3);
  const through = (u, y) => c.blocksSight(point(u, y, 11), point(u, y, -10));
  assert.equal(through(0, 1.58), false, 'The window opening is real');
  assert.equal(through(.8, 1.58), true);
  assert.equal(through(0, 2.2), true);
  assert.equal(c.blocksSight(point(0, 2.2, 11), point(0, 2.2, 1)), false, 'Geometry past the end of the ray is irrelevant');
  c.addCircle(-29, -34, .6, 9, 0);
  assert.equal(c.blocksSight(v(-29, 2, -40), v(-29, 2, -28)), true);
  assert.equal(c.blocksSight(v(-28, 2, -40), v(-28, 2, -28)), false);
  c.addFloor(-20, -26, 5, 6, -.8, 3);
  assert.equal(c.blocksSight(v(-20, 1.6, -26), v(-20, 4.5, -26)), true);
  assert.equal(c.blocksSight(v(-24, 1.6, -26), v(-24, 4.5, -26)), false);
  c.addRamp(15, 3, 2, 5, 0, 0, 2.5);
  assert.equal(c.blocksSight(v(14.8, .80, 3), v(15.1, 1.75, 3)), true);
  assert.equal(c.blocksSight(v(14.8, 1.85, 3), v(15.1, 1.75, 3)), false);
});

test('gaze requires both aim and line of sight; peripheral views still count as visible', () => {
  const p = spot('silhouette', 0, -17);
  const { collision, feet, view, watcher } = harness([p]);
  turn(view, feet, eyes(p));
  watcher.sight.capture(view);
  assert.deepEqual(watcher.sight.observe(p), { visible: true, gaze: true, beam: true });
  view.rotateY(.31);
  watcher.sight.capture(view);
  assert.deepEqual(watcher.sight.observe(p), { visible: true, gaze: false, beam: true });
  const panes = new CollisionWorld();
  panes.addBox(0, -8, 4, .06, .17, 0, 3.4);
  const withGlass = new WatcherSight(collision, panes);
  turn(view, feet, eyes(p));
  withGlass.capture(view);
  assert.equal(withGlass.canFixate(p), true);
  assert.deepEqual(withGlass.observe(p), { visible: false, gaze: false, beam: false });
});

test('arrives off-camera, holds a short look, resets on glance away, tilts and vanishes on a sustained stare', () => {
  const front = spot('front', 0, -22), side = spot('side', 24, 0), other = spot('other', -23, 3);
  const { view, feet, watcher, run, model } = harness([front, side, other]);
  run(11);
  assert.equal(watcher.phase, 'waiting');
  run(7);
  assert.equal(watcher.phase, 'watching');
  assert.notEqual(watcher.place.id, front.id);
  assert.equal(watcher.sight.outsideView(watcher.place, .135), true);
  const first = watcher.place;
  turn(view, feet, eyes(first));
  run(1.7);
  assert.ok(watcher.stare > 1.5 && watcher.stare < 2);
  assert.equal(model.amount, 0);
  view.rotateY(.22);
  run(.25);
  assert.equal(watcher.stare, 0);
  assert.equal(watcher.phase, 'watching');
  turn(view, feet, eyes(first));
  run(3.35);
  assert.ok(model.amount > .17 && model.amount < .43);
  assert.ok(model.group.position.equals(first.pos), 'The body never advances toward the observer');
  assert.equal(watcher.lastSeen.id, first.id);
  run(2.9);
  assert.equal(watcher.lastVanish.reason, 'stare');
  assert.equal(model.group.visible, false);
  turn(view, feet, v(0, 1.61, -5));
  run(watcher.nextSearch - watcher.time - .3);
  assert.equal(watcher.phase, 'waiting');
  run(.44);
  assert.equal(watcher.phase, 'watching');
  assert.notEqual(watcher.place.id, first.id);
  assert.equal(watcher.sight.outsideView(watcher.place, .135), true);
});

test('sprinting past the apparition cannot collide; it vanishes well before touch with a possible long absence', () => {
  const at = spot('road', 22, 0, { kind: 'road' });
  const { watcher, view, run, state, collision, model } = harness([at]);
  const player = new PlayerController({ collision, spawn: state.feet });
  state.feet = player.position;
  run(18);
  assert.equal(watcher.place.id, at.id);
  watcher.random = () => .05;
  const original = collision.solids.length;
  let gap;
  for (let frame = 0; frame < 340; frame++) {
    for (let i = 0; i < 2; i++) player.step(1 / 120, { forward: 1, sprint: true }, -Math.PI / 2);
    turn(view, player.position, eyes(at));
    state.running = player.sprinting;
    watcher.update(1 / 60, state);
    if (!model.group.visible && gap == null) gap = player.position.distanceTo(at.pos);
  }
  assert.equal(watcher.lastVanish.reason, 'approach');
  assert.ok(gap > 5.9, `Too close: ${gap}`);
  assert.ok(player.position.x > 29);
  assert.equal(player.position.y, 0);
  assert.equal(collision.solids.length, original);
  assert.ok(watcher.nextSearch - watcher.lastVanish.time > 120);
});

test('a hidden step has support, avoids the trunk and freezes immediately if the camera returns', () => {
  const cover = { x: 22, z: 10 }, hiding = spot('tree', 23.56, 11.15, { kind: 'tree', cover });
  const feet = v(0, 0, 10), collision = new CollisionWorld();
  collision.addCircle(cover.x, cover.z, .58, 7);
  const { watcher, model, view, run } = harness([hiding], { collision, feet });
  run(18);
  turn(view, feet, eyes(hiding));
  run(.65);
  assert.equal(watcher.lastSeen.id, hiding.id);
  turn(view, feet, v(0, 1.61, 0));
  run(1.25);
  assert.equal(watcher.phase, 'withdrawing');
  const { from, to } = watcher.route;
  assert.equal(clearWithdrawal(collision, from, to, hiding.scale), true);
  assert.equal(watcher.sight.hasLine({ ...hiding, pos: to, yaw: watcher.route.yaw }), false);
  assert.ok(clearWithdrawal(collision, from, v(21, 0, 9.5), 1) === false, 'May not move through a trunk');
  run(.4);
  assert.ok(model.steps > 0);
  const freeze = model.group.position.clone();
  assert.equal(hasWatcherClearance(collision, freeze, 1), true);
  turn(view, feet, freeze.clone().add(v(0, 2.81, 0)));
  run(.05);
  assert.equal(watcher.phase, 'watching');
  assert.ok(model.group.position.equals(freeze));
  turn(view, feet, v(0, 1.61, 0));
  run(3.25);
  assert.equal(model.group.visible, false);
  assert.ok(['lost', 'cover'].includes(watcher.lastVanish.reason));
});

test('sometimes the flashlight finds nothing; it still toggles normally', () => {
  const { watcher, view, feet, state, run, model, cues } = harness(undefined, { torch: false, random: () => .30 });
  const camera = new FirstPersonCamera(view);
  camera.toggle();
  turn(view, feet, v(0, 1.61, -9));
  run(18);
  assert.ok(watcher.torchShy);
  turn(view, feet, eyes(watcher.place));
  run(.8);
  assert.equal(model.group.visible, true);
  assert.equal(watcher.seenInDark, true);
  state.torch = camera.toggle();
  run(.05);
  assert.equal(watcher.lastVanish.reason, 'light');
  assert.equal(model.group.visible, false);
  assert.equal(camera.torch.intensity, camera.power);
  assert.equal(cues.length, 0, 'A silent encounter does not force any cue');
});

test('crossing a building threshold cancels a sighting; a hallway encounter is same-floor and starts off view', () => {
  const hall = spot('far end of corridor', 8, 0, { kind: 'hall', siteId: 'school', scale: .75, pose: 'hunched' });
  const upstairs = spot('wrong floor', 9, 0, { kind: 'hall', siteId: 'school', scale: .75, pos: v(9, 2.925, 0) });
  const { watcher, state, run, model } = harness([spot('outdoors', 24, 0), hall, upstairs]);
  run(18);
  assert.equal(watcher.place.id, 'outdoors');
  state.roomId = 'school';
  run(.05);
  assert.equal(watcher.lastVanish.reason, 'threshold');
  assert.equal(model.group.visible, false);
  watcher.random = () => .18;
  run(watcher.nextSearch - watcher.time + .2);
  assert.equal(watcher.phase, 'watching');
  assert.equal(watcher.place.id, hall.id);
  assert.equal(watcher.sight.outsideView(watcher.place, .135), true);
});

test('runners only get far marks; idle waiting and active gaze cap sight-query work', () => {
  const { collision, watcher, state, view, feet } = harness([spot('close', 12, 0), spot('far', 41, 0, { kind: 'field' })],
    { random: seededRandom(71) });
  const ray = collision.blocksSight.bind(collision);
  let rays = 0;
  collision.blocksSight = (...args) => { rays++; return ray(...args); };
  state.running = true;
  for (let i = 0; i < 60; i++) watcher.update(1 / 60, state);
  assert.equal(rays, 0);
  watcher.update(23, state);
  assert.equal(watcher.place.id, 'far');
  assert.ok(rays <= 18 * 6);
  turn(view, feet, eyes(watcher.place));
  rays = 0;
  for (let i = 0; i < 60; i++) watcher.update(1 / 60, state);
  assert.ok(rays >= 8 && rays <= 11, `Unexpected active casts: ${rays}`);
  const time = watcher.time;
  watcher.pause();
  assert.equal(watcher.stare, 0);
  assert.equal(watcher.time, time);
});

test('the rendered actor is a textured skinned sculpt with a stable rest pose and animated head/legs', () => {
  const image = () => ({ file: 'actor', albedo: new Texture(), normal: new Texture(), orm: new Texture() });
  const actor = createWatcherModel({ watcherSkin: image(), watcherCloth: image(), watcherFace: image() }, { compact: true });
  const { mesh, group } = actor, g = mesh.geometry;
  assert.equal(mesh.isSkinnedMesh, true);
  assert.equal(group.visible, false);
  assert.equal(mesh.castShadow, false);
  assert.equal(mesh.receiveShadow, true);
  assert.ok(mesh.material.every((m) => m.map && m.normalMap && m.aoMap));
  assert.ok(g.index.count / 3 > 10_000 && g.index.count / 3 < 18_000);
  assert.ok(mesh.skeleton.bones.length >= 16);
  for (const key of ['position', 'normal', 'uv', 'skinWeight']) assert.ok(g.getAttribute(key).array.every(Number.isFinite), key);
  const weights = g.getAttribute('skinWeight');
  for (let i = 0; i < weights.count; i++) assert.ok(Math.abs(weights.getX(i) + weights.getY(i) - 1) < 1e-6);
  actor.hold(1, 'standing');
  const skull = mesh.skeleton.bones.find((bone) => bone.name === 'skull');
  const base = skull.rotation.z;
  actor.tilt(0);
  assert.equal(skull.rotation.z, base);
  actor.tilt(.32);
  assert.ok(skull.rotation.z > base + .30);
  const leg = mesh.skeleton.bones.find((bone) => bone.name === 'thigh L');
  actor.step(.25);
  assert.ok(leg.rotation.x > .20);
  actor.dispose();
});

test('rare close sightings appear behind the view and an old mark can echo only after a long absence', () => {
  const past = spot('remembered verge', 24, 0), reverse = spot('behind a wall', 0, 12.5, { kind: 'wall' });
  const { watcher, run, view, feet, state } = harness([past, reverse]);
  run(18);
  assert.equal(watcher.place.id, past.id);
  turn(view, feet, eyes(past));
  run(6);
  assert.equal(watcher.lastSeen.id, past.id);
  turn(view, feet, v(0, 1.61, -5));
  watcher.random = () => .04;
  run(watcher.nextSearch - watcher.time + .15);
  assert.equal(watcher.place.id, reverse.id);
  assert.ok(watcher.sight.bearing(watcher.place) < -.8);
  assert.ok(feet.distanceTo(watcher.place.pos) > 9);
  // Leave the second silhouette unnoticed, and return much later to the first.
  run(90);
  assert.equal(watcher.lastSeen.id, past.id);
  watcher.random = () => .5;
  watcher.update(181, state);
  assert.equal(watcher.place.id, past.id);
});

test('a long, selected echo may reuse a remembered mark before the normal repeat window', () => {
  const remembered = spot('last seen at the hedge', 24, 0);
  const { watcher, feet, view, run } = harness([remembered]);
  run(18);
  turn(view, feet, eyes(remembered));
  run(.7);
  assert.equal(watcher.lastSeen.id, remembered.id);
  const cooldownChoices = [.95, .12, .30];
  watcher.random = () => cooldownChoices.shift() ?? .5;
  feet.set(19, 0, 0);
  run(.05);
  assert.equal(watcher.lastVanish.reason, 'approach');
  assert.ok(watcher.nextSearch - watcher.time > 150);
  feet.set(0, 0, 0);
  turn(view, feet, v(0, 1.61, -5));
  run(watcher.nextSearch - watcher.time - .22);
  assert.equal(watcher.phase, 'waiting');
  const draw = [.5, .5, .5, .075]; // medium range, not rear, rare echo roll
  watcher.random = () => draw.shift() ?? .5;
  run(.4);
  assert.ok(watcher.time - watcher.recent[0].time < 180);
  assert.equal(watcher.place.id, remembered.id);
});

test('one quiet ambient cue per non-silent encounter originates at the apparition', () => {
  const { watcher, run, cues } = harness(undefined, { random: () => .55 });
  run(19);
  assert.equal(watcher.phase, 'watching');
  assert.equal(cues.length, 0, 'No sting on appearance');
  run(24);
  assert.equal(cues.length, 1);
  const [{ kind, position, clarity }] = cues;
  assert.ok(['breath', 'whisper', 'creak', 'steps'].includes(kind));
  assert.equal(position.x, watcher.place.pos.x);
  assert.equal(position.z, watcher.place.pos.z);
  assert.ok(position.y > 0 && position.y < 3 && clarity <= .91);
});


test('a peripheral encounter can step visibly away but freezes on direct gaze without moving the authored mark', () => {
  const mark = spot('farm edge', 24, 0);
  const { watcher, state, view, feet, model, run, collision } = harness([mark], { walk: true, random: () => .49 });
  run(18);
  assert.equal(watcher.phase, 'watching');
  assert.equal(watcher.sight.outsideView(watcher.place), true);
  const origin = mark.pos.clone();
  turn(view, feet, eyes(mark));view.rotateY(.26);
  run(4.2);
  assert.equal(watcher.phase, 'crossing');
  assert.ok(model.travel > .1);
  const moved = model.group.position.clone();
  assert.ok(feet.distanceTo(moved) > feet.distanceTo(origin));
  assert.equal(hasWatcherClearance(collision, moved, 1), true);
  assert.equal(clearWithdrawal(collision, watcher.route.from, watcher.route.to, 1, true), true);
  turn(view, feet, eyes(watcher.place));
  watcher.update(.05, state);
  assert.equal(watcher.phase, 'watching');
  assert.ok(model.group.position.equals(moved));
  assert.ok(mark.pos.equals(origin));
  assert.equal(collision.solids.length, 0);
});

test('visible movement is skipped when a wall blocks all viable routes or reduced motion is on', () => {
  for (const reducedMotion of [false, true]) {
    const collision = new CollisionWorld(), mark = spot('field verge', 24, 0);
    if (!reducedMotion) collision.addBox(25, 0, .44, 12, 0, 0, 4, 'wall');
    const { watcher, feet, view, model, run } = harness([mark], { walk: true, collision, reducedMotion, random: () => .49 });
    run(18);
    turn(view, feet, eyes(mark));view.rotateY(.26);
    run(6);
    assert.equal(watcher.phase, 'watching');
    assert.ok(model.group.position.equals(mark.pos));
    assert.equal(model.travel, undefined);
  }
});

test('an eye discovery requires unoccluded frontal gaze, not just a visible silhouette', () => {
  const heard = [], mark = spot('eye-level reveal', 24, 0);
  const { watcher, collision, feet, view, run } = harness([mark], { torch: false, random: () => .48,
    onReveal: (at, distance) => heard.push({ at: at.clone(), distance }) });
  run(18);
  assert.equal(heard.length, 0);
  const occluder = collision.addBox(13, 0, .09, 2.1, 0, 2.1, 3.55);
  turn(view, feet, eyes(mark));
  run(.5);
  assert.equal(heard.length, 0, 'The lower body can still be visible while both eyes are hidden');
  occluder.bottom = 3.6;occluder.top = 4.6;
  run(.5);
  assert.equal(heard.length, 1);
  assert.equal(heard[0].distance, 24);
  assert.ok(heard[0].at.y > 2.75);
  run(1);
  assert.equal(heard.length, 1);
  assert.ok(watcher.model.group.position.equals(mark.pos));
});
