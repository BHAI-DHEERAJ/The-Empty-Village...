import { Vector3 } from 'three';
import { WORLD } from '../settings.js';
import { CollisionWorld } from '../world/physics/CollisionWorld.js';
import { districtAt, groundHeight, isBuildingFootprint, isEntrance, pathEdge, ROUTES, WELL, worldPoint } from '../world/sceneryLayout.js';
import { BASE, wallCoords } from '../world/village/buildingPlans.js';
import { WATCHER_HEIGHT, WATCHER_RADIUS } from './WatcherModel.js';

const TAU = 2 * Math.PI;
const GOLDEN_ANGLE = 2.39996323;
const fieldMarks = [
  [53,20],[61,24],[62,-21],[69,4],[74,23],[75,53],[90,3],[91,-14],[94,25],
  [95,47],[105,-17],[110,5],[113,48],[122,-2],[127,27],[140,17],[144,34],
];

export function hasWatcherClearance(collision, position, scale) {
  const { x, y, z } = position, r = WATCHER_RADIUS * scale;
  if (Math.max(Math.abs(x), Math.abs(z)) > WORLD.limit - r - .3) return false;
  const onSupport = (a, b) => Math.abs(collision.supportAt(a, b, y + .05) - y) < .045;
  if (!onSupport(x, z) || !collision.headroomAt(x, z, y + .009, WATCHER_HEIGHT * scale + .075)) return false;
  for (const [dx, dz] of [[r * .60, 0], [-r * .60, 0], [0, r * .60], [0, -r * .60]]) {
    if (!onSupport(x + dx, z + dz) || !collision.headroomAt(x + dx, z + dz, y + .009, WATCHER_HEIGHT * scale + .062)) return false;
  }
  const probe = position.clone();
  // The exact same solver the player uses, but on a private probe. The Watcher
  // never registers a solid and never modifies any actor or navigation route.
  collision.resolve(probe, new Vector3(), r, WATCHER_HEIGHT * scale + .06);
  return probe.distanceToSquared(position) < 1e-8;
}

export function clearWithdrawal(collision, from, to, scale, crossing = false) {
  if (Math.abs(from.y - to.y) > .035 || to.distanceToSquared(from) > (crossing ? 5.1 : 3.1) ** 2) return false;
  const probe = new Vector3();
  const samples = Math.max(1, Math.ceil(to.distanceTo(from) / .24));
  for (let i = 0; i <= samples; i++) {
    probe.lerpVectors(from, to, i / samples);
    if ((!crossing && pathEdge(probe.x, probe.z) < .10) || isEntrance(probe.x, probe.z, .28) ||
        isBuildingFootprint(probe.x, probe.z, .20) || !hasWatcherClearance(collision, probe, scale)) return false;
  }
  return true;
}

// Window dressing is not part of movement collision. These narrow, sight-only
// proxies reproduce opaque panes, ironwork and shutters without closing holes.
function markWindow(occlusion, site, wall, o) {
  const [x, z] = worldPoint(site, ...wallCoords(wall, o.at));
  const rotated = wall.axis === 'x', h = o.high - o.low;
  const yaw = site.yaw - (rotated ? Math.PI / 2 : 0), y = wall.base + o.low;
  const outside = (rotated ? -1 : 1) * wall.side;
  function add(dx, dz, w, d, low, high, turn = 0) {
    const [a, b] = worldPoint({ x, z, yaw }, dx, dz);
    occlusion.addBox(a, b, w, d, yaw + turn, y + low, y + high, 'window-dressing');
  }
  for (const s of [-1, 1]) add(s * o.w * .5, 0, .076, .27, -.05, h + .05);
  for (const u of [-.29, 0, .29]) add(o.w * u, 0, .025, .031, .03, h - .03);
  add(0, .011 * outside, o.w, .075, h * .55 - .023, h * .55 + .023);
  if (!o.broken) add(0, -.017 * outside, o.w - .05, .019, .024, h - .024);
  if (o.broken) add(-o.w * .335, -.017 * outside, o.w * .205, .025, .042, h * .50);
  if (o.shutter) for (const s of [-1, 1]) {
    const turn = s * (1.01 + (site.id.length % 3) * .13) * outside, width = o.w * .46;
    const cx = s * (o.w * .5 - .004) + s * width * .5 * Math.cos(turn);
    const cz = outside * .11 - s * width * .5 * Math.sin(turn);
    add(cx, cz, width, .065, .022, h - .022, turn);
  }
}

