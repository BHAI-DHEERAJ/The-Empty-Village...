import { localPoint, worldPoint } from '../sceneryLayout.js';

export const UPPER = 2.86;
export const BASE = .065;
export const BASEMENT = -2.78;
export const WALL = .25;
export const area = (x0,x1,z0,z1) => ({x0,x1,z0,z1});
const middle = (a,b) => (a+b)*.5;
const opening = (at,w, low=0,high=2.14,detail={}) => ({at,w,low,high,...detail});

export function levelBounds(site){return area(-site.w/2+.045,site.w/2-.045,-site.d/2+.045,site.d/2-.045);}

export function subtractRectangle(a,b) {
  const x0=Math.max(a.x0,b.x0),x1=Math.min(a.x1,b.x1),z0=Math.max(a.z0,b.z0),z1=Math.min(a.z1,b.z1);
  if(x0>=x1||z0>=z1)return [a];
  return [area(a.x0,x0,a.z0,a.z1),area(x1,a.x1,a.z0,a.z1),area(x0,x1,a.z0,z0),area(x0,x1,z1,a.z1)]
    .filter(r=>r.x1-r.x0>.014&&r.z1-r.z0>.014);
}

export function housePlan(site) {
  const x=site.w*.5,z=site.d*.5;
  const eave=site.eave;
  const heightAt=(base)=>base===BASEMENT?BASE-BASEMENT-.142 : base===BASE&&site.levels>1?Math.min(eave,UPPER-.005):eave;
  const floors=[], rooms=[], walls=[], stairs=[];
  const entryW=site.door==='double'||site.door==='gate'? Math.min(2.35,site.w*.38):1.52;
  const entryX=(site.plan==='solo'||site.plan==='split') ? Math.min(.41,x*.13) : 0;
  const main=opening(entryX,entryW,0,site.plan==='temple'?2.36:2.22,{entry:true,door:site.door});
  const indoor=(axis,at,a,b,base,openingList=[],finish='inner')=>walls.push({axis,at,a,b,base,height:heightAt(base),openings:openingList,finish});
  const room=(id,type,x0,x1,z0,z1,base,detail={})=>rooms.push({...area(x0,x1,z0,z1),id,type,base,...detail});
  function windows(line, base, front=false) {
    const pairs = front&&site.plan==='school' ? [-.39,-.22,.22,.39] : front?site.windows:line>14?[-.36,-.18,.18,.36]:[-.28,.28];
    return pairs.map((f,j)=>opening(line*f,Math.min(1.34,line*.152-(j%2)*.14), .97+(j%2)*.14,2.02+(base>1?.06:0),{
      window:true,shutter:(j+site.id.charCodeAt(0))%4!==0,broken:(j+site.id.length)%3!==1,
    }));
  }
  function shell(base,upper=false) {
    const front=windows(site.w,base,true);
    const enter=upper?(site.balcony?opening(0,1.4,0,2.15,{balcony:true}):null):main;
    if(enter) {
      for(let i=front.length-1;i>=0;i--)if(Math.abs(front[i].at-enter.at)<(front[i].w+enter.w)*.5+.21)front.splice(i,1);
      front.push(enter);
    }
    walls.push({axis:'z',at:z,a:-x,b:x,base,height:heightAt(base),openings:front,finish:'outer',side:1,front:true},
      {axis:'z',at:-z,a:-x,b:x,base,height:heightAt(base),openings:windows(site.w,base),finish:'outer',side:-1});
    for(const sign of [-1,1]){
      const sideWindow=site.plan==='temple'? [.06] : site.d>6.4?[-.24,.26]:[sign*.14];
      walls.push({axis:'x',at:sign*x,a:-z,b:z,base,height:heightAt(base),side:sign,finish:'outer',
        openings:sideWindow.map((f,j)=>opening(site.d*f,site.plan==='temple'?.58:.93,.99+j*.13,2.06,{window:true,shutter:sign>0,broken:true}))});
    }
  }
  shell(BASE);
  const full=levelBounds(site);
  const u=BASE+UPPER;
  const hasUp=site.levels>1;
  const stairWidth=site.plan==='mansion'?1.58:1.32;
  const end=-z+1.14;
  const start=z-1.12;
  const upX=-x+.98+(site.plan==='mansion'?.36:0);
  const downX=x-1.36;
  if(hasUp)stairs.push({id:'upper-stair',x:upX,w:stairWidth,start,end,front:BASE,back:u});
  if(site.basement)stairs.push({id:'basement-stair',x:downX,w:1.56,start,end,front:BASE,back:BASEMENT});
  for(const stair of stairs)stair.hole=area(stair.x-stair.w*.55,stair.x+stair.w*.55,stair.end-.024,stair.start+.036);
  const upperStair=stairs.find(s=>s.id==='upper-stair'), basementStair=stairs.find(s=>s.id==='basement-stair');
  floors.push({base:BASE,rects:basementStair?subtractRectangle(full,basementStair.hole):[full],type:'ground'});
  if(hasUp){floors.push({base:u,rects:subtractRectangle(full,upperStair.hole),type:'upper'});shell(u,true);}
  if(site.basement) {
    floors.push({base:BASEMENT,rects:[full],type:'basement'});
    for(const sign of [-1,1]) {
      walls.push({axis:'z',at:sign*z,a:-x,b:x,base:BASEMENT,height:BASE-BASEMENT,openings:[],finish:'foundation'},
        {axis:'x',at:sign*x,a:-z,b:z,base:BASEMENT,height:BASE-BASEMENT,openings:[],finish:'foundation'});
    }
    const bx=x*.26;
    indoor('x',bx,-z+.16,z-.16,BASEMENT,[opening(end-.10,1.44),opening(z*.35,1.35)]);
    indoor('z',-.34,-x+.15,bx,BASEMENT,[opening(-1.15,1.42)]);
    room('coal-store','storage',-x+.25,bx-.16,-z+.23,-.46,BASEMENT);
    room('household-store','storage',-x+.25,bx-.19,-.22,z-.24,BASEMENT);
    room('basement-landing','landing',bx+.15,x-.26,-z+.17,z-.22,BASEMENT,{stair:true});
  }
  const g=BASE;
  let court=null;
  if(site.plan==='court') {
    const c=(site.courtWidth??site.w*.31)/2, b=-z*.41, f=z*.37;
    court=area(-c,c,b,f);
    for(const sign of [-1,1]) {
      indoor('x',sign*c,b,f,g,[opening(middle(b,f),Math.min(1.7,(f-b)*.55),0,2.11)],'court');
      room(`wing-${sign}`,sign<0?'bedroom':'living',sign<0?-x+.18:c+.13,sign<0?-c-.13:x-.18,b+.12,f-.12,g);
    }
    indoor('z',b,-x+.14,x-.14,g,[opening(0,1.66,0,2.14),opening(-middle(c,x),1.20),opening(middle(c,x),1.20)],'court');
    room('rear-kitchen','kitchen',-x+.2,x-.20,-z+.19,b-.15,g);
    room('inner-court','courtyard',-c+.02,c-.02,b+.09,f-.04,g);
    room('open-gallery','landing',-x+.20,x-.20,f+.07,z-.21,g);
  } else if(site.plan==='school') {
    const widths=[.23,.22,.23,.16,.16];
    let at=-x+.12;
    const joined=[];
    widths.forEach((f,i)=>{
      const next=i===4?x-.12:at+(site.w-.24)*f;
      const mid=middle(at,next);
      joined.push(opening(mid,i<3?1.45:1.22,0,2.23));
      if(i<4)indoor('x',next,-z+.14,1.52,g,[]);
      room(`school-${i}`,i<3?'classroom':i===3?'office':'storage',at+.12,next-.13,-z+.2,1.43,g,{index:i});
      at=next;
    });
    indoor('z',1.56,-x+.13,x-.13,g,joined);
    room('school-corridor','landing',-x+.18,x-.18,1.72,z-.17,g);
  } else if(site.plan==='temple') {
    room('shrine','shrine',-x+.20,x-.20,-z+.23,z-.19,g);
  } else if(site.plan==='solo') {
    room('single-room',site.area==='forest'?'hut':'studio',-x+.18,x-.18,-z+.18,z-.17,g);
  } else if(site.plan==='mansion') {
    const hall=1.57, wing=5.99, split=-.42;
    const frontDoor=z*.45, backDoor=-z*.48, landing=end-.14;
    for(const sign of [-1,1]){
      indoor('x',sign*hall,-z+.12,z-.12,g,[opening(frontDoor,1.51),opening(backDoor,1.38),opening(landing,1.28)]);
      const endDoors=sign<0?[opening(landing,1.36),opening(start+.12,1.42)]:[opening(start+.16,1.44)];
      indoor('x',sign*wing,-z+.13,z-.12,g,endDoors);
      const left=sign<0?-wing+.14:hall+.14, right=sign<0?-hall-.14:wing-.14;
      indoor('z',split,left-.09,right+.09,g,[]);
      room(`ground-gallery-${sign}`,sign>0?'dining':'living',left,right,split+.14,z-.19,g);
      room(`ground-back-${sign}`,sign>0?'kitchen':'office',left,right,-z+.21,split-.14,g);
      room(`ground-stairs-${sign}`,'landing',sign<0?-x+.18:wing+.11,sign<0?-wing-.11:x-.18,-z+.19,z-.19,g,{stair:true});
    }
    room('entry-gallery','landing',-hall+.14,hall-.14,-z+.19,z-.18,g);
    indoor('x',-hall,-z+.16,z-.14,u,[opening(backDoor,1.42),opening(frontDoor,1.48)]);
    indoor('x',-wing,-z+.16,z-.14,u,[opening(landing,1.42),opening(start+.13,1.27)]);
    indoor('z',split,-wing+.06,-hall-.06,u,[]);
    room('upper-west-bedroom','bedroom',-wing+.13,-hall-.16,split+.14,z-.18,u);
    room('upper-rear-bedroom','bedroom',-wing+.13,-hall-.16,-z+.18,split-.14,u);
    room('upper-stair-gallery','landing',-x+.17,-wing-.14,-z+.17,z-.19,u,{stair:true});
    indoor('x',hall,-z+.16,z-.14,u,[opening(frontDoor,1.19,0,2.12,{locked:true}),opening(backDoor,1.20,0,2.12,{locked:true})]);
    indoor('z',split,hall+.05,x-.10,u,[]);
    room('sealed-bedroom','bedroom',hall+.14,x-.18,split+.14,z-.18,u,{locked:true});
    room('sealed-archive','storage',hall+.14,x-.18,-z+.18,split-.14,u,{locked:true});
    room('upper-gallery','landing',-hall+.14,hall-.14,-z+.17,z-.18,u);
  } else if(site.plan==='split'||site.plan==='shops') {
    const n=site.id.charCodeAt(site.id.length-1);
    if(site.plan!=='shops'&&n%5===2&&site.w>6.5) {
      const divider=-x*.15;
      indoor('x',divider,-z+.12,z-.12,g,[opening(-z*.29,1.42)]);
      room('east-front',site.area==='farmland'?'kitchen':'living',divider+.14,x-.17,-z+.17,z-.17,g);
      room('west-room','bedroom',-x+.17,divider-.14,-z+.17,z-.17,g);
    }else{
      const divider=-z*.085+(n%3-1)*.32;
      const gap=opening(entryX-.14+(n%3-1)*x*.14,site.plan==='shops'?1.7:1.38,0,2.07);
      indoor('z',divider,-x+.12,x-.12,g,[gap]);
      room('front-room',site.plan==='shops'?'shop':site.area==='farmland'?'kitchen':'living',-x+.17,x-.17,divider+.135,z-.17,g);
      room('rear-room',site.plan==='shops'?'storage':site.style==='ruin'?'storage':'bedroom',-x+.17,x-.17,-z+.17,divider-.135,g);
    }
  } else {
    const hall=site.d>7?1.05:site.w>8.2?.98:.85;
    const rearDoor=hasUp?end-.32:-z*.59;
    const frontDoor=site.d*.24;
    const cut=z*((site.id.charCodeAt(site.id.length-1)%3)-1)*.115;
    for(const base of hasUp?[g,u]:[g]) {
      const up=base>2;
      for(const sign of [-1,1]) {
        const stairSide=sign<0&&hasUp || sign>0&&Boolean(site.basement)&&!up;
        const doors=[opening(rearDoor,1.20,0,2.13),opening(frontDoor,1.20,0,2.13)];
        indoor('x',hall*sign,-z+.13,z-.13,base,doors);
        const left=sign<0?-x+.16:hall+.14, right=sign<0?-hall-.14:x-.15;
        if(stairSide){
          room(`stair-hall-${base}-${sign}`,'landing',left,right,-z+.15,z-.15,base,{stair:true});
          continue;
        }
        indoor('z',cut,left-.03,right+.03,base,[]);
        const frontType=site.plan==='hospital'?'ward':up?'bedroom':sign<0?'living':'kitchen';
        const rearType=site.plan==='hospital'?sign<0?'office':'storage':up?sign<0?'bedroom':'storage':sign<0?'bedroom':site.d>6.5?'bath':'storage';
        room(`front-${base}-${sign}`,frontType,left,right,cut+.14,z-.18,base);
        room(`rear-${base}-${sign}`,rearType,left,right,-z+.17,cut-.14,base);
      }
      room(`hall-${base}`,'landing',-hall+.12,hall-.12,-z+.17,z-.17,base);
    }
  }
  return {site,entry:main,rooms,walls,floors,stairs,court,bounds:full,roofAt:(hasUp?u:g)+eave};
}

