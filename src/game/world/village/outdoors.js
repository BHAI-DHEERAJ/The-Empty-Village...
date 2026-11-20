import { BoxGeometry, Color, Group, InstancedMesh, MathUtils, Mesh, Object3D, PlaneGeometry, SpotLight, Vector3 } from 'three';
import { CANAL, CAR, WELL, groundHeight, isEntrance, isSceneryFootprint, pathEdge, worldPoint } from '../sceneryLayout.js';
import { between, seededRandom } from '../random.js';
import { HingedDoor } from '../../interaction/HingedDoor.js';
import { makeSeat } from '../../interaction/InteractionController.js';
import { lettering } from './lettering.js';
import { addPlayground } from './playground.js';
import { ModelBatch } from './modeling.js';
import { cobweb, table } from './props.js';

function well(b,p,colliders) {
  const {x,z,r}=WELL;
  b.pot(p.rock,x,0,z,[[r,-.016],[r,.58],[r*.995,.78],[r*.78,.78],[r*.77,.69],[r*.79,-.21]],{shadow:true});
  b.cylinder(p.water,x,.063,z,r*.784,r*.784,.026,{sides:29});
  // Offset stone courses, with recessed mortar behind them and moss concentrated by the lip.
  for (let row = 0; row < 3; row += 1) {
    for (let i = 0; i < 19; i += 1) {
      const a = (i + row * .45) * Math.PI * 2 / 19;
      const tint = (i * 11 + row * 7) % 13;
      b.box(tint < 4 || tint > 10 && row === 2 ? p.stoneMoss : p.rock,
        x + Math.cos(a) * r * .961, .129 + .202 * row + (tint - 6) * .0015, z + Math.sin(a) * r * .961,
        .162, .186, .294 - (tint % 3) * .014, { ry: -a, rx: (tint - 6) * .010, rz: .028 * (i % 3 - 1) });
    }
  }
  for(let i=0;i<17;i++) {
    const angle=i*Math.PI*2/17, m=i%4===0?p.rock:p.stoneMoss;
    b.box(m,x+Math.cos(angle)*r*.9,.766+(i%3)*.014,z+Math.sin(angle)*r*.9,.29,.106,.34,{ry:-angle+.1,rz:(i%5-2)*.019,shadow:true});
  }
  for(const side of [-1,1]) {
    b.box(p.wood,x+side*.83,1.31,z-.17,.143,1.26,.157,{rz:side*.064,shadow:true});
    b.box(p.darkWood,x+side*.84,.74,z-.16,.23,.098,.23);
  }
  b.beam(p.wood,[x-1.04,1.88,z-.18],[x+1.02,1.85,z-.24],.084,7,true);
  b.ring(p.rust,x+.03,1.77,z-.175,.107,.032,{ry:Math.PI/2});
  b.cord(p.rope,[[x-.33,1.89,z-.12],[x-.19,1.86,z-.22],[x+.02,1.78,z-.18],[x+.08,1.29,z-.148],[x+.095,.91,z-.081],[x+.10,.66,z-.02]],.019,{segments:15});
  bucket(b,p,x+.88-.10,.033,z+.98,.18,.63);
  b.ring(p.iron,x+.64,.108,z+1.20,.081,.012,{rx:-1.15});
  cobweb(b,p.web,[x+.65,1.59,z-.21],[.23,.04,-.08],[.03,.24,.02],8,.0025);
  cobweb(b,p.web,[x-.67,.76,z+.38],[.19,-.03,.23],[.12,.15,-.07],7,.0025);
  colliders.addCircle(x,z,r*.99,.875,0,'well');
}

