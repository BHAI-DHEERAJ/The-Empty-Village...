import { MathUtils, Vector3 } from 'three';
import { between } from '../world/random.js';
import { WATCHER_HEIGHT } from './WatcherModel.js';
import { clearWithdrawal, hasWatcherClearance } from './WatcherPlaces.js';
import { WatcherSight } from './WatcherSight.js';
import { chooseRoadCrossing } from './WatcherRoad.js';
import { clearRushLane, findRushRoute, RUSH_GAP, RUSH_MIN, RUSH_MAX, RUSH_STRIDE, sweptGapSquared } from './WatcherRush.js';

const SENSE_INTERVAL = .10;
const TILT_AFTER = 2;
const RUSH_NOTICE = 1.25, RUSH_WINDUP = .24, RUSH_RAMP = .18, RUSH_SPEED = 11.3;
const RANGE = { close: [9.2, 15.9], medium: [16, 34], far: [32, 55], hall: [7.25, 14.7] };
const coverKinds = new Set(['tree', 'wall', 'verge', 'window-side']);
const roamKinds = new Set([...coverKinds, 'road', 'field', 'well']);
const windowKinds = new Set(['upper-window', 'broken-window', 'doorway']);
const moods = [
  ['road', 'verge'], ['road', 'field'], ['tree', 'wall'], ['tree', 'wall'], ['well', 'field'],
  ['upper-window'], ['broken-window', 'window-side'], ['doorway', 'broken-window'], ['roof'],
];
const weights = {
  road: .96, field: 1.17, verge: .83, tree: .82, well: 1.13, wall: .87,
  roof: .16, 'upper-window': 1.27, 'broken-window': 1.11, 'window-side': .79, doorway: 1, hall: 1,
};

// The actor has no input into player simulation: only read-only positions,
// line-of-sight queries, a render rig and optional audio events.
export class Watcher {
  constructor({ collision, spots, occlusion, roads = [] }, model, { random = Math.random, onCue = () => {}, onReveal, reducedMotion = false, scareDirector } = {}) {
    this.spots = spots;
    this.roads=roads;this.roadSide=1;this.nextRoad=5.3;
    this.collision = collision;
    this.model = model;
    this.sight = new WatcherSight(collision, occlusion);
    this.random = random;
    this.onCue = onCue;
    this.onReveal = onReveal;
    this.reducedMotion = reducedMotion;
    this.phase = 'waiting';
    this.time = 0;
    this.nextSearch = this.#range(12, 23);
    this.scareDirector = scareDirector;
    this.rushReadyAt = scareDirector && !reducedMotion ? 0 : Infinity;
    this.nextRushCheck = 0;
    this.recent = [];
    this.lastSeen = null;
    this.roomId = null;
    this.stare = 0;
    this.lastCue = -Infinity;
    this.stepPosition = new Vector3();
    this.cuePosition = new Vector3();
    this.routeProbe = new Vector3();
  }

  #range(a, b) { return between(this.random, a, b); }

  pause() {
    this.cancelRush();
    this.#clearGaze();
  }

  suspend(){
    if(this.phase==='rushing')this.cancelRush();
    if(!this.place)return;
    this.#hide('story');
    // A hand-off is not a fresh search. Keep any existing cooldown and leave
    // a short gap before reappearing if the player crosses the boundary again.
    this.nextSearch=Math.max(this.nextSearch,this.time+4);
    this.nextRoad=Math.max(this.nextRoad,this.time+4);
  }

