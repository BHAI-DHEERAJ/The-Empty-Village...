import { Group, Vector3 } from 'three';
import { MISSIONS } from '../../interaction/MissionLog.js';
import { WELL, worldPoint } from '../sceneryLayout.js';
import { lettering } from './lettering.js';
import { ModelBatch } from './modeling.js';

function notice(parent, p, id, [x,y,z], yaw, text, { metal = false, site = null } = {}) {
  const group = new Group();
  group.name = id === 'school-register' ? 'School attendance register' : 'Weathered village evidence';
  group.position.set(x,y,z);group.rotation.y=yaw;parent.add(group);
  const b = new ModelBatch(group), w = metal ? .265 : .45, h = metal ? .182 : .304;
  b.box(metal ? p.rust : p.darkWood,0,0,0,w+.038,h+.031,.039,{rz:-.048});
  if (metal) {
    b.box(p.iron,0,0,.024,w,h,.017,{rz:-.048});
  } else {
    b.panel(p.paper,[[-w*.51,-h*.47,.027],[w*.20,-h*.51,.029],[w*.50,-h*.36,.029],[w*.48,h*.50,.028],[-w*.48,h*.46,.028]],
      [[.04,.04],[.71,.02],[.97,.12],[.98,.96],[.04,.94]], [0,1,2,0,2,3,0,3,4]);
    b.box(p.tractorRed,-w*.36,h*.30,.032,.044,.065,.011,{rz:-.04});
  }
  lettering(b,metal?p.paper:p.black,text,0,h*.10,.036,metal?.055:.073,w-.075);
  for(let i=0;i<3;i++)b.box(p.black,-w*.07,-h*(.15+i*.096),.032,w*(.64-.07*i),.004,.004,{rz:-.014});
  for (const side of [-1,1]) b.cylinder(p.rust,side*w*.42,h*.36,.033,.013,.013,.016,{rx:Math.PI/2,sides:6});
  b.finish(group.name);
  const [xx,zz] = site ? worldPoint(site,x+.057*Math.sin(yaw),z+.057*Math.cos(yaw)) : [x+.057*Math.sin(yaw),z+.057*Math.cos(yaw)];
  const at = new Vector3(xx,y,zz);
  const chapter = MISSIONS.find(m=>m.id===id);
  return {id,kind:'evidence',name:chapter.item,range:2.45,at,label:metal?'पीतल का टैग देखो':id==='school-register'?'रजिस्टर पढ़ो':'नोटिस पढ़ो',
    use({cue}){cue(metal?'latch':'paper',at,.75);return null;}};
}

export function addFieldNotes(scene,p,buildings,actions,chapter=false) {
  if(!chapter){
    actions.push(notice(scene,p,'gate-notice',[-4.22,1.04,-6.517],.075,'गुमशुदा'));
    const school=buildings.find(b=>b.site.id==='school');
    actions.push(notice(school.interior,p,'school-register',[-2.22,1.31,school.site.d*.5-.178],Math.PI,'हाज़िरी',{site:school.site}));
  }
  actions.push(notice(scene,p,'well-tags',[WELL.x+.83,1.23,WELL.z-.07],.03,chapter?'सुनो':'2:43',{metal:true}));
}