function bucket(b,p,x,y,z,r=.14,openSpan=1) {
  b.pot(p.wood,x,y,z,[[r*.78,0],[r,.27],[r*.92,.269],[r*.7,.037],[0,.036]],{span:Math.PI*2*openSpan,rz:.23});
  b.ring(p.iron,x,y+.095,z,r*.91,.014,{rx:Math.PI/2,rz:.17});
}
function jar(b,p,x,y,z,r=.22,broken=false) {
  b.pot(p.pottery,x,y,z,[[r*.38,0],[r*.70,.033],[r,.124],[r*.973,.228],[r*.55,.315],[r*.48,.345],[r*.6,.357],[r*.52,.367],[r*.39,.355],[r*.43,.32],[r*.86,.215],[r*.91,.136],[r*.67,.049],[0,.025]],
    {span:Math.PI*2*(broken?.66:1),ry:x*.8,rz:broken?.38:0});
  if(broken) for(let i=0;i<3;i++) b.box(p.pottery,x+.25+i*.075,y+.024,z+.14-i*.097,.13,.032,.064,{ry:i*.73,rz:.16*(i-1)});
}
function wheel(b,p,x,y,z,r,axis='z',damaged=false) {
  const ry=axis==='x'?Math.PI/2:0;
  b.ring(p.rubber,x,y,z,r,r*.195,{ry,shadow:true});
  b.ring(p.rust,x,y,z,r*.76,r*.063,{ry});
  b.cylinder(p.iron,x,y,z,r*.49,r*.49,r*.32,{rx:axis==='x'?0:Math.PI/2,rz:axis==='x'?Math.PI/2:0,sides:12});
  for(let i=0;i<6;i++) {
    if(damaged&&i===3)continue;
    const u=Math.cos(i*Math.PI/3)*r*.70,v=Math.sin(i*Math.PI/3)*r*.70;
    b.beam(p.iron,[x,y,z],axis==='x'?[x,y+v,z+u]:[x+u,y+v,z],r*.045,4);
  }
}
function utility(b,p,colliders) {
  const {x,z}=CAR;
  b.box(p.rust,x,.56,z,1.59,.36,3.26,{rz:.045,shadow:true});
  b.box(p.dullTeal,x,.82,z+.85,1.50,.334,1.33,{rz:.045,shadow:true});
  b.box(p.dullTeal,x,.51,z-.88,1.53,.43,1.41,{rz:.033,shadow:true});
  b.box(p.iron,x,.57,z+1.654,1.49,.217,.107,{rz:.045,shadow:true});
  b.box(p.iron,x,.62,z-1.64,1.51,.13,.08);
  b.box(p.rust,x,.862,z+1.54,1.23,.36,.117,{rz:.045});
  for(const xx of [-.49,.49]) {
    b.cylinder(p.iron,x+xx,.914,z+1.618,.137,.137,.069,{rx:Math.PI/2,sides:12});
    b.cylinder(p.glass,x+xx,.914,z+1.657,.109,.109,.027,{rx:Math.PI/2,sides:12});
  }
  for(let i=0;i<7;i++) b.box(p.iron,x-.30+i*.10,.868,z+1.604,.026,.22,.025);
  for(const xx of [-.76,.76]) for(const zz of [-1.05,1.04]) wheel(b,p,x+xx,.34,z+zz,.31,'x',xx>0);
  for(const sx of [-1,1]) {
    b.beam(p.dullTeal,[x+sx*.70,.88,z+.38],[x+sx*.58,1.56,z+.06],.040,5,true);
    b.beam(p.rust,[x+sx*.70,.72,z-.70],[x+sx*.59,1.55,z-.77],.043,5,true);
    b.box(p.rust,x+sx*.75,1.033,z-.23,.066,.35,.83,{rz:.053});
    b.box(p.dullTeal,x+sx*.66,1.39,z-.94,.056,.44,.54,{rz:sx*.09});
  }
  b.box(p.dullTeal,x,1.57,z-.62,1.31,.086,1.23,{rz:.05,shadow:true});
  b.beam(p.iron,[x-.58,1.56,z+.062],[x+.58,1.58,z+.062],.032,5);
  b.panel(p.glass,[[x-.57,1.52,z+.10],[x-.64,.929,z+.39],[x+.65,.93,z+.39],[x+.38,1.13,z+.27],[x+.08,1.20,z+.24]],[[0,1],[0,0],[1,0],[.83,.4],[.6,.51]],[0,1,4,1,2,3,1,3,4]);
  b.box(p.leather,x-.33,1.04,z-.28,.48,.48,.11,{rx:-.14});
  b.box(p.leather,x+.32,1.04,z-.28,.47,.49,.11,{rx:-.12});
  colliders.addBox(x,z,1.67,3.31,0,0,1.55,'vehicle');
}
export function bicycle(b,p,x,z,{basket=false,fallen=false}={}) {
  const yc=.347;
  const lift=(pt)=> fallen ? [pt[0],.020+pt[1]*.24-pt[2]*.90,z+(pt[1]*.96+pt[2]*.24)] : [pt[0],pt[1],z+pt[2]];
  const beam=(p1,p2,r,sides=6)=>b.beam(p.rust,lift(p1),lift(p2),r,sides);
  const rv=fallen ? 1.31 : 0;
  for(const dx of [-.54,.55]) {
    b.ring(p.rubber,...lift([x+dx,yc,0]),.314,.022,{rx:rv});
    b.ring(p.iron,...lift([x+dx,yc,0]),.285,.011,{rx:rv});
    for(let i=0;i<7;i++) {
      const a=i*Math.PI*2/7;
      beam([x+dx,yc,0],[x+dx+.28*Math.cos(a),yc+.28*Math.sin(a),0],.0055,4);
    }
  }
  const a=[x-.54,yc,0],c=[x+.55,yc,0],hub=[x-.013,yc-.025,0],seat=[x-.21,.82,0],head=[x+.38,.87,0];
  for(const [u,v] of [[a,hub],[a,seat],[seat,head],[head,hub],[seat,hub],[head,c]])beam(u,v,.021);
  beam(head,[x+.42,.98,-.063],.015);
  b.cord(p.iron,[[x+.43,.98,-.22],[x+.40,1.01,-.06],[x+.39,.98,.19]].map(lift),.017,{segments:7});
  b.box(p.leather,...lift([x-.20,.864,0]),.227,.063,.12,{rz:.11,rx:rv});
  b.ring(p.iron,...lift([x-.014,yc-.025,.038]),.083,.012,{rx:rv});
  b.ball(p.iron,...lift([x+.391,1.022,.14]),.035,{sy:.51});
  if(basket){
    const u=x+.606;
    b.box(p.iron,u,.892,z,.345,.020,.331);
    for(const y of [.91,1.001,1.063]){
      const r=y>.92?.169:.142;
      b.cord(p.iron,[[u-r,y,z-r],[u+r,y,z-r],[u+r,y,z+r],[u-r,y,z+r],[u-r,y,z-r]],.009,{segments:17});
    }
    for(let i=0;i<6;i++)for(const side of [-1,1]){
      const a=(i-2.5)*.061;
      b.beam(p.rust,[u+a,.91,z+side*.141],[u+a*1.17,1.063,z+side*.169],.0048,4);
      b.beam(p.rust,[u+side*.141,.91,z+a],[u+side*.169,1.063,z+a*1.17],.0048,4);
    }
  }
}
function cart(b,p,x,z) {
  for(let i=0;i<6;i++) b.box(p.darkWood,x-.55+i*.22,.506+(i===3?.065:0),z,.202,.069,1.58,{rz:(i%3-1)*.063,shadow:true});
  b.beam(p.iron,[x-.88,.39,z+.30],[x+.88,.39,z+.30],.043,7);
  for(const dx of [-.76,.76]) wheel(b,p,x+dx,dx<0?.39:.31,z+.30,.384,'x',dx>0);
  b.beam(p.wood,[x-.44,.46,z+.42],[x-.39,.27,z+2.04],.048,6);
  b.beam(p.wood,[x+.41,.48,z+.41],[x+.55,.37,z+1.71],.049,6);
}
const PI=Math.PI;

