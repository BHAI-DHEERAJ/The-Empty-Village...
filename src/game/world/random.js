// Mulberry32: the same seed builds the same scenery on every load.
export function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let state = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

export function between(random, min, max) {
  return min + (max - min) * random();
}
