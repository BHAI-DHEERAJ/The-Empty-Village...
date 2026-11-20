import { Group } from 'three';
import { ModelBatch } from './modeling.js';

export function cobweb(batch, material, center, horizontal, vertical, sides = 8, radius = .0028) {
  const point = (t, distance) => center.map((v, i) => v + (horizontal[i] * Math.cos(t) + vertical[i] * Math.sin(t)) * distance);
  const angles = Array.from({ length: sides + 1 }, (_, i) => i / sides * Math.PI * 2);
  angles.slice(0, -1).forEach((ang, i) => batch.beam(material, center, point(ang, i % 3 ? 1 : 1.17), radius, 3));
  for (const ring of [.24,.43,.65,.85]) {
    for (let i = 0; i < sides; i += 1) {
      if (((i + Math.round(ring * 10)) % 9) === 0) continue;
      batch.beam(material, point(angles[i], ring), point(angles[i + 1], ring * (.97 + (i % 3) * .03)), radius * .66, 3);
    }
  }
}

export function paperFlat(b, m, x, y, z, w, h, ry = 0) {
  b.panel(m, [[x-w/2,y,z-h/2],[x+w/2,y,z-h/2],[x+w/2,y+.007,z+h/2],[x-w/2,y+.021,z+h/2]].map(([a,v,c]) => {
    const dx = a-x, dz=c-z; return [x+dx*Math.cos(ry)+dz*Math.sin(ry),v,z-dx*Math.sin(ry)+dz*Math.cos(ry)];
  }), [[0,1],[1,1],[1,0],[0,0]], [0,2,1,0,3,2]);
}

export function frame(b, p, material, x, y, z, w, h, rz = 0, floor = false) {
  const rx = floor ? -Math.PI / 2 + .09 : 0;
  function transform(a, c) {
    return [x+a*Math.cos(rz)-c*Math.sin(rz), y+(a*Math.sin(rz)+c*Math.cos(rz))*Math.cos(rx), z+(a*Math.sin(rz)+c*Math.cos(rz))*Math.sin(rx)];
  }
  for (const v of [-1, 1]) {
    const [a, yy, zz] = transform(0, h / 2 * v);
    b.box(p.darkWood, a, yy, zz, w+.032, .026, .028, { rz, rx });
    const [u, vy, vz] = transform(w / 2 * v, 0);
    b.box(p.wood, u, vy, vz, .025, h, .027, { rz, rx });
  }
  b.panel(material, [transform(-w/2,-h/2),transform(w/2,-h/2),transform(w/2,h/2),transform(-w/2,h/2)],
    [[0,0],[1,0],[1,1],[0,1]], [0,1,2,0,2,3]);
}

function furnitureMaterials(p, metal) { return metal ? [p.iron, p.rust] : [p.wood, p.darkWood]; }
export function table(b, p, x, y, z, w, d, h, { metal = false, broken = false, skew = 0 } = {}) {
  const [top, leg] = furnitureMaterials(p, metal);
  b.box(top, x, y+h, z, w, .066, d, { rz: skew });
  for (const u of [-1,1]) for (const v of [-1,1]) {
    if (broken && u === 1 && v === -1) continue;
    b.box(leg,x+u*(w/2-.071),y+h/2,z+v*(d/2-.069),.061,h,.061,{ rz: broken && u < 0 ? -.12 : 0 });
  }
  if (!metal) b.box(p.darkWood,x,y+h-.079,z+d*.43,w-.12,.13,.055);
}

export function chair(b, p, x, y, z, { fallen = false, rotation = 0 } = {}) {
  const cx = Math.cos(rotation), sx = Math.sin(rotation);
  function piece(m, a, h, d, w, zHeight, depth, angle = 0) {
    const back = fallen ? -h * .86 + d : d;
    b.box(m,x+a*cx+back*sx,y+(fallen ? d*.48+.15 : h),z-a*sx+back*cx,w,zHeight,depth,
      { ry: rotation, rx: fallen ? -1.13 : 0, rz: angle });
  }
  piece(p.wood,0,.44,0,.43,.057,.40);
  for (const a of [-.17,.17]) for (const d of [-.16,.16]) if (!fallen || a < 0 || d < 0) piece(p.darkWood,a,.228,d,.045,.42,.051);
  for (const a of [-.17,.17]) piece(p.wood,a,.65,-.165,.049,.43,.046, fallen ? .16 : 0);
  piece(p.softWood,0,.81,-.176,.41,.106,.043, fallen ? -.12 : .04);
}

