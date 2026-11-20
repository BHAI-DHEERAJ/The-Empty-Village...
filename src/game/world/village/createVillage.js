import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { districtAt, SITES, worldPoint } from '../sceneryLayout.js';
import { addAtmosphere } from './atmosphere.js';
import { buildArchitecture, makeDistantShell } from './architecture.js';
import { containsPlan, housePlan } from './buildingPlans.js';
import { furnishInterior } from './interiors.js';
import { addFieldNotes } from './fieldNotes.js';
import { consolidateStatic, ModelBatch } from './modeling.js';
import { buildOutdoors } from './outdoors.js';
import { villagePalette } from './palette.js';
import { furnishInvestigation } from '../../story/InvestigationProps.js';
import { buildChapterExterior } from '../../story/ChapterScenery.js';

function lightInRoom(building,p,lights){
  const {site,interior,plan}=building;
  const where=plan.rooms.find(r=>['office','shrine','shop','dining','living'].includes(r.type));
  if(!where||!(site.plan==='hospital'||site.plan==='mansion'||site.plan==='school'||site.plan==='shops'||site.id==='centre-01'||site.id==='old-04'))return;
  const x=(where.x0+where.x1)*.5,z=where.z1-(where.z1-where.z0)*.25,y=where.base+site.eave-.24;
  const b=new ModelBatch(interior);
  b.beam(p.darkWood,[where.x0-.10,y+.191,z],[where.x1+.10,y+.191,z],.058,5);
  b.cylinder(p.iron,x,y+.094,z,.031,.031,.18,{sides:7});
  b.cylinder(p.rust,x,y,z,.047,.20,.092,{sides:10});
  b.finish('Shaded interior fixture');
  const glow=new Mesh(new BoxGeometry(.116,.035,.116),p.bulb);glow.name='Dim bulb';glow.position.set(x,y-.059,z);interior.add(glow);
  const [u,v]=worldPoint(site,x,z);
  lights.push({glow,point:new Vector3(u,y-.22,v),strength:site.plan==='mansion'?11.5:7.8,phase:site.id.length*3.8,site:site.id});
}

export function createVillage(scene,textures,collision,options={}){
  const p=villagePalette(textures), {lights,actions,vehicles,updateVehicles}=buildOutdoors(scene,p,collision,options);
  const log=options.chapter;
  const story=log?buildChapterExterior(scene,p,collision,actions,lights,log):null;
  const buildings=SITES.map(site=>{
    const shape=buildArchitecture(scene,housePlan(site),p,collision);
    Object.assign(shape,furnishInterior(shape,p,collision));
    const exhibits=story?furnishInvestigation(shape,p,collision,story):[];
    lightInRoom(shape,p,lights);
    const moving=new Set(shape.movers.map(m=>m.object));
    consolidateStatic(shape.trim,moving);
    consolidateStatic(shape.interior,new Set([...moving,...exhibits,...lights.filter(n=>n.site===site.id).map(n=>n.glow)]));
    consolidateStatic(shape.group,new Set([...moving,shape.interior,shape.trim]));
    const shell=new Group();shell.name='Full-detail shell';
    for(const child of shape.group.children.slice())if(child!==shape.interior)shell.add(child);
    const far=makeDistantShell(shape.plan,p,shape.actions);
    shape.group.add(shell,far);
    return {...shape,shell,far};
  });
  for(const building of buildings)actions.push(...building.actions);
  addFieldNotes(scene,p,buildings,actions,!!story);
  const atmosphere=addAtmosphere(scene,buildings,textures,p,lights,options);
  const roomAt=(position)=>buildings.find(({plan})=>containsPlan(plan,position.x,position.y,position.z))??null;
  return {
    buildings,actions,vehicles,updateVehicles,roomAt,story,
    locationAt(position,room=roomAt(position)){return room?.site.name??districtAt(position.x,position.z);},
    update(time,camera,current,torch,daylight,blackout){
      const {x,z}=camera.position;
      for(const building of buildings){
        const {site,interior,group,trim,shell,far}=building;
        const r2=(site.x-x)**2+(site.z-z)**2;
        const nearby=building===current||r2<(options.compact?25:39)**2;
        group.visible=building===current||r2<(current?(options.compact?41:59):(options.compact?72:97))**2;
        shell.visible=nearby;far.visible=!nearby;
        trim.visible=building===current||r2<(options.compact?22:34)**2;
        const roomRange=Math.max(site.d,site.w)*.54+(options.compact?5.1:7.7);
        interior.visible=building===current||!current&&r2<roomRange**2;
      }
      atmosphere(time,camera,current,torch,daylight,blackout);
    },
  };
}
