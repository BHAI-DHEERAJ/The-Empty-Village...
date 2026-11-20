export const WORLD = Object.freeze({
  halfSize: 172,
  limit: 158,
  groundY: 0,
  fogColor: 0x171f31,
  fogDensity: .0188,
  spawn: Object.freeze({ x: .35, y: 0, z: 1.5 }),
});

export const PLAYER = Object.freeze({
  radius: .27, height: 1.67, speed: 3.25, sprintSpeed: 5.55, step: .29,
  acceleration: 14, brake: 20, gravity: 18, jumpSpeed: 5.35,
});

export const CAMERA = Object.freeze({
  fov: 64, sprintFov: 68, eye: 1.61, initialPitch: -.026, minPitch: -1.48, maxPitch: 1.48, sensitivity: .00235,
});
