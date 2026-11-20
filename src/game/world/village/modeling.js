import {
  BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, Float32BufferAttribute, LatheGeometry,
  Matrix4, Mesh, Object3D, SphereGeometry, TorusGeometry, TubeGeometry, Vector2, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function surfaceUV(geometry, material, w, h) {
  const tile = material.userData.tile;
  if (!tile) return;
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * w / tile[0], uv.getY(i) * h / tile[1]);
}

// Build editable props from UV-mapped 3D pieces, then merge static pieces by material.
export class ModelBatch {
  constructor(group) {
    this.group = group;
    this.parts = new Map();
    this.pose = new Object3D();
  }

  within(x, y, z, yaw, draw) {
    const previous = this.transform;
    const local = new Matrix4().makeRotationY(yaw).setPosition(x, y, z);
    this.transform = previous ? previous.clone().multiply(local) : local;
    try { return draw(this); } finally { this.transform = previous; }
  }

  add(geometry, material, x = 0, y = 0, z = 0, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, shadow = false } = {}) {
    if (!geometry || !material) return;
    if(this.shadowOverride!=null)shadow=this.shadowOverride;
    this.pose.position.set(x, y, z);
    this.pose.rotation.set(rx, ry, rz);
    this.pose.scale.set(sx, sy, sz);
    this.pose.updateMatrix();
    geometry.applyMatrix4(this.pose.matrix);
    if (this.transform) geometry.applyMatrix4(this.transform);
    const paint=paintVariants.get(material);
    if(paint){
      const n=geometry.getAttribute('position').count, rgb=new Float32Array(n*3),{r,g,b}=material.color;
      for(let i=0;i<n;i++){rgb[i*3]=r;rgb[i*3+1]=g;rgb[i*3+2]=b;}
      geometry.setAttribute('color',new Float32BufferAttribute(rgb,3));material=paint;
    }
    const key = `${material.id}:${shadow}`;
    if (!this.parts.has(key)) this.parts.set(key, { material, shadow, geometries: [] });
    this.parts.get(key).geometries.push(geometry);
  }

  box(material, x, y, z, w, h, d, { uvOffset = [0, 0], ...pose } = {}) {
    const geometry = new BoxGeometry(w, h, d);
    const tex = geometry.getAttribute('uv');
    const tile = material.userData.tile;
    if (tile) {
      const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let i = 0; i < tex.count; i += 1) {
        const [u, v] = faces[Math.floor(i / 4)];
        tex.setXY(i, tex.getX(i) * u / tile[0] + uvOffset[0], tex.getY(i) * v / tile[1] + uvOffset[1]);
      }
    }
    this.add(geometry, material, x, y, z, pose);
  }

  cylinder(material, x, y, z, t, b, h, options = {}) {
    const { sides = 10, open = false, ...pose } = options;
    const geo = new CylinderGeometry(t, b, h, sides, 1, open);
    surfaceUV(geo, material, Math.PI * (t + b), h);
    this.add(geo, material, x, y, z, pose);
  }

  ball(material, x, y, z, r, pose = {}) {
    const g = new SphereGeometry(r, 12, 8);
    surfaceUV(g, material, 2 * Math.PI * r * (pose.sx ?? 1), Math.PI * r * (pose.sy ?? 1));
    this.add(g, material, x, y, z, pose);
  }

  ring(material, x, y, z, r, t, pose = {}) {
    const g = new TorusGeometry(r, t, 6, 20);
    surfaceUV(g, material, Math.PI * 2 * r, Math.PI * 2 * t);
    this.add(g, material, x, y, z, pose);
  }

  pot(material, x, y, z, points, options = {}) {
    const { span = 2 * Math.PI, start = 0, ...pose } = options;
    const g = new LatheGeometry(points.map(([r, h]) => new Vector2(r, h)), 15, start, span);
    const heights = points.map(([, y]) => y);
    surfaceUV(g, material, span * Math.max(...points.map(([r]) => r)), Math.max(...heights) - Math.min(...heights));
    this.add(g, material, x, y, z, pose);
  }

  beam(material, start, end, r, sides = 6, shadow = false) {
    const from = new Vector3(...start), to = new Vector3(...end);
    const direction = to.clone().sub(from);
    const length = direction.length();
    if (length < .0001) return;
    const geometry = new CylinderGeometry(r, r * .94, length, sides);
    surfaceUV(geometry, material, Math.PI * 2 * r, length);
    const object = new Object3D();
    object.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
    geometry.applyMatrix4(new Matrix4().makeRotationFromQuaternion(object.quaternion));
    const mid = from.add(to).multiplyScalar(.5);
    this.add(geometry, material, mid.x, mid.y, mid.z, { shadow });
  }

  cord(material, points, radius = .013, { segments = 9, sides = 4 } = {}) {
    const path = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
    const g = new TubeGeometry(path, segments, radius, sides);
    surfaceUV(g, material, path.getLength(), Math.PI * radius * 2);
    this.add(g, material);
  }

  panel(material, coords, uvs, indices, { offset = [0, 0, 0], ...pose } = {}) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(coords.flat(), 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs.flat(), 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    this.add(geometry, material, ...offset, pose);
  }

  finish(label) {
    for (const { material, shadow, geometries } of this.parts.values()) {
      const g = mergeGeometries(geometries);
      for (const geometry of geometries) geometry.dispose();
      if (!g) continue;
      g.computeBoundingSphere();
      const mesh = new Mesh(g, material);
      mesh.name = label;
      mesh.castShadow = shadow;
      mesh.receiveShadow = !material.transparent;
      this.group.add(mesh);
    }
    this.parts.clear();
  }
}


const paintVariants = new WeakMap();
export function setBatchPaint(material, vertexPaint){paintVariants.set(material,vertexPaint);}

// Flatten fixed subassemblies (window joinery, framed apertures, furnishings on
// separate levels) into one local mesh per surface and shadow flag. Keep movers
// and separately culled layers out of the bake.
export function consolidateStatic(group, skipped=new Set()){
  group.updateWorldMatrix(true,true);
  const inv=group.matrixWorld.clone().invert(), lists=new Map(), removable=[];
  const gather=(node)=>{
    if(skipped.has(node)||!node.visible)return true;
    if(node.isMesh&&!node.isInstancedMesh&&node.geometry.index){
      const key=`${node.material.id}/${node.castShadow}/${node.receiveShadow}`;
      if(!lists.has(key))lists.set(key,[]);
      lists.get(key).push(node);
      return false;
    }
    const kept=node.children.map(gather).some(Boolean);
    if(!kept&&node!==group)removable.push(node);
    return kept;
  };
  gather(group);
  for(const list of lists.values()){
    const first=list[0];
    const pieces=list.map(node=>node.geometry.applyMatrix4(new Matrix4().multiplyMatrices(inv,node.matrixWorld)));
    let g;
    if(list.length===1)g=pieces[0];
    else { g=mergeGeometries(pieces);pieces.forEach(p=>p.dispose()); }
    if(!g)throw new Error('Incompatible fixed building geometry');
    g.computeBoundingSphere();
    const mesh=new Mesh(g,first.material);mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;
    mesh.name=first.name;group.add(mesh);list.forEach(m=>m.removeFromParent());
  }
  removable.forEach(n=>n.removeFromParent());
}
