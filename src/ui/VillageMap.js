import { APPROACHES, CANAL, COURTS, entryPoint, ROUTES, SITES, WELL, worldPoint } from '../game/world/sceneryLayout.js';

const SVG = 'http://www.w3.org/2000/svg';
const round = value => Math.round(value * 100) / 100;
const coords = points => points.map(([x, z]) => `${round(x)},${round(z)}`).join(' ');

// Three.js X is east and Z is south. SVG uses the same two axes, so both
// the geometry and the live route can be plotted without a second map layout.
export function mapViewBox(feet, overview = false) {
  if (!overview) return [round(feet.x - 26), round(feet.z - 17), 52, 34];
  const left = Math.min(-148, feet.x - 9), right = Math.max(150, feet.x + 9);
  const north = Math.min(-139, feet.z - 9), south = Math.max(86, feet.z + 9);
  return [left, north, right - left, south - north].map(round);
}

export function routePolyline(feet, waypoints) {
  return waypoints.length ? coords([[feet.x, feet.z], ...waypoints]) : '';
}

export function playerTransform(feet, heading, overview = false) {
  return `translate(${round(feet.x)} ${round(feet.z)}) rotate(${round(heading)}) scale(${overview ? 3.15 : 1})`;
}

function draw(parent, type, attrs = {}) {
  const element = parent.ownerDocument.createElementNS(SVG, type);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  parent.append(element);
  return element;
}

function rect(parent, x, y, width, height, cls, attrs = {}) {
  return draw(parent, 'rect', { x, y, width, height, class: cls, ...attrs });
}

function path(parent, d, cls, attrs = {}) {
  return draw(parent, 'path', { d, class: cls, ...attrs });
}

const DISTRICT_LABELS = [
  [-103, -32, 'जंगल', 'WEST WOODS'], [-64, -100, 'हवेली', 'HAVELI'],
  [24, -86, 'पुरानी बस्ती', 'OLD QUARTER'], [-24, -47, 'गाँव', 'VILLAGE'],
  [47, -52, 'स्कूल', 'SCHOOL'], [121, -3, 'खेत', 'FIELDS'],
  [64, 63, 'नहर', 'CANAL'],
];

