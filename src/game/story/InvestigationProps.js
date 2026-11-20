import { Group, Vector3 } from 'three';
import { CAMERA, PLAYER } from '../settings.js';
import { entryPoint, localPoint, worldPoint } from '../world/sceneryLayout.js';
import { BASE } from '../world/village/buildingPlans.js';
import { ModelBatch } from '../world/village/modeling.js';
import { lettering } from '../world/village/lettering.js';
import { HOUSE_CLUE_BY_SITE } from './HouseClues.js';
import { MISSIONS } from './VillageChapter.js';
import { modelWrench } from './Wrench.js';

const PI=Math.PI;
const insideFront=(site,position)=>{
  const [x,z]=localPoint(site,position.x,position.z);
  return Math.abs(x)<site.w/2-.15&&Math.abs(z)<site.d/2-.16&&
    position.y>BASE+.47&&position.y<BASE+2.63;
};
const world=(site,x,y,z)=>{const [wx,wz]=worldPoint(site,x,z);return new Vector3(wx,y,wz);};

// Furnish an actually reachable position, rather than dropping more obstacles
// in doorways. Test every position against the finished room furniture and
// trace the stance back through the real entry while its hinged leaves are open.
function findStand(building,collision,carryTray){
  const {site}=building,[doorX,edge]=entryPoint(site), entry=building.actions.find(a=>a.id===`${site.id}/entry`);
  const before=entry.progress;
  entry.setOpen(1);
  const probe=new Vector3(),zero=new Vector3();
  const clear=(p)=>{
    const y=collision.supportAt(p.x,p.z,BASE+.29);
    probe.copy(p).setY(y);collision.resolve(probe,zero.set(0,0,0));
    return Number.isFinite(y)&&Math.abs(y-BASE)<.22&&probe.distanceToSquared(p.clone().setY(y))<.006**2&&
      collision.headroomAt(p.x,p.z,y+.006,PLAYER.height);
  };
  try{
    const sign=Number(site.id.slice(-1))%2?1:-1;
    for(const depth of [2.32,1.96,1.62,2.67,1.33,2.99]){
      if(depth>site.d-.75)continue;
      for(const dx of [.81,1.08,.65,1.32,.48,.0].flatMap(s=>s?[s*sign,-s*sign]:[0])){
        const x=doorX+dx,z=edge-depth;
        const width=carryTray?.51:.28;
        if(Math.abs(x)>site.w*.5-width-.12)continue;
        const spot=world(site,x,BASE,z);
        if(collision.boxOccupied({x:spot.x,z:spot.z,w:width,d:.15,bottom:BASE+.011,top:BASE+1.52,c:Math.cos(site.yaw),s:Math.sin(site.yaw)}))continue;
        const at=world(site,x,BASE+1.04,z+.13);
        for(const [shift,stanceDepth] of [[0,1.3],[0,1.05],[dx*.4,.94],[0,.76],[dx*.70,1.15],[-dx*.51,1.22]]){
          const stance=world(site,doorX+shift,BASE,edge-stanceDepth),eye=stance.clone().add(new Vector3(0,CAMERA.eye,0));
          if(stance.distanceToSquared(spot)<.49**2||collision.blocksSight(eye,at))continue;
          let pass=true;
          for(let j=0;j<=13;j++){
            const t=j/13;
            if(!clear(world(site,doorX+shift*t,BASE,edge+.26-(stanceDepth+.26)*t))){pass=false;break;}
          }
          if(pass)return {x,z,at,stance};
        }
      }
    }
    throw new Error(`No reachable evidence display in ${site.id}`);
  }finally{entry.setOpen(before);}
}

function cabinet(b,p,isWide=false){
  const w=isWide?.95:.42;
  for(const s of [-1,1])b.box(p.darkWood,s*(w*.5-.044),BASE+.435,-.025,.056,.87,.265,{shadow:true});
  b.box(p.wood,0,BASE+.846,0,w,.074,.306,{shadow:true});
  b.box(p.rust,0,BASE+.104,-.10,w-.04,.075,.076);
  b.box(p.paintedWood,0,BASE+.757,.139,w-.041,.116,.047);
}

