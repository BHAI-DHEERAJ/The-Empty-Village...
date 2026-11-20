import { Group, MeshStandardMaterial, Vector3 } from 'three';
import { HingedDoor } from '../../interaction/HingedDoor.js';
import { worldPoint } from '../sceneryLayout.js';
import { nightMaterial } from '../shaders.js';
import { addStructureCollision, BASE, subtractRectangle, UPPER, WALL, wallCoords, wallPieces } from './buildingPlans.js';
import { ModelBatch } from './modeling.js';
import { lettering } from './lettering.js';
import { cobweb } from './props.js';

const PI=Math.PI;
const mid=(a,b)=>(a+b)*.5;
const facadeSign = {
  school: ['सरकारी प्राथमिक स्कूल',2.55], hospital: ['ग्राम स्वास्थ्य केंद्र',2.75],
  shops: ['किराने की दुकान',1.88], temple: ['मंदिर',1.07], mansion: ['हवेली',1.07],
};

export function placeBox(collision,site,x,z,w,d,y0,y1,angle=0,tag='furniture'){
  const [wx,wz]=worldPoint(site,x,z);
  return collision.addBox(wx,wz,w,d,site.yaw+angle,y0,y1,tag);
}

function roofPanel(b,mat,under,coords){
  let [a,c,d,e]=coords;
  const normalY=(c[2]-a[2])*(e[0]-a[0])-(c[0]-a[0])*(e[2]-a[2]);
  if(normalY<0)[c,e]=[e,c];
  const U=Math.hypot(...c.map((n,i)=>n-a[i])), V=Math.hypot(...e.map((n,i)=>n-a[i]));
  const tile=mat.userData.tile??[2,2];
  const uv=[[0,0],[U/tile[0],0],[U/tile[0],V/tile[1]],[0,V/tile[1]]];
  b.panel(mat,[a,c,d,e],uv,[0,1,2,0,2,3],{shadow:true});
  b.panel(under,[a,c,d,e].map(([x,y,z])=>[x,y-.115,z]),uv,[0,2,1,0,3,2]);
  const edge=(p,q)=>b.beam(under,[p[0],p[1]-.055,p[2]],[q[0],q[1]-.055,q[2]],.056,4,true);
  edge(a,c);edge(c,d);edge(d,e);edge(e,a);
}

function gableEnd(b,m,x,y,z,r,peak,reverse=false){
  b.panel(m,[[-x,y,z],[x,y,z],[r,peak,z]],[[0,0],[2*x/(m.userData.tile?.[0]??2),0],[(x+r)/2,(peak-y)/2]],reverse?[0,2,1]:[0,1,2],{shadow:!reverse||z<0});
}

