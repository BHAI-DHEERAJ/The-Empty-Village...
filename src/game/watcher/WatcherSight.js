import { Quaternion, Vector3 } from 'three';
import { WATCHER_HEIGHT, WATCHER_RADIUS } from './WatcherModel.js';

const LOOK_COS = Math.cos(5.8 * Math.PI / 180);
const BEAM_COS = Math.cos(.335);
// First three are the head, sternum and waist. The rest catch partially
// exposed shoulders/legs, for example beside a neem trunk or inside a window.
const points = [[0,.924,.078],[0,.740,.079],[0,.513,.024],[-.25,.748,0],[.25,.748,0],[0,.260,.016]];

export class WatcherSight {
  constructor(collision, windowOcclusion) {
    this.collision = collision;
    this.windows = windowOcclusion;
    this.eye = new Vector3();
    this.inverse = new Quaternion();
    this.probe = new Vector3();
    this.relative = new Vector3();
  }

  capture(view) {
    view.getWorldPosition(this.eye);
    view.getWorldQuaternion(this.inverse).invert();
    // getEffectiveFOV includes the camera's zoom (the sprint FOV is dynamic).
    this.tanY = Math.tan(view.getEffectiveFOV() * Math.PI / 360);
    this.tanX = this.tanY * view.aspect;
  }

  #local(x, y, z) {
    return this.relative.set(x, y, z).sub(this.eye).applyQuaternion(this.inverse);
  }

  #centre(spot) {
    return this.#local(spot.pos.x, spot.pos.y + WATCHER_HEIGHT * spot.scale * .5, spot.pos.z);
  }

  outsideView(spot, margin = 0) {
    const d = this.#centre(spot), depth = -d.z;
    const r = Math.hypot(WATCHER_RADIUS, WATCHER_HEIGHT * .5) * spot.scale + .12;
    const h = this.tanX + margin, v = this.tanY + margin;
    // Test the whole bounding sphere against an expanded perspective frustum.
    // A head just outside a screen edge is not enough to allow a spawn.
    return depth + r <= 0 || Math.abs(d.x) > depth * h + r * Math.hypot(1, h) ||
      Math.abs(d.y) > depth * v + r * Math.hypot(1, v);
  }

  screenX(spot) { const d=this.#centre(spot);return d.x/Math.max(.065,-d.z); }

  bearing(spot) {
    const d = this.#centre(spot);
    return -d.z / Math.max(.001, d.length());
  }

  #point(spot, i) {
    const [x, y, z] = points[i], { pos, scale, yaw = 0 } = spot;
    const s = Math.sin(yaw), c = Math.cos(yaw);
    return this.probe.set(pos.x + (x * c + z * s) * scale,
      pos.y + y * WATCHER_HEIGHT * scale, pos.z + (-x * s + z * c) * scale);
  }

  #blocked() {
    return this.collision.blocksSight(this.eye, this.probe) || this.windows?.blocksSight(this.eye, this.probe);
  }

  hasLine(spot) {
    for (let i = 0; i < points.length; i++) {
      this.#point(spot, i);
      if (!this.#blocked()) return true;
    }
    return false;
  }

  #project(i, spot) {
    const p = this.#point(spot, i);
    return this.#local(p.x, p.y, p.z);
  }

  canFixate(spot) {
    for (let i = 0; i < 3; i++) {
      const d = this.#project(i, spot);
      if (-d.z > .065 && -d.z >= d.length() * LOOK_COS) return true;
    }
    return false;
  }

  seesEyes(spot) {
    const { x, z } = spot.pos;
    const dx = this.eye.x - x, dz = this.eye.z - z, yaw = spot.yaw ?? 0;
    if (Math.sin(yaw) * dx + Math.cos(yaw) * dz < .41 * Math.hypot(dx, dz)) return false;
    const d = this.#project(0, spot), depth = -d.z;
    return depth > .065 && depth >= d.length() * LOOK_COS && !this.#blocked();
  }

  observe(spot) {
    let visible = false, gaze = false, beam = false;
    for (let i = 0; i < points.length; i++) {
      const d = this.#project(i, spot), depth = -d.z;
      if (depth < .065 || Math.abs(d.x) > this.tanX * depth || Math.abs(d.y) > this.tanY * depth) continue;
      const facing = depth / d.length();
      if (this.#blocked()) continue;
      visible = true;
      gaze ||= i < 3 && facing >= LOOK_COS;
      beam ||= facing >= BEAM_COS;
      if (gaze) break; // The narrower gaze cone also implies the beam cone.
    }
    return { visible, gaze, beam };
  }
}
