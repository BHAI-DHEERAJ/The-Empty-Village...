import { Vector3 } from 'three';
import { isBuildingFootprint, isEntrance } from '../world/sceneryLayout.js';
import { hasWatcherClearance } from './WatcherPlaces.js';

// Clearance includes the longest reaching pose plus the player radius.
export const RUSH_GAP = 2.16;
export const RUSH_STRIDE = 3.48;
export const RUSH_MIN = 8.6, RUSH_MAX = 21.5;

export function clearRushLane(collision, from, to) {
  const probe = new Vector3();
  const samples = Math.max(1, Math.ceil(from.distanceTo(to) / .24));
  for (let i = 0; i <= samples; i++) {
    probe.lerpVectors(from, to, i / samples);
    if (isBuildingFootprint(probe.x, probe.z, .24) || isEntrance(probe.x, probe.z, .25) ||
        !hasWatcherClearance(collision, probe, 1)) return false;
  }
  return true;
}

export function findRushRoute(collision, feet, pos) {
  const { x, y, z } = feet, dx = x - pos.x, dz = z - pos.z;
  const distance = Math.hypot(dx,dz);
  if (distance < RUSH_MIN || distance > RUSH_MAX || Math.abs(pos.y - y) > .045 || Math.abs(collision.ground(x,z) - y) > .055) return null;
  const from = pos.clone(), end = feet.clone().setY(pos.y);
  const to = end.clone().lerp(from, RUSH_GAP / distance);
  // Check just beyond the root's endpoint so outstretched arms also have room.
  const reach = end.lerp(from, .58 / distance);
  if (!clearRushLane(collision, from, reach)) return null;
  return { yaw: Math.atan2(dx,dz), from, to, length: from.distanceTo(to), feet: feet.clone(), time: 0, nextStep: .43 };
}

// Closest separation of both centres over a frame in relative XZ space. A
// frame drop, sprint or jump toward the apparition must not make it overlap.
export function sweptGapSquared(from, to, previousFeet, feet) {
  const x = from.x - previousFeet.x, z = from.z - previousFeet.z;
  const dx = to.x - feet.x - x, dz = to.z - feet.z - z;
  const u = Math.max(0, Math.min(1, -(x*dx + z*dz) / (dx*dx + dz*dz || 1)));
  return (x + dx*u) ** 2 + (z + dz*u) ** 2;
}
