import { Group, MathUtils, Vector3 } from 'three';
import { createWatcherModel } from '../watcher/WatcherModel.js';
import { ModelBatch } from '../world/village/modeling.js';
import { villagePalette } from '../world/village/palette.js';
import { ESCAPE, escapeMotion, escapeRoad } from './CretaFinale.js';

const {smoothstep}=MathUtils;
export const BRANCH_REACH=2.38;
export function branchPose(base,tip,direction) {
  const distance=escapeMotion(ESCAPE.brush).distance;
  escapeRoad(distance,base,direction);
  tip.copy(base).addScaledVector(direction,2.16);
  tip.x-=direction.z*.786;tip.z+=direction.x*.786;tip.y=.866;
  base.copy(tip);base.x-=direction.z*BRANCH_REACH;base.z+=direction.x*BRANCH_REACH;base.y=0;
  return Math.atan2(-direction.x,-direction.z);
}

export function createFinaleHazards(scene,textures) {
  const branch=new Group();branch.name='Escape · branch at the forest bend';scene.add(branch);
  const p=villagePalette(textures),limb=new ModelBatch(branch);
  const base=new Vector3(),tip=new Vector3(),direction=new Vector3();
  const yaw=branchPose(base,tip,direction);
  branch.position.copy(base);
  branch.visible=false;
  const points=[[.37,.075,.19],[-.22,.30,.11],[-1.23,.62,-.091],[-1.91,.73,-.153],[-BRANCH_REACH,.866,0]];
  for(let i=1;i<points.length;i++)limb.beam(p.bark,points[i-1],points[i],.119-i*.019,7);
  for(let i=0;i<3;i++){
    const a=points[i+1];
    for(const s of [-1,1]){
      const b=[a[0]-.38-i*.036,a[1]+.18+i*.052,a[2]+s*.39];
      limb.beam(p.bark,a,b,.029-i*.005,5);
      limb.panel(p.leaf,[[-.19,0,0],[.19,0,0],[.15,.34,0],[-.18,.37,0]],[[0,0],[1,0],[1,1],[0,1]],
        [0,1,2,0,2,3],{offset:b,ry:s*1.04+i*.27,rz:s*.41});
    }
  }
  limb.finish('Low timber cracking away from the bonnet');
  const shade=createWatcherModel({...textures,watcherCloth:textures.hauntCloth},{compact:true,tints:[0x68737e,0x979586,0xb3b1b3]});
  shade.group.name='Escape · a shadow in the headlights';shade.group.scale.setScalar(.70);scene.add(shade.group);
  const step=new Vector3(),tangent=new Vector3();
  const at=escapeMotion(ESCAPE.scare).distance+5.60;
  return {
    branch,shade,
    hide(){branch.visible=shade.group.visible=false;},
    update(t,car,{scares=true,reduced=false}={}){
      branch.visible=t>=ESCAPE.brushShot-.60&&t<ESCAPE.shadows+1;
      if(branch.visible){
        const elapsed=t-ESCAPE.brush,flex=smoothstep(elapsed,0,.71);
        const shake=elapsed>0&&elapsed<.85?Math.sin(elapsed*20)*Math.exp(-elapsed*5):0;
        branch.rotation.set(0,yaw-flex*1.19+(reduced?0:shake*.23),-flex*.49,'YXZ');
        branch.position.copy(base).addScaledVector(direction,flex*.46);
      }
      const emerge=smoothstep(t,ESCAPE.scare-.77,ESCAPE.scare-.26),fade=1-smoothstep(t,ESCAPE.scare+.06,ESCAPE.scare+.54);
      const glint=smoothstep(t,ESCAPE.shadows-.48,ESCAPE.shadows+.24)*(1-smoothstep(t,ESCAPE.shadows+.85,ESCAPE.dawn-.30));
      const crossing=emerge*fade;
      shade.group.visible=scares&&(crossing>.035||glint>.055);
      if(!shade.group.visible)return;
      if(crossing>.035){
        escapeRoad(at+t-ESCAPE.scare,step,tangent);
        const flank=MathUtils.lerp(4.9,.96,smoothstep(t,ESCAPE.scare-.72,ESCAPE.scare+.28));
        step.x-=tangent.z*flank;step.z+=tangent.x*flank;
      }else{
        escapeRoad(escapeMotion(t).distance-9.8,step,tangent);
        step.x-=tangent.z*3.1;step.z+=tangent.x*3.1;
      }
      shade.group.position.copy(step);
      shade.group.rotation.y=Math.atan2(car.position.x-step.x,car.position.z-step.z);
      shade.veil(Math.max(crossing,glint*.82));shade.eyes(reduced?.47:1.13);
      shade.run(t*1.77,reduced?.35:.82,crossing*.31);
    },
  };
}