  #clearGaze() {
    this.stare = 0;
    this.fixation = null;
    this.glance = null;
    this.rushSeenAt = null;
    this.lostAt = null;
  }

  update(dt, { view, feet, speed = 0, running = false, grounded = true, seated = false, velocity, roomId = null, torch = true }) {
    this.time += dt;
    const now = this.time;
    if (roomId !== this.roomId) {
      this.roomId = roomId;
      if (this.phase === 'rushing') return this.cancelRush();
      if (roomId) {
        this.interiorReady = now + this.#range(5, 12);
        if (this.place) return this.#vanish('threshold', feet);
      }
    }
    if (this.phase === 'rushing') {
      if (!this.scareDirector.enabled || seated) return this.cancelRush();
      return this.#runAtPlayer(dt, view, feet);
    }
    if(this.phase==='road-cross')return this.#roadStep(dt,feet);
    if (this.phase === 'waiting') {
      if(!roomId&&grounded&&!seated&&velocity&&speed>.68&&this.#tryRoad(view,feet,velocity,torch))return;
      if (now < this.nextSearch || (roomId && now < this.interiorReady)) return;
      this.sight.capture(view);
      if (!this.#findPlace(feet, speed, running, torch)) this.nextSearch = now + this.#range(1.6, roomId ? 6.5 : 3.8);
      return;
    }
    const pos = this.model.group.position;
    const range = feet.distanceTo(pos);
    if (range < this.withdrawAt + (running ? .85 : 0)) return this.#vanish('approach', feet);
    if (range > 70) return this.#vanish('quiet', feet);
    this.sight.capture(view);
    if (this.phase === 'withdrawing') return this.#walkOut(feet);
    if (this.phase === 'crossing' && (running || this.sight.canFixate(this.place))) this.#endCrossing();

    const spot = this.place;
    const canRush = this.phase === 'watching' && this.model.group.visible && !roomId && !running && grounded && !seated &&
      this.#rushAvailable() && this.#rushSpot(spot,feet,range);
    if (!canRush || this.sight.outsideView(spot)) this.rushSeenAt = null;
    if (this.fixation != null && !this.sight.canFixate(spot)) {
      this.fixation = null;
      this.stare = 0;
    }
    const torchSwitch = this.torchShy && torch && !this.previousTorch;
    this.previousTorch = torch;
    if (now >= this.nextSense || torchSwitch) {
      this.nextSense = now + SENSE_INTERVAL;
      const { visible, gaze, beam } = this.sight.observe(spot);
      this.fixation = gaze ? (this.fixation ?? now) : null;
      // Only a sustained, unobstructed view of the same actor can start a rush.
      this.rushSeenAt = canRush && visible && beam ? (this.rushSeenAt ?? now) : null;
      if (this.rushSeenAt != null && now - this.rushSeenAt >= RUSH_NOTICE && now >= this.nextRushCheck && this.#tryRush(feet)) return;
      if (visible) {
        this.glance ??= now;
        if (gaze && !this.revealTried && this.onReveal && (this.rushSeenAt == null || now - this.rushSeenAt > 1.95) && this.sight.seesEyes(spot)) {
          this.revealTried = true;
          // Only a rare head-on discovery gets a sting, not the appearance.
          // It doesn't change the actor's position, the camera, or the torch.
          if (this.revealEligible) {
            this.cuePosition.copy(pos).y += WATCHER_HEIGHT * spot.scale * .92;
            this.onReveal(this.cuePosition, range);
          }
        }
        if (!this.seen && now - this.glance >= .18) {
          this.seen = true;
          this.lastSeen = { id: spot.id, pos: spot.pos.clone(), time: now };
        }
      } else this.glance = null;
      if (!torch && visible && (this.seen || gaze)) this.seenInDark = true;
      if (this.torchShy && this.seenInDark && torch && beam) return this.#vanish('light', feet);
      if (now >= this.expires && !visible) return this.#vanish('quiet', feet);
      this.lostAt = this.seen && !visible ? (this.lostAt ?? now) : null;
      if (this.phase === 'watching' && this.lostAt != null && now - this.lostAt >= this.patience) {
        if (!this.reducedMotion && spot.cover && this.sight.outsideView(spot, .035) && this.#findWithdrawal(feet)) return;
        return this.#vanish('lost', feet);
      }
      if (this.phase === 'watching' && this.motionReady && now >= this.motionReady && range > 12 && range < 47 && !running &&
          this.seen && visible && !gaze && !this.sight.canFixate(spot) && now - this.glance >= .42) {
        this.motionReady = 0;
        this.#findCrossing(feet);
      }
    }
    if (this.phase === 'crossing') this.#cross(dt, feet);
    this.eyeGlow = MathUtils.damp(this.eyeGlow, torch ? .91 : 1.36, 3.4, dt);
    this.model.eyes?.(this.eyeGlow);
    this.stare = this.fixation == null ? 0 : now - this.fixation;
    if (this.stare >= this.stareLimit) return this.#vanish('stare', feet);
    const lean = this.tiltAmount * MathUtils.smoothstep(this.stare, TILT_AFTER, 4.15);
    if (lean > this.lean) this.lean = lean;
    else this.lean = MathUtils.damp(this.lean, lean, 3.7, dt);
    this.model.tilt(this.lean);
    if(this.phase==='watching'&&!this.reducedMotion&&this.unsettled){
      const amount=MathUtils.smoothstep(this.stare,2.38,3.51)*.89;
      this.model.contort?.(now,amount);
      if(amount>.34&&!this.twitched){this.twitched=true;this.#cue('joint',.58);}
    }

    if (!this.silent && now >= this.nextCue) {
      this.nextCue = Infinity; // At most one ambient cue in an encounter.
      if (range < 34) {
        const choices = range < 16 ? ['breath', 'whisper', 'creak'] : ['steps', 'creak', 'whisper'];
        this.#cue(choices[Math.floor(this.random() * choices.length)], this.glance == null ? .55 : .91);
      }
    }
  }

  #tryRoad(view,feet,velocity,torch){
    if(this.reducedMotion||!this.roads.length||!this.model.run||this.time<this.nextRoad)return false;
    this.nextRoad=this.time+1.25;
    this.sight.capture(view);
    const crossing=chooseRoadCrossing(this.roads,this.sight,feet,velocity,this.roadSide,this.lastRoad);
    if(!crossing || !clearRushLane(this.collision,crossing.from,crossing.to))return false;
    const {id,from,to,yaw,side}=crossing;
    this.#appear({id,kind:'road',pos:from.clone(),scale:1,yaw},torch);
    this.phase='road-cross';
    this.model.eyes?.(.29);
    this.model.veil?.(0);
    this.roadSide=side;this.lastRoad=id;
    this.nextRoad=this.time+this.#range(46,79);
    const length=from.distanceTo(to);
    this.route={from,to,length,time:0,pace:this.#range(3.78,4.92),stepAt:1.39,side,feet:feet.clone()};
    this.cuePosition.copy(from).y+=1.21;this.onCue('road-rustle',this.cuePosition,.74);
    return true;
  }

  #roadStep(dt,feet){
    const r=this.route, actor=this.model.group;
    r.time+=dt;
    const travel=Math.min(r.length,r.time*r.pace), progress=travel/r.length;
    const next=this.stepPosition.lerpVectors(r.from,r.to,progress);
    if(sweptGapSquared(actor.position,next,r.feet,feet)<8.2**2||!clearRushLane(this.collision,actor.position,next))return this.#vanish('road-clear',feet);
    r.feet.copy(feet);
    actor.position.copy(next);this.place.pos.copy(next);
    this.model.run(travel/2.49,.63+.32*Math.sin(progress*Math.PI),0);
    this.model.veil?.(MathUtils.smoothstep(progress,0,.22)*(1-MathUtils.smoothstep(progress,.79,1)));
    const glance=Math.max(0,1-Math.abs(progress-.53)/.27);
    this.model.contort?.(r.time,glance*.52,-r.side*glance*.69);
    if(travel>=r.stepAt){
      this.cuePosition.copy(next).y+=.11;
      this.onCue('road-step',this.cuePosition,.78);
      r.stepAt+=1.22;
    }
    if(progress>=1)this.#vanish('road-clear',feet);
  }

  #rushAvailable() {
    return this.model.run && this.time >= this.rushReadyAt && this.scareDirector?.canRush;
  }

  #rushSpot(spot, feet, range) {
    return spot.scale === 1 && !spot.pose && roamKinds.has(spot.kind) && range >= RUSH_MIN && range <= RUSH_MAX &&
      Math.abs(spot.pos.y - feet.y) <= .045;
  }

  #tryRush(feet) {
    this.nextRushCheck = this.time + .56;
    const actor = this.model.group;
    const route = findRushRoute(this.collision, feet, actor.position);
    if (!route || !this.scareDirector.beginRush()) return false;
    this.rushReadyAt = this.time + this.#range(111, 164);
    route.turn = MathUtils.euclideanModulo(route.yaw - actor.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    route.startYaw = actor.rotation.y;
    this.rush = route;
    // Keep the same mark, position and pose on the start frame. Nothing is
    // manifested, moved or rescaled here; the next frame begins the windup.
    this.place = { ...this.place, pos: actor.position.clone() };
    this.phase = 'rushing';
    this.route = null;
    return true;
  }

  #runAtPlayer(dt, view, feet) {
    const rush = this.rush, actor = this.model.group;
    rush.time += dt;
    const chargeTime = Math.max(0, rush.time - RUSH_WINDUP);
    const travel = RUSH_SPEED * (chargeTime < RUSH_RAMP ? chargeTime ** 2 / (RUSH_RAMP * 2) : chargeTime - RUSH_RAMP * .5);
    const progress = Math.min(1, travel / rush.length);
    const next = this.stepPosition.lerpVectors(rush.from, rush.to, progress);
    const gap = sweptGapSquared(actor.position, next, rush.feet, feet);
    const gapNow = Math.hypot(next.x - feet.x, next.z - feet.z);
    const reach = Math.max(MathUtils.smoothstep(progress, .55, .91), 1 - MathUtils.smoothstep(gapNow, 2.55, 5.0));
    this.sight.capture(view);
    const pose = { ...this.place, pos: next };
    if (this.sight.outsideView(pose, .12)) return this.cancelRush();
    // This is a single committed line to where the player was. No steering
    // or follow-up pursuit, and never even one rendered frame at contact.
    if (gap <= RUSH_GAP ** 2 || progress >= 1) return this.#finishRush(true);
    const ahead = this.routeProbe.lerpVectors(rush.from, rush.to, (travel + .26 + reach * 1.24) / rush.length);
    if (!clearRushLane(this.collision, actor.position, ahead) || !this.sight.hasLine(pose)) return this.cancelRush();
    actor.position.copy(next);
    actor.rotation.y = rush.startYaw + rush.turn * MathUtils.smoothstep(rush.time,0,RUSH_WINDUP);
    this.place.pos.copy(next);
    this.place.yaw = actor.rotation.y;
    rush.feet.copy(feet);
    const effort = .33 * MathUtils.smoothstep(rush.time, 0, RUSH_WINDUP) +
      .67 * MathUtils.smoothstep(chargeTime, 0, RUSH_RAMP);
    this.model.run(travel / RUSH_STRIDE, effort, reach);
    this.model.eyes?.(1.55 + .69 * reach);
    if (travel >= rush.nextStep) {
      this.cuePosition.copy(next).y += .12;
      this.onCue('rush-step', this.cuePosition, .84 + .13 * reach);
      rush.nextStep += RUSH_STRIDE * .5;
    }
  }

  cancelRush() {
    if (this.phase === 'rushing') this.#finishRush(false);
  }

  #finishRush(completed) {
    this.cuePosition.copy(this.model.group.position).y += 1.68;
    this.rush = null;
    this.#hide(completed ? 'rush' : 'rush-cancelled');
    this.nextSearch = this.time + this.#range(34, 57);
    this.scareDirector.finishRush(completed ? this.cuePosition : null);
  }

  #findPlace(feet, speed, running, torch) {
    const now = this.time;
    // Runners get distant glimpses, not a sequence of nearby pursuers. Long
    // halls are considered only after settling inside, and close exterior
    // encounters aren't eligible until the first encounter is over.
    if (this.roomId && (running || this.random() > .30)) return false;
    const close = !this.roomId && !running && this.recent.length > 0 && this.random() < (speed < .4 ? .10 : .063);
    let band = 'medium';
    if (this.roomId) band = 'hall';
    else if (close) band = 'close';
    else if (running || this.random() < (speed > .8 ? .42 : .27)) band = 'far';
    const [min, max] = RANGE[band];
    const rear = close || this.random() < .22;
    const echo = this.lastSeen && now - this.lastSeen.time > 145 && this.random() < .14;
    const prefer = (min + max) * .5;
    const mood = running ? moods[1] : moods[Math.floor(this.random() * moods.length)];
    const favorRushRange = !this.roomId && !running && band === 'medium' && this.#rushAvailable();
    const candidates = [];
    for (const spot of this.spots) {
      if (this.roomId) {
        if ((spot.kind !== 'hall' && spot.kind !== 'window-side') || spot.siteId !== this.roomId || Math.abs(spot.pos.y - feet.y) > .85) continue;
      } else if (spot.kind === 'hall') continue;
      if (close && !coverKinds.has(spot.kind) && spot.kind !== 'well') continue;
      const distance = feet.distanceTo(spot.pos);
      const window = windowKinds.has(spot.kind);
      const nearEligible = favorRushRange && this.#rushSpot(spot,feet,distance);
      if (!nearEligible && (distance < (band === 'medium' && window ? 12.8 : min) || distance > max)) continue;
      if (window) {
        if (distance > 33.5 || running) continue;
        const { x, z } = spot.pos;
        if ((feet.x - x) * Math.sin(spot.facing) + (feet.z - z) * Math.cos(spot.facing) < 3) continue;
      }
      const history = this.recent.find((record) => record.id === spot.id);
      if (history && now - history.time < (echo && spot.id === this.lastSeen.id ? 100 : 180)) continue;
      if (this.lastSeen && now - this.lastSeen.time < 122 && this.lastSeen.pos.distanceToSquared(spot.pos) < 4.5 ** 2) continue;
      if (!this.sight.outsideView(spot, .135)) continue;
      const bearing = this.sight.bearing(spot);
      if (close && bearing > -.08) continue;
      const repeat = this.recent.at(-1)?.kind === spot.kind ? .51 : 0;
      const angle = rear ? -.89 * bearing : .89 * bearing;
      const mode = running && (spot.kind === 'road' || spot.kind === 'field') ? .55 :
        !running && speed < .4 && (windowKinds.has(spot.kind) || spot.kind === 'roof') ? .42 : 0;
      const emphasis = mood.includes(spot.kind) ? (spot.kind === 'upper-window' ? 3.5 : 2.45) : 0;
      const score = this.#range(0, 2.6) + weights[spot.kind] + angle + mode + emphasis + (nearEligible ? 2.75 : 0) - repeat - Math.abs(distance - (nearEligible ? 14.8 : window ? 20 : prefer)) / 13 +
        (echo && spot.id === this.lastSeen.id ? 4.0 : 0);
      candidates.push({ spot, score });
    }
    candidates.sort((a, b) => b.score - a.score);
    let occluded = null;
    const kindBudget = new Map();
    let checked = 0;
    for (const { spot } of candidates) {
      const tried = kindBudget.get(spot.kind) ?? 0;
      if (tried >= 7) continue;
      if (++checked > 18) break;
      kindBudget.set(spot.kind, tried + 1);
      const yaw = spot.facing ?? Math.atan2(feet.x - spot.pos.x, feet.z - spot.pos.z);
      const candidate = { ...spot, yaw };
      if (this.sight.hasLine(candidate)) {
        this.#appear(candidate, torch);
        return true;
      }
      if (!occluded && spot.cover) occluded = candidate;
    }
    // A watched corner needn't be a guaranteed sighting. This fallback is
    // still outside the expanded frustum, and unavailable for close events.
    if (!close && occluded && this.random() < .24) {
      this.#appear(occluded, torch);
      return true;
    }
    return false;
  }

  #appear(spot, torch) {
    const now = this.time;
    this.place = spot;
    this.recent.push({ id: spot.id, kind: spot.kind, time: now });
    if (this.recent.length > 8) this.recent.shift();
    this.phase = 'watching';
    this.seen = this.seenInDark = false;
    this.#clearGaze();
    this.lean = 0;
    this.nextSense = now;
    this.previousTorch = torch;
    this.torchShy = !torch && this.random() < .36;
    this.tiltAmount = this.#range(.34, .58) * (this.reducedMotion ? .65 : 1);
    this.stareLimit = this.#range(4.45, 6.05);
    this.withdrawAt = this.#range(4.8, 6.15);
    this.patience = this.#range(.54, 1.55);
    this.expires = now + this.#range(27, 66);
    this.silent = this.random() < .47;
    this.nextCue = now + this.#range(4.4, 14.9);
    this.hand = this.random() < .5 ? -1 : 1;
    this.model.hold(this.hand, spot.pose ?? 'standing');
    this.model.veil?.(1);
    this.unsettled=!spot.pose && this.recent.length%3===2;this.twitched=false;
    this.motionReady = !this.reducedMotion && !this.roomId && this.model.walk && roamKinds.has(spot.kind) && !spot.pose &&
      spot.scale === 1 && this.random() < .67 ? now + this.#range(1.7, 4.4) : 0;
    this.eyeGlow = torch ? .91 : 1.36;
    this.model.eyes?.(this.eyeGlow);
    this.revealTried = false;
    this.revealEligible = !!this.onReveal && !this.silent && this.random() < (torch ? .24 : .49);
    const actor = this.model.group;
    actor.position.copy(spot.pos);
    actor.rotation.y = spot.yaw;
    actor.scale.setScalar(spot.scale);
    actor.visible = true;
  }

  #findCrossing(feet) {
    const spot = this.place, from = spot.pos.clone();
    const outward = Math.atan2(from.x - feet.x, from.z - feet.z);
    const side = this.random() < .5 ? -1 : 1;
    // Sample only a few short outward routes, away from the player. No global
    // pathfinding, pursuit, or movement through the openings of buildings.
    for (const [turn, length] of [[side * 1.25, 3.65], [-side * 1.29, 3.3], [side * .91, 2.64], [-side * .88, 2.7], [0, 2.15]]) {
      const yaw = outward + turn;
      const to = from.clone().add(new Vector3(Math.sin(yaw) * length, 0, Math.cos(yaw) * length));
      if (this.sight.outsideView({ ...spot, pos: to }, .08) || !clearWithdrawal(this.collision, from, to, spot.scale, true)) continue;
      this.route = { from, to, yaw, length, time: 0, nextCheck: 0, duration: length / this.#range(.91, 1.32) };
      this.place = { ...spot, pos: from.clone() }; // never mutate the library of spawn marks
      this.phase = 'crossing';
      if (!this.silent && Number.isFinite(this.nextCue)) {
        this.nextCue = Infinity;
        this.#cue('steps', .66);
      }
      return;
    }
  }

  #cross(dt, feet) {
    const route = this.route, actor = this.model.group;
    route.time += dt;
    const t = Math.min(1, route.time / route.duration);
    const eased = t * t * (3 - 2 * t);
    const next = this.stepPosition.lerpVectors(route.from, route.to, eased);
    // If the player's own movement changes the geometry of this encounter,
    // freeze rather than even momentarily stepping in their direction.
    if (feet.distanceToSquared(next) < Math.max(9.2 ** 2, feet.distanceToSquared(actor.position) - .0001)) {
      this.#endCrossing();return;
    }
    if (route.time >= route.nextCheck) {
      const checkT = Math.min(1, (route.time + .18) / route.duration);
      const probe = this.routeProbe.lerpVectors(route.from, route.to, checkT * checkT * (3 - 2 * checkT));
      route.nextCheck = route.time + SENSE_INTERVAL;
      if (!hasWatcherClearance(this.collision, probe, this.place.scale)) { this.#endCrossing();return; }
    }
    actor.position.copy(next);
    const angle = MathUtils.euclideanModulo(route.yaw - actor.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    actor.rotation.y += MathUtils.clamp(angle, -dt * 4.8, dt * 4.8);
    this.place.pos.copy(next);
    this.place.yaw = actor.rotation.y;
    this.model.walk(eased * route.length, Math.min(1, t * 9, (1 - t) * 7));
    if (t >= 1) this.#endCrossing();
  }

  #endCrossing() {
    this.phase = 'watching';
    this.route = null;
    this.model.hold(this.hand, this.place.pose ?? 'standing');
  }

  #findWithdrawal(feet) {
    const spot = this.place, { pos, cover } = spot;
    const behind = Math.atan2(cover.x - feet.x, cover.z - feet.z);
    for (const offset of [0, .55, -.55, 1.08, -1.08, 1.54, -1.54]) {
      const a = behind + offset, distance = offset === 0 ? 1.29 : 1.72;
      const to = new Vector3(cover.x + Math.sin(a) * distance, pos.y, cover.z + Math.cos(a) * distance);
      if (feet.distanceTo(to) <= this.withdrawAt + 2 || to.distanceToSquared(pos) < .51 ** 2) continue;
      const yaw = Math.atan2(to.x - pos.x, to.z - pos.z), candidate = { ...spot, pos: to, yaw };
      if (!this.sight.outsideView(candidate, .035) || this.sight.hasLine(candidate) ||
          !clearWithdrawal(this.collision, pos, to, spot.scale)) continue;
      this.route = { from: pos, to, yaw, start: this.time, duration: this.#range(1.05, 1.74) };
      this.phase = 'withdrawing';
      this.model.group.rotation.y = yaw;
      if (!this.silent && this.time - this.lastCue > 6.5 && this.random() < .57) this.#cue('steps', .66);
      return true;
    }
    return false;
  }

  #walkOut(feet) {
    const route = this.route, actor = this.model.group;
    const t = Math.min(1, (this.time - route.start) / route.duration);
    this.stepPosition.lerpVectors(route.from, route.to, MathUtils.smoothstep(t, 0, 1));
    if (!this.sight.outsideView({ ...this.place, pos: actor.position }) ||
        !this.sight.outsideView({ ...this.place, pos: this.stepPosition })) {
      // A quick turn catches the last valid pose, not the intermediate path.
      this.place = { ...this.place, pos: actor.position.clone(), yaw: route.yaw };
      this.phase = 'watching';
      this.route = null;
      this.model.hold(this.hand, this.place.pose ?? 'standing');
      this.#clearGaze();
      this.nextSense = this.time;
      return;
    }
    actor.position.copy(this.stepPosition);
    this.model.step(t);
    if (t >= 1) this.#vanish('cover', feet);
  }

  #cue(type, clarity) {
    const spot = this.place;
    this.cuePosition.copy(this.model.group.position);
    this.cuePosition.y += type === 'steps' ? .12 : WATCHER_HEIGHT * spot.scale * .78;
    this.onCue(type, this.cuePosition, clarity);
    this.lastCue = this.time;
  }

  #vanish(reason, feet) {
    if (!this.silent && reason !== 'quiet' && reason !== 'threshold' && this.time - this.lastCue > 5 &&
        feet.distanceTo(this.model.group.position) < 29 && this.random() < .38) this.#cue('vanish', .72);
    this.#hide(reason);
    // A rare long absence is part of the pacing; no immediate chain of spawns.
    const longAbsence = this.random() < (reason === 'approach' ? .24 : .15);
    const wait = reason==='road-clear'?this.#range(11,22):longAbsence ? this.#range(124, 215) : this.seen ? this.#range(43, 99) : this.#range(29, 69);
    this.nextSearch = this.time + wait;
  }

  #hide(reason) {
    this.model.group.visible = false;
    this.model.veil?.(1);
    this.phase = 'waiting';
    this.place = this.route = null;
    this.lastVanish = { reason, time: this.time };
    this.#clearGaze();
  }

  dispose() { this.cancelRush();this.model.dispose(); }
}