function roof(b,plan,p){
  const {site,roofAt:y}=plan;
  const x=site.w/2,z=site.d/2, a=x+(site.wall==='timber'?.47:.36), c=z+.39;
  const tile=site.area==='forest'&&['mud','farm'].includes(site.style)?p.thatch:p.roof;
  const pitch=site.pitch, rise=Math.min(2.28,Math.max(.59,x*pitch)), top=y+rise+.07;
  const panel=(corners,m=tile)=>roofPanel(b,m,p.darkWood,corners);
  if(site.roof==='flat'){
    b.box(p.cement,0,y+.044,0,2*a,.157,2*c,{shadow:true});
    b.box(p.floor,0,y-.047,0,site.w-.09,.027,site.d-.09);
    b.box(p.mutedPlaster,0,y-.112,c-.07,2*a+.03,.135,.18,{shadow:true});
    const h=site.parapet==='low'?.33:site.parapet==='posts'?.49:.62;
    for(const sign of [-1,1]){
      b.box(p.cement,sign*(a-.18),y+.11+h*.5,0,.18,h,2*c-.31,{shadow:true});
      b.box(p.cement,0,y+.11+h*.5,sign*(c-.16),2*a-.29,h,.18,{shadow:true});
      b.box(p.mutedPlaster,0,y+.12+h,sign*(c-.16),2*a-.19,.06,.26);
    }
    if(site.parapet==='screen'||site.parapet==='posts')for(let i=-2;i<=2;i++){
      const xx=i*a*.32,h0=site.parapet==='posts'?.19:.28;
      b.box(p.oldBrick,xx,y+.14+h+h0*.5,c-.15,a*.19,h0,.24);
    }
    if(site.plan==='hospital'||site.style==='terrace'){
      b.cylinder(p.dullTeal,-x*.56,y+.39,-z*.39,.46,.49,.52,{sides:14,shadow:true});
      b.cylinder(p.iron,-x*.56,y+.671,-z*.39,.48,.48,.06,{sides:14});
    }
    return;
  }
  if(site.roof==='temple'){
    b.box(p.rock,0,y+.065,0,2*a,.25,2*c,{shadow:true});
    for(const s of [-1,1])b.box(p.shrineStone,0,y+.105,s*(z+.27),2*a+.1,.128,.24);
    b.pot(p.rock,0,y+.13,-z*.23,[[1.52,0],[1.54,.18],[1.40,.27],[1.36,.60],[1.25,.68],[1.24,.77],[1.12,.82],[1.05,1.02],[.91,1.15],[.83,1.39],[.59,1.68],[.37,1.91],[.39,2.02],[.25,2.08],[0,2.10]],{sz:.91,shadow:true});
    b.pot(p.rust,0,y+2.21,-z*.23,[[.28,0],[.23,.074],[.13,.13],[.185,.28],[.12,.36],[.05,.49],[0,.67]]);
    b.beam(p.rust,[0,y+2.62,-z*.23],[.026,y+3.04,-z*.23],.018,6);
    return;
  }
  if(site.roof==='court'&&plan.court){
    const q=plan.court;
    const r=.27;
    panel([[-a,y,-c],[a,y,-c],[a,y+r,q.z0],[ -a,y+r,q.z0]]);
    panel([[-a,y+r,q.z1],[a,y+r,q.z1],[a,y,c],[-a,y,c]]);
    panel([[-a,y,q.z0],[q.x0,y+r,q.z0],[q.x0,y+r,q.z1],[-a,y,q.z1]]);
    panel([[q.x1,y+r,q.z0],[a,y,q.z0],[a,y,q.z1],[q.x1,y+r,q.z1]]);
    for(const sign of [-1,1])for(const zz of [q.z0+.13,q.z1-.13]){
      const xx=sign*(q.x1+.11);
      b.box(p.darkWood,xx,y/2+.08,zz,.16,y-.10,.18,{shadow:true});
    }
    return;
  }
  if(site.roof==='shed'){
    const low=y-.047,high=y+Math.max(.51,site.d*pitch);
    panel([[-a,high,-c],[a,high,-c],[a,low,c],[-a,low,c]]);
    for(const s of [-1,1]) {
      const q=s*(x-.02);
      const verts=[[q,y-.12,-z],[q,high-.08,-z],[q,low-.09,z],[q,y-.12,z]];
      b.panel(p[site.wall]??p.adobe,verts,[[0,0],[0,1],[1,.1],[1,0]],s>0?[0,1,2,0,2,3]:[0,2,1,0,3,2],{shadow:true});
    }
    b.box(p[site.wall]??p.adobe,0,mid(y,high-.07),-z,site.w,high-.07-y,.22,{shadow:true});
    for(let i=0;i<=Math.ceil(site.w/1.16);i++){
      const xx=-x+i*site.w/Math.ceil(site.w/1.16);
      b.beam(p.wood,[xx,high-.14,-c],[xx,low-.14,c],.063,5);
    }
    return;
  }
  if(site.roof==='hip'){
    const ridge=Math.max(.32,z*.58), mat=site.wall==='timber'?p.wood:p[site.wall]??p.plaster;
    panel([[-a,y,-c],[0,top,-ridge],[0,top,ridge],[-a,y,c]]);
    panel([[0,top,-ridge],[a,y,-c],[a,y,c],[0,top,ridge]]);
    for(const s of [-1,1]){
      const v=[[-a,y,s*c],[a,y,s*c],[0,top,s*ridge]];
      const uv=[[0,0],[a/(tile.userData.tile?.[0]??2)*2,0],[a/3,rise/2]];
      b.panel(tile,v,uv,s>0?[0,1,2]:[0,2,1],{shadow:true});
      b.panel(p.darkWood,v.map(([x,y,z])=>[x,y-.09,z]),uv,s>0?[0,2,1]:[0,1,2]);
      for(const u of [-1,1])b.beam(p.darkWood,[u*a,y-.065,s*c],[0,top-.05,s*ridge],.065,5,true);
      b.box(mat,0,y-.10,s*z,site.w-.11,.17,.25);
    }
    b.beam(tile,[0,top+.014,-ridge],[0,top+.014,ridge],.105,7,true);
    if(site.plan==='mansion'){
      // A projecting pediment and vent give the estate a recognisable silhouette.
      const prot=z+.39, hh=y+1.11;
      gableEnd(b,p.plaster,2.10,y-.15,prot+.07,0,hh);
      for(const s of [-1,1])b.beam(p.cement,[s*2.19,y-.10,prot+.085],[0,hh+.055,prot+.085],.103,5,true);
      b.cylinder(p.darkWood,0,y+.28,prot+.076,.222,.222,.025,{rx:PI/2,sides:14});
      for(let j=-2;j<=2;j++)b.box(p.wood,j*.074,y+.28,prot+.095,.025,.25+(2-Math.abs(j))*.043,.046);
    }
    return;
  }
  const broken=site.roof==='broken', ridge=(site.damage??.0)*-.27;
  panel([[-a,y,-c],[ridge,top,-c],[ridge,top,c],[-a,y,c]]);
  if(broken){
    const edges=[.93,.86,.74,.32,.51,.22,.61,.55];
    for(let i=0;i<edges.length;i++) {
      const b0=c-i*2*c/edges.length, b1=c-(i+1)*2*c/edges.length;
      const f0=edges[i],f1=edges[(i+1)%edges.length];
      const point=(f,z)=>[ridge+(a-ridge)*f,top+(y-top)*f,z];
      panel([[ridge,top,b1],point(f1,b1),point(f0,b0),[ridge,top,b0]]);
    }
    // Broken ends are supported by rafters connected to the top plate and ridge.
    for(let i=0;i<7;i++){
      const zz=c-.24-i*(2*c-.5)/6;
      b.beam(p.wood,[ridge,top-.14,zz],[a-(i%3)*.31,y-.061+(i%3)*.077,zz+.04],.075,5,true);
    }
  } else panel([[ridge,top,-c],[a,y,-c],[a,y,c],[ridge,top,c]]);
  for(const sign of [-1,1]){
    const zz=sign*(z-.019);
    gableEnd(b,p[site.wall]??p.plaster,x,y-.05,zz,ridge,top-.13,sign<0);
    gableEnd(b,p.darkWood,x,y-.06,zz-sign*.105,ridge,top-.14,sign>0);
    b.box(p.darkWood,0,y-.103,zz,site.w,.121,.12,{shadow:true});
    for(const s of [-1,1])b.beam(p.wood,[s*a,y-.049,sign*c],[ridge,top-.035,sign*c],.077,5,true);
  }
  b.beam(tile,[ridge,top+.025,-c],[ridge,top+.025,c],.108,7,true);
  for(let i=0;i<4;i++){
    const zz=-z+.21+i*(site.d-.42)/3;
    b.box(p.darkWood,0,y-.075,zz,site.w-.26,.108,.108);
  }
}

