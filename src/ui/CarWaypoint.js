import { Vector3 } from 'three';
import { CRETA_RETURN } from '../game/story/VillageChapter.js';

// The map handles the long route. This small pin points at the actual bonnet,
// not the car's centre or the walkable stance in front of it.
export class CarWaypoint {
  constructor(element) {
    this.element = element;
    this.projected = new Vector3();
    this.eye = new Vector3();
  }

  hide() {
    if (!this.element.hidden) this.element.hidden = true;
  }

  update(view, objective, collision, windows) {
    if (objective?.id !== CRETA_RETURN.id) return this.hide();
    const { at, ignore } = objective;
    view.updateWorldMatrix(true, false);
    const point = this.projected.copy(at).applyMatrix4(view.matrixWorldInverse);
    if (-point.z <= view.near || -point.z >= view.far) return this.hide();
    point.applyMatrix4(view.projectionMatrix);
    // Leave room for the label at the edge of short or narrow viewports.
    if (Math.abs(point.x) > .78 || point.y > .78 || point.y < -.95) return this.hide();
    const eye = this.eye.setFromMatrixPosition(view.matrixWorld);
    if (collision.blocksSight(eye, at, ignore) || windows?.blocksSight(eye, at)) return this.hide();
    const left = `${((1 + point.x) * 50).toFixed(2)}%`;
    const top = `${((1 - point.y) * 50).toFixed(2)}%`;
    if (this.element.style.left !== left) this.element.style.left = left;
    if (this.element.style.top !== top) this.element.style.top = top;
    if (this.element.hidden) this.element.hidden = false;
  }
}
