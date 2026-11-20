import { MathUtils, Vector3 } from 'three';
import { createWatcherModel } from './WatcherModel.js';
import { hasWatcherClearance } from './WatcherPlaces.js';
import { WatcherSight } from './WatcherSight.js';
import { ModelBatch } from '../world/village/modeling.js';
import { imageMaterial } from '../world/materials.js';
import { nightMaterial } from '../world/shaders.js';
import { groundHeight, isBuildingFootprint } from '../world/sceneryLayout.js';

const HEIGHT_SCALE=2.5,SAFE_DISTANCE=4.9;
const {smoothstep}=MathUtils;

export function createStalkerModel(scene,textures,{compact=false}={}){
  const rig=createWatcherModel({...textures,watcherCloth:textures.hauntCloth},{compact,tints:[0x332f35,0x77665c,0xb6a7a1]});
  const {group,mesh}=rig;
  group.name='THE TALL STALKER · साढ़े सात मीटर ऊँचा';group.scale.set(1.68,HEIGHT_SCALE,1.71);scene.add(group);
  // The forked silhouette is bound to the skull, so it moves when the Stalker
  // cranes toward the player. It has the same UV-mapped bark as the forest.
  const skull=mesh.skeleton.bones.find(b=>b.name==='skull');
  const bark=nightMaterial(imageMaterial(textures.bark,{color:0x665d66,vertexColors:true,toneMapped:true}),'stalker-thorns');
  const b=new ModelBatch(skull);
  for(const s of [-1,1]){
    b.cord(bark,[[s*.087,.265,-.033],[s*.155,.370,-.084],[s*.244,.461,-.092],[s*.288,.572,-.067]],.026,{segments:8,sides:6});
    b.beam(bark,[s*.194,.410,-.087],[s*.319,.438,.044],.018,6);
    b.beam(bark,[s*.24,.469,-.086],[s*.221,.589,-.13],.015,6);
  }
  b.finish('Skull-bound crown of broken roots');
  const hide=()=>{group.visible=false;};
  // Dither the skinned skin and the rigid accessories together.
  const veil=n=>{rig.veil(n);for(const node of skull.children)if(node.isMesh)node.visible=n>.46;};
  return {...rig,hide,veil};
}