function stainedPatch(b,m,x,y,z,c,d,ry,seed){
  const a=[[-.5,-.16],[-.32,-.42],[.10,-.50],[.54,-.23],[.4,.09],[.25,.44],[-.17,.39],[-.48,.27]];
  const P=(u,v)=>[x+u*c*Math.cos(ry),y+v*d,z-u*c*Math.sin(ry)];
  const points=[P(0,0),...a.map(([i,j],k)=>P(i*(1+Math.cos(k*7+seed)*.18),j))];
  const uv=[[.48,.48],...a.map(([i,j])=>[i+.5,j+.5])];
  b.panel(m,points,uv,a.flatMap((_,i)=>[0,i+1,(i+1)%a.length+1]));
}

function localFrame(group,wall,at,y=wall.base){
  const child=new Group(),[x,z]=wallCoords(wall,at);
  child.position.set(x,y,z);child.rotation.y=wall.axis==='z'?0:-PI/2;
  group.add(child);return child;
}
const materialFor=(site,p)=>site.wall==='damp'?(site.id.endsWith('4')?p.mutedGreen:site.id.endsWith('0')?p.mutedBlue:p.lime):p[site.wall]??p.plaster;

function doorLeaf(group,wall,o,site,p,collision,slots){
  const axisYaw=wall.axis==='z'?0:-PI/2;
  const outer=wall.side??1;
  const frame=localFrame(group,wall,o.at);
  const a=new ModelBatch(frame);
  const mat=o.locked?p.darkWood:o.door==='metal'||o.door==='gate'?p.iron:site.id.endsWith('4')?p.paintedWood:p.door;
  const thickness=wall.finish==='outer'?.32:.23, border=o.entry?.084:.058;
  for(const s of [-1,1]){
    a.box(o.entry?p.wood:p.darkWood,s*(o.w/2+.008),o.high*.5,0,border,o.high,thickness,{shadow:true});
    a.box(p.rust,s*(o.w/2-.043),.19,0,.039,.23,.087);
  }
  a.box(p.darkWood,0,o.high+.012,0,o.w+border,.091,thickness+.03,{shadow:true});
  if(o.entry)a.box(site.plan==='temple'?p.rock:p.mutedPlaster,0,o.high+.113,.035,o.w+.33,.127,.36,{shadow:true});
  a.finish('Built-in door frame and lintel');
  // Interior openings without leaves are framed, including the stair exits.
  if(!o.entry&&!o.locked&&!o.balcony)return;
  const n=o.door==='double'||o.door==='gate'||o.balcony ? 2 : 1;
  const gate=o.door==='gate', damaged=o.door==='broken';
  const h=o.high-(gate?.26:.115), h0=gate?.105:.034;
  const leaves=[];
  for(const sign of n===2?[-1,1]:[(site.id.charCodeAt(site.id.length-1)%2===0)?1:-1]){
    const leaf=new Group();
    leaf.name=o.locked?'Locked wooden door':gate?'Hinged iron gate':damaged?'Broken board door':'Hinged timber door';
    const edge=sign*(o.w*.5-.065), width=o.w/n-(n===1?.17:.105);
    const angle=o.locked?0:-sign*outer*(o.balcony?1.88:1.86+(site.id.length%4)*.021);
    leaf.position.set(edge,0,0);leaf.rotation.y=angle;frame.add(leaf);
    const b=new ModelBatch(leaf);
    const at=-sign*width*.5;
    if(gate){
      const count=site.gateBars??6;
      for(const yy of [h0+.04,h0+h*.50,h0+h-.045])b.box(p.rust,at,yy,0,width,.048,.06,{shadow:true});
      for(let i=0;i<count;i++){
        const xx=at-width/2+.035+i*(width-.07)/(count-1);
        b.box(mat,xx,h0+h/2,0,.032,h,.039,{shadow:true});
        b.box(p.rust,xx,h0+h+.015,0,.042,.062,.038,{rz:PI/4});
      }
      b.beam(p.rust,[at-width*.45,h0+.13,0],[at+width*.43,h0+h*.86,0],.027,5);
    } else if(damaged||o.door==='board'){
      const count=width>.9?7:5;
      for(let i=0;i<count;i++){
        const u=i/(count-1), strip=width/count;
        const span=h*(damaged&&!o.locked?(i%4===1?.66:i%4===2?.79:.96):1);
        b.box(i%3===0?p.softWood:mat,-sign*strip*(i+.5),h0+span*.5,0,strip*.97,span,.069,{rz:damaged?(u-.5)*.032:0,shadow:true});
      }
      for(const yy of [.41,1.44])b.box(p.darkWood,at,yy,.049*outer,width*.95,.084,.057,{shadow:true});
    } else {
      b.box(mat,at,h0+h/2,0,width,h,.072,{shadow:true});
      for(const side of [-1,1])for(const yy of [.46,1.37]){
        b.box(o.door==='metal'?p.rust:p.wood,at,yy,side*.039,width*.84,.052,.026);
        if(o.door!=='metal')for(const x of [-1,1])b.box(p.darkWood,at+x*width*.38,yy+.25,side*.041,.044,.50,.023);
      }
    }
    for(const y of [.27,h0+h-.22]){
      b.cylinder(p.rust,-sign*.007,y,.043*outer,.034,.034,.152,{sides:7});
      b.box(p.iron,-sign*.075,y,.043*outer,.127,.071,.025);
    }
    const hand=-sign*(width-.126);
    b.box(p.rust,hand,1.025,.043*outer,.104,.136,.042);
    b.ring(p.iron,hand,1.029,.074*outer,.046,.010);
    if(o.locked){
      b.ring(p.rust,hand,1.077,.099,.045,.011);
      b.box(p.iron,hand,1.002,.106,.105,.095,.049,{rz:-.08});
    }
    b.finish(leaf.name);
    if(!o.locked)leaves.push({object:leaf,edge,width,centre:at,low:h0,high:h0+h,openAngle:angle});
  }
  const [x,z]=worldPoint(site,...wallCoords(wall,o.at));
  const id=`${site.id}/${o.entry?'entry':o.balcony?'balcony':`lock/${o.at}`}`;
  if(o.locked){
    // Ignore this door's own blocking panel when selecting it, not any other wall.
    const ignore=collision.solids.filter(s=>s.tag==='locked'&&Math.hypot(s.x-x,s.z-z)<.08&&Math.abs(s.bottom-wall.base)<.03);
    slots.actions.push({id,kind:'locked',name:'हवेली का बंद कमरा',label:'कुंडी आज़माओ',at:new Vector3(x,wall.base+1.57,z),range:1.95,ignore,
      use({cue}){cue('latch',this.at,.46);return 'दूसरी तरफ़ से बंद है।';}});
  } else {
    slots.movers.push(...leaves.map(({object})=>({kind:'door',object})));
    slots.actions.push(new HingedDoor({id,x,y:wall.base,z,yaw:site.yaw+axisYaw,noun:gate?'gate':'door',leaves,collision,opening:o}));
  }
}

