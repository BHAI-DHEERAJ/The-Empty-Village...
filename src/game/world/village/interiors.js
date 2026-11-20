import { Group, Vector3 } from 'three';
import { makeSeat } from '../../interaction/InteractionController.js';
import { between, seededRandom } from '../random.js';
import { worldPoint } from '../sceneryLayout.js';
import { placeBox } from './architecture.js';
import { BASE, UPPER, wallCoords } from './buildingPlans.js';
import { lettering } from './lettering.js';
import { ModelBatch } from './modeling.js';
import { book, bottle, bowl, cabinet, chair, cobweb, cot, drape, fan, frame, paperFlat, table, templeDetail } from './props.js';

const PI=Math.PI;
const mid=(a,b)=>(a+b)*.5;
const pointAt=(a,r)=>a[0]+(a[1]-a[0])*r;
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
const roomDims=(r)=>({x:r.x1-r.x0,z:r.z1-r.z0});
const inside=(x,z,r,margin=0)=>x>r.x0-margin&&x<r.x1+margin&&z>r.z0-margin&&z<r.z1+margin;

function doorwayZones(plan,base){
  const zones=[];
  for(const wall of plan.walls.filter(w=>w.base===base))for(const o of wall.openings.filter(o=>!o.window&&!o.locked)){
    const [x,z]=wallCoords(wall,o.at), along=o.w*.39+.213, deep=o.entry?1.05:.80;
    const w=wall.axis==='z'?along:deep,d=wall.axis==='z'?deep:along;
    zones.push({x,z,w,d});
  }
  if(base===BASE&&plan.site.plan==='split'){
    const dividing=plan.walls.find(w=>w.finish==='inner'&&w.base===base&&w.openings.length);
    if(dividing){
      const [x,z]=wallCoords(dividing,dividing.openings[0].at);
      const a=plan.entry.at,j=plan.site.d*.5;
      if(dividing.axis==='z')zones.push({x:mid(a,x),z:mid(z,j),w:Math.abs(x-a)*.5+.35,d:Math.abs(z-j)*.5});
      else zones.push({x:a,z:mid(z,j),w:.41,d:Math.abs(z-j)*.5+.06},{x:mid(x,a),z,w:Math.abs(x-a)*.5+.13,d:.35});
    }
  }
  return zones;
}

// A placement has a real, reserved footprint and a single collision shape, independent of mesh detail.
function staging(b,plan,r,collision,reserved) {
  const {site}=plan;
  const floor=plan.floors.find(f=>f.base===r.base);
  return (x,z,w,d,h,make,ry=0)=>{
    const co=Math.abs(Math.cos(ry)), si=Math.abs(Math.sin(ry));
    const rw=(w*co+d*si)*.5, rd=(d*co+w*si)*.5;
    const px=clamp(x,r.x0+rw+.033,r.x1-rw-.033),pz=clamp(z,r.z0+rd+.033,r.z1-rd-.033);
    if(px-rw<r.x0+.027||pz-rd<r.z0+.027||roomDims(r).x<2*rw+.10||roomDims(r).z<2*rd+.10)return false;
    if(reserved.some(a=>Math.abs(px-a.x)<a.w+rw+.065&&Math.abs(pz-a.z)<a.d+rd+.065))return false;
    for(const i of [-1,1])for(const j of [-1,1])if(!floor.rects.some(a=>inside(px+i*rw,pz+j*rd,a,.013)))return false;
    b.within(px,0,pz,ry,make);
    const solid=h>0?placeBox(collision,site,px,pz,w,d,r.base-.009,r.base+h,ry,'furniture'):null;
    reserved.push({x:px,z:pz,w:rw,d:rd});
    return {x:px,z:pz,solid};
  };
}