export function lamp(b,p,collision,lights,x,z,{broken=false,lean=.10,h=3.68,end=-.68,brightness=24,phase=0,id=null}={}){
  const ground=groundHeight(x,z);
  const q=ground+h;
  b.cylinder(p.rock,x,ground+.164,z,.152,.203,.335,{sides:8,shadow:true});
  b.cord(p.iron,[[x,ground+.14,z],[x+lean*.11,ground+h*.44,z],[x+lean,ground+h*.89,z],[x+lean+end*.39,q+.018,z],[x+end,q,z+.05]],.043,{segments:14,sides:7});
  b.box(p.rust,x+end,q-.034,z+.05,.38,.12,.21,{rz:end*.18,shadow:true});
  b.box(p.darkGlass,x+end,q-.105,z+.05,.22,.034,.137,{rz:end*.18});
  if(broken){
    b.cord(p.rust,[[x+end*.74,q,z],[x+end*.76,q-.24,z+.024],[x+end*.59,q-.53,z+.10],[x+end*.75,q-.69,z+.08]],.009,{segments:8});
    cobweb(b,p.web,[x+end*.71,q-.11,z+.068],[.166,.035,-.017],[-.04,-.134,.015],7,.0015);
  }else{
    const glow=new Mesh(new BoxGeometry(.17,.025,.105),p.bulb);
    glow.name='Low amber street lamp';glow.position.set(x+end,q-.136,z+.05);glow.rotation.z=end*.18;b.group.add(glow);
    lights.push({glow,point:new Vector3(x+end,q-.25,z+.05),strength:brightness,phase,id,kind:x<-39&&z>-26?'forest':'street'});
  }
  collision.addCircle(x,z,.21,ground+h,ground,'lamp-post');
  return [x+lean,ground+h-.38,z];
}