function windowFrame(out,inside,wall,o,site,p,slots){
  const g=localFrame(out,wall,o.at,wall.base+o.low), b=new ModelBatch(g);
  const h=o.high-o.low, w=o.w;
  const outside=(wall.axis==='x'?-1:1)*(wall.side??1);
  const paint=site.id.endsWith('0')?p.indigoWood:site.wall==='damp'||site.id.endsWith('4')?p.paintedWood:p.wood;
  for(const s of [-1,1])b.box(paint,s*w/2,.5*h,0,.076,h+.10,.27,{shadow:true});
  for(const y of [0,h])b.box(paint,0,y,0,w+.09,.078,.27,{shadow:true});
  b.box(p.floor,0,-.046,outside*.040,w+.22,.087,.37,{shadow:true});
  b.box(p.darkWood,0,h*.55,outside*.011,w,.039,.075);
  if(o.shutter){
    for(const sign of [-1,1]){
      const yaw=sign*(1.01+(site.id.length%3)*.13)*outside;
      const width=w*.46, left=sign*(w/2-.004);
      const cx=left+sign*width*.50*Math.cos(yaw), dz=outside*.11-sign*width*.50*Math.sin(yaw);
      b.box(paint,cx,h*.5,dz,width,h-.048,.053,{ry:yaw,rz:sign*.038,shadow:true});
      for(const yy of [.18,h-.17])b.box(p.darkWood,cx,yy,dz+.024*outside,width*.88,.058,.034,{ry:yaw});
      b.cylinder(p.rust,left,h*.25,outside*.088,.022,.022,.12,{sides:6});
    }
  }
  for(const u of [-.29,0,.29])b.box(p.rust,w*u,h*.53,0,.025,h-.10,.031,{shadow:true});
  const paneZ=-outside*.017;
  if(o.broken){
    b.panel(p.glass,[[-w*.44,.041,paneZ],[-w*.44,h*.91,paneZ],[-w*.21,h*.53,paneZ],[-w*.09,h*.15,paneZ],[w*.15,.041,paneZ]],[[0,0],[0,1],[.25,.6],[.35,.18],[.6,0]],[0,1,2,0,2,3,0,3,4]);
  }else b.box(p.darkGlass,0,h*.5,paneZ,w-.06,h-.064,.014);
  if(wall.front&&site.roof!=='shed'&&site.plan!=='temple'){
    b.box(p.cement,0,h+.16,outside*.255,w+.42,.117,.47,{shadow:true});
    for(const x of [-w*.37,w*.37])b.box(p.mutedPlaster,x,h+.079,outside*.19,.093,.16,.21,{rx:outside*.41});
  }
  b.finish('Framed shutters, sill and broken glazing');

}