function block(paint,b,p,w,d,h){
  b.box(paint,0,h*.5,0,w,h,d);
  for(const s of [-1,1])b.box(p.darkWood,s*w*.36,h*.5,d*.5+.009,.042,h+.004,.022);
  for(const y of [.063,h-.057])b.box(p.wood,0,y,d*.49,w,.066,.036);
  b.box(p.iron,0,h*.71,d*.50+.02,.083,.036,.026);
}
function jar(b,p,x,y,z,r=.19){
  b.pot(p.pottery,x,y,z,[[0,0],[r*.67,0],[r,.09],[r*.90,.225],[r*.50,.27],[r*.48,.33],[r*.58,.34],[r*.58,.36],[r*.42,.366],[r*.39,.337],[r*.39,.29],[r*.76,.20],[r*.73,.057],[0,.024]]);
}
function tv(b,p,x,y,z){
  b.box(p.darkWood,x,y+.185,z,.57,.369,.348);
  b.box(p.rust,x,y+.182,z+.165,.53,.335,.063);
  b.box(p.darkGlass,x-.072,y+.191,z+.203,.36,.258,.023);
  for(let i=0;i<4;i++)b.box(p.iron,x+.181,y+.092+i*.028,z+.204,.092,.008,.010);
  b.cylinder(p.darkWood,x+.183,y+.227,z+.210,.031,.031,.027,{rx:PI/2,sides:8});
  b.cord(p.rust,[[x+.06,y+.368,z-.093],[x-.01,y+.51,z-.082],[x-.14,y+.686,z-.12]],.008,{segments:6,sides:4});
}
function radio(b,p){
  b.box(p.darkWood,.18,.91,-.074,.42,.24,.202);
  b.box(p.glass,.10,.949,.034,.215,.085,.022);
  for(let i=0;i<5;i++)b.box(p.iron,.295,.841+i*.025,.039,.126,.010,.012);
  b.cylinder(p.rust,.299,.973,.037,.031,.031,.024,{rx:PI/2,sides:8});
  b.beam(p.rust,[.299,1.03,-.10],[.244,1.38,-.181],.009,5);
}
function staticClock(b,p,x,y,z,r){
  b.cylinder(p.rust,x,y,z,r,r,.054,{rx:PI/2,sides:20});
  b.cylinder(p.chalk,x,y,z+.035,r*.86,r*.86,.022,{rx:PI/2,sides:20});
  for(let i=0;i<12;i++){
    const a=i*PI/6;
    b.box(p.darkWood,x+Math.sin(a)*r*.70,y+Math.cos(a)*r*.70,z+.049,.010,i%3===0?.035:.018,.007,{rz:-a});
  }
  for(const [a,f,t] of [[17*PI/30,.70,.006],[(3+17/60)*PI/6,.50,.009]])
    b.beam(p.darkWood,[x,y,z+.06],[x+Math.sin(a)*r*f,y+Math.cos(a)*r*f,z+.063],t,4);
  b.cylinder(p.rust,x,y,z+.058,.021,.021,.014,{rx:PI/2,sides:8});
}
function wallMount(plan,r,requiredWidth=.55) {
  const cx=mid(r.x0,r.x1),cz=mid(r.z0,r.z1);
  const picks=[];
  for(const wall of plan.walls){
    if(wall.base!==r.base)continue;
    const normal=wall.axis==='z'?Math.sign(cz-wall.at):Math.sign(cx-wall.at);
    const where=wall.axis==='z'?cz:cx;
    const interval=wall.axis==='z'?[r.x0,r.x1]:[r.z0,r.z1];
    const bound=wall.axis==='z'?(normal>0?r.z0:r.z1):(normal>0?r.x0:r.x1);
    if(Math.abs(bound-wall.at)>.32)continue;
    const a=Math.max(wall.a+.13,interval[0]),c=Math.min(wall.b-.13,interval[1]);
    if(c-a<requiredWidth)continue;
    for(const q of [.33,.67,.49,.19,.84]){
      const t=pointAt([a,c],q);
      if(t<a+requiredWidth/2||t>c-requiredWidth/2)continue;
      if(wall.openings.some(o=>Math.abs(t-o.at)<o.w*.5+requiredWidth*.51+.10))continue;
      const depth=wall.finish==='outer'?.145:.092;
      const [x,z]=wallCoords(wall,t,depth*normal);
      const yaw=wall.axis==='z'?(normal>0?0:PI):normal*PI/2;
      picks.push({x,z,yaw,score:Math.abs(where-wall.at)+Math.abs(q-.48)*.41});
    }
  }
  return picks.sort((a,b)=>a.score-b.score)[0];
}

