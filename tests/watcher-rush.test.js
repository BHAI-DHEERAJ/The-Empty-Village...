import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, PerspectiveCamera, Texture, Vector3 } from 'three';
import { ScareDirector } from '../src/game/interaction/ScareDirector.js';
import { PlayerController } from '../src/game/player/PlayerController.js';
import { PLAYER, WORLD } from '../src/game/settings.js';
import { CollisionWorld } from '../src/game/world/physics/CollisionWorld.js';
import { Watcher } from '../src/game/watcher/Watcher.js';
import { createWatcherModel } from '../src/game/watcher/WatcherModel.js';
import { RUSH_GAP, sweptGapSquared } from '../src/game/watcher/WatcherRush.js';

const FRAME = 1 / 60;
const mark = { id: 'main/road/test', kind: 'road', pos: new Vector3(WORLD.spawn.x,0,WORLD.spawn.z-11.5), scale: 1 };

function setup({ enabled = true, reducedMotion = false, spots = [mark] } = {}) {
  const collision = new CollisionWorld();
  const player = new PlayerController({ collision });
  const view = new PerspectiveCamera(64, 16 / 10, .065, 330);
  view.rotateY(Math.PI); // Our existing road mark is behind the camera at spawn.
  const model = { group: new Group(), poses: [], hold() {}, tilt() {}, step() {}, run(...pose) { this.poses.push(pose); } };
  model.group.visible = false;
  const sounds = [];
  const cue = (kind, at) => sounds.push({ kind, at: at.clone(), visible: model.group.visible });
  const director = new ScareDirector({ enabled, reducedMotion, random: () => .5, sound: cue });
  const watcher = new Watcher({ collision, spots }, model, { reducedMotion, random: () => .5, scareDirector: director, onCue: cue });
  const state = { view, feet: player.position, running: false, grounded: true, seated: false };
  function step(dt = FRAME) {
    view.position.copy(player.position).y += 1.61;
    director.update(dt, view, { seated: state.seated });
    watcher.update(dt, state);
  }
  function spotWatcher() {
    for (let i = 0; i < 1300 && watcher.phase === 'waiting'; i++) step();
    assert.equal(watcher.phase, 'watching');
    assert.equal(watcher.sight.outsideView(watcher.place,.135), true);
    view.quaternion.identity();
  }
  function waitForRush() {
    spotWatcher();
    const position = model.group.position.clone(), id = watcher.place.id;
    for (let i=0;i<60;i++) step();
    assert.equal(watcher.phase,'watching','A glance alone never starts a charge');
    assert.ok(model.group.position.equals(position));
    for (let i = 0; i < 65 && watcher.phase !== 'rushing'; i++) step();
    assert.equal(watcher.phase, 'rushing');
    assert.equal(watcher.place.id,id,'The encounter keeps the original mark');
    assert.ok(model.group.position.equals(position),'The rush must start from the visible pose');
  }
  return { watcher, state, view, player, model, sounds, collision, director, step, spotWatcher, waitForRush };
}