function drawWall(shell,inside,group,trim,interior,wall,site,p,collision,slots){
  const orient=wall.axis==='z'?0:-PI/2;
  const outer=wall.finish==='outer';
  const thickness=outer?WALL:wall.finish==='foundation'?.27:.158;
  const m=outer?materialFor(site,p):wall.finish==='foundation'?p.rock:wall.finish==='court'?p.darkAdobe:p.lime;
  const interiorFinish=site.plan==='temple'?p.shrineStone:site.wall==='adobe'?p.darkAdobe:site.plan==='hospital'?p.mutedGreen:site.style==='ruin'?p.oldBrick:p.mutedPlaster;
  const dir=(wall.axis==='x'?-1:1)*(wall.side??1);
  for(const {a,b,lo,hi,tag} of wallPieces(wall)) {
    if(tag==='locked')continue; // The visible leaf, not an extra baked wall, covers that aperture.
    const x=mid(a,b),y=wall.base+mid(lo,hi), [u,v]=wallCoords(wall,x);
    const cur=outer?shell:inside;
    cur.box(m,u,y,v,b-a,hi-lo,thickness,{ry:orient,shadow:true,uvOffset:[a/(m.userData.tile?.[0]??2),lo*.29]});
    if(outer){
      const [q,r]=wallCoords(wall,x,-wall.side*(thickness*.5+.010));
      inside.box(interiorFinish,q,y,r,b-a,hi-lo,.019,{ry:orient,uvOffset:[a*.33,lo*.37]});
      if(lo<.04){
        const [n,h]=wallCoords(wall,x,wall.side*(thickness/2+.018));
        shell.box(site.wall==='brick'?p.oldBrick:p.floor,n,wall.base+.089,h,b-a,.189,.056,{ry:orient});
      }
      if(hi-lo>1.18&&b-a>.51){
        const [q,r]=wallCoords(wall,a+(b-a)*.35,wall.side*(thickness*.5+.004));
        const yaw=orient+(dir<0?PI:0);
        stainedPatch(shell,site.wall==='brick'?p.lime:p.oldBrick,q,wall.base+lo+(hi-lo)*.38,r,Math.min(.76,(b-a)*.72),.24+(b-a)%1*.48,yaw,x);
      }
    }
  }
  for(const o of wall.openings){
    if(o.window)windowFrame(trim,interior,wall,o,site,p,slots);
    else doorLeaf(outer?group:interior,wall,o,site,p,collision,slots);
  }
  if(!outer&&wall.finish!=='foundation' && !wall.openings.length) {
    const [x,z]=wallCoords(wall,mid(wall.a,wall.b),.081);
    stainedPatch(inside,p.mutedLime,x,wall.base+.50,z,.56,.76,orient,x);
  }
}