function calendar(b,p,seed){
  const x=0,y=1.56,z=.017;
  b.box(p.wood,x,y+.235,z,.259,.028,.027);
  b.box(p.paper,x,y,z,.252,.462,.008,{rz:(seed%3-1)*.07});
  lettering(b,p.darkWood,'जुलाई',x,y+.123,z+.009,.073,.195);
  for(let i=0;i<6;i++)b.box(p.rust,x,y-.008-i*.033,z+.010,.169,.004,.007);
  for(let i=0;i<7;i++)b.box(p.rust,x-.077+i*.026,y-.091,z+.011,.003,.17,.006);
  b.ring(p.tractorRed,x+.027,y-.127,z+.018,.023,.004);
}
function decorateWalls(b,p,plan,r,n){
  const mount=wallMount(plan,r,r.type==='classroom'?1.1:.73);
  if(!mount)return;
  const {x,z,yaw}=mount;
  b.within(x,0,z,yaw,(s)=>{
    if(['living','studio','dining','office','bedroom','ward'].includes(r.type)){
      if(r.type==='office'||r.type==='living'||r.type==='studio')staticClock(s,p,0,1.98,.022,.178);
      if(r.type==='bedroom'||r.type==='ward'||r.type==='dining')frame(s,p,r.type==='ward'?p.darkGlass:p.photo,.016,1.57,.021,.42,.47,(n%3-1)*.06);
      else frame(s,p,p.photo,-.334,1.52,.021,.31,.235, -.08);
      if(r.type==='living')frame(s,p,p.glass,.329,1.49,.024,.307,.39,.044);
      if(r.type==='office')calendar(s,p,n);
    } else if(['kitchen','shop','storage'].includes(r.type))calendar(s,p,n);
    else if(r.type==='classroom')frame(s,p,p.paper,.18,1.68,.022,.31,.40,.075);
    else if(r.type==='bath')frame(s,p,p.glass,0,1.49,.037,.39,.49,-.03);
    else if(r.type==='landing'&&!r.stair&&n%3===0){
      frame(s,p,p.photo,-.03,1.54,.031,.34,.45,.12);
      s.beam(p.rust,[-.12,1.73,.026],[0,1.88,.013],.005,4);
    }
  });
}