export function cabinet(b, p, x, z, { medical = false, width = .88, height = 1.48 } = {}) {
  const mat = medical ? p.iron : p.wood;
  const side = medical ? p.dullTeal : p.darkWood;
  b.box(side,x,height/2,z-.21,width,height,.049);
  for (const dx of [-width*.47,width*.47]) b.box(mat,x+dx,height/2,z,.063,height,.44);
  for (const y of [.10,.48,.90,height]) b.box(mat,x,y,z,width,.055,.45);
  b.box(side,x-width*.31,height*.64,z+.31,width*.49,height*.68,.054,{ ry: .58, rz:-.038 });
  b.box(p.rust,x-width*.42,height*.65,z+.42,.016,.12,.023);
  if (medical) {
    for (const [a,y,s] of [[-.21,.49,.065],[.16,.49,.073],[.26,.92,.072],[-.23,.92,.043]]) bottle(b,p,x+a,y,z-.058,s);
  } else {
    book(b,p,x+.19,.52,z-.03,.19,.14,.029,.4);
    bottle(b,p,x+.22,.14,z-.06,.074);
  }
}

export function bottle(b,p,x,y,z,s=.055) {
  b.pot(p.darkGlass,x,y,z,[[0,0],[s*.91,0],[s,.047],[s,.153],[s*.47,.196],[s*.43,.237],[s*.48,.245]]);
  b.cylinder(p.iron,x,y+.248,z,s*.49,s*.49,.014);
}
export function book(b,p,x,y,z,w=.21,d=.29,h=.038,ry=0) {
  b.box(p.cloth,x,y+h*.5,z,w*.94,h*.64,d*.96,{ ry });
  for (const dy of [.004,h-.004]) b.box(p.pottery,x,y+dy,z,w,.008,d,{ ry });
  paperFlat(b,p.paper,x,y+h+.003,z,w*.9,d*.89,ry);
}
export function bowl(b,p,x,y,z,r=.11,metal=false) {
  b.pot(metal ? p.iron : p.pottery,x,y,z,[[0,0],[r*.56,0],[r*.94,.043],[r,.062],[r*.89,.063],[r*.82,.041],[r*.52,.022],[0,.022]]);
}

export function cot(b,p,x,z,{medical=false,blanket=p.dirtyCloth}={}) {
  const mat = medical ? p.iron : p.wood;
  for (const sx of [-1,1]) for(const sz of [-1,1]) b.cylinder(mat,x+sx*.42,medical?.36:.19,z+sz*.93,.043,.055,medical?.72:.38);
  for (const sx of [-1,1]) b.box(mat,x+sx*.43,.44,z,.065,.072,1.98);
  for (const s of [-1,1]) b.box(mat,x,.43,z+s*.95,.91,.078,.058);
  if (medical) {
    b.beam(p.rust,[x-.43,.64,z-.93],[x+.43,.64,z-.93],.034);
    b.beam(p.iron,[x-.43,.57,z+.93],[x+.43,.57,z+.93],.029);
  }
  b.box(medical ? p.dirtyCloth : p.rope,x,.476,z,.81,.115,1.83,{rz:.028});
  if (!medical) {
    for (let i=0;i<9;i++) b.beam(p.rope,[x-.412,.508,z-.86+i*.207],[x+.413,.502,z-.86+i*.207],.010,4);
  }
  b.box(p.cloth,x-.025,.553,z-.53,.67,.10,.45,{ry:-.16,rz:.05});
  b.panel(blanket, [[x-.39,.55,z+.09],[x+.36,.53,z+.17],[x+.44,.37,z+.54],[x+.22,.32,z+.92],[x-.20,.42,z+.89],[x-.44,.37,z+.56]],
    [[0,0],[1,0],[1,.4],[.71,1],[.36,1],[0,.5]],[0,1,2,0,2,5,5,2,4,4,2,3]);
}

