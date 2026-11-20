import { Group, Vector3 } from 'three';
import { ModelBatch } from '../world/village/modeling.js';
import { lettering } from '../world/village/lettering.js';
import { table } from '../world/village/props.js';
import { lamp } from '../world/village/outdoors.js';
import { worldPoint } from '../world/sceneryLayout.js';
import { buildStoryCar, PARKED, REPAIR_STANCE, ROAD_MARKER, VILLAGE_SIGN } from './StoryCar.js';
import { CRETA_RETURN } from './VillageChapter.js';
import { RADIO_TRACK } from '../audio/RadioTrack.js';
import { VILLAGE_EN_LABEL, VILLAGE_NAME, VILLAGE_REGION } from '../world/VillageName.js';

const PI=Math.PI,point=(x,y,z)=>new Vector3(x,y,z);
const toWorld=(site,x,y,z)=>{const [u,v]=worldPoint(site,x,z);return point(u,y,v);};

function buildArrivalLandmarks(scene,p,collision,lights){
  const roadside=new Group();roadside.name='जंगल से गाँव की पुरानी सड़क';scene.add(roadside);
  const b=new ModelBatch(roadside);
  const [x,,z]=ROAD_MARKER,yaw=-1.48;
  b.within(x,0,z,yaw,a=>{
    a.box(p.rock,0,.11,0,1.07,.24,.60,{shadow:true});
    a.box(p.cement,0,.62,0,.93,1.04,.34,{shadow:true});
    a.box(p.mutedOchre,0,1.171,-.014,.95,.108,.377,{rz:-.035,shadow:true});
    a.box(p.paper,-.012,.833,.174,.823,.52,.024);
    lettering(a,p.black,VILLAGE_NAME,-.012,.906,.19,.124,.76);
    lettering(a,p.black,'आगे',-.012,.716,.19,.088,.36);
    for(const s of [-1,1])a.beam(p.black,[.34,.715,.19],[.297,.715+s*.039,.192],.009,4);
    a.beam(p.black,[.21,.715,.19],[.34,.715,.191],.009,4);
    a.box(p.rock,-.49,.11,.23,.243,.11,.212,{ry:.34});
  });
  collision.addBox(x,z,1.07,.60,yaw,0,1.23,'arrival-milestone');
  const poles=[[-19.35,31.35],[-11.65,25.2],[-5.4,18.7],[-4.0,10.02]];
  for(const [i,[u,v]] of poles.entries()){
    const h=4.12+i%2*.28;
    b.beam(p.wood,[u,0,v],[u-.10,h,v+.055],.104,7,true);
    b.box(p.rust,u-.08,h-.22,v+.055,.65,.082,.081,{ry:.17,rz:i===1?.22:-.05});
    for(const s of [-1,1])b.cylinder(p.pottery,u+s*.24-.08,h-.124,v+.055,.027,.042,.116,{sides:7});
    collision.addCircle(u,v,.15,h,0,'arrival-pole');
    if(i){
      const [px,pz]=poles[i-1],height=4.12+(i-1)%2*.28;
      b.cord(p.iron,[[px-.10,height-.06,pz],[.5*(u+px),3.45,.5*(v+pz)],[u-.10,h-.06,v]],.011,{segments:10,sides:4});
    }
  }
  lamp(b,p,collision,lights,4.38,17.15,{h:3.14,end:-.69,brightness:17,phase:24});
  b.finish('मील का पत्थर, पुराने तार और पहला खंभा');
}