function porch(out,plan,p,collision){
  const {site,entry}=plan;
  const z=site.d/2,x=site.w/2;
  out.box(p.floor,entry.at,BASE-.073,z+.35,entry.w+.36,.146,.89,{shadow:true});
  out.box(p.cement,entry.at,-.014,z+.841,entry.w+.46,.055,.24);
  if(site.porch){
    out.box(p.floor,0,BASE-.070,z+site.porch*.5,Math.min(site.w*.73,entry.w+1.15),.14,site.porch,{shadow:true});
    out.box(p.wood,0,BASE+2.48,z+site.porch*.52,Math.min(site.w*.74,entry.w+1.16),.095,site.porch+.16,{shadow:true,rx:.095});
  }
  if(site.veranda){
    out.box(p.floor,0,BASE-.061,z+.89,site.w-.12,.122,1.69,{shadow:true});
    const over=site.plan==='mansion'?p.cement:p.roof, line=z+1.62;
    if(site.plan!=='mansion')roofPanel(out,over,p.wood,[[-x-.19,BASE+2.51,z-.27],[x+.19,BASE+2.51,z-.27],[x+.19,BASE+2.23,line+.09],[-x-.19,BASE+2.23,line+.09]]);
    else out.box(p.cement,0,BASE+2.46,z+.70,site.w+.52,.183,2.05,{shadow:true});
    for(const at of site.plan==='mansion'?[-x+.43,-x*.58,-x*.28,x*.28,x*.58,x-.43]:site.plan==='school'?[-x+.34,-x*.54,-x*.18,x*.18,x*.54,x-.34]:[-x+.25,x-.25]){
      const h=site.plan==='mansion'?2.46:2.24, w=site.plan==='mansion'?.28:.16;
      out.box(p.rock,at,BASE+.095,line,w+.11,.19,w+.10,{shadow:true});
      out.box(site.plan==='mansion'?p.mutedPlaster:p.wood,at,BASE+h*.5,line,w,h,w,{shadow:true});
      out.box(p.floor,at,BASE+h-.042,line,w+.11,.11,w+.10);
      placeBox(collision,site,at,line,w+.10,w+.10,BASE-.01,BASE+h,0,'veranda-post');
    }
  }
  if(site.balcony&&site.levels>1){
    const ww=Math.min(3.8,site.w*.49), y=BASE+UPPER;
    out.box(p.cement,0,y-.093,z+.66,ww,.186,1.36,{shadow:true});
    out.box(p.wood,0,y+.97,z+1.30,ww+.03,.077,.11,{shadow:true});
    for(let i=0;i<Math.round(ww/.18);i++){
      const xx=-ww*.48+i*.18;
      out.box(i%3===0?p.rust:p.wood,xx,y+.47,z+1.30,.051,.94,.068,{rz:i%5===0?.083:0});
    }
    for(const s of [-1,1]){
      out.box(p.wood,s*ww*.48,y+.95,z+.68,.10,.079,1.29,{shadow:true});
      for(let i=0;i<6;i++)out.box(p.rust,s*ww*.48,y+.47,z+.18+i*.2,.061,.94,.053);
      placeBox(collision,site,s*ww*.48,z+.68,.13,1.23,y,y+1.0,0,'balcony-rail');
      out.beam(p.darkWood,[s*ww*.34,y-.78,z-.022],[s*ww*.47,y-.18,z+1.04],.09,5,true);
    }
  }
  if(site.door==='gate'){
    for(const s of [-1,1]){
      const xx=s*(entry.w*.61+.26);
      out.box(p.brick,xx,BASE+1.12,z+.065,.42,2.24,.41,{shadow:true});
      out.box(p.cement,xx,BASE+2.25,z+.065,.55,.115,.53,{shadow:true});
    }
  }
  const sign = facadeSign[site.plan];
  if(sign){
    const [title,w] = sign, width = Math.min(site.w*.76,w), y=BASE+(site.veranda?(site.plan==='mansion'?2.53:2.275):2.52);
    const zz=z+(site.veranda?1.747:.222);
    out.box(p.board,0,y,zz,width,.30,.061,{shadow:true});
    out.box(p.darkWood,0,y+.148,zz+.022,width+.09,.04,.067);
    lettering(out,p.chalk,title,0,y,zz+.036,.163,width-.145);
  }
  if(site.plan==='mansion'){
    for(const s of [-1,1])for(const xx of [2.29,x-.52]){
      out.box(p.plaster,s*xx,BASE+UPPER*.96,z+.058,.33,UPPER*1.92,.35,{shadow:true});
      out.box(p.cement,s*xx,BASE+UPPER*1.93,z+.09,.50,.18,.45);
    }
    out.box(p.mutedPlaster,0,BASE+UPPER-.047,z+.206,site.w+.17,.143,.39,{shadow:true});
  }
}