function sign(b,p,collision,x,z,text,second,ry,w){
  const y=groundHeight(x,z);
  const c=Math.cos(ry),s=Math.sin(ry);
  b.within(x,y,z,ry,a=>{
    for(const j of [-1,1]){
      a.box(p.darkWood,j*w*.36,.91,.015,.085,1.83,.093,{rz:j*.027,shadow:true});
      // Small masonry sockets are structural, not loose rocks or gate decoration.
      a.box(p.floor,j*w*.36,.055,.016,.144,.11,.14,{shadow:true});
      for(const q of [1.28,1.59])a.cylinder(p.rust,j*w*.36,q,.106,.017,.017,.018,{rx:PI/2,sides:6});
    }
    a.box(p.board,0,1.48,.065,w,.44,.083,{rz:-.022,shadow:true});
    a.box(p.wood,0,1.705,.103,w+.045,.035,.032,{rz:-.021});
    const painted=(material,text,y,h)=>{
      const arrow=text.match(/[↑→←]/)?.[0];
      const trimmed=text.replace(/[↑→←]/g,'').trim();
      const side=arrow?(text.startsWith(arrow)?-1:1):0;
      lettering(a,material,trimmed,-side*.084,y,.112,h,w-(arrow?.48:.19));
      if(!arrow)return;
      const x=side*(w*.5-.159),r=h*.55,d=arrow==='←'?-1:1;
      const dir=arrow==='↑'?[0,1]:[d,0], u=dir[0],v=dir[1];
      const start=[x-u*r,y-v*r,.122], tip=[x+u*r,y+v*r,.122];
      a.beam(material,start,tip,.0085,5);
      for(const n of [-1,1])a.beam(material,[tip[0]-u*r*.78+n*v*r*.62,tip[1]-v*r*.78-n*u*r*.62,.122],tip,.0085,5);
    };
    painted(p.chalk,text,second?1.56:1.49,.151);
    if(second)painted(p.paper,second,1.378,.104);
  });
  collision.addBox(x+s*.065,z+c*.065,w,.084,ry,y+1.245,y+1.73,'sign-board');
  for(const sign of [-1,1])collision.addCircle(x+sign*w*.36*c,z-sign*w*.36*s,.09,y+1.84,y,'sign-post');
}