function artefact(b,p,clue){
  const h=BASE+.88;
  if(clue.id==='clue/centre-01'){
    b.box(p.bedRed,0,h+.138,-.048,.398,.280,.063,{rx:-.15,rz:.072});
    b.box(p.paper,0,h+.138,-.024,.365,.251,.044,{rx:-.15,rz:.072});
    b.box(p.tractorRed,0,h+.138,.008,.398,.280,.026,{rx:-.15,rz:.072});
    b.box(p.darkWood,-.150,h+.130,.025,.029,.248,.013,{rx:-.15,rz:.072});
    lettering(b,p.paper,'दादा',.021,h+.177,.039,.064,.262,-.15);
    b.box(p.iron,.126,h+.083,.035,.043,.019,.014,{rz:.07});
  }else if(clue.prop==='metal'){
    b.box(p.darkWood,0,h+.022,.032,.29,.038,.224,{ry:.12});
    b.ring(p.rust,-.077,h+.061,.053,.067,.018,{rx:PI/2,ry:.17});
    b.beam(p.rust,[-.035,h+.059,.052],[.095,h+.062,.075],.022,7);
    b.box(p.iron,.093,h+.063,.097,.038,.032,.057,{ry:.17});
    b.box(p.mutedOchre,.071,h+.058,-.043,.119,.025,.055,{ry:-.12});
  }else{
    const photo=clue.prop==='photo',print=clue.prop==='print';
    b.box(print?p.lime:p.darkWood,0,h+.126,-.04,.354,.267,.038,{rx:-.15,rz:.046});
    b.box(photo?p.photo:print?p.cement:p.paper,0,h+.129,-.014,.314,.221,.021,{rx:-.15,rz:.046});
    if(!photo){
      for(let i=0;i<4;i++)b.box(print?p.rust:p.black,(i-1.4)*.012,h+.129-(i-1)*.038,.010+(i-1)*.005,.223-i*.022,.005,.005,{rz:.029*i});
      b.box(p.tractorRed,-.113,h+.197,.008,.052,.042,.012,{rz:-.123});
    }
  }
}

function recorder(b,p,x){
  const y=BASE+.994;
  b.box(p.dullTeal,x,y,-.005,.49,.199,.255,{shadow:true});
  b.box(p.iron,x,y+.098,-.013,.466,.014,.235);
  b.box(p.darkGlass,x,y+.003,.132,.288,.118,.020);
  for(const s of [-1,1]){
    b.cylinder(p.paper,x+s*.072,y+.012,.145,.027,.027,.016,{rx:PI/2,sides:11});
    b.cylinder(p.rust,x+s*.072,y+.012,.156,.012,.012,.007,{rx:PI/2,sides:7});
  }
  for(let i=0;i<5;i++)b.box(p.black,x+.185,y+.047-i*.023,.127,.069,.006,.013);
  b.box(p.tractorRed,x-.187,y+.115,.060,.038,.024,.059);
  for(let i=0;i<3;i++)b.box(p.rust,x-.122+i*.060,y+.111,.06,.043,.020,.055);
  b.cord(p.rubber,[[x-.162,y+.068,-.082],[x-.10,y+.23,-.113],[x+.10,y+.23,-.118],[x+.16,y+.067,-.083]],.018,{segments:8});
}

function signalRadio(b,p){
  const y=BASE+1.06;
  b.box(p.dullTeal,0,y,-.018,.49,.30,.246,{shadow:true});
  b.box(p.darkWood,0,y,.107,.46,.270,.032);
  b.box(p.mutedOchre,-.052,y+.075,.131,.286,.083,.017);
  for(let i=0;i<9;i++)b.box(p.ink,-.167+i*.028,y+.064,.142,.003,.031+(i%4===0?.015:0),.006);
  b.beam(p.tractorRed,[-.091,y+.040,.146],[-.091,y+.106,.146],.006,4);
  for(let i=0;i<5;i++)b.box(p.black,-.068,y+.005-i*.022,.128,.264,.009,.012);
  b.cylinder(p.rust,.159,y+.058,.140,.044,.044,.027,{rx:PI/2,sides:12});
  b.ring(p.iron,.159,y+.058,.157,.035,.005);
  b.box(p.tractorRed,.156,y-.069,.146,.067,.073,.027);
  b.cylinder(p.iron,.16,y+.157,-.072,.031,.031,.028,{sides:8});
  b.beam(p.iron,[.16,y+.161,-.072],[.30,y+.507,-.072],.011,7);
  b.ball(p.iron,.30,y+.508,-.072,.019);
}

