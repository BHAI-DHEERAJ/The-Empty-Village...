import {
  Bone, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, MathUtils, Skeleton,
  SkinnedMesh, Sphere, Uint16BufferAttribute, Vector3,
} from 'three';
import { imageMaterial } from '../world/materials.js';
import { nightMaterial } from '../world/shaders.js';

export const WATCHER_HEIGHT = 3.05;
export const WATCHER_RADIUS = .57; // Includes the hands and the hidden step pose.
const TAU = 2 * Math.PI;
const RUN_LIMBS = [[-1,'L'],[1,'R']];
const { lerp, smoothstep } = MathUtils;

// An indexed, UV-mapped character sculpt. Rings are cross-sections of the
// actual anatomy/garment, not stacked cylinders or separate joint pegs.
class Sculpt {
  positions = [];
  colors = [];
  uv = [];
  joints = [];
  weights = [];
  faces = [[], [], []];
  seams = [];

  constructor(density) { this.density = density; }

  vertex(x, y, z, u, v, tone, weights) {
    const i = this.positions.length / 3;
    this.positions.push(x, y, z);
    this.colors.push(tone, tone, tone);
    this.uv.push(u, v);
    const [a, b = a, w = 0] = weights;
    this.joints.push(a, b, 0, 0);
    this.weights.push(1 - w, w, 0, 0);
    return i;
  }

  surface(material, rows, sides, sample, closed = true) {
    rows = Math.max(4, Math.round(rows * this.density));
    sides = Math.max(3, Math.round(sides * this.density));
    const start = this.positions.length / 3;
    const indices = this.faces[material];
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= sides; i++) this.vertex(...sample(j / rows, i / sides));
      const row = start + j * (sides + 1);
      if (closed) this.seams.push([row, row + sides]);
      if (j === 0) continue;
      for (let i = 0; i < sides; i++) {
        const a = row + i - sides - 1, b = row + i;
        indices.push(a, a + 1, b + 1, a, b + 1, b);
      }
    }
  }

  finish() {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(this.joints, 4));
    geometry.setAttribute('skinWeight', new Float32BufferAttribute(this.weights, 4));
    let start = 0;
    this.faces.forEach((indices, i) => {
      geometry.addGroup(start, indices.length, i);
      start += indices.length;
    });
    geometry.setIndex(this.faces.flat());
    geometry.computeVertexNormals();
    const normal = geometry.getAttribute('normal');
    const a = new Vector3(), b = new Vector3();
    for (const [i, j] of this.seams) {
      a.fromBufferAttribute(normal, i).add(b.fromBufferAttribute(normal, j)).normalize();
      normal.setXYZ(i, a.x, a.y, a.z);
      normal.setXYZ(j, a.x, a.y, a.z);
    }
    return geometry;
  }
}

// Smooth, variable-width cross-sections, authored from lowest to highest ring.
function profile(sections, t) {
  const y = lerp(sections[0][0], sections.at(-1)[0], t);
  const j = Math.max(0, sections.findIndex((s) => y <= s[0] + 1e-6) - 1);
  const a = sections[j], b = sections[j + 1];
  const f = MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
  const before = sections[j - 1] ?? a, after = sections[j + 2] ?? b;
  return [y, ...a.slice(1).map((n, k) => {
    const i = k + 1, d = b[i] - n, f2 = f * f, f3 = f2 * f, segment = b[0] - a[0];
    const va = (b[i] - before[i]) * segment / (b[0] - before[0]);
    const vb = (after[i] - n) * segment / (after[0] - a[0]);
    return n + (3 * f2 - 2 * f3) * d + (f3 - 2 * f2 + f) * va + (f3 - f2) * vb;
  })];
}