function roomFurniture(b,p,plan,r,collision,reserved,n,activity){
  const {site}=plan, {x:w,z:d}=roomDims(r);
  const cx=mid(r.x0,r.x1),cz=mid(r.z0,r.z1);
  const random=seededRandom(n*117371+731);
  const side=n%2===0?1:-1;
  const lx=(t)=>pointAt([r.x0,r.x1],t),lz=(t)=>pointAt([r.z0,r.z1],t);
  const add=staging(b,plan,r,collision,reserved);
  let objects=0;
  function place(x,z,w,d,h,draw,yaw=0){
    const placed=add(x,z,w,d,h,draw,yaw);if(placed)objects++;
    return placed;
  }
  function nearSide(w,d,h,draw,{rz=.38,front=false,yaw=0}={}){
    const candidates=[[lx(side>0?.15:.85),lz(front?.84:rz)],[lx(side>0?.84:.16),lz(front?.82:rz)],
      [lx(.18),lz(.16)],[lx(.82),lz(.83)],[lx(.11),lz(.80)],[lx(.87),lz(.20)], [cx,lz(.92)],[cx,lz(.09)]];
    for(const [x,z] of candidates){const made=place(x,z,w,d,h,draw,yaw);if(made)return made;}
    return null;
  }
  const crate=(x,z,mat=p.wood)=>place(x,z,.55,.49,.51,s=>block(mat,s,p,.55,.49,.51));
  const cupboard=({metal=false,width=.86}={})=>nearSide(width,.64,1.45,s=>cabinet(s,p,0,-.05,{medical:metal,width}),{rz:.13,yaw:n%3===2?PI/2:0});
  const blankets=[p.dirtyCloth,p.bedBlue,p.bedRed,p.cloth];
  const sleeping=(medical=false)=>nearSide(.97,2.0,medical?.72:.64,s=>cot(s,p,0,0,{medical,blanket:blankets[n%4]}),{rz:.31,yaw:d<2.28&&w>=2.3?PI/2:0});
  const sit=(placed,rot,name,rise)=>{
    if(!placed)return;
    const [x,z]=worldPoint(site,placed.x,placed.z);
    activity.actions.push(makeSeat({id:`${site.id}/${r.id}/seat/${activity.actions.length}`,name,
      at:new Vector3(x,r.base+rise,z),yaw:site.yaw+rot,ignore:[placed.solid]}));
  };
  const seating=(x,z,rot,fallen=false)=>{
    const f=place(x,z,.52,fallen?.83:.48,fallen?.32:.87,s=>chair(s,p,0,0,0,{fallen,rotation:0}),rot);
    if(!fallen)sit(f,rot,'कुर्सी',.467);
    return f;
  };
  const bench=(x,z,length=.94,rot=0)=>{
    const f=place(x,z,length,.41,.48,s=>table(s,p,0,0,0,length,.37,.448),rot);
    sit(f,rot,'स्कूल की बेंच',.481);
    return f;
  };
  function surface(named='work',tw=1.10,td=.57,th=.728){
    const desktop=(s)=>{
      table(s,p,0,0,0,tw,td,th,{metal:r.type==='office'&&site.plan==='hospital',skew:named==='tv'?0:n%4===0?.019:0});
      if(named==='tv')tv(s,p,.06,th+.034,-.039);
      if(named==='radio')radio(s,p);
      if(named==='meal'){bowl(s,p,-.29,th+.036,-.093,.105,true);bowl(s,p,.21,th+.036,.071,.106);bottle(s,p,.32,th+.036,-.11,.052);}
      if(named==='work')book(s,p,-.14,th+.035,.017,.18,.21,.036,-.20);
      if(named==='counter'){jar(s,p,-tw*.34,th+.034,-.05);jar(s,p,tw*.29,th+.034,-.04,.13);bowl(s,p,tw*.10,th+.034,.10,.12,true);}
      paperFlat(s,p.paper,.11,th+.039,.11,.27,.22,n%4*.16);
    };
    return nearSide(tw,td+(.0),th+.06,desktop,{rz:named==='counter'?.16:.73,yaw:named==='counter'&&w<2.35?PI/2:0});
  }
  switch(r.type){
    case 'shrine':
      templeDetail(b,p,site);placeBox(collision,site,0,-site.d*.26,1.93,1.20,r.base,r.base+1.57,0,'shrine');objects+=1;break;
    case 'studio':
    case 'hut':
      sleeping();
      if(r.type==='hut'){surface('meal',.83,.55,.63);crate(lx(.79),lz(.18));}
      else {surface('tv',.90,.53,.70);cupboard({width:.77});}
      break;
    case 'living': {
      const f=surface(n%3===0?'meal':'tv',w>3.2?1.13:.88,.58,n%4===2?.58:.72);
      if(f){
        seating(f.x+.29,f.z+.78,PI+.35,n%3===2);
        if(w>2.7&&d>2.2)seating(f.x-.74,f.z+.09,-PI/2,false);
      }
      if(w>2.53&&d>2.35)cupboard({width:.75});
      break;
    }
    case 'bedroom':
      sleeping();cupboard({width:w>3.1?1.02:.78});
      if(w>2.65&&d>2.35)nearSide(.50,.49,.60,s=>{block(p.wood,s,p,.50,.49,.60);bottle(s,p,.11,.60,-.09);},{rz:.76});
      break;
    case 'kitchen': {
      surface('counter',Math.min(1.28,w*.67),.61,.77);
      nearSide(.78,.58,.40,(s)=>{
        s.box(p.adobe,0,.10,0,.74,.20,.55);
        s.box(p.darkAdobe,0,.26,-.079,.73,.15,.41);
        for(const x of [-.205,.205])s.ring(p.oldBrick,x,.342,-.073,.139,.047,{rx:-PI/2});
        s.pot(p.iron,-.204,.379,-.077,[[0,0],[.102,0],[.152,.102],[.161,.135],[.143,.138],[.127,.103],[.079,.019],[0,.017]]);
        s.beam(p.wood,[-.244,.06,.07],[-.40,.05,.278],.026,5);
      },{rz:.22});
      if(w>2.8)nearSide(.49,.48,.38,s=>jar(s,p,0,0,0,.22),{rz:.75});
      break;
    }
    case 'storage':
      cupboard({width:w>2.6?1.12:.80,metal:site.plan==='hospital'});
      crate(lx(.8),lz(.21)); if(w>2.6)crate(lx(.16),lz(.75),p.darkWood);
      nearSide(.65,.54,.56,s=>{
        s.pot(p.rope,0,0,0,[[0,0],[.22,.019],[.30,.075],[.283,.34],[.244,.48],[.122,.51],[.07,.56],[0,.57]],{sz:.80});
        s.ring(p.rope,0,.496,0,.117,.017,{rx:PI/2});
      },{rz:.81});
      break;
    case 'bath':
      nearSide(.80,.65,.91,s=>{
        s.box(p.cement,0,.391,-.03,.49,.782,.45);
        s.box(p.pottery,0,.81,-.013,.78,.103,.613);
        s.pot(p.pottery,0,.876,.02,[[0,0],[.16,0],[.227,.042],[.246,.078],[.211,.076],[.170,.027],[0,.011]],{sz:.87});
        s.cord(p.iron,[[0,.859,-.24],[0,1.031,-.244],[0,1.081,-.140],[0,1.058,-.102]],.024,{segments:7});
      },{rz:.20});
      crate(lx(.76),lz(.74),p.pottery);break;
    case 'ward': {
      sleeping(true);
      nearSide(.97,1.99,.74,s=>cot(s,p,0,0,{medical:true,blanket:p.cloth}),{rz:.77,yaw:PI/2});
      surface('work',.79,.51,.80);
      nearSide(.80,.69,.84,s=>{
        for(const sign of [-1,1]){
          const x=.29*sign;
          s.ring(p.rubber,x,.275,.10,.244,.029,{ry:PI/2});s.ring(p.rust,x,.275,.10,.213,.013,{ry:PI/2});
          for(let i=0;i<6;i++){const a=i*PI/3;s.beam(p.iron,[x,.275,.10],[x,.275+Math.sin(a)*.208,.10+Math.cos(a)*.208],.008,4);}
          s.beam(p.iron,[x,.076,-.267],[x,.748,.15],.022,5);
          s.ring(p.rubber,x,.091,-.264,.073,.017,{ry:PI/2});
        }
        s.box(p.dirtyCloth,0,.451,.004,.57,.048,.37);
        s.box(p.cloth,0,.645,.194,.57,.341,.058,{rx:-.15});
      },{rz:.65,yaw:.25});
      break;
    }
    case 'office': {
      const f=surface('radio',Math.min(1.35,w*.72),.62,.776);
      if(f){
        seating(f.x+.10,f.z+.76,PI+.16);
        if(!activity.radio){
          const [x,z]=worldPoint(site,f.x+.20,f.z+.045), y=r.base+.96;
          activity.radio={x,z,y};
          const at=new Vector3(x,y,z);
          const id=site.plan==='mansion'?'mansion-radio':`${site.id}/radio`;
          activity.actions.push({id,kind:'radio',name:'पुराना रेडियो',label:'रेडियो का बटन घुमाओ',range:2.42,at,ignore:[f.solid],
            use({cue}){cue('dial',at);return null;}});
        }
      }
      cupboard({metal:site.plan==='hospital'});break;
    }
    case 'classroom': {
      // Board and lesson shelf are fixed to the back wall; keep the central aisle clear.
      const bw=Math.min(3.19,w*.80), anchor=wallMount(plan,r,bw+.16);
      if(anchor)b.within(anchor.x,0,anchor.z,anchor.yaw,s=>{
        s.box(p.darkWood,0,1.64,.043,bw,1.03,.085);
        s.box(p.board,0,1.65,.092,bw-.134,.891,.022);
        s.box(p.wood,0,1.16,.094,bw,.057,.16);
        lettering(s,p.chalk,['सोमवार','2 × 3','कक्षा 3'][r.index]??'आज का पाठ',0,1.81,.107,.102);
        for(let j=0;j<4;j++){
          const y=1.44+j*.065;
          s.beam(p.chalk,[-.57,y,.108],[.47+j*.043,y-.012,.108],.004,4);
        }
        s.box(p.chalk,-.38,1.198,.15,.067,.013,.021,{ry:.31});
      });
      for(let row=0;row<3;row++)for(const s of [-1,1]){
        if(row===2&&s>0&&r.index===1)continue;
        const x=cx+s*w*.286+.015*row,z=lz(.33+row*.213),width=Math.min(1.30,w*.33);
        place(x,z,width,.54,.704,(s)=>{
          table(s,p,0,0,0,width,.50,.67,{broken:row===2&&x>cx,skew:row===2?.035:0});
          if((n+row)%3!==1)book(s,p,.043,.706,.008,.20,.234,.04,n*.13);
        });
        bench(x,z+.51,width-.13,(row===1?.037:0));
      }
      if(objects<1)bench(lx(.20),lz(.21),.94);
      break;
    }
    case 'dining': {
      const length=Math.min(2.93,d*.56),theta=d>w?PI/2:0;
      const location=place(cx,cz,length,1.09,.824,s=>{
        table(s,p,0,0,0,length,1.07,.79);
        s.box(p.bedRed,0,.827,0,length*.83,.012,.37,{ry:.018});
        for(const x of [-length*.34,0,length*.31]){bowl(s,p,x,.837,.20,.127,true);bowl(s,p,x,.837,-.23,.108);}
        jar(s,p,.04,.834,.053,.13);bottle(s,p,-length*.22,.831,-.01,.049);
      },theta);
      for(const xx of [-.82,.80])for(const zz of [-1,0,1])seating(cx+xx,cz+zz*.86,xx>0?-PI/2:PI/2,zz===1&&xx>0);
      if(!location)surface('meal',1.50,.7,.79);
      break;
    }
    case 'shop':
      surface('counter',Math.min(w*.36,2.24),.62,.88);cupboard({width:1.01});crate(lx(.86),lz(.46));break;
    case 'courtyard':
      // The pottery sits to one side; axial circulation remains open.
      nearSide(.45,.45,.39,s=>jar(s,p,0,0,0,.217),{rz:.78});break;
    case 'landing':
      if(!r.stair && w>2.25 && d>2){
        const tryBench=(s)=>table(s,p,0,0,0,.93,.39,.445);
        sit(nearSide(.97,.42,.48,tryBench,{rz:.15,yaw:PI/2}),PI/2,'बेंच',.478);
      }
      break;
  }
  if(!r.stair&&!['shrine','classroom','courtyard'].includes(r.type))decorateWalls(b,p,plan,r,n);
  const flatY=.010;
  if(!r.stair&&r.type!=='shrine'){
    for(let i=0;i<(r.type==='classroom'?4:2);i++){
      const x=lx(.13+random()*.73),z=lz(.18+random()*.66);
      paperFlat(b,i%2===0?p.leaf:p.paper,x,flatY,z,.108+random()*.09,.095+random()*.099,random()*6.28);
    }
  }
  if(r.type!=='courtyard'&&!r.stair){
    const ceil=site.levels>1&&r.base===BASE?Math.min(site.eave,UPPER-.17):site.eave;
    const x=side>0?r.x1-.17:r.x0+.17,z=r.z0+.20;
    if(r.type!=='shrine')cobweb(b,p.web,[x,ceil-.34,z],[-side*.21,.095,0],[0,.20,.158],7,.0025);
    if(['bedroom','storage','ward','living'].includes(r.type))cobweb(b,p.web,[x,.97,z+.03],[side*.14,.01,-.15],[0,.25,.13],7,.0022);
  }
  return objects;
}

