import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { FirstPersonCamera } from '../src/game/camera/FirstPersonCamera.js';
import { HingedDoor } from '../src/game/interaction/HingedDoor.js';
import { InteractionController, makeSeat } from '../src/game/interaction/InteractionController.js';
import { MissionLog, MISSIONS } from '../src/game/interaction/MissionLog.js';
import { ScareDirector } from '../src/game/interaction/ScareDirector.js';
import { PlayerController } from '../src/game/player/PlayerController.js';
import { CAMERA } from '../src/game/settings.js';
import { CollisionWorld } from '../src/game/world/physics/CollisionWorld.js';

const v = (x, y, z) => new Vector3(x, y, z);
const aim = (view, from, to) => { view.position.copy(from).add(v(0, CAMERA.eye, 0)); view.lookAt(to); };

function hinge(collision) {
  return new HingedDoor({ id: 'hinge', x: 7.05, y: 0, z: -.19, yaw: 0, collision,
    leaves: [{ object: new Group(), edge: -.72, width: 1.38, centre: .69, low: .04, high: 2.14, openAngle: -Math.PI / 2 }] });
}

test('a hinged door updates the visible leaf, physics and occlusion inside the same swept grid cells', () => {
  const collision = new CollisionWorld(), door = hinge(collision), who = new PlayerController({ collision, spawn: v(7.05, 0, -1.62) });
  const front = v(7.05, 1.55, -2), back = v(7.05, 1.55, 2), cues = [];
  const use = () => door.use({ player: who, cue: (type) => cues.push(type) });
  assert.equal(collision.blocksSight(front, back), false);
  assert.equal(use(), null);
  for (let i = 0; i < 60; i++) door.tick(1 / 60, who);
  assert.equal(Math.abs(door.leaves[0].object.rotation.y), 0);
  assert.equal(door.label, 'दरवाज़ा खोलो');
  assert.equal(collision.blocksSight(front, back), true);
  assert.equal(collision.blocksSight(front, back, door.colliders), false, 'Only its own action ignores the leaf');
  for (let i = 0; i < 120; i++) who.step(1 / 120, { forward: 1 }, Math.PI);
  assert.ok(who.position.z < -.49, `Closed door did not stop the player: ${who.position.z}`);
  assert.equal(use(), null);
  for (let i = 0; i < 60; i++) door.tick(1 / 60, who);
  assert.equal(door.leaves[0].object.rotation.y, -Math.PI / 2);
  assert.equal(collision.blocksSight(front, back), false);
  for (let i = 0; i < 120; i++) who.step(1 / 120, { forward: 1 }, Math.PI);
  assert.ok(who.position.z > .9);
  assert.equal(collision.solids.length, 1);
  assert.deepEqual(cues, ['latch', 'hinge']);
});

test('a door cannot swing into a player, even when they walk into its path after activation', () => {
  const door = hinge(new CollisionWorld());
  const p = { position: v(7.02, 0, .42) }, cue = () => {};
  assert.equal(door.use({ player: p, cue }), 'पहले दरवाज़े से थोड़ा हटो।');
  assert.equal(door.progress, 1);
  p.position.z = -2;
  assert.equal(door.use({ player: p, cue }), null);
  p.position.z = .42;
  for (let i = 0; i < 100; i++) door.tick(1 / 60, p);
  assert.ok(door.progress > .1 && door.progress < 1);
  const stopped = door.progress;
  assert.equal(door.tick(.1, p), false);
  assert.equal(door.progress, stopped);
  p.position.z = -2;
  for (let i = 0; i < 60; i++) door.tick(1 / 60, p);
  assert.equal(door.progress, 0);
});

test('use always rechecks live aim and line of sight instead of trusting a stale prompt', () => {
  const c = new CollisionWorld(), windows = new CollisionWorld(), view = new PerspectiveCamera();
  const p = { position: v(0, 0, 0) }, at = v(0, 1.43, -2), action = { id: 'a', at, range: 2.7, label: 'Read', use() { uses++; } };
  let uses = 0;
  const i = new InteractionController({ actions: [action], collision: c, windowOcclusion: windows });
  aim(view, p.position, at);
  assert.equal(i.prompt(1, view, true).label, 'Read');
  view.rotateY(.7);
  assert.equal(i.prompt(1.03, view, true).label, 'Read', 'Prompt ticks are intentionally throttled');
  i.activate(view, p);assert.equal(uses, 0);
  aim(view, p.position, at);
  windows.addBox(0, -1, 3, .1, 0, 1.2, 1.85);
  i.activate(view, p);assert.equal(uses, 0, 'Opaque glazing blocks use');
  c.addBox(.5, -2, .12, 3, 0, 0, 4);
  view.position.set(.75, CAMERA.eye, -1.81);view.lookAt(at);
  i.activate(view, p);assert.equal(uses, 0, 'A solid wall blocks use');
  view.position.set(0, CAMERA.eye, -1.22);view.lookAt(at);
  i.activate(view, p);assert.equal(uses, 1);
});