function tractor(b,p,collision,x,z,ry,red){
  const mat=red?p.tractorRed:p.dullTeal, y=groundHeight(x,z);
  b.within(x,y,z,ry,a=>{
    a.box(p.iron,0,.53,-.03,.65,.24,2.0,{shadow:true});
    a.beam(p.rust,[-.78,.60,-.64],[.78,.60,-.64],.093,8,true);
    a.beam(p.rust,[-.57,.29,.89],[.57,.29,.89],.069,7,true);
    for(const s of [-1,1]){
      wheel(a,p,s*.66,.63,-.67,.527,'x',s>0);
      wheel(a,p,s*.56,.299,.87,.249,'x',true);
      for(let i=0;i<14;i++){
        const angle=i/14*2*PI;
        a.box(p.rubber,s*.66,.63+Math.cos(angle)*.617,-.67+Math.sin(angle)*.617,.198,.050,.109,{rx:angle,rz:s*.18});
      }
      a.panel(mat,[[s*.35,.945,-1.16],[s*.82,.917,-1.16],[s*.83,1.16,-.53],[s*.39,1.18,-.51]],[[0,0],[1,0],[1,1],[0,1]],s>0?[0,1,2,0,2,3]:[0,2,1,0,3,2],{shadow:true});
      a.box(mat,s*.42,.65,-.02,.22,.053,.48,{shadow:true});
    }
    a.box(mat,0,.943,.50,.59,.429,1.24,{shadow:true,rz:.028});
    a.box(p.rust,0,.919,1.153,.526,.362,.104,{shadow:true});
    for(let i=-4;i<=4;i++)a.box(p.black,i*.054,.922,1.209,.023,.261,.017);
    for(const s of [-1,1]){
      a.cylinder(p.iron,s*.206,1.05,1.218,.078,.078,.047,{rx:PI/2,sides:10});
      a.cylinder(p.glass,s*.206,1.05,1.245,.057,.057,.025,{rx:PI/2,sides:10});
    }
    a.box(p.leather,0,1.012,-.70,.39,.081,.33,{rx:.16});
    a.box(p.leather,0,1.153,-.84,.36,.263,.056,{rx:.17});
    a.beam(p.iron,[0,.82,-.08],[0,1.26,-.24],.025,6);
    a.ring(p.iron,0,1.30,-.21,.176,.016,{rx:-1.12});
    a.beam(p.rust,[.11,.997,.45],[.098,1.56,.47],.032,7);
    a.cylinder(p.iron,.098,1.58,.47,.051,.052,.065,{sides:8});
  });
  const solid=collision.addBox(x,z,1.60,2.64,ry,y,y+1.33,'tractor');
  const lampGroup=new Group();lampGroup.name='Tractor headlight lenses';lampGroup.position.set(x,y,z);lampGroup.rotation.y=ry;
  const lights=new ModelBatch(lampGroup);
  for(const s of [-1,1])lights.cylinder(p.bulb,s*.206,1.05,1.264,.052,.052,.018,{rx:PI/2,sides:12});
  lights.finish('Lit tractor lenses');lampGroup.visible=false;b.group.add(lampGroup);
  const at=new Vector3(x,y+1.27,z);
  return {id:red?'tractor-red':'tractor-green',kind:'tractor',name:red?'लाल ट्रैक्टर':'हरा ट्रैक्टर',at,range:2.76,ignore:[solid],
    on:false,rpm:0,source:new Vector3(x,y+.84,z),yaw:ry,
    get label(){return this.on?'ट्रैक्टर बंद करो':'ट्रैक्टर चालू करो';},
    use({cue}){this.on=!this.on;lampGroup.visible=this.on;cue(this.on?'ignition':'engine-off',at);return null;},
  };
}

function tractorLights(scene,vehicles){
  // One non-shadowed light budget for the nearest running tractor. The lenses
  // on both tractors still remember their own ignition state.
  const light=new SpotLight(0xffc381,0,20,.47,.89,1.18);
  light.name='Pooled tractor headlight';scene.add(light,light.target);
  return (dt,view)=>{
    let best=null,r2=46**2;
    for(const vehicle of vehicles){
      vehicle.rpm=MathUtils.damp(vehicle.rpm,vehicle.on?1:0,7,dt);
      const range=view.position.distanceToSquared(vehicle.source);
      if(vehicle.rpm>.003&&range<r2){best=vehicle;r2=range;}
    }
    if(best){
      const [x,z]=worldPoint({x:best.source.x,z:best.source.z,yaw:best.yaw},0,1.34);
      light.position.set(x,best.source.y+.20,z);
      light.target.position.set(x+Math.sin(best.yaw)*11,best.source.y-.84,z+Math.cos(best.yaw)*11);
    }
    light.intensity=best?39*best.rpm:0;
  };
}

function canal(b,p,collision){
  const {x,z0,z1,half,bridgeZ}=CANAL;
  const length=z1-z0-.76;
  b.panel(p.water,[[x-half,-.55,z0+.38],[x-half,-.55,z1-.38],[x+half,-.55,z1-.38],[x+half,-.55,z0+.38]],[[0,0],[0,length/3],[1.36,length/3],[1.36,0]],[0,1,2,0,2,3]);
  for(let j=0;j<bridgeZ.length;j++){
    const z=bridgeZ[j], w=j===1?3.65:2.81, span=(half+.93)*2;
    const m=j===2?p.wood:p.floor;
    b.box(m,x,.006,z,span,.252,w,{shadow:true});
    if(j===2)for(let i=0;i<17;i++)b.box(p.wood,x-span*.47+i*span*.058,.142,z,.327,.042,w-.098,{rz:i%4*.006});
    for(const end of [-1,1]){
      b.box(p.cement,x+end*(span*.5+.29),.013,z,.68,.116,w+.18,{shadow:true});
      b.box(p.rock,x+end*2.49,-.27,z,.37,.61,w-.12,{shadow:true});
    }
    for(const s of [-1,1]){
      const zz=z+s*(w*.5-.12);
      for(const i of [-1,0,1])b.box(j===2?p.rust:p.mutedPlaster,x+i*(span*.5-.18),.577,zz,.103,.90,.119,{shadow:true});
      for(const h of [1.004,.64])b.box(j===2?p.wood:p.rust,x,h,zz,span-.163,.063,.069,{shadow:true});
      collision.addBox(x,zz,span-.10,.15,0,.10,1.024,'bridge-rail');
    }
    collision.addFloor(x,z,span,w,0,j===2?.162:.132,{thickness:.25,tag:'bridge'});
  }
  for(const [x0,z] of [[78.9,-4.55],[87.7,31.0],[79.1,53.6]]){
    const s=Math.sign(x-x0);
    b.box(p.cement,x0,.084,z,.83,.168,1.28,{shadow:true});
    b.cord(p.rust,[[x0,.149,z],[x0,.53,z],[x0+s*.31,.64,z],[x0+s*1.25,.64,z],[x0+s*1.64,.16,z],[x0+s*2.10,-.60,z]],.068,{sides:8,segments:10});
    b.cylinder(p.iron,x0,.678,z,.096,.088,.09,{sides:7});
    b.ring(p.tractorRed,x0,.742,z,.156,.021,{rx:PI/2});
    for(const j of [-1,1])b.beam(p.iron,[x0+j*.35,.03,z-.44],[x0+s*.90,.61,z-.05],.026,5);
    collision.addBox(x0,z,.87,1.25,0,0,.74,'irrigation-control');
  }
}

