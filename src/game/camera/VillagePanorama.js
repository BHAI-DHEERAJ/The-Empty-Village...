import { PerspectiveCamera, Vector3 } from 'three';

// Separate from the player view: the title never moves the player, turns on
// the torch, or advances live encounter timers. Expose the roofs and main lane
// without a cut or a full-speed spin. Portrait framing puts the trail centre.
export class VillagePanorama {
  constructor(reducedMotion) {
    this.view = new PerspectiveCamera(59,1,.12,330);
    this.view.name = 'Title panorama camera';
    this.target = new Vector3();
    this.reducedMotion = reducedMotion;
  }

  resize(aspect) {
    this.view.aspect = aspect;
    this.view.fov = aspect < .85 ? 58 : 56;
    this.view.updateProjectionMatrix();
  }

  update(time) {
    const t = this.reducedMotion ? 0 : time;
    const portrait = this.view.aspect < .85;
    this.view.position.set(4.24 - 2.8 * Math.sin(t * .059),6.58 + .46 * Math.sin(t * .058),10.2 - 2.8 * Math.sin(t * .046));
    this.target.set((portrait ? 2.2 : 1.5) + 4.87 * Math.sin(t * .066), .14 + .62 * Math.sin(t * .037), -18.9);
    this.view.lookAt(this.target);
    return this.view;
  }
}