export class StalkerDirector {
  constructor({collision,occlusion,actor,log,cue=()=>{},voice=()=>{},reducedMotion=false,enabled=true}){
    Object.assign(this,{collision,actor,log,cue,voice,reducedMotion,enabled});
    this.sight=new WatcherSight(collision,occlusion);
    this.direction=new Vector3();this.probe=new Vector3();this.look=new Vector3();this.clock=0;
    this.nextAt=5.8;this.level=this.blackout=0;this.hint='';this.phase='idle';
    this.mark={pos:actor.group.position,scale:HEIGHT_SCALE,yaw:0};
    // Resume at the current story beat, not every old scare in a row.
    this.events=log.steps.slice(0,-1).map(step=>step.id);
    this.resetProgress();
  }
  resetProgress(){this.beat=this.log.finished?this.events.length:Math.max(0,this.events.findLastIndex(id=>this.log.has(id)));}
  setEnabled(enabled){this.enabled=enabled;}
  get active(){return this.phase!=='idle';}
  clear(){
    this.actor.hide();this.phase='idle';this.hint='';this.blackout=0;this.level=0;
  }
  #clearAt(pos){return !isBuildingFootprint(pos.x,pos.z,1.08)&&hasWatcherClearance(this.collision,pos,HEIGHT_SCALE);}
  #bearing(feet,pos){return Math.atan2(feet.x-pos.x,feet.z-pos.z);}
  #pick(view,feet){
    view.getWorldDirection(this.look);this.look.y=0;this.look.normalize();
    if(this.look.lengthSq()<.5)this.look.set(0,0,-1);
    const yaw=Math.atan2(this.look.x,this.look.z);
    // Check behind first, then a road shoulder and finally the far lane.
    for(const az of [Math.PI,2.44,-2.44,1.59,-1.59,.58,-.58,.05])for(const dist of [10.1,12.6,15.9,18.1]){
      const pos=this.probe.set(feet.x+Math.sin(yaw+az)*dist,0,feet.z+Math.cos(yaw+az)*dist);
      pos.y=groundHeight(pos.x,pos.z);
      if(!this.#clearAt(pos))continue;
      const mark={pos,scale:HEIGHT_SCALE,yaw:this.#bearing(feet,pos)};
      if(this.sight.hasLine(mark))return pos;
    }
    return null;
  }
  update(dt,{view,feet,room,seated,grounded}){
    this.clock+=dt;
    if(room||seated){if(this.active){this.nextAt=this.clock+6.1;this.clear();}return;}
    if(!grounded&&!this.active)return;
    this.sight.capture(view);
    if(!this.active){
      if(this.clock<this.nextAt||!this.log.has(this.events[this.beat]))return;
      const picked=this.#pick(view,feet);
      if(!picked){this.nextAt=this.clock+.7;return;}
      this.mark.pos.copy(picked);this.mark.yaw=this.#bearing(feet,picked);this.actor.group.rotation.y=this.mark.yaw;
      this.actor.hold(this.beat%2?1:-1,'standing');this.actor.eyes(.69);this.actor.veil(0);
      this.time=0;this.travel=0;this.phase='warning';
      this.hint=this.beat%2?'सड़क की बत्तियाँ एक साथ बुझ रही हैं…':'पीछे किसी ने तुम्हारा नाम लिया।';
      const at=picked.clone().setY(2.17);
      this.cue('stalker-footfall',at,1.18);this.voice(this.beat===0?'stalker-first':'stalker-road');
      return;
    }
    this.time+=dt;
    const strength=this.enabled&&!this.reducedMotion;
    const {pos}=this.mark,dist=Math.hypot(feet.x-pos.x,feet.z-pos.z);
    if(this.time>9.05||dist<SAFE_DISTANCE||dist>33){
      this.beat++;this.nextAt=this.clock+29;this.clear();return;
    }
    const yaw=this.#bearing(feet,pos);
    this.actor.group.rotation.y=this.mark.yaw+=Math.atan2(Math.sin(yaw-this.mark.yaw),Math.cos(yaw-this.mark.yaw))*(1-Math.exp(-4.3*dt));
    this.blackout=strength?smoothstep(this.time,.20,1.14)*(1-smoothstep(this.time,7.55,8.94))*.90:0;
    if(this.time<.70)return;
    this.actor.group.visible=true;
    this.actor.veil(smoothstep(this.time,.70,1.40)*(1-smoothstep(this.time,8,9.01)));
    const seen=this.sight.observe(this.mark).visible;
    if(seen&&this.phase==='warning'){
      this.phase='seen';this.noticedAt=this.time;this.hint='ऊपर देखो। वह घर से भी लंबा है।';
      this.cue('stalker-breath',pos.clone().setY(2.44),.90);
    }
    if(this.phase==='seen'){
      const age=this.time-this.noticedAt;
      const rush=strength&&age>1.07&&age<2.71&&dist>SAFE_DISTANCE+.25&&this.sight.hasLine(this.mark);
      if(rush){
        this.direction.copy(feet).sub(pos).setY(0).normalize();
        this.probe.copy(pos).addScaledVector(this.direction,Math.min(dist-SAFE_DISTANCE-.1,dt*4.39));
        this.probe.y=groundHeight(this.probe.x,this.probe.z);
        if(this.#clearAt(this.probe)){
          this.travel+=this.probe.distanceTo(pos);pos.copy(this.probe);
          this.actor.run(this.travel*.81,.77,smoothstep(age,2.18,2.65)*.49);
          if(this.clock>(this.nextFoot??0)){this.nextFoot=this.clock+.43;this.cue('stalker-footfall',pos,.99);}
        }
      }else{
        this.actor.hold(this.beat%2?1:-1,'standing');
        this.actor.tilt(this.reducedMotion?.12:.17+smoothstep(age,0,1.05)*.45);
        if(strength)this.actor.contort(this.time,.41*smoothstep(age,2.65,3.75));
      }
      this.level=strength?smoothstep(age,1,1.65)*(1-smoothstep(age,2.65,4.6))*.34:0;
      this.actor.eyes(.68+(strength?.86:0)*smoothstep(age,.53,2.33));
    }
  }
}