export function furnishInterior(building,p,collision){
  const {plan,site,interior,movers}=building;
  const dressed=[],activity={radio:null,actions:building.actions}, groups=new Map();
  for(const f of plan.floors){
    const floor=new Group();floor.name=`${f.type} furnishings`;floor.position.y=f.base;interior.add(floor);
    groups.set(f.base,{floor,batch:new ModelBatch(floor),reserved:doorwayZones(plan,f.base)});
  }
  const seed=site.id.split('').reduce((n,s)=>n*37+s.charCodeAt(0),77)|0;
  plan.rooms.forEach((r,i)=>{
    if(r.locked)return;
    const {batch,reserved}=groups.get(r.base);
    const n=(seed+i*1741)>>>0;
    const objects=roomFurniture(batch,p,plan,r,collision,reserved,n,activity);
    dressed.push({room:r,objects});
  });
  // An intact rod supports one wind-worn curtain; the fan is tied to a joist.
  const windowWall=plan.walls.find(w=>w.finish==='outer'&&w.base===BASE&&w.front&&w.openings.some(o=>o.window));
  if(windowWall&&site.plan!=='temple'&&site.plan!=='shops'){
    const o=windowWall.openings.find(o=>o.window),y=o.high+.063;
    const {floor,batch}=groups.get(BASE), z=site.d*.5-.20, x=o.at+(o.broken?.15:-.12);
    batch.beam(p.rust,[x-.36,y,z],[x+.36,y,z],.016,6);
    const {group,phase}=drape(floor,p,x,y-.01,z,Math.min(o.w*.56,.69),site.plan==='hospital'?1.06:.93,0,((seed>>>0)%100)*.094);
    movers.push({kind:'cloth',object:group,phase});
  }
  const fanRoom=plan.rooms.find(r=>!r.locked&&['living','studio','dining','ward','classroom'].includes(r.type)&&roomDims(r).x>1.5&&roomDims(r).z>1.5);
  if(fanRoom){
    const {floor,batch}=groups.get(fanRoom.base),x=mid(fanRoom.x0,fanRoom.x1),z=mid(fanRoom.z0,fanRoom.z1);
    const y=site.eave-.38;
    batch.box(p.darkWood,x,y+.32,z,roomDims(fanRoom).x+.19,.113,.149,{shadow:true});
    batch.cylinder(p.iron,x,y+.248,z,.038,.038,.16,{sides:7});
    const motor=new Group();motor.name='Loose ceiling fan';motor.position.set(x,y,z);floor.add(motor);
    const f=new ModelBatch(motor);fan(f,p,0,0,0,.06);f.finish('Rusting fan and ceiling wire');
    movers.push({kind:'fan', object:motor,phase:site.z*.11});
    const wire=new Group();wire.position.set(x+.58,y+.18,z+.13);floor.add(wire);
    const branch=new ModelBatch(wire);branch.cord(p.rust,[[0,0,0],[.06,-.10,.015],[.11,-.24,-.033],[.061,-.36,-.09]],.008,{segments:7});branch.finish('Hanging wire');
    movers.push({kind:'wire',object:wire,phase:site.x*.07});
  }
  for(const {batch} of groups.values())batch.finish('Arranged furniture and abandonment details');
  return {...activity,dressed};
}
