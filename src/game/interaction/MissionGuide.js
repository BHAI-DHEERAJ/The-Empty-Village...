import { Vector3 } from 'three';
import { CAMERA } from '../settings.js';
import { APPROACHES, CANAL, entryPoint, localPoint, ROUTES, worldPoint } from '../world/sceneryLayout.js';

const nodes = [], links = [], edges = [];
const coordinates = new Map();
function node(pair) {
  const key = pair.join(',');
  if (!coordinates.has(key)) {
    coordinates.set(key, nodes.length); nodes.push(pair); links.push([]);
  }
  return coordinates.get(key);
}
for (const route of ROUTES) {
  for (let i = 1; i < route.path.length; i++) {
    const a = node(route.path[i - 1]), b = node(route.path[i]);
    const distance = Math.hypot(nodes[b][0] - nodes[a][0], nodes[b][1] - nodes[a][1]);
    edges.push({ a, b, distance });
    links[a].push([b, distance]); links[b].push([a, distance]);
  }
}

function project(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len2 = dx * dx + dz * dz;
  const t = len2 ? ((x - a[0]) * dx + (z - a[1]) * dz) / len2 : 0;
  const u = Math.min(1, Math.max(0, t)), px = a[0] + u * dx, pz = a[1] + u * dz;
  return { t, u, px, pz, d2: (x - px) ** 2 + (z - pz) ** 2, along: t * Math.sqrt(len2) };
}

function bankApproach(from) {
  const [x,z] = from, span = CANAL.half + 1.35;
  if (z < CANAL.z0 - 1 || z > CANAL.z1 + 1 ||
      Math.abs(x - CANAL.x) < span && CANAL.bridgeZ.some(bridge => Math.abs(bridge - z) < .92)) {
    return { point: from };
  }
  // Join a road on the same bank. If already down by the water, step
  // outward before approaching a bridge; its rails block a side entrance.
  const side = x < CANAL.x ? -1 : 1, limit = CANAL.x + span * side;
  return { point: (x - limit) * side < 0 ? [limit,z] : from, side, limit };
}

function snap([x,z], bank) {
  let best;
  for (const edge of edges) {
    const a = nodes[edge.a], b = nodes[edge.b];
    const p = project(x,z,a,b);
    if (bank?.side && (p.px - bank.limit) * bank.side < 0) {
      const aOK = (a[0] - bank.limit) * bank.side >= 0, bOK = (b[0] - bank.limit) * bank.side >= 0;
      if (!aOK && !bOK) continue;
      p.u = (bank.limit - a[0]) / (b[0] - a[0]);
      p.px = bank.limit;
      p.pz = a[1] + p.u * (b[1] - a[1]);
      p.d2 = (x - p.px) ** 2 + (z - p.pz) ** 2;
    }
    if (!best || p.d2 < best.d2) best = { ...p, edge };
  }
  return best;
}

function roadCourse(from, to) {
  const bank = bankApproach(from), start = snap(bank.point,bank), end = snap(to);
  const path = bank.point === from ? [] : [bank.point];
  path.push([start.px,start.pz]);
  const endPoint = [end.px,end.pz];
  if (start.edge === end.edge) return [...path, endPoint];
  // One shortest-path search per leg (or deliberate detour), not per frame.
  // Record the next junction on the route back from the destination.
  const dist = Array(nodes.length).fill(Infinity), next = Array(nodes.length).fill(-1), visited = new Set();
  const e = end.edge;
  dist[e.a] = e.distance * end.u; dist[e.b] = e.distance * (1 - end.u);
  for (let i = 0; i < nodes.length; i++) {
    let a = -1;
    for (let j = 0; j < nodes.length; j++) if (!visited.has(j) && (a === -1 || dist[j] < dist[a])) a = j;
    if (a < 0 || !Number.isFinite(dist[a])) break;
    visited.add(a);
    for (const [b,length] of links[a]) {
      if (dist[a] + length < dist[b]) { dist[b] = dist[a] + length; next[b] = a; }
    }
  }
  const s = start.edge;
  let at = start.u * s.distance + dist[s.a] <= (1 - start.u) * s.distance + dist[s.b] ? s.a : s.b;
  while (at !== -1) { path.push(nodes[at]); at = next[at]; }
  return [...path, endPoint];
}

