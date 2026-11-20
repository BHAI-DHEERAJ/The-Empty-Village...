import { MeshStandardMaterial, Vector2 } from 'three';
import { nightMaterial } from './shaders.js';

export function imageMaterial(surface, { strength = .72, ...properties } = {}) {
  const material = new MeshStandardMaterial({
    name: surface.file,
    map: surface.albedo,
    normalMap: surface.normal ?? null,
    normalScale: new Vector2(strength, strength),
    aoMap: surface.orm ?? null,
    aoMapIntensity: .65,
    roughnessMap: surface.orm ?? null,
    roughness: surface.orm ? 1 : .91,
    displacementMap: surface.displacement ?? null,
    displacementScale: surface.displacement ? .026 : 0,
    displacementBias: surface.displacement ? -.009 : 0,
    metalnessMap: surface.metallic ? surface.orm : null,
    metalness: surface.metallic ? 1 : 0,
    ...properties,
  });
  return nightMaterial(material, 'image-surface');
}