function drawTerrain(svg, id, overview) {
  const defs = draw(svg, 'defs'), terrain = draw(svg, 'g');
  const grid = draw(defs, 'pattern', { id: `${id}-grid`, width: 10, height: 10, patternUnits: 'userSpaceOnUse' });
  path(grid, 'M0 10V0H10', 'map-grid');
  const furrows = draw(defs, 'pattern', { id: `${id}-furrows`, width: 3.1, height: 3.1, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-12)' });
  path(furrows, 'M1 0V3.1', 'map-furrow');
  const trees = draw(defs, 'pattern', { id: `${id}-woods`, width: 8.8, height: 10.4, patternUnits: 'userSpaceOnUse' });
  path(trees, 'M1 4 2.2 1.6 3.4 4Zm4.4 5 1-2.1 1.1 2.1Z', 'map-tree');
  rect(terrain, -190, -190, 380, 380, 'map-ground');
  const woods = 'M-190-190h135q20 41 12 73-14 33 4 73t-5 52q-16 26 9 57t-12 125h-143Z';
  path(terrain, woods, 'map-woods');
  path(terrain, woods, '', { fill: `url(#${id}-woods)` });
  for (const d of [
    'M-190-155Q-117-145-78-103T-68-6-92 71-53 190',
    'M-190-139Q-120-133-91-94T-81-7-103 74-63 190',
    'M-190-122Q-133-113-106-75T-95 6-118 83-75 190',
    'M-36-185Q-13-146 1-140T60-123 123-81 186-71',
    'M-26-187Q-9-154 10-149T69-134 135-93 186-83',
    'M9 190Q-4 140 16 118T60 92 154 96 188 63',
    'M19 190Q6 146 27 124T69 104 155 107 188 79',
  ]) path(terrain, d, 'map-contour');
  for (const [x, z, w, h] of [[52,-26,26,23],[52,21,24,24],[51,48,27,15],[89,-27,52,17],[89,19,22,17],[114,22,30,14],[89,43,53,19]]) {
    rect(terrain, x, z, w, h, 'map-field', { rx: 1 });
    rect(terrain, x, z, w, h, '', { rx: 1, fill: `url(#${id}-furrows)` });
  }
  rect(terrain, -190, -190, 380, 380, '', { fill: `url(#${id}-grid)` });
  for (const [x, z, w, h] of COURTS) {
    draw(terrain, 'ellipse', { class: 'map-yard', cx: x, cy: z, rx: w * .8, ry: h * .74 });
  }
  for (const { points } of APPROACHES) {
    draw(terrain, 'polyline', { class: 'map-lane', points: coords(points) });
  }
  for (const { path: points, width } of ROUTES) {
    draw(terrain, 'polyline', { class: 'map-road-edge', points: coords(points), 'stroke-width': width * 1.67 });
    draw(terrain, 'polyline', { class: 'map-road', points: coords(points), 'stroke-width': width * 1.3 });
  }
  const { x, z0, z1, half, bridgeZ } = CANAL;
  rect(terrain, x - half - .48, z0, (half + .48) * 2, z1 - z0, 'map-bank', { rx: 1.44 });
  rect(terrain, x - half, z0 + .36, half * 2, z1 - z0 - .72, 'map-water', { rx: 1.1 });
  for (const [i, z] of bridgeZ.entries()) {
    const width = i === 1 ? 3.65 : 2.81;
    rect(terrain, x - half - 1.35, z - width / 2, (half + 1.35) * 2, width, 'map-bridge');
  }
  const sites = new Map();
  for (const site of SITES) {
    const { id: siteId, x, z, w, d, yaw, residence } = site;
    const footprint = rect(terrain, -w / 2, -d / 2, w, d, 'map-house', {
      rx: .36, transform: `translate(${x} ${z}) rotate(${round(-yaw * 180 / Math.PI)})`,
      'data-site': siteId,
    });
    if (!residence || siteId === 'mansion-01') footprint.classList.add('map-landmark');
    sites.set(siteId, footprint);
    if (!overview) {
      const [u, v] = entryPoint(site);
      const [a, b] = worldPoint(site, u - .54, v), [c, e] = worldPoint(site, u + .54, v);
      path(terrain, `M${round(a)} ${round(b)}L${round(c)} ${round(e)}`, 'map-entry');
    }
  }
  draw(terrain, 'circle', { cx: WELL.x, cy: WELL.z, r: WELL.r, class: 'map-well' });
  if (overview) {
    for (const [x, z, hi, en] of DISTRICT_LABELS) {
      draw(terrain, 'text', { class: 'map-district', x, y: z }).textContent = hi;
      draw(terrain, 'text', { class: 'map-district-en', x, y: z + 6.9, lang: 'en' }).textContent = en;
    }
  }
  return sites;
}

export class VillageMap {
  constructor(svg, { overview = false, id } = {}) {
    this.svg = svg;
    this.overview = overview;
    this.footprints = drawTerrain(svg, id, overview);
    this.routeBack = draw(svg, 'polyline', { class: 'map-path-edge' });
    this.routeLine = draw(svg, 'polyline', { class: 'map-path-line', 'data-map-path': '' });
    this.goal = draw(svg, 'g', { class: 'map-objective', 'data-map-goal': '' });
    draw(this.goal, 'circle', { r: 2.8 });
    this.diamond = path(this.goal, 'M0-1.5 1.5 0 0 1.5-1.5 0Z', 'map-diamond');
    this.car = path(this.goal, 'M-1.45 1.2v-1.2l.56-1.24H.89L1.45 0v1.2m-2.9-.32h2.9m-2.65-.73h.36m1.68 0h.36', 'map-car');
    this.player = draw(svg, 'g', { class: 'map-player', 'data-map-player': '' });
    path(this.player, 'M0 0-5.2-8.7Q0-11.8 5.2-8.7Z', 'map-cone');
    draw(this.player, 'circle', { r: 2.3, class: 'map-player-ring' });
    path(this.player, 'M0-2.55 1.67 1.6 0 .87-1.67 1.6Z', 'map-player-tip');
  }

  render(time, feet, heading, waypoints, goal, force = false) {
    const { overview } = this;
    // Moving the SVG camera and line is cheap, but don't rewrite either at
    // render-frame rate on a phone. Render instantly when the route changes.
    const next = waypoints[0];
    const changed = this.lastGoal !== goal || this.nextX !== next?.[0] || this.nextZ !== next?.[1] || this.lastCount !== waypoints.length;
    if (!force && !changed && time < this.nextFrame) return;
    this.nextFrame = time + .045;
    this.nextX = next?.[0]; this.nextZ = next?.[1]; this.lastCount = waypoints.length;
    const box = mapViewBox(feet, overview).join(' ');
    const plot = routePolyline(feet, waypoints), player = playerTransform(feet, heading, overview);
    if (box !== this.lastBox) { this.svg.setAttribute('viewBox', box); this.lastBox = box; }
    if (plot !== this.lastPlot) {
      this.routeLine.setAttribute('points', plot);
      this.routeBack.setAttribute('points', plot);
      this.lastPlot = plot;
    }
    if (player !== this.lastPlayer) { this.player.setAttribute('transform', player); this.lastPlayer = player; }
    if (this.lastGoal !== goal) {
      this.footprints.get(this.lastGoal?.site)?.removeAttribute('data-objective');
      this.footprints.get(goal?.site)?.setAttribute('data-objective', '');
      this.goal.style.display = goal ? '' : 'none';
      if (goal) {
        const repair = goal.kind === 'repair';
        this.goal.setAttribute('transform', `translate(${round(goal.at.x)} ${round(goal.at.z)}) scale(${overview ? 2.8 : 1})`);
        this.car.style.display = repair ? '' : 'none';
        this.diamond.style.display = repair ? 'none' : '';
      }
      this.lastGoal = goal;
    }
  }
}