function stairs(b,plan,p,collision){
  const {site}=plan;
  for(const stair of plan.stairs){
    const {x,w,start,end,front,back}=stair;
    const depth=start-end,steps=Math.ceil(Math.abs(front-back)/.163);
    const wood=plan.site.style==='storey'&&plan.site.wall==='brick';
    const m=wood?p.wood:p.floor;
    for(let i=0;i<steps;i++) {
      const t=(i+.5)/steps, height=front+(back-front)*t;
      b.box(m,x,height-.080,start-t*depth,w,.159,depth/steps+.014,{shadow:true});
      b.box(wood?p.softWood:p.mutedPlaster,x,height-.029,start-t*depth+depth/steps*.46,w+.023,.056,.038);
    }
    for(const s of [-1,1]){
      const xx=x+s*(w*.50+.022), low=Math.min(front,back), high=Math.max(front,back);
      if(stair.id==='basement-stair'&&s>0)continue;
      if(stair.id==='upper-stair'&&s<0)continue;
      const ay=front+.87, by=back+.87;
      b.beam(p.darkWood,[xx,ay,start],[xx,by,end],.052,6,true);
      for(let i=0;i<=4;i++){
        const t=i/4,y=front+(back-front)*t;
        b.box(p.rust,xx,y+.44,start-t*depth,.038,.89,.043);
      }
      const N=Math.ceil(depth/.68);
      for(let i=0;i<N;i++){
        const a=i/N,c=(i+1)/N,yy=front+(back-front)*(a+c)*.5;
        placeBox(collision,site,xx,start-(a+c)*.5*depth,.08,depth/N+.015,yy+.10,yy+.92,0,'stair-rail');
      }
      // A low guard on the adjacent landing keeps the player out of the side of the well.
      const guardX=x+s*(w*.55+.071), v0=end+.67,v1=start-.57;
      if(v1>v0){
        b.box(p.wood,guardX,high+.89,mid(v0,v1),.090,.065,v1-v0,{shadow:true});
        for(let zz=v0;zz<=v1+.01;zz+=.56)b.box(p.rust,guardX,high+.42,zz,.042,.85,.047);
        placeBox(collision,site,guardX,mid(v0,v1),.10,v1-v0,high-.03,high+.94,0,'stair-guard');
      }
      const zz=end+.27;
      cobweb(b,p.web,[xx+s*.12,Math.max(low,back)+.24,zz],[0,.073,.24],[s*.20,.16,-.02],7,.0023);
    }
  }
}

export function buildArchitecture(scene,plan,p,collision){
  const {site}=plan;
  const group=new Group();group.name=site.name;group.position.set(site.x,0,site.z);group.rotation.y=site.yaw;scene.add(group);
  const interior=new Group();interior.name='Near-field rooms';group.add(interior);
  const trim=new Group();trim.name='Near-field shutters and sills';group.add(trim);
  const out=new ModelBatch(group),inside=new ModelBatch(interior);
  const slots={movers:[],actions:[]};
  addStructureCollision(plan,collision);
  for(const wall of plan.walls)drawWall(out,inside,group,trim,interior,wall,site,p,collision,slots);
  for(const level of plan.floors)for(const a of level.rects) {
    const b=level.type==='ground'?out:inside;
    const m=level.type==='upper'?p.darkWood:level.type==='basement'?p.rock:site.wall==='adobe'?p.floor:p.cement;
    b.box(m,mid(a.x0,a.x1),level.base-.075,mid(a.z0,a.z1),a.x1-a.x0,.15,a.z1-a.z0,{shadow:true});
  }
  if(plan.court){
    const c=plan.court;
    inside.box(p.paving,0,BASE+.002,mid(c.z0,c.z1),c.x1-c.x0,.008,c.z1-c.z0);
    // Ceiling over the galleries only. The courtyard opening is real through the roof.
    for(const a of subtractRectangle(plan.bounds,c))inside.box(p.darkWood,mid(a.x0,a.x1),plan.roofAt-.055,mid(a.z0,a.z1),a.x1-a.x0,.065,a.z1-a.z0);
  }
  stairs(inside,plan,p,collision);
  roof(out,plan,p);
  porch(out,plan,p,collision);
  out.finish('Batched walls, roof, and entry structure');inside.finish('Finished rooms, floors, ceilings, and stairs');
  return {site,plan,group,trim,interior,...slots};
}