function fenceRun(b,p,collision,from,to,{gap=0,m=p.wood,height=.96,broken=false}={}){
  const dx=to[0]-from[0], dz=to[1]-from[1],len=Math.hypot(dx,dz),ry=-Math.atan2(dz,dx);
  const n=Math.max(1,Math.ceil(len/1.2)), post=.095, step=len/n;
  for(let i=0;i<=n;i++){
    const x=from[0]+i/n*dx,z=from[1]+i/n*dz,y=groundHeight(x,z);
    b.box(m,x,y+height*.48,z,post,height,post,{ry,rz:broken?(i%3-1)*.077:0,shadow:true});
    collision.addCircle(x,z,post*.73,y+height,y,'fence-post');
    if(i>=n||(gap&&i===gap)||broken&&i%5===2)continue;
    const xx=x+dx/n*.5,zz=z+dz/n*.5;
    for(const r of [.39,.77])b.box(m,xx,y+height*r,zz,step+.01,.061,.063,{ry,rz:broken?(i%4-1)*.084:0,shadow:true});
    collision.addBox(xx,zz,step+.01,.076,ry,y+.23,y+height*.84,'fence-rails');
  }
}

function estateGate(b,p,collision,actions){
  const x=-52.9,z=-112.1,w=1.96,leaves=[];
  for(const s of [-1,1]){
    const px=x+s*2.08;
    b.box(p.brick,px,.95,z,.39,1.90,.43,{shadow:true});
    b.box(p.floor,px,1.899,z,.49,.121,.53,{shadow:true});
    b.box(p.mutedPlaster,px,.108,z,.52,.216,.56);
    collision.addBox(px,z,.43,.47,0,0,1.96,'estate-gatepost');
    fenceRun(b,p,collision,[px,z],[px+s*4.3,z+.32],{broken:s<0,m:p.rust,height:1.38});
    const edge=s*1.97,centre=-s*w*.5;
    const leaf=new Group();leaf.name='Mansion drive gate leaf';leaf.position.set(x+edge,.095,z);b.group.add(leaf);
    const bars=new ModelBatch(leaf);
    for(const y of [.097,1.18])bars.box(p.rust,centre,y,0,w,.051,.041,{shadow:true});
    for(let i=0;i<9;i++)bars.box(p.iron,-s*(.08+i*(w-.14)/8),.645,0,.027,1.22,.035,{shadow:true});
    bars.beam(p.rust,[0,.14,0],[-s*(w-.035),1.19,0],.025,6);
    bars.ring(p.iron,-s*(w-.10),.96,.035,.046,.011);
    bars.finish('Mansion drive gate leaf and latch');
    leaves.push({object:leaf,edge,centre,width:w,low:.038,high:1.27,openAngle:s*PI*.5});
  }
  actions.push(new HingedDoor({id:'estate-gate',x,y:.095,z,yaw:0,noun:'gate',leaves,collision}));
}

