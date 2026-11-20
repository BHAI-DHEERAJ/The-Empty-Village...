import { ClampToEdgeWrapping, MirroredRepeatWrapping, NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three';
import { suffixesFor, SURFACES } from './surfaceCatalog.js';

const urls = import.meta.glob('../../assets/textures/**/*.webp', { eager: true, query: '?url', import: 'default' });

class TextureLoadError extends Error {
  constructor(path, cause) {
    super(`Could not load village texture: ${path}`, { cause });
    this.name = 'TextureLoadError';
  }
}

export async function loadWorldTextures(renderer, onProgress) {
  const loader = new TextureLoader();
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const loaded = [];
  const plans = Object.entries(SURFACES).map(([id, surface]) => ({
    id, surface, paths: suffixesFor(surface).map(suffix => `${surface.file}-${suffix}.webp`),
  }));
  const total = plans.reduce((sum, plan) => sum + plan.paths.length, 0);
  onProgress?.(0, total);
  const results = await Promise.allSettled(plans.map(async ({ id, surface, paths }) => {
    // Wait for all loads (even on a failure) so we can dispose partial successes.
    const maps = await Promise.allSettled(paths.map(async (path, index) => {
      const url = urls[`../../assets/textures/${path}`];
      if (!url) throw new TextureLoadError(path);
      let map;
      try { map = await loader.loadAsync(url); }
      catch (error) { throw new TextureLoadError(path, error); }
      loaded.push(map);
      map.name = path;
      map.colorSpace = index === 0 ? SRGBColorSpace : NoColorSpace;
      const wrap = ['cutout', 'print'].includes(surface.type) ? ClampToEdgeWrapping : surface.type === 'sky' ? MirroredRepeatWrapping : RepeatWrapping;
      map.wrapS = map.wrapT = wrap;
      map.anisotropy = surface.type ? Math.min(anisotropy, 2) : anisotropy;
      onProgress?.(loaded.length, total);
      return map;
    }));
    const failure = maps.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
    const [albedo, normal, orm, displacement] = maps.map((result) => result.value);
    return [id, { ...surface, albedo, normal, orm, displacement }];
  }));
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) {
    loaded.forEach((texture) => texture.dispose());
    throw failure.reason;
  }
  return Object.fromEntries(results.map((result) => result.value));
}

export function disposeWorldTextures(textures) {
  for (const { albedo, normal, orm, displacement } of Object.values(textures ?? {})) {
    albedo.dispose();
    normal?.dispose();
    orm?.dispose();
    displacement?.dispose();
  }
}
