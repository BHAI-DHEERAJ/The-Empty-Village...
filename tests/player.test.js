import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlayerController } from '../src/game/player/PlayerController.js';
import { PLAYER, WORLD } from '../src/game/settings.js';

const STEP = 1 / 120;
const origin = { x: 0, y: 0, z: 0 };
function advance(player, frames, input = {}, yaw = 0) {
  for (let frame = 0; frame < frames; frame += 1) player.step(STEP, input, yaw);
}
const closeTo = (actual, expected, margin = .001) => assert.ok(Math.abs(actual - expected) <= margin, `${actual} ≉ ${expected}`);

for (const [key, input, axis, sign] of [
  ['W', { forward: 1 }, 'z', -1], ['A', { right: -1 }, 'x', -1],
  ['S', { forward: -1 }, 'z', 1], ['D', { right: 1 }, 'x', 1],
]) {
  test(`${key} moves in its direction, and releasing it brakes`, () => {
    const player = new PlayerController({ spawn: origin });
    advance(player, 120, input);
    assert.ok(player.position[axis] * sign > 3);
    closeTo(player.position.y, 0);
    advance(player, 120);
    closeTo(player.velocity.length(), 0);
  });
}

test('movement follows camera yaw and normalizes diagonal speed', () => {
  const player = new PlayerController({ spawn: origin });
  advance(player, 120, { forward: 1 }, -Math.PI / 2);
  assert.ok(player.position.x > 3);
  closeTo(player.position.z, 0);
  advance(player, 120, { forward: 1, right: 1 });
  closeTo(player.velocity.length(), PLAYER.speed);
});

test('jump goes up, a midair press does not add lift, and gravity lands on the ground', () => {
  const player = new PlayerController();
  player.step(STEP, { jump: true });
  assert.equal(player.grounded, false);
  assert.ok(player.position.y > 0);
  advance(player, 33);
  assert.ok(player.position.y > .75 && player.position.y < .86);
  const before = player.velocity.y;
  player.step(STEP, { jump: true });
  assert.ok(player.velocity.y < before);
  advance(player, 100);
  assert.equal(player.position.y, WORLD.groundY);
  assert.equal(player.velocity.y, 0);
  assert.equal(player.grounded, true);
  player.step(STEP, { jump: true });
  assert.equal(player.grounded, false);
});

test('trunks block movement without letting the player sink or pass through', () => {
  const player = new PlayerController({ spawn: origin, colliders: [{ x: 0, z: -2, radius: .6, yMax: 9 }] });
  advance(player, 420, { forward: 1 });
  closeTo(player.position.z, -2 + .6 + PLAYER.radius);
  closeTo(player.velocity.length(), 0);
  advance(player, 120, { forward: 1, right: 1 });
  assert.ok(player.position.x > 2);
  assert.ok(player.position.z < -2);
});

test('the character stays on the flat world at its outer edge', () => {
  const player = new PlayerController({ spawn: origin, limit: 4 });
  advance(player, 480, { forward: 1, right: -1 });
  closeTo(player.position.x, -4 + PLAYER.radius);
  closeTo(player.position.z, -4 + PLAYER.radius);
  closeTo(player.position.y, 0);
});


test('sprint is faster than walking and does not boost jumps or backwards movement', () => {
  const p=new PlayerController({spawn:origin});
  advance(p,120,{forward:1,sprint:true});
  closeTo(p.velocity.length(),PLAYER.sprintSpeed);
  assert.equal(p.sprinting,true);
  p.step(STEP,{forward:1,sprint:true,jump:true});
  assert.equal(p.grounded,false);
  p.step(STEP,{forward:1,sprint:true});
  assert.equal(p.sprinting,false);
  advance(p,120,{forward:-1,sprint:true});
  closeTo(p.velocity.length(),PLAYER.speed);
});