function model(parent, name, x, draw){
  const group=new Group();group.name=name;group.position.x=x;parent.add(group);
  const b=new ModelBatch(group);draw(b);b.finish(name);
  return group;
}

function station(building,p,collision,story,clue){
  const {site,interior}=building,big=site.id==='mansion-01';
  const {x,z,at,stance}=findStand(building,collision,big);
  const table=new Group();table.name=`सबूत · ${site.name}`;table.position.set(x,0,z);interior.add(table);
  const b=new ModelBatch(table);
  cabinet(b,p,big);b.finish(table.name);
  const spot=world(site,x,BASE,z);
  const body=collision.addBox(spot.x,spot.z,big?.95:.42,.30,site.yaw,BASE,BASE+.889,'evidence-stand');
  const eligible=view=>insideFront(site,view.position);
  const options={ignore:[body],stance,range:2.66,aim:.869,eligible};
  const exhibit=model(table,clue.item,big?.25:0,a=>artefact(a,p,clue));
  const label=clue.id==='clue/centre-01'?'डायरी पढ़ो':clue.id==='clue/forest-04'?'नोटबुक पढ़ो':clue.label;
  story.bind(clue,big?world(site,x+.25,at.y,z+.15):at,label,{
    ...options,model:exhibit,sound:clue.prop==='metal'?'latch':'paper',
  });
  if(!big)return story.log.index.has(clue.id)?[exhibit]:[];
  const radio=model(table,'हवेली का मदद वाला रेडियो',-.218,a=>signalRadio(a,p));
  // Completing the call also pockets the tool resting on the radio. This
  // stays part of the same interaction, not another pickup mission.
  const wrench=model(table,'रेडियो पर रखा रिंच',-.209,a=>modelWrench(a,p));
  wrench.position.y=BASE+1.223;wrench.position.z=.021;wrench.rotation.y=PI*.46;
  wrench.visible=!story.log.finished;story.wrench=wrench;
  story.bind(MISSIONS.at(-1),world(site,x-.218,BASE+1.10,z+.17),'मदद का संदेश भेजो',{
    ...options,model:radio,sound:'signal-clear',
  });
  return [radio,wrench];
}

export function furnishInvestigation(building,p,collision,story){
  const {site,interior}=building,clue=HOUSE_CLUE_BY_SITE.get(site.id);
  if(clue)return station(building,p,collision,story,clue);
  if(site.id!=='school')return [];
  // The reachable recorder is in the entrance corridor. The normal hinged
  // doors are unlocked; there is no generator, code or battery gate.
  const x=-2.30,z=3.07,spot=world(site,x,BASE,z);
  const desk=new Group();desk.position.set(x,0,z);interior.add(desk);
  const b=new ModelBatch(desk);
  cabinet(b,p,true);lettering(b,p.chalk,'टेप',0,BASE+.765,.174,.063,.31);b.finish('स्कूल में रिकॉर्डिंग की मेज़');
  const tape=model(desk,'स्कूल का असली टेप रिकॉर्डर',0,a=>recorder(a,p,0));
  const body=collision.addBox(spot.x,spot.z,.958,.315,site.yaw,BASE,BASE+.891,'school-recorder');
  story.bind(MISSIONS.find(m=>m.tape),world(site,x,BASE+1.013,z+.175),'टेप रिकॉर्डर चलाओ',{
    model:tape,room:'school-corridor',ignore:[body],sound:'dial',range:2.78,aim:.868,eligible:view=>insideFront(site,view.position),
  });
  return [tape];
}
