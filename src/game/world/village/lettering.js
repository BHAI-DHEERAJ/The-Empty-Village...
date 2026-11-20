import { CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from 'three';
import { nightMaterial } from '../shaders.js';

const FONT = '600 88px "Noto Sans Devanagari"';
const baked = new WeakMap();

// Prefer the bundled font for the baked signs, but fall back to the browser's
// font if that optional download fails or holds up the village.
export async function loadLetteringFont() {
  let timeout;
  try {
    const font = document.fonts?.load(FONT, 'सूना गाँव · मुख्य सड़क 2 × 3');
    if (font) await Promise.race([font, new Promise(resolve => { timeout = setTimeout(resolve, 3000); })]);
  } catch { /* The canvas can use a system font. */ }
  finally { clearTimeout(timeout); }
}

function labelTexture(tint, text) {
  let labels = baked.get(tint);
  if (!labels) baked.set(tint, labels = new Map());
  if (labels.has(text)) return labels.get(text);
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.font = FONT;
  const metrics = ctx.measureText(text);
  const left = Math.ceil(Math.max(0,metrics.actualBoundingBoxLeft ?? 0));
  const right = Math.ceil(Math.max(metrics.width,metrics.actualBoundingBoxRight ?? 0));
  const top = Math.ceil(metrics.actualBoundingBoxAscent ?? 91), bottom = Math.ceil(metrics.actualBoundingBoxDescent ?? 22);
  const pad = 6, inkHeight = Math.max(1,top+bottom);
  canvas.width = left+right+2*pad;
  canvas.height = inkHeight+2*pad;
  ctx.font = FONT;
  ctx.fillStyle = '#fffaf0';
  ctx.fillText(text,left+pad,top+pad);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  const material = nightMaterial(new MeshStandardMaterial({ name: text, map, color: tint.color, emissive: tint.isMeshBasicMaterial ? tint.color : 0,
    emissiveIntensity: tint.isMeshBasicMaterial ? .8 : 0,
    alphaTest: .24, roughness: .96, polygonOffset: true, polygonOffsetFactor: -.8 }), 'village-lettering');
  material.addEventListener('dispose', () => { map.dispose();labels.delete(text); });
  const label = { material, aspect: canvas.width / canvas.height, inkHeight: inkHeight / canvas.height };
  labels.set(text,label);
  return label;
}

export function lettering(batch, tint, text, x, y, z, h = .18, maxWidth = Infinity, rx = 0) {
  if (typeof document === 'undefined') return; // Geometry/physics tests do not need a browser font renderer.
  const label = labelTexture(tint,text);
  if (!label) return;
  const halfW = Math.min(maxWidth, h * label.aspect / label.inkHeight) * .5, halfH = halfW / label.aspect;
  batch.panel(label.material, [[-halfW,-halfH,0],[halfW,-halfH,0],[halfW,halfH,0],[-halfW,halfH,0]],
    [[0,0],[1,0],[1,1],[0,1]], [0,1,2,0,2,3], { offset:[x,y,z], rx });
}