const gap = (x,z,p) => Math.hypot(p[0] - x, p[1] - z);
const REACH = .68;
const STRAY = 5.5;

const EMPTY_PATH = Object.freeze([]);

// The map and the player follow the same ordered route. Advancing a waypoint
// is one-way; a small sideways step at a fork does not reselect the road.
export class MissionGuide {
  constructor(buildings, collision = null) {
    this.collision = collision;
    this.eye = new Vector3(); this.point = new Vector3();
    this.buildings = new Map(buildings.map(b => [b.site.id, b]));
    this.entries = new Map(buildings.map(({site}) => {
      const [u,v] = entryPoint(site);
      return [site.id, { out: worldPoint(site,u,v+1.23), in: worldPoint(site,u,v-.60), u, v }];
    }));
    this.approaches = new Map(APPROACHES.map(p => [p.id,p.points]));
    this.course = null; this.lastRoom = null;
    this.indoorPath = EMPTY_PATH;
    this.departurePath = null;
  }

  get remainingPath() { return this.course?.remaining ?? this.indoorPath; }

  #aim(feet, x, y, z, kind, distance = Math.hypot(x - feet.x, z - feet.z)) {
    this.kind = kind; this.distance = distance;
    return this.point.set(x,y,z);
  }

  #indoor(feet, action, roomId) {
    const building = this.buildings.get(roomId);
    if (!building) return null;
    const {site,plan} = building, [fx,fz] = localPoint(site,feet.x,feet.z);
    if (!plan) return null;
    if (roomId === 'school') {
      const room = plan.rooms.find(r => fx > r.x0 && fx < r.x1 && fz > r.z0 && fz < r.z1);
      if (room && room.id !== 'school-corridor') {
        const [x,z] = worldPoint(site,(room.x0 + room.x1)*.5,2.42);
        return [x,z];
      }
    }
    if (roomId === 'centre-01') {
      const [tx,tz] = localPoint(site,action.at.x,action.at.z);
      const xSide = Math.abs(fx) > .94 ? Math.sign(fx) : 0;
      const targetSide = action.site === roomId && Math.abs(tx) > .94 ? Math.sign(tx) : 0;
      const rear = fz < 0, targetRear = tz < 0;
      if (xSide === targetSide && (!xSide || rear === targetRear)) return null;
      const side = xSide || targetSide;
      const wall = plan.walls.find(w => w.axis === 'x' && w.finish === 'inner' && Math.sign(w.at) === side);
      if (!wall) return null;
      const u = xSide ? side * .24 : side * 1.44;
      const v = wall.openings[(xSide ? rear : targetRear) ? 0 : 1].at;
      return worldPoint(site,u,v);
    }
    if (site.plan === 'split' || site.plan === 'shops') {
      const goal = action.stance ?? action.at;
      const [tx,tz] = action.site === roomId ? localPoint(site,goal.x,goal.z) : entryPoint(site);
      const wall = plan.walls.find(w => w.finish === 'inner' && w.openings.length);
      if (wall) {
        const from = wall.axis === 'x' ? fx : fz, to = wall.axis === 'x' ? tx : tz;
        const direction = Math.sign(to - wall.at);
        if (direction && (from - wall.at) * direction < .16) {
          const next = wall.at + direction * .58, {at} = wall.openings[0];
          return wall.axis === 'x' ? worldPoint(site,next,at) : worldPoint(site,at,next);
        }
      }
    }
    return null;
  }

  #plan(feet, action, leaving) {
    const {x,z} = feet, start = [x,z], goal = action.stance ?? action.at, objective = [goal.x,goal.z];
    const entry = this.entries.get(action.site), arrival = this.approaches.get(action.site);
    const departure = this.approaches.get(leaving);
    const prefix = departure?.some(p => gap(x,z,p) < 4.1) ? departure.slice(1) : [];
    const path = [start];
    const end = entry?.in ?? objective;
    if (arrival && entry && !prefix.length) {
      const [u,v] = localPoint(this.buildings.get(action.site).site,x,z);
      const inFront = Math.abs(u-entry.u) < 1.0 && v > entry.v-.18 && v < entry.v+3.0;
      let near;
      for (let i = 1; i < arrival.length; i++) {
        const p = project(x,z,arrival[i - 1],arrival[i]);
        if (!near || p.d2 < near.d2) near = { ...p, i };
      }
      // Join the feeder path if we are actually beside it. Being near the
      // destination through a different wall is not the same as its frontage.
      if (inFront) return this.#course(path,end,'door');
      if (near?.d2 < 1.55 ** 2) {
        path.push(...arrival.slice(0,near.i).reverse());
        return this.#course(path,end,'door');
      }
    }
    const roadEnd = arrival?.at(-1) ?? objective;
    path.push(...prefix,...roadCourse(prefix.at(-1) ?? start,roadEnd),...(arrival?.slice().reverse() ?? []));
    return this.#course(path,end,entry?'door':'item');
  }

  #course(path, end, kind) {
    const points = path.filter((p,i) => !i || gap(p[0],p[1],path[i - 1]) > .10);
    if (gap(end[0],end[1],points.at(-1)) > .10 || points.length === 1) points.push(end);
    const tail = Array(points.length).fill(0);
    for (let i = points.length - 2; i >= 0; i--) tail[i] = tail[i+1] + gap(points[i][0],points[i][1],points[i+1]);
    return { points, tail, index:1, remaining:points.slice(1), kind };
  }

  #advance(course, feet) {
    const {x,z} = feet, {points,index} = course;
    while (course.index < points.length - 1) {
      const i = course.index, point = points[i];
      const outgoing = project(x,z,point,points[i + 1]);
      const incoming = project(x,z,points[i - 1],point);
      if (gap(x,z,point) > REACH && !(incoming.t > .96 && outgoing.along > .38 && outgoing.d2 < 1.4 ** 2)) break;
      course.index++;
    }
    if (index !== course.index) course.remaining = points.slice(course.index);
  }

  #inside(feet, action, roomId) {
    this.course = null;
    const {at} = action;
    const eye = this.eye.copy(feet); eye.y += CAMERA.eye;
    const visible = roomId === action.site && !this.collision?.blocksSight(eye,at,action.ignore);
    const via = visible ? null : this.#indoor(feet,action,roomId);
    const exit = roomId !== action.site && this.entries.get(roomId)?.out;
    if (exit) {
      // Show the whole route to the new objective even before the player
      // leaves the last building, with its frontage leading back to the road.
      if (this.departurePath?.room !== roomId) {
        const course = this.#plan({x:exit[0],z:exit[1]},action,roomId);
        this.departurePath = { room:roomId, points:course.points };
      }
      this.indoorPath = via ? [via,...this.departurePath.points] : this.departurePath.points;
      const [x,z] = via ?? exit;
      return this.#aim(feet,x,feet.y+.28,z,via?'passage':'exit');
    }
    const target = visible || !action.stance || action.stance.distanceToSquared(feet) <= .55 ** 2 ? at : action.stance;
    this.indoorPath = [via ?? [target.x,target.z]];
    if (via) return this.#aim(feet,via[0],feet.y+.28,via[1],'passage');
    return this.#aim(feet,target.x,target.y,target.z,target===at?'item':'passage');
  }

  update(feet, action, roomId) {
    const leaving = !roomId && this.lastRoom !== action?.site ? this.lastRoom : null;
    this.lastRoom = roomId;
    if (action !== this.action) {
      this.action = action; this.course = null; this.departurePath = null;
    }
    this.indoorPath = EMPTY_PATH;
    if (!action) return null;
    if (roomId) return this.#inside(feet,action,roomId);
    let course = this.course ??= this.#plan(feet,action,leaving);
    this.#advance(course,feet);
    const {points,index} = course;
    const here = project(feet.x,feet.z,points[index - 1],points[index]);
    if (here.d2 > STRAY ** 2) {
      course = this.course = this.#plan(feet,action,null);
      this.#advance(course,feet);
    }
    const point = course.points[course.index], kind = course.index === course.points.length - 1 ? course.kind : 'route';
    return this.#aim(feet,point[0],feet.y+.28,point[1],kind,gap(feet.x,feet.z,point)+course.tail[course.index]);
  }
}