// Solid intervals over a wall: leave real windows/doors; a locked aperture still contains a solid leaf.
export function wallPieces(wall) {
  const result=[];
  const push=(a,b,lo,hi,tag=wall.finish)=>{if(b-a>.014&&hi-lo>.014)result.push({a,b,lo,hi,tag});};
  let cursor=wall.a;
  for(const o of wall.openings.slice().sort((a,b)=>a.at-b.at)) {
    const a=Math.max(cursor,o.at-o.w*.5,wall.a), b=Math.min(wall.b,o.at+o.w*.5);
    if(b-a<.032)continue;
    push(cursor,a,0,wall.height);
    push(a,b,0,o.low);push(a,b,o.high,wall.height);
    if(o.locked)push(a,b,0,o.high,'locked');
    cursor=b;
  }
  push(cursor,wall.b,0,wall.height);
  return result;
}
export function wallCoords(wall,t,offset=0) {
  return wall.axis==='x'?[wall.at+offset,t]:[t,wall.at+offset];
}
export function addStructureCollision(plan,collision) {
  const {site}=plan;
  for(const wall of plan.walls)for(const {a,b,lo,hi,tag} of wallPieces(wall)) {
    const [lx,lz]=wallCoords(wall,middle(a,b));
    const [x,z]=worldPoint(site,lx,lz);
    const yaw=site.yaw+(wall.axis==='x'?Math.PI/2:0);
    collision.addBox(x,z,b-a,tag==='locked'?.09:wall.finish==='outer'?WALL:.158,yaw,wall.base+lo-.012,wall.base+hi,tag);
  }
  for(const floor of plan.floors)for(const rect of floor.rects) {
    const [x,z]=worldPoint(site,middle(rect.x0,rect.x1),middle(rect.z0,rect.z1));
    collision.addFloor(x,z,rect.x1-rect.x0,rect.z1-rect.z0,site.yaw,floor.base,{thickness:.15,tag:floor.type});
  }
  for(const stair of plan.stairs){
    const [x,z]=worldPoint(site,stair.x,middle(stair.end,stair.start));
    collision.addRamp(x,z,stair.w,stair.start-stair.end,site.yaw,stair.front,stair.back);
  }
  const [tx,tz]=worldPoint(site,plan.entry.at,site.d/2+.34);
  collision.addFloor(tx,tz,plan.entry.w+.30,.82,site.yaw,BASE,{thickness:.11,tag:'threshold'});
  if(site.veranda) {
    const [x,z]=worldPoint(site,0,site.d/2+.89);
    collision.addFloor(x,z,site.w-.12,1.69,site.yaw,BASE,{thickness:.09,tag:'veranda'});
  }
  if(site.balcony&&site.levels>1){
    const [x,z]=worldPoint(site,0,site.d*.5+.66);
    collision.addFloor(x,z,Math.min(3.8,site.w*.49),1.36,site.yaw,BASE+UPPER,{thickness:.18,tag:'balcony'});
    const [rx,rz]=worldPoint(site,0,site.d*.5+1.30);
    collision.addBox(rx,rz,Math.min(3.8,site.w*.49),.14,site.yaw,BASE+UPPER,BASE+UPPER+1,'balcony-rail');
  }
  const ceilings=plan.court?subtractRectangle(plan.bounds,plan.court):[plan.bounds];
  for(const rect of ceilings){
    const [x,z]=worldPoint(site,middle(rect.x0,rect.x1),middle(rect.z0,rect.z1));
    collision.addFloor(x,z,rect.x1-rect.x0,rect.z1-rect.z0,site.yaw,plan.roofAt+.10,{thickness:.14,tag:'roof'});
  }
}

export function containsPlan(plan,x,y,z) {
  if(y<BASEMENT-.05||y>plan.roofAt-.10)return false;
  const [a,b]=localPoint(plan.site,x,z);
  return Math.abs(a)<plan.site.w*.5-.12 && Math.abs(b)<plan.site.d*.5-.13 && (y>-.08||plan.site.basement);
}
