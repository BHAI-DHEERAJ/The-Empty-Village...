import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, Object3D } from 'three';
import { WORLD } from '../settings.js';
import { between, seededRandom } from './random.js';
import { nightMaterial } from './shaders.js';
import { imageMaterial } from './materials.js';
import { courtAt, fieldAt, groundHeight, isSceneryFootprint, pathEdge } from './sceneryLayout.js';

const TILE = 8;
const RADIUS = 3;
const WORLD_BOUNDS = Object.freeze([-WORLD.halfSize, WORLD.halfSize, -WORLD.halfSize, WORLD.halfSize]);

function tuftGeometry() {
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i < 3; i += 1) {
    const k = positions.length / 3, angle = i * Math.PI / 3;
    const x = Math.cos(angle) * .268, z = Math.sin(angle) * .268;
    for (const [v, y] of [[0, 0], [.57, .19], [1, .348]]) {
      const shift = y * y * .28;
      positions.push(-x + shift, y, -z, x + shift, y, z);
      uvs.push(0, v, 1, v);
    }
    indices.push(k, k + 1, k + 2, k + 2, k + 1, k + 3, k + 2, k + 3, k + 4, k + 4, k + 3, k + 5);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createGrassField(scene, textures, { compact = false, bounds = WORLD_BOUNDS, edgeAt = pathEdge } = {}) {
  const [left,right,near,far]=bounds;
  const still=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const grid = compact ? 10 : 15;
  const geometry = tuftGeometry();
  const wind = { value: 0 };
  const leaf = imageMaterial(textures.wildGrass, { color: 0xc6d6ad, side: DoubleSide, alphaTest: .37, emissive: 0x252b20, emissiveMap: textures.wildGrass.albedo, emissiveIntensity: .34 });
  const material = nightMaterial(leaf, 'grass-cards-wind', (shader) => {
    shader.uniforms.uWindClock = wind;
    shader.vertexShader = `uniform float uWindClock;\n${shader.vertexShader}`.replace('#include <begin_vertex>', /* glsl */`
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 root = instanceMatrix[3].xz;
        float tips = pow(max(position.y, 0.0) * 2.0, 1.8);
        float gust = sin(dot(root, vec2(.84, .51)) + uWindClock * 1.54) * .44
          + sin(root.x * .31 - root.y * .19 - uWindClock * .78) * .56;
        transformed.x += (.014 + gust * .072) * tips;
        transformed.z += (.021 + gust * .044) * tips;
        float range = distance(root, cameraPosition.xz);
        transformed.y *= 1.0 - smoothstep(23.0, 33.2, range);
      #endif
    `);
  });
  const tiles = new Map(), spareMeshes = [], dummy = new Object3D(), color = new Color();
  let lastX = Infinity, lastZ = Infinity;

  function makeTile(tx, tz) {
    const random = seededRandom((tx * 73856093) ^ (tz * 19349663) ^ 0x31e5);
    const mesh = spareMeshes.pop() ?? new InstancedMesh(geometry, material, grid * grid);
    mesh.receiveShadow = true;
    mesh.name = 'Windblown textured grass';
    let count = 0;
    for (let j = 0; j < grid; j += 1) {
      for (let i = 0; i < grid; i += 1) {
        const x = tx * TILE + ((i + random()) * TILE) / grid;
        const z = tz * TILE + ((j + random()) * TILE) / grid;
        if (x < left || x > right || z < near || z > far || isSceneryFootprint(x, z, .03)) continue;
        const edge = edgeAt(x,z) + Math.sin(z * 1.81 + x * .75) * .19;
        if (edge < .15 && random() < (edge < -.31 ? .997 : .88)) continue;
        const court = courtAt(x, z);
        const patch = Math.sin(x * .78 + z * .6) * Math.sin(z * .52 - x * .29);
        const y=groundHeight(x,z);
        if(y<-.44 || random() < .26 - patch * .18 + court * .65 + (fieldAt(x,z) ? .30 : 0)) continue;
        const broad = between(random, .46, 1.31);
        const tall = between(random, .51, 1.42) * (1 + patch * .33) * (edge < .35 ? .55 : 1);
        dummy.position.set(x, y - .018, z);
        dummy.scale.set(broad, tall, broad);
        dummy.rotation.y = random() * Math.PI * 2;
        dummy.updateMatrix();
        mesh.setMatrixAt(count, dummy.matrix);
        const tint = between(random, .70, 1.24) + patch * .12;
        color.setRGB(tint * between(random, .87, 1.10), tint, tint * between(random, .77, 1.03));
        mesh.setColorAt(count++, color);
      }
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
    return mesh;
  }
  return {
    update(time, camera) {
      wind.value = still?0:time;
      const tx = Math.floor(camera.position.x / TILE), tz = Math.floor(camera.position.z / TILE);
      if (tx === lastX && tz === lastZ) return;
      lastX = tx;
      lastZ = tz;
      for (const [key, tile] of tiles) {
        if (Math.abs(tile.x - tx) > RADIUS || Math.abs(tile.z - tz) > RADIUS) {
          scene.remove(tile.mesh); spareMeshes.push(tile.mesh); tiles.delete(key);
        }
      }
      for (let z = tz - RADIUS; z <= tz + RADIUS; z += 1) {
        for (let x = tx - RADIUS; x <= tx + RADIUS; x += 1) {
          if (x * TILE > right || (x + 1) * TILE < left || z * TILE > far || (z + 1) * TILE < near) continue;
          const key = `${x}:${z}`;
          if (!tiles.has(key)) tiles.set(key, { x, z, mesh: makeTile(x, z) });
        }
      }
    },
    dispose() {
      for (const tile of tiles.values()) { scene.remove(tile.mesh); tile.mesh.dispose(); }
      for (const mesh of spareMeshes) mesh.dispose();
      geometry.dispose(); material.dispose(); tiles.clear(); spareMeshes.length = 0;
    },
  };
}