function fieldBatches(scene,p,compact){
  const plots=[ [50,63,20,29], [65,77,21,33], [51,63,-23,-10], [71,77,-31,-20], [90,103,5,14], [94,105,23,36], [93,111,44,55], [111,132,-11,2], [120,138,24,35], [132,148,43,58] ];
  const geometry=new BoxGeometry(1,1,1), leaf=new PlaneGeometry(1,1), pose=new Object3D(), color=new Color();
  for(let k=0;k<plots.length;k++){
    const [x0,x1,z0,z1]=plots[k],rng=seededRandom(712997+k*7713),furrows=[],crop=[];
    for(let x=x0+.24;x<x1;x+=1.36){
      for(let z=z0+.10;z<z1;z+=2.24){
        if(pathEdge(x,z)<.58||isSceneryFootprint(x,z,.93)||isEntrance(x,z,.11))continue;
        const len=Math.min(2.17,z1-z+.73);
        furrows.push([x,.031,z,.57,.088,len,0]);
        for(let j=0;j<(compact?3:4);j++){
          const zz=z-len*.36+j*len*.23,side=between(rng,-.16,.16), h=between(rng,.24,.67);
          const spread=h*between(rng,.68,1.33);
          crop.push([x+side,h*.49+.052,zz,spread,h,1,rng()*PI]);
          if(!compact)crop.push([x+side,h*.49+.052,zz,spread,h,1,rng()*PI+PI*.5]);
        }
      }
    }
    const instance=(items,geo,m,title)=>{
      if(!items.length)return;
      const mesh=new InstancedMesh(geo,m,items.length);mesh.name=title;
      items.forEach(([x,y,z,a,b,c,rot],i)=>{
        pose.position.set(x,y,z);pose.rotation.y=rot;pose.scale.set(a,b,c);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);
        const shade=between(rng,.70,1.16);color.setRGB(shade*1.03,shade,shade*.91);mesh.setColorAt(i,color);
      });
      mesh.computeBoundingSphere();scene.add(mesh);
    };
    instance(furrows,geometry,p.soil,'Instanced irrigation and crop furrows');
    instance(crop,leaf,k%3===0?p.grass:p.crop,'Rows of abandoned crops');
  }
}

function groundLitter(scene,p,compact){
  const r=seededRandom(443386), geo=new PlaneGeometry(1,1), pose=new Object3D(), tint=new Color();
  for(const [x,z] of [[-5,-6],[4.9,-11],[-7.1,-21],[6.8,-31],[7.0,-48],[-5.5,-53],[-6,-72],[-4,-92],[-14,-101],[-49,-7],[-65,-8],[-96,-11],[41,-37],[60,14],[110,18],[-51,-115]]){
    const leaves=new InstancedMesh(geo,p.leaf,compact?21:34);
    leaves.name='Dry leaf deposits along walls and roads'; let count=0;
    for(let i=0;i<leaves.count;i++){
      const xx=x+between(r,-1.7,1.7),zz=z+between(r,-2.42,2.42);
      if(isSceneryFootprint(xx,zz,.08)||groundHeight(xx,zz)<-.09)continue;
      const d=between(r,.085,.149);
      pose.position.set(xx,.016+r()*.017,zz);pose.rotation.set(-PI/2+r()*.2,0,r()*PI*2);pose.scale.set(d,d*between(r,.65,1.77),1);pose.updateMatrix();
      leaves.setMatrixAt(count,pose.matrix);const hue=between(r,.65,1.12);tint.setRGB(hue*1.04,hue,hue*.87);leaves.setColorAt(count++,tint);
    }
    leaves.count=count;leaves.computeBoundingSphere();scene.add(leaves);
  }
}