function entrance(b,p,collision,actions){
  const sign=point(...VILLAGE_SIGN);
  const sx=sign.x,sz=sign.z-.119;
  b.within(sx,0,sz,0,a=>{
    for(const s of [-1,1]){
      a.box(p.wood,s*.96,.99,-.032,.136,1.98,.131,{rz:s*.021,shadow:true});
      collision.addCircle(sx+s*.96,sz-.03,.09,1.98,0,'population-post');
    }
    for(let i=0;i<4;i++) a.box(i===1?p.softWood:p.darkWood,0,1.35+i*.187,0,2.61+(i===2?.027:0),.186,.13,{rz:(i-1.8)*.008,shadow:true});
    lettering(a,p.chalk,VILLAGE_NAME,0,1.865,.077,.173,2.42);
    lettering(a,p.chalk,VILLAGE_REGION,0,1.712,.078,.087,1.11);
    lettering(a,p.chalk,VILLAGE_EN_LABEL,0,1.535,.078,.109,2.43);
    lettering(a,p.chalk,'स्कूल  →',0,1.350,.078,.096,1.12);
  });

  b.within(-6.93,0,-3.90,.24,a=>{
    a.box(p.cement,0,.071,-.56,3.89,.143,1.79,{shadow:true});
    a.box(p.cement,0,.91,-1.204,3.56,1.82,.198,{shadow:true});
    for(const x of [-1.78,1.78]){
      a.box(p.rust,x,1.21,.25,.090,2.4,.092,{rz:.02,shadow:true});
      const [u,v]=worldPoint({x:-6.93,z:-3.90,yaw:.24},x,.25);collision.addCircle(u,v,.068,2.4,0,'shelter-post');
    }
    const [u,v]=worldPoint({x:-6.93,z:-3.90,yaw:.24},0,-1.204);collision.addBox(u,v,3.56,.20,.24,0,1.82,'bus-stop');
    a.box(p.board,0,2.278,.48,3.80,.258,.105,{shadow:true});
    for(let j=0;j<7;j++)a.box(p.dullTeal,(j-3)*.52,2.33,-.432,.54,.040,2.08,{rx:.126,rz:(j-3)*.006,shadow:true});
    lettering(a,p.chalk,`${VILLAGE_NAME} बस अड्डा`,0,2.291,.548,.162,3.49);
    table(a,p,-.44,.14,-.865,2.19,.40,.42);
    a.box(p.wood,.93,1.337,-1.079,.603,.574,.046);
    a.box(p.paper,.93,1.337,-1.046,.553,.50,.024);
    lettering(a,p.black,'बस का समय',.93,1.500,-1.031,.063,.48);
    lettering(a,p.black,'6:10  ·  हिसार',.92,1.377,-1.029,.062,.48);
    for(let i=0;i<4;i++)a.box(p.ink,.91,1.289-i*.041,-1.029,.427-i*.02,.005,.004,{rz:.019});
    a.panel(p.cement,[[.92,1.112,-1.018],[1.213,1.112,-1.016],[1.21,1.265,-1.016],[1.074,1.231,-1.018],[.98,1.185,-1.021]],[[0,0],[1,0],[1,1],[.5,.7],[.2,.3]],[0,1,4,4,1,3,1,2,3]);
  });

  const stall={x:-8.51,z:-7.56,yaw:.72};
  b.within(stall.x,0,stall.z,stall.yaw,a=>{
    a.box(p.adobe,0,.79,-.58,2.62,1.58,.19,{shadow:true});
    a.box(p.board,0,1.92,.16,2.56,.26,.10,{rz:-.03,shadow:true});
    lettering(a,p.chalk,'गरम चाय',0,1.93,.218,.154,2.38);
    a.box(p.bedRed,0,2.13,.016,2.71,.054,1.63,{rx:.13,rz:-.03,shadow:true});
    for(const s of [-1,1])a.box(p.wood,s*1.18,.99,.68,.077,1.99,.086,{rz:-s*.026,shadow:true});
    table(a,p,0,0,.42,2.34,.56,1.01,{skew:-.016});
    a.pot(p.iron,.67,1.04,.40,[[0,0],[.15,0],[.16,.11],[.127,.229],[.076,.274],[.094,.278],[.091,.29],[0,.29]],{shadow:true});
    a.cord(p.iron,[[.67,1.26,.48],[.67,1.43,.42],[.67,1.31,.29]],.019,{segments:7});
    a.beam(p.rust,[.784,1.17,.42],[.947,1.28,.43],.031);
    a.pot(p.cement,.19,1.047,.563,[[0,0],[.093,0],[.126,.018],[.133,.031],[.125,.037],[.092,.020],[0,.020]],{shadow:true});
    a.ring(p.rust,.19,1.071,.563,.101,.004,{rx:-PI/2});
    a.box(p.darkWood,-.69,1.221,-.325,.70,.047,.39,{shadow:true});
    a.box(p.paintedWood,-.69,1.343,-.332,.559,.209,.284,{shadow:true});
    a.box(p.black,-.69,1.344,-.183,.520,.178,.027);
    a.box(p.mutedOchre,-.565,1.381,-.166,.238,.046,.011);
    lettering(a,p.black,'रेडियो',-.565,1.384,-.158,.034,.204);
    a.cylinder(p.iron,-.535,1.295,-.163,.024,.024,.023,{rx:PI/2,sides:9});
    for(let i=0;i<7;i++)a.box(p.rust,-.819,1.288+i*.018,-.164,.164,.005,.005);
    a.beam(p.iron,[-.907,1.433,-.334],[-1.02,1.724,-.309],.008,5);
  });
  for(const [l,w,d,h] of [[-.58,2.65,.20,1.58],[.42,2.38,.58,1.052]]){
    const v=toWorld(stall,0,0,l);collision.addBox(v.x,v.z,w,d,stall.yaw,0,h,'tea-stall');
  }
  const radio=toWorld(stall,-.69,1.35,-.146);
  actions.push({id:'tea-radio',kind:'radio',name:RADIO_TRACK.title,label:'हरियाणवी रेडियो सुनो',at:radio,range:2.70,use:()=>null});
}