function rings(sculpt, material, sections, rows, sides, options) {
  const {
    uvX = 1, uvY = 1, shift = 0, phase = 0, folds = 0, tone = 1,
    deform = (x, y, z) => [x, y, z], weights,
  } = options;
  // Sections store [height, lateral radius, depth radius, centre X, centre Z].
  const row = Array.from({ length: rows + 1 }, (_, j) => profile(sections, j / rows));
  sculpt.surface(material, rows, sides, (t, u) => {
    const [y, rx, rz, cx, cz] = row[Math.round(t * rows)];
    const a = (u - .5) * TAU;
    const fold = 1 + folds * (.64 * Math.sin(9 * a + y * 11 + phase) + .36 * Math.sin(14 * a - y * 22 + phase));
    const x = Math.sin(a) * Math.max(.001, rx) * fold + cx;
    const z = Math.cos(a) * Math.max(.001, rz) * fold + cz;
    return [...deform(x, y, z, a, t), u * uvX + shift, t * uvY,
      tone * (.96 + .075 * Math.sin(a * 3 + y * 6 + phase) + (fold - 1) * .5), weights(y)];
  });
}

function makeRig(mesh) {
  const bones = [], lookup = {};
  const add = (name, position, parent) => {
    const object = new Bone();
    object.name = name;
    object.position.set(...position);
    if (parent) {
      const p = lookup[parent];
      p.object.add(object);
      object.position.sub(p.origin);
    } else mesh.add(object);
    const record = { object, origin: new Vector3(...position), id: bones.length };
    bones.push(object);
    lookup[name] = record;
  };
  add('hips', [0, 1.46, 0]);
  add('spine', [0, 1.81, -.019], 'hips');
  add('ribcage', [.006, 2.27, -.012], 'spine');
  add('neck', [.01, 2.514, .018], 'ribcage');
  add('skull', [.012, 2.645, .035], 'neck');
  add('left hem', [-.12, 1.47, -.006], 'hips');
  add('right hem', [.12, 1.47, -.006], 'hips');
  for (const side of [-1, 1]) {
    const l = side < 0 ? 'L' : 'R';
    add(`upper arm ${l}`, [side * .27, 2.386, -.014], 'ribcage');
    add(`forearm ${l}`, [side * .349, 1.803, .002], `upper arm ${l}`);
    add(`hand ${l}`, [side * .411, 1.243, .032], `forearm ${l}`);
    add(`thigh ${l}`, [side * .122, 1.428, 0], 'hips');
    add(`shin ${l}`, [side * .15, .786, .027], `thigh ${l}`);
    add(`foot ${l}`, [side * .166, .153, -.02], `shin ${l}`);
  }
  mesh.updateMatrixWorld(true);
  mesh.bind(new Skeleton(bones));
  return lookup;
}

