import { Vector3 } from 'three';

const AIM = .938;
const ZERO = Object.freeze({ forward: 0, right: 0, sprint: false });

// The render camera can sit on a chair or ride a swing. The physics capsule
// stays on a clear, supported dismount spot so nothing can strand the player.
export function makeSeat({ id, name, at, yaw = 0, ignore = [], eye, machine, range = 2.14, label }) {
  return {
    id, name, at, range, ignore, machine, kind: 'seat',
    focusAt: at.clone().setY(at.y + (machine?.type === 'swing' ? .62 : .28)),
    label: label ?? 'बैठो',
    eye: eye ?? ((out) => out.copy(at).add({ x: Math.sin(yaw) * .06, y: .77, z: Math.cos(yaw) * .06 })),
    use(context) { return context.mount(this); },
  };
}

export class InteractionController {
  constructor({ actions, collision, windowOcclusion, cue = () => {}, onUse = () => {}, priority = () => false, reducedMotion = false }) {
    this.actions = actions;
    this.index = new Map(actions.map((action) => [action.id, action]));
    this.doors = actions.filter((action) => action.kind === 'door');
    this.machines = [...new Set(actions.map((action) => action.machine).filter(Boolean))];
    this.collision = collision;
    this.windowOcclusion = windowOcclusion;
    this.cue = cue;
    this.onUse = onUse;
    this.priority=priority;
    this.reducedMotion = reducedMotion;
    this.look = new Vector3();
    this.delta = new Vector3();
    this.eye = new Vector3();
    this.nextAim = 0;
    this.focus = null;
  }

  find(view, screenAim) {
    if (this.seated) return this.seated;
    if(screenAim){
      view.updateWorldMatrix(true,false);
      this.look.set(screenAim.x,screenAim.y,.5).unproject(view).sub(view.position).normalize();
    }else view.getWorldDirection(this.look);
    let best = null, score = -Infinity;
    for (const candidate of this.actions) {
      if(candidate.available && !candidate.available())continue;
      if(candidate.eligible && !candidate.eligible(view))continue;
      const at = candidate.focusAt ?? candidate.at;
      const d2 = this.delta.copy(at).sub(view.position).lengthSq();
      if (d2 > candidate.range ** 2 || d2 < .09 ** 2) continue;
      const distance = Math.sqrt(d2);
      const facing = this.look.dot(this.delta) / distance;
      if (facing < (screenAim?Math.max(.976,candidate.aim??AIM):candidate.aim??AIM)) continue;
      const grade = facing - distance * .034 + (this.priority(candidate)?(screenAim?.027:.077):0);
      if (grade <= score) continue;
      if (this.collision.blocksSight(view.position, at, candidate.ignore ?? candidate.colliders) ||
          this.windowOcclusion?.blocksSight(view.position, at)) continue;
      best = candidate;
      score = grade;
    }
    return best;
  }

  /** Always recheck the current aim/occlusion, even between HUD poll ticks. */
  activate(view, player, screenAim) {
    if (this.seated) return this.dismount(player);
    const action = this.find(view,screenAim);
    if (!action) return null;
    const message = action.use({ player, cue: this.cue, mount: (seat) => this.#mount(seat, player) });
    this.focus = action;
    if (!message) this.onUse(action, 'use');
    return message ?? null;
  }

  #mount(seat, player) {
    if (!player.grounded) return 'बैठने से पहले ज़मीन पर उतरो।';
    // This exact stance was reached with the fixed-step solver. Keep it as a
    // safe exit irrespective of the moving seat's current phase.
    player.velocity.set(0, 0, 0);
    player.sprinting = false;
    this.seated = seat;
    this.standAt = player.position.clone();
    seat.machine?.start(seat, this.reducedMotion);
    this.cue(seat.machine ? 'chain' : 'sit', seat.at);
    return null;
  }

  dismount(player) {
    if (!this.seated) return null;
    const { collision } = this, spot = this.standAt.clone();
    // Dynamic door states are checked again. The original spot normally wins;
    // the nearby alternatives are on the same floor and in clear sight of it.
    const valid = (p) => {
      const y = collision.supportAt(p.x, p.z, spot.y + .22);
      if (Math.abs(y - spot.y) > .18 || !collision.headroomAt(p.x, p.z, y + .009)) return false;
      p.y = y;
      const copy = p.clone();
      collision.resolve(copy, new Vector3());
      return copy.distanceToSquared(p) < .00001;
    };
    let exit = valid(spot) ? spot : null;
    if (!exit) for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const p = spot.clone().add({ x: Math.cos(a) * .43, y: 0, z: Math.sin(a) * .43 });
      if (valid(p) && !collision.blocksSight(spot.clone().add({x:0,y:.9,z:0}), p.clone().add({x:0,y:.9,z:0}))) { exit = p; break; }
    }
    if (!exit) return 'अभी उठने की जगह नहीं है।';
    const seat = this.seated;
    player.position.copy(exit);
    player.velocity.set(0, 0, 0);
    player.grounded = true;
    seat.machine?.leave();
    this.seated = this.standAt = null;
    this.focus = null;
    this.nextAim = 0;
    this.onUse(seat, 'leave');
    return null;
  }

  movement(movement, jump, player) {
    if (!this.seated) return { movement, jump };
    const { machine } = this.seated;
    if (jump || (!machine && Math.abs(movement.forward) + Math.abs(movement.right) > .13)) {
      this.dismount(player);
    }
    if (!this.seated) return { movement, jump: false };
    machine?.pump(movement.forward, this.reducedMotion);
    return { movement: ZERO, jump: false };
  }

  cameraAnchor() {
    if (!this.seated) return null;
    const seat = this.seated;
    if (this.reducedMotion && seat.machine) return this.eye.copy(seat.at).setY(seat.at.y + .73);
    return seat.eye(this.eye);
  }

  tick(dt, player) {
    let changed = false;
    for (const door of this.doors) if (door.moving && door.tick(dt, player)) changed = true;
    for (const machine of this.machines) if (machine.tick(dt)) changed = true;
    return changed;
  }

  prompt(now, view, active) {
    if (!active) { this.focus = null; this.nextAim = 0; return null; }
    if (this.seated) return { label: this.seated.machine ? 'उतर जाओ' : 'उठ जाओ', name: this.seated.name,
      detail: this.seated.machine ? 'झूलने के लिए आगे-पीछे करो' : 'उठने के लिए चलो' };
    if (now >= this.nextAim) {
      this.nextAim = now + .076;
      this.focus = this.find(view);
    }
    if (!this.focus) return null;
    return { label: this.focus.label, touchLabel: this.focus.touchLabel, name: this.focus.name,
      locked: this.focus.kind === 'locked'||!!this.focus.locked?.() };
  }
}