// Each mission maps to one model and one ordinary use action. Other household
// exhibits are readable, but never change the route or the mission counter.
function missionCatalog(anchors, actions, log) {
  return (evidence, at, label, { model, ignore, room, stance, eligible, range = 2.65, aim = .868, sound = 'paper' } = {}) => {
    const { id, site } = evidence;
    const mission = log.steps[log.index.get(id)];
    if (mission) anchors.set(id, { id, site, at, label, kind: mission.kind, model, ignore, room, stance });
    const action = {
      id, at, label, name: evidence.item, ignore, range, aim, eligible,
      kind: mission ? 'chapter' : 'house-clue', objective: mission?.id, evidence,
      use({ cue }) { cue(sound, at, .82); return null; },
    };
    if (mission) action.available = () => log.canComplete(id) || log.has(id);
    actions.push(action);
  };
}

export function buildChapterExterior(scene, p, collision, actions, lights, log) {
  const car = buildStoryCar(scene, p, collision);
  buildArrivalLandmarks(scene, p, collision, lights);
  const group = new Group(); group.name = `${VILLAGE_EN_LABEL} · गाँव की चौखट`; scene.add(group);
  const b = new ModelBatch(group), anchors = new Map();
  entrance(b, p, collision, actions);
  b.finish('गाँव का बोर्ड, बस अड्डा और चाय की दुकान');
  const at=point(PARKED.x,.99,PARKED.z-1.52),ignore=[car.solid],label='रिंच से मरम्मत करो';
  anchors.set(CRETA_RETURN.id,{
    ...CRETA_RETURN,at,label,ignore,model:car.hood,stance:point(REPAIR_STANCE.x,REPAIR_STANCE.y,REPAIR_STANCE.z),
  });
  actions.push({
    id:CRETA_RETURN.id,kind:'car-repair',at,label,touchLabel:'रिंच लगाओ',name:'CRETA · बोनट',ignore,range:2.58,aim:.87,
    available:()=>log.hasWrench,
    eligible:({position})=>position.z<PARKED.z-2.16&&Math.abs(position.x-PARKED.x)<1.52,
    use:({player})=>player.grounded?null:'रिंच इस्तेमाल करने से पहले ज़मीन पर उतरो।',
  });
  return { car, anchors, bind: missionCatalog(anchors, actions, log), log };
}