function shapeWatcher(rig, density) {
  const mesh = new Sculpt(density);
  const id = (name) => rig[name].id;
  const blend = (y, low, high, from, to) => [id(from), id(to), smoothstep(y, low, high)];
  const torso = (y) => y < 1.95 ? blend(y, 1.62, 1.93, 'hips', 'spine') : blend(y, 2.01, 2.31, 'spine', 'ribcage');
  rings(mesh, 0, [
    [1.43,.203,.115,0,0],[1.56,.215,.145,0,-.008],[1.76,.175,.121,.004,-.023],
    [1.98,.186,.135,.008,-.028],[2.19,.233,.145,.006,-.009],[2.30,.273,.143,.003,-.009],
    [2.395,.293,.122,.004,-.015],[2.451,.235,.102,.004,-.010],[2.508,.112,.072,.014,.007],
    [2.519,.082,.060,.014,.011],
  ], 31, 42, { uvX: 2, uvY: 2, folds: .089, tone: .81, weights: torso });

  // The coat opens below the waist: two hanging, ragged cloth panels with
  // individually weighted hems. The out-of-sight step can flex both panels.
  for (const side of [-1, 1]) {
    const hem = side < 0 ? 'left hem' : 'right hem';
    mesh.surface(0, 26, 24, (t, u) => {
      const edge = (1 - t) ** 4;
      const opening = .13 + edge * .35;
      const a = lerp(side < 0 ? -Math.PI + .065 : opening, side < 0 ? -opening : Math.PI - .061, u);
      const jagged = (.028 * Math.sin(a * 15 + side) + .036 * Math.sin(a * 25 - .7) + .016 * Math.cos(a * 61)) * edge;
      const y = lerp(side < 0 ? .863 : .938, 1.67, t) + jagged + edge * .08 * Math.cos(a);
      const fold = .018 * Math.sin(a * 11 + t * 3) + .009 * Math.cos(a * 19 - t * 3);
      const r = lerp(.292, .199, t) + fold;
      const z = Math.cos(a) * (lerp(.181, .141, t) + fold * .71) - .018;
      return [Math.sin(a) * r, y, z, (a / TAU + .5) * 2, t * 1.59,
        .73 + .10 * Math.cos(a * 5 - t * 3), blend(y, 1.38, 1.59, hem, 'hips')];
    }, false);
  }

  // Overlapped lapels, a frayed placket and curved collar keep the coat readable
  // even with the dark material. These are mesh details, not painted cylinders.
  mesh.surface(0, 13, 8, (t, u) => {
    const y = lerp(1.91, 2.508, t), x = (u - .5) * (.076 + .158 * t);
    return [x, y, .121 + .029 * Math.sin(Math.PI * t) - Math.abs(x) * .12, u, t * 2, .45, torso(y)];
  }, false);
  for (const side of [-1, 1]) {
    mesh.surface(0, 21, 5, (t, u) => {
      const y = lerp(1.52, 2.493, t) + (u - .5) * .036;
      const wide = .027 + .105 * Math.exp(-((t - .80) ** 2) / .029);
      const seam = .012 + .083 * smoothstep(t, .52, .96);
      const x = side * (seam + wide * (side < 0 ? 1 - u : u));
      const z = .144 - .056 * smoothstep(t, .82, 1) - .15 * Math.abs(x) + .013 * Math.sin(u * Math.PI);
      return [x, y, z, u * .43, t * 1.7, .68 + .46 * (side < 0 ? u : 1-u), torso(y)];
    }, false);
  }
  rings(mesh, 0, [[2.47,.108,.075,.011,.016],[2.512,.100,.081,.014,.017],
    [2.560,.094,.072,.010,.026]], 9, 34, {
    tone: .78, weights: (y) => blend(y, 2.49, 2.56, 'ribcage', 'neck'),
    deform: (x, y, z, a, t) => [x, y + .044 * Math.cos(a) * t + .013 * Math.sin(a * 3) * t, z],
  });
  rings(mesh, 1, [[2.49,.073,.062,.012,.018],[2.58,.064,.056,.012,.036],
    [2.66,.072,.063,.014,.040],[2.717,.081,.073,.016,.038]], 12, 28, {
    tone: .75, weights: (y) => blend(y, 2.58, 2.68, 'neck', 'skull'),
  });

  for (const side of [-1, 1]) {
    const l = side < 0 ? 'L' : 'R', s = side;
    const arm = `upper arm ${l}`, forearm = `forearm ${l}`, hand = `hand ${l}`;
    rings(mesh, 0, [
      [1.234,.054,.051,s*.413,.031],[1.28,.063,.056,s*.409,.028],
      [1.41,.057,.053,s*.399,.020],[1.62,.069,.064,s*.382,.006],
      [1.77,.070,.065,s*.353,.001],[1.84,.076,.075,s*.346,-.01],
      [2.07,.088,.093,s*.321,-.020],[2.25,.106,.109,s*.294,-.020],
      [2.381,.113,.119,s*.269,-.021],[2.431,.091,.091,s*.247,-.017],
      [2.466,.002,.003,s*.231,-.016],
    ], 32, 28, { uvY: 2.35, folds: .128, phase: side * 1.32, tone: .78,
      weights: (y) => y > 2.29 ? blend(y, 2.31, 2.465, arm, 'ribcage') : blend(y, 1.70, 1.91, forearm, arm) });
    rings(mesh, 1, [[1.064,.032,.031,s*.428,.053],[1.121,.048,.031,s*.429,.047],
      [1.17,.044,.036,s*.419,.044],[1.241,.030,.029,s*.413,.035],[1.30,.038,.036,s*.406,.03]], 16, 22,
    { tone: .92, shift: side * .21, weights: (y) => blend(y, 1.221, 1.277, hand, forearm) });
    for (let i = 0; i < 5; i++) {
      const thumb = i === 4;
      const x = s * (.394 + i * .020 - (thumb ? .099 : 0));
      const bottom = thumb ? 1.017 : [.918,.893,.906,.949][i], top = thumb ? 1.193 : 1.109 + i * .002;
      const r = thumb ? .017 : .016 - i * .0012;
      rings(mesh, 1, [[bottom,.004,.005,x-s*.018,.088],[bottom+.028,r*.72,r*.71,x-s*.013,.066],
        [lerp(bottom,top,.46),r*.93,r*.82,x,.049],[lerp(bottom,top,.69),r*.74,r*.76,x+s*.002,.054],
        [top,r,r*.90,x,.055]], 11, 12, { shift: i * .39, tone: thumb ? .90 : .97, weights: () => [id(hand)] });
    }

    const thigh = `thigh ${l}`, shin = `shin ${l}`, foot = `foot ${l}`;
    const leg = (y) => y > 1.32 ? blend(y, 1.34, 1.54, thigh, 'hips') : blend(y, .685, .9, shin, thigh);
    rings(mesh, 0, [[.135,.044,.044,s*.168,-.026],[.21,.061,.058,s*.169,-.018],
      [.43,.053,.056,s*.163,-.012],[.66,.063,.060,s*.154,.007],[.777,.080,.067,s*.148,.022],
      [.871,.073,.074,s*.145,.013],[1.08,.085,.086,s*.138,.004],[1.35,.098,.105,s*.125,-.012],
      [1.54,.092,.103,s*.111,-.012]], 29, 25, { uvY: 2.25, folds: .152, tone: side < 0 ? 1.0 : .94, phase: side, weights: leg });
    rings(mesh, 0, [[.012,.051,.132,s*.174,.039],[.037,.065,.147,s*.174,.045],
      [.066,.064,.142,s*.171,.040],[.099,.057,.108,s*.169,.018],[.144,.052,.068,s*.167,-.015],
      [.201,.049,.044,s*.166,-.021]], 15, 23, { tone: .63, shift: .95, weights: (y) => blend(y, .12, .197, foot, shin) });
  }

  // Crown, temples, cheeks and long jaw. The frontal projection in the baked
  // atlas shares these proportions; the empty eye sockets also recess in 3D.
  const widths = [0,.05,.10,.18,.23,.32,.40,.48,.55,.66,.77,.86,.94,.99,1];
  const contour = [.005,.052,.074,.091,.103,.117,.129,.136,.144,.150,.139,.116,.077,.031,.003];
  const depth = [.008,.062,.089,.103,.112,.123,.127,.132,.140,.139,.130,.111,.081,.034,.005];
  const face = widths.map((t, i) => [2.570 + .479 * t, contour[i], depth[i], .014 + .009 * t, .031 - .025 * t]);
  const bell = (value, centre, spread) => Math.exp(-(((value - centre) / spread) ** 2));
  rings(mesh, 2, face, 61, 62, { weights: () => [id('skull')],
    deform(x, y, z, a, t) {
      const front = smoothstep(Math.cos(a), .41, .87);
      const wide = Math.abs(x - (.014 + .009 * t));
      const eye = bell(wide, .066, .043) * bell(t, .539, .072);
      const brow = bell(wide, .066, .053) * bell(t, .605, .049);
      const nose = bell(wide, 0, .021) * bell(t, .397, .081);
      const bridge = bell(wide, 0, .015) * bell(t, .49, .139);
      const cheek = bell(wide, .095, .032) * bell(t, .366, .067);
      const mouth = bell(wide, 0, .047) * bell(t, .204, .018);
      return [x, y, z + front * (-.049 * eye + .019 * brow + .047 * nose + .027 * bridge + .018 * cheek - .012 * mouth)];
    },
  });
  for (const side of [-1, 1]) {
    const x = (a) => side * a + .018;
    rings(mesh, 1, [[2.724,.004,.008,x(.109),.009],[2.751,.017,.022,x(.121),.001],
      [2.789,.020,.031,x(.132),-.009],[2.828,.018,.028,x(.139),-.013],
      [2.844,.003,.008,x(.136),-.014]], 14, 20, { weights: () => [id('skull')], tone: .72,
      deform: (u, y, z, a, t) => [u - side * .009 * Math.sin(t * Math.PI) * smoothstep(Math.cos(a), .1, .9), y, z] });
  }
  return mesh.finish();
}