export function buildOutdoors(scene,p,collision,{compact=false}={}){
  const lights=[],actions=[];
  const batch=(name)=>{const g=new Group();g.name=name;scene.add(g);return new ModelBatch(g);};
  const centre=batch('Main road, village square and shops'),farm=batch('Irrigated farmland and canal'),old=batch('Old courtyard and well'),forest=batch('Wooded tracks'),school=batch('School compound and playground'),estate=batch('Mansion approach');
  sign(centre,p,collision,-4.95,-6.58,'सूना गाँव','गाँव का चौक  →',.075,2.160);
  sign(centre,p,collision,-1.36,-24.25,'←  जंगल की पगडंडी','गाँव की सड़क  ↑',.06,1.944);
  sign(centre,p,collision,5.62,-10.20,'नहर की सड़क  →',null,-.36,1.728);
  sign(centre,p,collision,7.72,-38.04,'स्कूल  →','पुरानी बस्ती  ↑',-.15,2.160);
  sign(old,p,collision,2.44,-109.36,'←  हवेली','पश्चिम वाली गली',.10,2.484);
  sign(forest,p,collision,-47.4,-13.3,'जंगल की पगडंडी','लकड़ी की झोपड़ियाँ',.57,1.944);
  sign(farm,p,collision,80.24,12.66,'नहर','पुल से पार जाओ',-.72,1.944);
  sign(school,p,collision,39.5,-34.22,'स्कूल','खेल का मैदान',.08,1.420);
  sign(estate,p,collision,-48.4,-113.4,'हवेली','मुख्य फाटक',.12,1.944);
  const A=lamp(centre,p,collision,lights,6.07,-9.25,{end:-1.02,brightness:19,phase:3});
  const B=lamp(centre,p,collision,lights,7.0,-26.24,{end:-.77,broken:true}), C=lamp(centre,p,collision,lights,-4.73,-36.24,{end:.82,brightness:28,phase:16});
  lamp(centre,p,collision,lights,9.53,-43.59,{end:-.85,brightness:18,phase:7});
  const D=lamp(centre,p,collision,lights,-3.84,-61.4,{end:.73,broken:true});
  for(const [u,v] of [[A,B],[B,C],[C,D]]){
    const mid=[(u[0]+v[0])*.5,(u[1]+v[1])*.5-.47,(u[2]+v[2])*.5];
    centre.cord(p.iron,[u,mid,v],.012,{segments:16,sides:4});
  }
  lamp(forest,p,collision,lights,-56.1,-2.85,{h:2.65,end:.67,brightness:12,phase:8});
  lamp(forest,p,collision,lights,-92.8,-9.28,{h:2.84,brightness:18,phase:28});
  lamp(forest,p,collision,lights,-113.65,-16.83,{h:2.52,brightness:14,phase:32});
  lamp(farm,p,collision,lights,75.76,16.9,{h:3.10,brightness:22,phase:19});
  lamp(old,p,collision,lights,4.42,-86.91,{phase:7,brightness:18});
  lamp(old,p,collision,lights,-7.26,-101.22,{broken:true});
  lamp(school,p,collision,lights,31.35,-37.93,{end:.56,phase:13,brightness:20});
  lamp(estate,p,collision,lights,-46.39,-115.11,{h:3.77,phase:31,brightness:20});
  well(old,p,collision);
  utility(centre,p,collision);
  bicycle(centre,p,7.84,-44.67);
  cart(forest,p,-54.2,-1.67);collision.addBox(-54.2,-1.67,1.73,1.63,0,0,.62,'handcart');
  cart(old,p,-2.33,-99.62);collision.addBox(-2.33,-99.62,1.73,1.63,0,0,.62,'handcart');
  const vehicles=[tractor(farm,p,collision,70.41,8.86,.27,true),tractor(farm,p,collision,99.17,35.97,-1.43,false)];
  actions.push(...vehicles);
  canal(farm,p,collision);addPlayground(school,p,collision,actions);estateGate(estate,p,collision,actions);
  for(const [i,[x,z,group]] of [[-6.78,-42.36,centre],[7.79,-38.60,centre],[-6.22,-90.64,old],[2.90,-93.68,old]].entries()){
    table(group,p,x,0,z,1.68,.37,.43,{skew:(x%2)*.029});
    const solid=collision.addBox(x,z,1.68,.39,0,0,.48,'courtyard-bench');
    actions.push(makeSeat({id:`village-bench-${i}`,name:'बेंच',at:new Vector3(x,.467,z),ignore:[solid]}));
  }
  fenceRun(farm,p,collision,[54.34,19.4],[63,19.6],{broken:true});
  fenceRun(forest,p,collision,[-51.9,-3.16],[-46.7,-2.86],{broken:true});
  fenceRun(old,p,collision,[-6.9,-89.1],[-6.75,-86.3],{broken:true,m:p.wood});
  for(const [x,z] of [[5.7,-45.63],[-6.4,-44.58],[-3.51,-95.1],[-9.36,-89.11],[-50.5,-4.83]]){
    jar(pathEdge(x,z)>.11?x<-39?forest:z<-80?old:centre:centre,p,x,.015,z,.195,x<0);
  }
  for(const b of [centre,farm,old,forest,school,estate])b.finish('District landmarks and grounded outdoor models');
  fieldBatches(scene,p,compact);groundLitter(scene,p,compact);
  return {lights,actions,vehicles,updateVehicles:tractorLights(scene,vehicles)};
}
