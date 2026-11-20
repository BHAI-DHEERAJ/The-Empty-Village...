import { PointLight } from 'three';
import { nightMaterial } from '../world/shaders.js';

// Light the object's real, textured surfaces. The separate CRETA waypoint
// does not change this effect. Only the active prop receives these materials;
// sharing a cabinet texture never lights it up.
export class MissionHighlight {
  constructor(scene, collision, occlusion, { reducedMotion = false } = {}) {
    this.light = new PointLight(0xffbb60, 0, 1.38, 1.8);
    this.light.name = 'Mission prop · warm spill';
    scene.add(this.light);
    this.collision = collision; this.occlusion = occlusion;
    this.reducedMotion = reducedMotion;
    this.shine = { value: .82 };
    this.materials = new Map();
    this.active = [];
  }

  #material(base) {
    if (!this.materials.has(base)) {
      const highlighted = nightMaterial(base.clone(), 'mission-shine', shader => {
        shader.uniforms.uMissionShine = this.shine;
        shader.fragmentShader = 'uniform float uMissionShine;\n' + shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           float edge = pow(1. - clamp(abs(dot(nonPerturbedNormal, normalize(vViewPosition))), 0., 1.), 1.65);
           totalEmissiveRadiance += uMissionShine * (diffuseColor.rgb * .74 + vec3(1., .48, .082) * (.24 + edge * .82));`
        );
      });
      this.materials.set(base, highlighted);
    }
    return this.materials.get(base);
  }

  update(time, target, view) {
    if (target !== this.target) {
      for (const [mesh, base] of this.active) mesh.material = base;
      this.active.length = 0;
      this.target = target;
      target?.model?.traverse(mesh => {
        if (!mesh.isMesh || !mesh.material.isMeshStandardMaterial) return;
        this.active.push([mesh, mesh.material]);
        mesh.material = this.#material(mesh.material);
      });
    }
    this.shine.value = this.reducedMotion ? .84 : .84 + .10 * Math.sin(time * 2.3);
    this.light.intensity = 0;
    if (!target?.model || !view || view.position.distanceToSquared(target.at) > 6 ** 2 ||
        this.collision.blocksSight(view.position, target.at, target.ignore) || this.occlusion?.blocksSight(view.position, target.at)) return;
    this.light.position.copy(target.at).y += .09;
    this.light.intensity = this.shine.value * 1.37;
  }

  dispose() {
    this.update(0, null);
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
    this.light.removeFromParent();
  }
}