export function createWatcherModel(textures, { compact = false, tints = [] } = {}) {
  const group = new Group();
  group.name = 'THE WATCHER';
  group.visible = false;
  const materials = [textures.watcherCloth, textures.watcherSkin, textures.watcherFace].map((surface, i) =>
    imageMaterial(surface, { color:tints[i]??0xffffff, vertexColors: true, strength: [.61,.43,.36][i], ...(i === 0 ? { side: DoubleSide } : {}) }));
  const glow = { value: .72 }, opacity = { value: 1 };
  // Turn a solid into wisps at road banks without transparent sorting or a
  // pop. The regular Watcher and the entire sprint keep a fully solid mesh.
  const veil = (shader) => {
    shader.uniforms.uVeil=opacity;
    shader.fragmentShader=`uniform float uVeil;\n${shader.fragmentShader}`.replace('#include <alphatest_fragment>',
      `#include <alphatest_fragment>
       if(uVeil<.999&&fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))>uVeil) discard;`);
  };
  materials.slice(0,2).forEach((m,i)=>nightMaterial(m,`road-silhouette-${i}`,veil));
  // The emissive portions follow the real face UVs and skull animation. The
  // two eyes still get occluded by scenery and attenuated by the village fog.
  nightMaterial(materials[2], 'watcher-amber-eyes', (shader) => {
    veil(shader);shader.uniforms.uEyeGlow = glow;
    shader.fragmentShader = `uniform float uEyeGlow;\n${shader.fragmentShader}`.replace(
      '#include <emissivemap_fragment>',
      /* glsl */`#include <emissivemap_fragment>
        vec2 eyeOffset = vec2(abs(abs(vMapUv.x - .5) - .075), abs(vMapUv.y - .539));
        vec2 footprint = min(vec2(.020, .019), fwidth(vMapUv) * .42);
        vec2 socket = eyeOffset / (vec2(.029, .036) + footprint);
        float radius = length(socket);
        float ember = 1. - smoothstep(.26, .76, radius);
        float iris = 1. - smoothstep(.02, .31, radius);
        float bruise = 1. - smoothstep(.45, 1.34, radius);
        totalEmissiveRadiance += uEyeGlow * (vec3(1.39, .11, .033) * ember +
          vec3(1.61, .63, .12) * iris + vec3(.16, .009, .004) * bruise);
      `);
  });
  const mesh = new SkinnedMesh(undefined, materials);
  mesh.name = 'Skinned Watcher sculpt';
  mesh.receiveShadow = true; // No stale silhouette in the throttled flashlight shadow map on a vanish.
  const rig = makeRig(mesh);
  mesh.geometry = shapeWatcher(rig, compact ? .73 : .90);
  mesh.boundingSphere = new Sphere(new Vector3(0, WATCHER_HEIGHT / 2, 0), 1.72);
  group.add(mesh);
  let handedness = 1;

  function tilt(amount) {
    rig.skull.object.rotation.set(.049 + amount * .20, .025 * handedness, handedness * (.109 + amount));
    rig.neck.object.rotation.z = handedness * amount * .13;
  }

  function hold(hand, pose) {
    handedness = hand;
    const compactPose = pose !== 'standing';
    for (const joint of Object.values(rig)) {
      joint.object.rotation.set(0, 0, 0);
    }
    rig.hips.object.position.y = rig.hips.origin.y;
    rig.spine.object.rotation.x = compactPose ? .092 : .037;
    rig.ribcage.object.rotation.z = -.046 * handedness;
    rig['forearm L'].object.rotation.x = -.054;
    rig['forearm R'].object.rotation.x = .019;
    rig['hand L'].object.rotation.z = -.081;
    rig['hand R'].object.rotation.z = .046;
    tilt(0);
  }

  // A single, slow step for withdrawing entirely outside the player's view.
  function step(progress) {
    const swing = Math.sin(progress * TAU), weight = Math.sin(progress * Math.PI);
    rig.hips.object.position.y = rig.hips.origin.y - weight * .024;
    rig['thigh L'].object.rotation.x = swing * .25;
    rig['thigh R'].object.rotation.x = -swing * .25;
    rig['shin L'].object.rotation.x = Math.max(0, swing) * .22;
    rig['shin R'].object.rotation.x = Math.max(0, -swing) * .22;
    rig['upper arm L'].object.rotation.x = -swing * .114;
    rig['upper arm R'].object.rotation.x = swing * .114;
    rig['left hem'].object.rotation.x = swing * .088;
    rig['right hem'].object.rotation.x = -swing * .085;
  }

  // Multi-step cadence for the occasional visible retreat. Arms and hems carry
  // opposite momentum; the body stops when the observer meets its gaze.
  function walk(travel, weight) {
    const phase = travel * TAU * .67;
    const swing = Math.sin(phase) * weight;
    rig.hips.object.position.y = rig.hips.origin.y - (.015 + .016 * Math.abs(Math.cos(phase))) * weight;
    rig['thigh L'].object.rotation.x = swing * .32;
    rig['thigh R'].object.rotation.x = -swing * .32;
    rig['shin L'].object.rotation.x = Math.max(0, swing) * .34;
    rig['shin R'].object.rotation.x = Math.max(0, -swing) * .34;
    rig['foot L'].object.rotation.x = -Math.max(0, swing) * .17;
    rig['foot R'].object.rotation.x = -Math.max(0, -swing) * .17;
    rig['upper arm L'].object.rotation.x = -swing * .20;
    rig['upper arm R'].object.rotation.x = swing * .20;
    rig['left hem'].object.rotation.x = swing * .107;
    rig['right hem'].object.rotation.x = -swing * .104;
  }

  // Arms pump with the stride, then both reach toward the camera. The hips
  // drop into the lunge while the neck counter-rotates to keep the eyes up.
  function run(cycles, effort, reach) {
    const phase = cycles * TAU;
    const stride = Math.sin(phase), beat = Math.cos(phase);
    rig.hips.object.position.y = rig.hips.origin.y + effort * (.018 - .094 * Math.abs(beat)) - reach * .22;
    rig.spine.object.rotation.x = .037 + .29 * effort + .115 * reach;
    rig.ribcage.object.rotation.set(.028 * effort, stride * .15 * effort * (1 - reach), -.078 * effort * beat + .045 * reach);
    rig.neck.object.rotation.set(-.135 * effort, 0, 0);
    rig.skull.object.rotation.set(.05 - .25 * effort + .095 * reach,
      .07 * stride * effort, .109 * handedness * (1 - effort) + effort * (.11 * beat - .14 * reach));
    for (const [side, limb] of RUN_LIMBS) {
      const swing = stride * side, back = Math.max(0,swing), armReach = reach * (side < 0 ? 1 : .94);
      rig[`thigh ${limb}`].object.rotation.x = effort * (.07 + swing * .86);
      rig[`shin ${limb}`].object.rotation.x = effort * (.16 + back * 1.05);
      rig[`foot ${limb}`].object.rotation.x = effort * (.10 * beat * side - back * .38);
      rig[`upper arm ${limb}`].object.rotation.set(
        lerp(effort * (.155 - swing * .83), -1.65 + side * .073, armReach),
        -side * armReach * (.156 + .022 * beat),
        side * lerp(.085 * effort, -.047, armReach), 'YXZ');
      rig[`forearm ${limb}`].object.rotation.x = lerp(-effort * (.89 + .23 * back), -.16 - side * .06, armReach);
      rig[`hand ${limb}`].object.rotation.set(armReach * (.33 + .10 * swing), -side * armReach * .28,
        side * lerp(-.075 * effort, .17 + .075 * beat, armReach));
      rig[side < 0 ? 'left hem' : 'right hem'].object.rotation.x = (.25 + swing * .20) * effort;
    }
  }

  function contort(time,amount,glance=0){
    const pulse=amount*(.89+.11*Math.sin(time*9.8));
    rig['hand R'].object.rotation.set(-.77*pulse,-.62*pulse,.46*pulse);
    rig['forearm R'].object.rotation.z=-.22*pulse;
    rig.ribcage.object.rotation.y=-.089*pulse;
    rig.skull.object.rotation.y+=glance;
  }
  return {
    group, mesh, hold, tilt, step, walk, run, contort,
    veil(value){opacity.value=value;},
    eyes(intensity) { glow.value = intensity; },
    dispose() {
      group.removeFromParent();
      mesh.geometry.dispose();
      mesh.skeleton.dispose();
      materials.forEach((material) => material.dispose());
    },
  };
}