// Fog-distance shells preserve each roof line, openings, apron, and balcony, but
// omit small joinery and carry only the color image. Near detailed meshes remain
// the source of collision and all interactions.
const distantMaterials=new WeakMap();
function distantMaterial(original){
  if(!distantMaterials.has(original)){
    const dim=new MeshStandardMaterial({name:`Distance finish: ${original.name}`, map:original.map,color:original.color,roughness:1});
    dim.userData.tile=original.userData.tile;
    distantMaterials.set(original,nightMaterial(dim,'distance-shell'));
  }
  return distantMaterials.get(original);
}
export function makeDistantShell(plan,p,actions=[]){
  const layer=new Group();layer.name='Fog-distance silhouette';
  const {site}=plan, x=site.w*.5,z=site.d*.5;
  const exterior=materialFor(site,p),wallMat=distantMaterial(exterior),oldBoards=distantMaterial(p.darkWood);
  const b=new ModelBatch(layer);
  const roofPaint=distantMaterial(p[site.roof==='temple'?'rock':site.roof==='flat'?'cement':'roof']);
  const mono={};for(const key of Object.keys(p))mono[key]=key==='roof'||key==='thatch'||key==='cement'||key==='rock'||key==='shrineStone'?roofPaint:key==='darkWood'||key==='wood'||key==='rust'||key==='dullTeal'||key==='iron'?oldBoards:wallMat;
  const doors=new Map(actions.filter(a=>a.kind==='door').map(a=>[a.opening,a]));
  for(const w of plan.walls.filter(w=>w.finish==='outer')){
    const yaw=w.axis==='z'?0:-PI/2;
    for(const {a,b:end,lo,hi} of wallPieces(w)){
      const [cx,cz]=wallCoords(w,mid(a,end));
      b.box(wallMat,cx,w.base+mid(lo,hi),cz,end-a,hi-lo,.25,{ry:yaw});
    }
    for(const o of w.openings){
      const door=doors.get(o);
      const [cx,cz]=wallCoords(w,o.at,door?0:-w.side*.44);
      if(door){
        const proxy=new Group();proxy.visible=false;layer.add(proxy);door.proxy=proxy;
        const board=new ModelBatch(proxy);board.box(oldBoards,cx,w.base+mid(o.low,o.high),cz,o.w-.11,o.high-o.low-.09,.06,{ry:yaw});
        board.finish('Closed distant doorway');
      }else if(o.window&&!o.broken)b.box(oldBoards,cx,w.base+mid(o.low,o.high),cz,o.w,o.high-o.low,.06,{ry:yaw});
    }
  }
  b.box(wallMat,0,.025,0,site.w,.075,site.d);
  if(site.veranda){
    const h=BASE+2.36;
    b.box(roofPaint,0,h,z+.81,site.w+.32,.18,1.77,{rx:.07});
    for(const sign of [-1,1])b.box(wallMat,sign*(x-.22),h*.50,z+1.62,.18,h,.17);
  }
  if(site.balcony&&site.levels>1){
    const w=Math.min(3.8,site.w*.49);b.box(wallMat,0,BASE+UPPER-.095,z+.65,w,.20,1.35);
    b.box(oldBoards,0,BASE+UPPER+.91,z+1.29,w,.10,.10);
    for(let i=0;i<6;i++)b.box(oldBoards,(i/5-.5)*w,BASE+UPPER+.50,z+1.29,.068,.85,.069);
  }
  // The shared roof builder uses real pitch/hip/eave geometry even at distance.
  b.shadowOverride=false;
  roof(b,plan,mono);b.finish('Distance shell with the authored floor and roof outline');
  for(const child of layer.children)child.receiveShadow=false;
  return layer;
}