export function fan(b,p,x,y,z,tilt=0) {
  b.cylinder(p.rust,x,y+.105,z,.026,.025,.22);
  b.cylinder(p.iron,x,y-.032,z,.115,.095,.097,{rz:tilt});
  for (const theta of [.27,2.36,4.46]) {
    const missing = theta > 4;
    b.box(p.rust,x+Math.sin(theta)*(missing?.18:.355),y-.083,z+Math.cos(theta)*(missing?.18:.37),.126,.022,missing?.20:.53,
      {ry:theta,rx:missing?.22:-.04,rz:tilt});
  }
  b.cord(p.iron,[[x,y+.12,z],[x+.21,y+.24,z-.09],[x+.54,y+.21,z+.15],[x+.65,y-.22,z+.21]],.012);
}

export function drape(interior,p,x,y,z,w,h,ry,seed) {
  const group = new Group();
  group.name = 'Torn linen curtain';
  group.position.set(x,y,z); group.rotation.y=ry; interior.add(group);
  const b = new ModelBatch(group);
  const left=[], right=[], uvs=[], faces=[];
  const folds=11;
  for(let j=0;j<=folds;j++) {
    const f=j/folds, a=(f-.5)*w, zoff=Math.sin(f*23.1+seed)*.065;
    left.push([a,0,zoff]); right.push([a + (f-.5)*.07, -h*(.72+.20*(.65+.35*Math.sin(j*3.1+2))-(j===5?.26:0)), zoff+.052+Math.sin(j*.8)*.035]);
    uvs.push([f*1.2,1]);
  }
  for(let j=0;j<=folds;j++) uvs.push([j/folds*1.2,0]);
  for(let j=0;j<folds;j++) {const k=j+folds+1;faces.push(j,k,j+1,j+1,k,k+1);}
  b.panel(p.cloth,[...left,...right],uvs,faces); b.finish('Creased and torn curtain');
  return {group, phase:seed};
}

export function templeDetail(b,p,site) {
  const {w,d}=site;
  b.box(p.stoneMoss,0,.24,-d*.26,1.9,.45,1.19);
  b.box(p.rock,0,.53,-d*.29,1.24,.16,.71);
  b.pot(p.rock,0,.59,-d*.31,[[.37,0],[.40,.11],[.25,.33],[.22,.46],[.26,.58],[.20,.68],[.13,.74],[.10,.80],[0,.86]],{sz:.73});
  b.ball(p.rock,0,1.45,-d*.31,.149,{sy:1.16});
  for (const sx of [-1,1]) {
    b.ball(p.rock,sx*.17,1.10,-d*.31,.116,{sy:1.5,sx:.77});
    b.ball(p.rock,sx*.24,.89,-d*.26,.176,{sy:.72,sx:1.11});
  }
  b.pot(p.rust,0,2.10,d*.34,[[.18,0],[.17,.04],[.13,.061],[.10,.19],[.07,.27],[.03,.30]],{sz:.96});
  b.ring(p.iron,0,2.42,d*.34,.056,.013);
  b.cord(p.rope,[[0,2.43,d*.34],[.027,2.71,d*.34],[0,3.01,d*.34]],.016);
  for (const [x,z] of [[-.71,-.36],[.40,-.57],[.82,-.39],[-.18,-.33]]) bowl(b,p,x,.026,z,.112);
  for (let i=0;i<19;i++) {
    const t=i*2.4,r=.26+(i%6)*.117;
    b.ball(i%2?p.pottery:p.rope, Math.cos(t)*r,.027,Math.sin(t)*r-.39,.027,{sx:.71,sy:.34,sz:1.74});
  }
  cobweb(b,p.web,[-w*.31,2.59,-d*.40],[.42,.08,.12],[.07,-.21,.23],9);
  cobweb(b,p.web,[w*.33,2.23,d*.38],[.31,-.02,-.12],[.12,-.23,.10],7);
}
