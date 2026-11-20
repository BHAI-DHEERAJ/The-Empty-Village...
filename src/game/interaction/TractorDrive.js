import { MathUtils, Vector3 } from 'three';
import { PLAYER } from '../settings.js';
import { poseBox } from '../world/physics/CollisionWorld.js';
import { makeSeat } from './InteractionController.js';

const WIDTH = 1.69, LENGTH = 2.68;
const EXITS = [[1.27,-.65],[-1.27,-.65],[1.21,.15],[-1.21,.15],[.36,-1.87],[-.36,-1.87]];
const FORWARD = 5.1, REVERSE = 2.15;

export class TractorDrive {
  constructor({ id, name, model, wheels, lenses, collision, bounds }) {
    this.id = id; this.kind = 'tractor'; this.type = 'tractor'; this.name = name;
    this.model = model; this.wheels = wheels; this.lenses = lenses;
    this.collision = collision; this.bounds = bounds;
    const { x, y, z } = model.position;
    this.solid = collision.addMobileBox(x, z, WIDTH, LENGTH, this.yaw, y, y + 1.43, 'tractor');
    this.probe = { ...this.solid, w: this.solid.w + .048, d: this.solid.d + .048, bottom: y + .018, top: y + 1.91 };
    this.ignore = [this.solid];
    this.on = false; this.rpm = 0; this.travel = 0; this.speed = 0;
    this.range = 2.76;
    this.at = new Vector3(); this.source = new Vector3(); this.saddle = new Vector3();
    this.guide = new Vector3(); this.exit = new Vector3(); this.exitProbe = new Vector3(); this.zeros = new Vector3();
    this.seat = makeSeat({ id: `${id}/drive`, name, at: this.saddle, ignore: this.ignore, machine: this,
      label: 'ट्रैक्टर चलाओ', range: 2.35, eye: out => this.model.localToWorld(out.set(0, 1.79, -.689)) });
    this.seat.missionAction = this;
    this.#sync();
  }

  get yaw() { return this.model.rotation.y; }
  get load() { return Math.min(1, Math.abs(this.speed) / FORWARD); }
  get label() { return this.on ? 'ट्रैक्टर बंद करो' : 'ट्रैक्टर चालू करो'; }

  #sync() {
    const { x, y, z } = this.model.position;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    poseBox(this.solid, x, z, this.yaw);
    this.at.set(x + s * .43, y + 1.23, z + c * .43);
    this.source.set(x + s * .26, y + .84, z + c * .26);
    this.saddle.set(x - s * .76, y + 1.02, z - c * .76);
    this.seat.focusAt.copy(this.saddle).y += .24;
  }

  #switch(on, cue) {
    this.on = on;
    this.lenses.visible = on;
    cue(on ? 'ignition' : 'engine-off', this.source);
  }

  use({ cue }) { this.#switch(!this.on, cue); return null; }

  board(player, cue) {
    if (!this.findExit()) return 'यहाँ उतरने की जगह नहीं है।';
    this.speed = 0;
    this.blocked = null;
    player.position.copy(this.model.position);
    if (!this.on) this.#switch(true, cue);
    else cue('sit', this.saddle);
    return null;
  }

  park() { this.speed = 0; this.blocked = null; }

  findExit(pose = this.solid) {
    const y = this.model.position.y;
    const c = pose.c, s = pose.s;
    this.guide.set(pose.x - s * .66, y + 1.10, pose.z - c * .66);
    for (const [u,v] of EXITS) {
      const x = pose.x + c * u + s * v, z = pose.z - s * u + c * v;
      const floor = this.collision.supportAt(x, z, y + .18);
      if (Math.abs(floor - y) > .17 || !this.collision.headroomAt(x,z,floor+.009)) continue;
      this.exit.set(x,floor,z);
      this.exitProbe.copy(this.exit);
      this.collision.resolve(this.exitProbe,this.zeros.set(0,0,0),PLAYER.radius,PLAYER.height,this.solid);
      if (!this.exit.equals(this.exitProbe)) continue;
      this.exitProbe.y += 1.1;
      if (!this.collision.blocksSight(this.guide,this.exitProbe,this.ignore)) return this.exit;
    }
    return null;
  }

  #fits(body) {
    const b = this.bounds, h = this.model.position.y;
    for (const side of [-1,1]) for (const end of [-1,1]) {
      const u = side * body.w, v = end * body.d;
      const x = body.x + body.c * u + body.s * v, z = body.z - body.s * u + body.c * v;
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1 || Math.abs(this.collision.ground(x,z) - h) > .07) return 'खेत का किनारा · वापस मुड़ो';
    }
    if (this.collision.boxOccupied(body,this.solid) || !this.findExit(body)) return 'रास्ता बंद है · पीछे लो या मुड़ो';
    return null;
  }

  drive(dt, movement, player) {
    const throttle = MathUtils.clamp(movement.forward,-1,1);
    const request = throttle * (throttle < 0 ? REVERSE : FORWARD);
    this.speed = MathUtils.damp(this.speed,request,throttle ? 3.4 : 7,dt);
    if (Math.abs(this.speed) < .018) { this.speed = 0;this.blocked = null;return null; }
    const steer = MathUtils.clamp(movement.right,-1,1);
    const turn = -steer * Math.sign(this.speed) * Math.min(1.04,Math.abs(this.speed) * .69) * dt;
    const { x, z } = this.model.position;
    const yaw = this.yaw + turn, mid = this.yaw + turn * .5, step = this.speed * dt;
    const addX = Math.sin(mid) * step, addZ = Math.cos(mid) * step;
    // Test both the in-between and proposed poses. This prevents slipping the
    // corners through thin fences even while turning at the highest speed.
    poseBox(this.probe,x+addX*.5,z+addZ*.5,mid);
    let blocked = this.#fits(this.probe);
    if (!blocked) { poseBox(this.probe,x+addX,z+addZ,yaw);blocked=this.#fits(this.probe); }
    if (blocked) { this.speed = 0;this.blocked = blocked;return null; }
    this.blocked = null;
    this.model.position.x += addX;this.model.position.z += addZ;
    this.model.rotation.y = MathUtils.euclideanModulo(yaw+Math.PI,2*Math.PI)-Math.PI;
    this.travel += step;
    for (const wheel of this.wheels) {
      wheel.spin.rotation.x = this.travel / wheel.radius;
      wheel.pivot.rotation.y = wheel.front ? -.30 * steer : 0;
    }
    this.#sync();
    player.position.copy(this.model.position);
    return { turn };
  }
}
