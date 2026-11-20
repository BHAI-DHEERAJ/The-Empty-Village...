import { MathUtils, Vector3 } from 'three';
import { PLAYER } from '../settings.js';
import { poseBox, touchesBox } from '../world/physics/CollisionWorld.js';

export class HingedDoor {
  constructor({ id, x, y, z, yaw, noun = 'door', leaves, collision, opening }) {
    this.id = id;
    this.kind = 'door';
    this.name = noun === 'gate' ? 'लोहे का फाटक' : 'दरवाज़ा';
    this.at = new Vector3(x, y + 1.12, z);
    this.focusAt = new Vector3(x, y + Math.min(1.57, leaves[0].high), z);
    this.range = 2.7;
    this.noun = noun;
    this.opening = opening;
    this.progress = this.target = 1;
    this.leaves = leaves;
    this.colliders = [];
    this.yaw = yaw;
    for (const leaf of leaves) {
      leaf.hx = x + Math.cos(yaw) * leaf.edge;
      leaf.hz = z - Math.sin(yaw) * leaf.edge;
      leaf.solid = collision.addHingedBox(leaf.hx, leaf.hz, leaf.width, .118, y + leaf.low, y + leaf.high);
      leaf.probe = { ...leaf.solid };
      this.colliders.push(leaf.solid);
    }
    this.#apply();
  }

  get label() { if(this.locked?.())return 'ताला देखो';return `${this.noun === 'gate' ? 'फाटक' : 'दरवाज़ा'} ${this.target >= .5 ? 'बंद करो' : 'खोलो'}`; }
  setOpen(amount) { this.progress=this.target=amount;this.#apply(); }
  get moving() { return this.progress !== this.target; }

  #pose(leaf, progress, item) {
    const angle = leaf.openAngle * MathUtils.smoothstep(progress, 0, 1);
    const yaw = this.yaw + angle;
    poseBox(item, leaf.hx + leaf.centre * Math.cos(yaw), leaf.hz - leaf.centre * Math.sin(yaw), yaw);
    return angle;
  }

  #apply() {
    for (const leaf of this.leaves) leaf.object.rotation.y = this.#pose(leaf, this.progress, leaf.solid);
    if (this.proxy) this.proxy.visible = this.progress < .47;
  }

  #safeTravel(to, feet) {
    if (this.at.distanceToSquared(feet) > 4.4 ** 2) return true;
    // Check the swept arc, not just its two end positions. An interrupted
    // door stops and waits instead of pushing or pinning the player.
    const n = Math.max(1, Math.ceil(Math.abs(to - this.progress) * 34));
    for (const leaf of this.leaves) {
      // Contact with the *closed* leaf does not prevent opening it away from
      // the player. Use the extra padding only if it starts clear.
      const radius = touchesBox(leaf.solid, feet, PLAYER.radius + .035) ? PLAYER.radius - .0005 : PLAYER.radius + .035;
      for (let i = 1; i <= n; i++) {
        this.#pose(leaf, MathUtils.lerp(this.progress, to, i / n), leaf.probe);
        if (touchesBox(leaf.probe, feet, radius)) return false;
      }
    }
    return true;
  }

  use({ player, cue }) {
    if(this.locked?.()){
      cue('latch',this.at,.52);
      if(this.onLocked?.())return null;
      return this.lockedMessage??'ताला लगा है। चाबी ढूँढो।';
    }
    const to = this.target < .5 ? 1 : 0;
    if (!this.#safeTravel(to, player.position)) return `पहले ${this.noun === 'gate' ? 'फाटक' : 'दरवाज़े'} से थोड़ा हटो।`;
    this.target = to;
    cue(to ? 'hinge' : 'latch', this.at);
    return null;
  }

  tick(dt, player) {
    if (!this.moving) return false;
    const to = this.progress + Math.sign(this.target - this.progress) * Math.min(Math.abs(this.target - this.progress), dt * 1.34);
    if (!this.#safeTravel(to, player.position)) return false;
    this.progress = to;
    this.#apply();
    return true;
  }
}