export function createWatcherPlaces({ buildings, collision }) {
  const spots = [];
  const occlusion = new CollisionWorld();
  const add = (id, kind, x, y, z, data = {}) => {
    const { scale = 1, ...details } = data;
    const pos = new Vector3(x, y, z);
    if (!hasWatcherClearance(collision, pos, scale)) return false;
    spots.push({ id, kind, pos, scale, district: districtAt(x, z), ...details });
    return true;
  };
  const outside = (id, kind, x, z, data) => {
    if (Math.abs(groundHeight(x, z)) > .04 || isBuildingFootprint(x, z, .62) || isEntrance(x, z, .4)) return false;
    return add(id, kind, x, groundHeight(x, z), z, data);
  };

  // Roads can hold a distant stationary silhouette, but no movement collider.
  // The separate side marks are used for medium distances and approaches.
  for (const { id, path, width } of ROUTES) for (let i = 1; i < path.length; i++) {
    const [a, b] = path[i - 1], [x, z] = path[i];
    const dx = x - a, dz = z - b, n = Math.hypot(dx, dz);
    if (n < 4.1) continue;
    const f = i % 2 ? .59 : .44, xx = a + dx * f, zz = b + dz * f;
    outside(`${id}/road/${i}`, 'road', xx, zz);
    for (const sign of [-1, 1]) {
      const u = xx + sign * (width + .99) * dz / n, v = zz - sign * (width + .99) * dx / n;
      if (pathEdge(u, v) > .55) outside(`${id}/verge/${i}/${sign}`, 'verge', u, v);
    }
  }
  for (const [i, [x, z]] of fieldMarks.entries()) {
    if (pathEdge(x, z) > .66) outside(`field/${i}`, 'field', x, z);
  }
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU + .8;
    outside(`well/${i}`, 'well', WELL.x + 2.55 * Math.sin(a), WELL.z + 2.55 * Math.cos(a));
  }

  const trunks = collision.solids.filter((entry) => entry.tag === 'trunk');
  for (const [i, tree] of trunks.entries()) {
    // Trails get more authored pockets than the impenetrable deep woods.
    if (i % (pathEdge(tree.x, tree.z) < 5 ? 2 : 6)) continue;
    for (const k of [0, 1]) {
      const a = i * GOLDEN_ANGLE + k * 2.38, r = tree.radius + .66 + k * .24;
      const x = tree.x + r * Math.sin(a), z = tree.z + r * Math.cos(a);
      if (pathEdge(x, z) > .4) outside(`trunk/${i}/${k}`, 'tree', x, z, { cover: { x: tree.x, z: tree.z } });
    }
  }

  for (const { site, plan } of buildings) {
    const place = (suffix, kind, lx, y, lz, data) => {
      const [x, z] = worldPoint(site, lx, lz);
      return add(`${site.id}/${suffix}`, kind, x, y, z, { siteId: site.id, ...data });
    };
    const halfW = site.w * .5, halfD = site.d * .5;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const [cx, cz] = worldPoint(site, sx * halfW, sz * halfD);
      const [x, z] = worldPoint(site, sx * (halfW + .99), sz * (halfD - .86));
      if (pathEdge(x, z) > .38) outside(`${site.id}/wall/${sx}/${sz}`, 'wall', x, z, { cover: { x: cx, z: cz } });
    }
    if (site.roof === 'flat') for (const s of [-1, 1]) {
      place(`roof/${s}`, 'roof', s * (halfW - 1.22), plan.roofAt + .1225, halfD - 1.26);
    }
    if (site.plan !== 'temple') {
      const scale = Math.min(.77, (site.eave - .28) / WATCHER_HEIGHT);
      for (const s of [1, -1]) {
        if (place(`recess/${s}`, 'doorway', plan.entry.at + s * .58, BASE, halfD - 1.87,
          { scale, facing: site.yaw, pose: 'hunched' })) break;
      }
    }
    let outsideWindows = 0;
    for (const wall of plan.walls) {
      if (wall.finish !== 'outer') continue;
      for (const [i, o] of wall.openings.entries()) {
        if (!o.window) continue;
        markWindow(occlusion, site, wall, o);
        if (outsideWindows < 2 && wall.base < 1 && !wall.front && o.broken) {
          const [lx, lz] = wallCoords(wall, o.at + o.w * .15, wall.side * 1.46);
          const [x, z] = worldPoint(site, lx, lz);
          if (pathEdge(x, z) > .37 && outside(`${site.id}/outside-window/${outsideWindows}`, 'window-side', x, z, { siteId: site.id })) outsideWindows++;
        }
        if (!o.broken || o.w < .72 || (wall.side < 0 && wall.base < 1 && i % 2)) continue;
        const yaw = site.yaw + (wall.axis === 'x' ? wall.side * Math.PI / 2 : wall.side < 0 ? Math.PI : 0);
        const scale = (o.low + (o.high - o.low) * .72) / (WATCHER_HEIGHT * .923);
        const kind = wall.base > 1 ? 'upper-window' : 'broken-window';
        const upper = wall.base > 1;
        let placed = 0;
        for (const [j, lane] of [.145, -.145, .38, -.38].entries()) {
          for (const distance of upper ? [.58, .92] : [.68]) {
            const [lx, lz] = wallCoords(wall, o.at + o.w * lane, -wall.side * distance);
            const room = plan.rooms.find((r) => r.base === wall.base && lx > r.x0 && lx < r.x1 && lz > r.z0 && lz < r.z1);
            // A locked room still has a physically valid floor. The single
            // figure can be glimpsed there, but no lock or doorway is changed.
            if (room && place(`window/${wall.axis}/${wall.side}/${wall.base}/${i}${j ? `/${j}` : ''}`,
              kind, lx, wall.base, lz, { facing: yaw, scale, pose: 'window' })) { placed++; break; }
          }
          if (placed >= (upper ? 2 : 1)) break;
        }
      }
    }
    for (const r of plan.rooms) {
      if (r.type !== 'landing' || r.stair || r.locked) continue;
      const w = r.x1 - r.x0, d = r.z1 - r.z0, alongX = w >= d;
      if (Math.max(w, d) < 6.9) continue;
      const scale = Math.min(.77, (site.eave - .26) / WATCHER_HEIGHT);
      const sx = (r.x0 + r.x1) * .5, sz = (r.z0 + r.z1) * .5;
      for (const s of [-1, 1]) for (const edge of [.69, 1.16]) {
        const x = alongX ? (s < 0 ? r.x0 + edge : r.x1 - edge) : sx + .26 * s;
        const z = alongX ? sz + .26 * s : (s < 0 ? r.z0 + edge : r.z1 - edge);
        if (place(`hall/${r.id}/${s}`, 'hall', x, r.base, z, { scale, pose: 'hunched' })) break;
      }
    }
  }
  return { spots, occlusion };
}