test('the already visible Watcher sprints with reaching arms, then cuts straight to invisible', () => {
  const { watcher, player, view, model, sounds, collision, director, step, waitForRush } = setup();
  waitForRush();
  const start = model.group.position.clone(), feet = player.position.clone();
  const rotation = view.quaternion.clone(), velocity = player.velocity.clone();
  const time = watcher.time, solidCount = collision.solids.length;
  assert.ok(start.z < feet.z - 9);
  assert.equal(director.level, 0, 'Never cover the start of the motion with an overlay');
  let lastGap = feet.distanceTo(start);
  while (watcher.phase === 'rushing' && watcher.time - time < 2) {
    step();
    if (model.group.visible) {
      const gap = feet.distanceTo(model.group.position);
      assert.ok(gap <= lastGap && gap >= RUSH_GAP);
      lastGap = gap;
    }
  }
  assert.equal(watcher.lastVanish.reason, 'rush');
  assert.ok(watcher.time - time < 1.4);
  assert.ok(lastGap < RUSH_GAP + .23, `Last visible pose was ${lastGap}m away`);
  assert.ok(model.poses.some(([, effort, reach]) => effort > .9 && reach > .97));
  assert.equal(model.group.visible, false);
  assert.equal(watcher.place, null);
  assert.ok(sounds.filter(({ kind }) => kind === 'rush-step').length >= 3);
  assert.deepEqual(sounds.filter(({ kind }) => kind === 'scare-rush').map(s => s.visible), [false]);
  assert.ok(player.position.equals(feet) && player.velocity.equals(velocity) && view.quaternion.equals(rotation));
  assert.equal(collision.solids.length, solidCount);
  assert.ok(watcher.rushReadyAt - watcher.time > 100 && director.availableAt - director.time > 45);
  step(FRAME);
  assert.equal(model.group.visible, false);
});

test('there is no in-view summon, off-screen rush, or charge from accumulated glances', () => {
  const empty = setup({spots: []});
  empty.view.quaternion.identity();
  const front = setup();
  front.view.quaternion.identity();
  for (let i=0;i<2200;i++){empty.step();front.step();}
  assert.equal(empty.watcher.phase,'waiting');
  assert.equal(front.watcher.phase,'waiting','A visible spawn mark never manifests into the camera');
  assert.equal(front.director.availableAt,0);

  const { watcher, view, step, spotWatcher } = setup();
  spotWatcher();
  for(let i=0;i<43;i++)step();
  view.rotateY(.53);
  for(let i=0;i<12;i++)step();
  view.quaternion.identity();
  for(let i=0;i<53;i++)step();
  assert.equal(watcher.phase,'watching','Time spent looking away resets the windup trigger');
  for(let i=0;i<42&&watcher.phase!=='rushing';i++)step();
  assert.equal(watcher.phase,'rushing');
});

test('forward sprint input and a dropped frame cannot let the Watcher overlap or stop the player', () => {
  const { watcher, state, player, model, step, waitForRush } = setup();
  waitForRush();
  const at = model.group.position.clone();
  for (let frame = 0; frame < 12; frame++) {
    for (let i = 0; i < 18; i++) player.step(1 / 120, { forward: 1, sprint: true }, 0);
    state.running = player.sprinting;
    step(.15);
    if (model.group.visible) assert.ok(player.position.distanceTo(model.group.position) >= RUSH_GAP);
  }
  assert.equal(watcher.lastVanish.reason, 'rush');
  assert.equal(model.group.visible, false);
  assert.ok(player.position.z < WORLD.spawn.z - 8.2);
  for (let i=0;i<80;i++) player.step(1/120,{ forward: 1, sprint: true },0);
  assert.ok(player.position.z < at.z, 'The path remains walkable even through the old start mark');
  assert.equal(sweptGapSquared(new Vector3(3,0,0),new Vector3(-3,0,0),new Vector3(),new Vector3()),0,
    'Even a crossing that misses both endpoint checks is clipped');
});

test('sidestepping and retreating does not cause a turn, a second lunge, or a chase', () => {
  const { watcher, view, player, model, step, waitForRush } = setup();
  waitForRush();
  const { x } = model.group.position, yaw = model.group.rotation.y;
  for (let i = 0; i < 95; i++) {
    player.position.x += .035;
    player.position.z += .036;
    view.position.copy(player.position).y += 1.61;
    view.lookAt(model.group.position.clone().add(new Vector3(0,1.62,0)));
    step();
    if (model.group.visible) {
      assert.equal(model.group.rotation.y, yaw);
      assert.ok(Math.abs(model.group.position.x - x) < 1e-8);
    }
  }
  assert.equal(watcher.lastVanish.reason, 'rush');
  assert.equal(model.group.visible, false);
});