test('seating changes the first-person camera but not the supported player stance and exits on movement', () => {
  const c = new CollisionWorld(), view = new PerspectiveCamera(64), cam = new FirstPersonCamera(view);
  const p = new PlayerController({ collision: c, spawn: v(0, 0, 0) }), stance = p.position.clone();
  const chair = makeSeat({ id: 'chair', name: 'Chair', at: v(0, .467, -1.5) });
  const i = new InteractionController({ actions: [chair], collision: c });
  aim(view, p.position, chair.focusAt);
  p.grounded = false;assert.equal(i.activate(view, p), 'बैठने से पहले ज़मीन पर उतरो।');
  p.grounded = true;
  assert.equal(i.activate(view, p), null);
  assert.equal(i.prompt(0, view, true).label, 'उठ जाओ');
  cam.reset(p.position);
  for (let j = 0; j < 50; j++) cam.update(1 / 60, p, j / 60, i.cameraAnchor());
  assert.ok(Math.abs(view.position.y - 1.237) < .001);
  assert.ok(view.position.z < -1.43);
  assert.ok(p.position.equals(stance));
  const command = i.movement({ forward: 1, right: 0 }, false, p);
  assert.equal(command.movement.forward, 1);
  assert.equal(i.seated, null);
  assert.equal(p.grounded, true);
  assert.ok(p.position.equals(stance));
});

test('the investigation and side mission persist independently and never skip a missing clue', () => {
  const m = new Map(), storage = { getItem: m.get.bind(m), setItem: m.set.bind(m) };
  const journal = new MissionLog(storage);
  assert.equal(journal.current.id, 'gate-notice');
  journal.use({ id: 'mansion-radio', kind: 'radio' });
  assert.equal(journal.progress, 0);
  const swing = { id: 'west', machine: { type: 'swing' } };
  assert.equal(journal.use(swing).yardChanged, true);
  assert.equal(journal.use(swing).yardChanged, false);
  assert.equal(new MissionLog(storage).yard, 1);
  assert.match(journal.use({ id: 'east', machine: { type: 'seesaw' } }).text, /छोटा काम पूरा/);
  for (const chapter of MISSIONS) {
    if (chapter.id === 'tractor-red') {
      assert.equal(journal.use({ id: chapter.id, kind: 'tractor', on: false }).chapter, undefined);
      assert.equal(journal.current, chapter);
    }
    assert.equal(journal.use({ id: chapter.id, kind: chapter.id === 'tractor-red' ? 'tractor' : 'evidence', on: true }).chapter, chapter);
    assert.equal(new MissionLog(storage).progress, journal.progress);
  }
  assert.equal(journal.current, null);
  assert.equal(journal.use({ id: 'well-tags', kind: 'evidence' }).readAgain, true);
  assert.equal(journal.progress, MISSIONS.length);
});

test('stray scares have local triggers, a shared cooldown, and a full opt-out', () => {
  const view = new PerspectiveCamera(), at = v(0, 1.2, -3), sounds = [];
  const director = new ScareDirector({ random: () => 0, sound: (kind, point) => sounds.push([kind, point.toArray()]) });
  let kicked = 0;
  director.queue('chain', 'swing', at, () => kicked++);
  aim(view, v(0, 0, 0), at);
  assert.equal(director.update(2.1, view), 0, 'Watching the empty seat delays the beat');
  view.rotateY(Math.PI);
  assert.equal(director.update(.1, view, { seated: true }), 0);
  assert.ok(director.update(.1, view) > 0);
  assert.equal(kicked, 1);
  assert.deepEqual(sounds, [['scare-metal', at.toArray()]]);
  assert.equal(director.update(.9, view), 0);
  director.queue('fading-radio', 'radio', at);
  director.update(34, view);
  assert.equal(director.reveal(at, 17), false, 'A different kind still respects the shared cooldown');
  director.update(20, view);
  assert.equal(director.reveal(at, 4), false);
  assert.equal(director.reveal(at, 17), true);
  director.setEnabled(false);
  assert.equal(director.update(.1, view), 0);
  director.queue('radio', 'radio', at, () => assert.fail('No motion when scares are off'));
  director.update(100, view);
  assert.equal(director.reveal(at, 17), false);
  assert.equal(sounds.length, 2);
  const reduced = new ScareDirector({ reducedMotion: true, sound: (kind) => sounds.push([kind]) });
  reduced.queue('radio', 'radio', at);
  assert.equal(reduced.update(.9, view), 0, 'Reduced motion avoids the visual accent');
  assert.deepEqual(sounds.at(-1), ['scare-radio']);
});