test('a thin fence vetoes a charge; a new obstacle or looking away interrupts it silently', () => {
  const blocked = setup();
  blocked.collision.addBox(WORLD.spawn.x,-2,11,.08,0,0,.68);
  blocked.spotWatcher();
  for (let i=0;i<185;i++) blocked.step();
  assert.equal(blocked.watcher.phase, 'watching');
  assert.equal(blocked.director.availableAt, 0, 'No scare cooldown consumed by a blocked route');

  for (const interrupt of ['obstacle','turn','pause','opt-out']) {
    const { watcher, view, model, sounds, collision, director, step, waitForRush } = setup();
    waitForRush();
    for(let i=0;i<23;i++)step();
    if (interrupt === 'obstacle') collision.addBox(WORLD.spawn.x,model.group.position.z + .7,6,.05,0,0,1.1);
    if (interrupt === 'turn') view.rotateY(Math.PI);
    if (interrupt === 'pause') watcher.pause();
    if (interrupt === 'opt-out') director.setEnabled(false);
    for (let i=0;i<8;i++)step();
    assert.equal(watcher.lastVanish.reason, 'rush-cancelled', interrupt);
    assert.equal(model.group.visible, false);
    assert.equal(director.rushing, false);
    assert.equal(director.level, 0);
    assert.ok(!sounds.some(s => s.kind === 'scare-rush'));
  }
});

test('the rush is outdoors only and settings leave ordinary sightings available', () => {
  const side = { id: 'ordinary', kind: 'tree', pos: new Vector3(25,0,1.5), scale: 1 };
  for (const options of [{ reducedMotion: true }, { enabled: false }]) {
    const { model, director, watcher, step } = setup({ ...options, spots: [side] });
    for(let i=0;i<1200;i++)step();
    assert.equal(watcher.phase, 'watching');
    assert.equal(model.group.visible, true);
    assert.equal(watcher.place.id, side.id);
    assert.equal(director.beginRush(), false);
  }
  const { watcher, state, step, director, spotWatcher } = setup();
  state.seated = true;
  spotWatcher();
  for(let i=0;i<175;i++)step();
  assert.equal(watcher.phase,'watching');
  state.seated = false;
  state.roomId = 'school';
  for(let i=0;i<180;i++)step();
  assert.equal(watcher.phase,'waiting');
  assert.ok(director.canRush);
});

test('the rig pumps both arms, extends them toward the player, and stays inside the cutoff clearance', () => {
  const map = { file: 'test map', albedo: new Texture(), normal: new Texture(), orm: new Texture(), tile: [1,1] };
  const actor = createWatcherModel({ watcherCloth: map, watcherSkin: map, watcherFace: map }, { compact: true });
  const bone = name => actor.mesh.skeleton.bones.find(part => part.name === name);
  actor.hold(1,'standing');
  actor.run(.25,1,0);
  const l = bone('upper arm L').rotation.x, r = bone('upper arm R').rotation.x;
  actor.run(.75,1,0);
  assert.ok((l-r) * (bone('upper arm L').rotation.x - bone('upper arm R').rotation.x) < 0);
  const vertex = new Vector3(), hand = new Vector3();
  for(let f=0;f<20;f++){
    actor.run(f/20,1,.6+(f%3)*.20);
    actor.group.updateMatrixWorld(true);
    actor.mesh.skeleton.update();
    if(f%3===2)assert.ok(bone('hand L').getWorldPosition(hand).z > 1);
    let radius = 0;
    for(let i=0;i<actor.mesh.geometry.attributes.position.count;i++){
      actor.mesh.getVertexPosition(i, vertex);
      radius = Math.max(radius, Math.hypot(vertex.x, vertex.z));
    }
    assert.ok(radius + PLAYER.radius < RUSH_GAP, `Reach plus collision radius: ${radius + PLAYER.radius}`);
  }
  actor.dispose();
});
