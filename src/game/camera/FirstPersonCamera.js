import { MathUtils, SpotLight, Vector3 } from 'three';
import { CAMERA, PLAYER } from '../settings.js';

export class FirstPersonCamera {
  constructor(view,{compact=false,reducedMotion=false}={}) {
    this.view=view;
    this.yaw=this.targetYaw=0;
    this.pitch=this.targetPitch=CAMERA.initialPitch;
    this.eye=0;
    this.phase=0;
    this.bobWeight=0;
    this.seatOffset=new Vector3();this.seatDelta=new Vector3();
    this.reducedMotion=reducedMotion;
    this.sensitivity=1;
    this.enabled=true;
    this.power=76;
    view.rotation.order='YXZ';
    this.torch=new SpotLight(0xffe8c8,this.power,52,.505,.89,1.33);
    this.torch.name='Camera-mounted flashlight';
    this.torch.position.set(.046,-.095,-.10);
    this.torch.target.position.set(0,-.015,-12);
    this.torch.castShadow=true;
    this.compact=compact;
    this.torch.shadow.mapSize.setScalar(compact ? 384 : 768);
    this.torch.shadow.camera.near=.21;
    this.torch.shadow.camera.far=46;
    this.torch.shadow.normalBias=.027;
    this.torch.shadow.bias=-.00011;
    this.torch.shadow.autoUpdate=false;
    this.torch.shadow.needsUpdate=true;
    view.add(this.torch,this.torch.target);
  }
  reset(position) { this.seatOffset.set(0,0,0);this.eye=position.y+CAMERA.eye;this.view.position.set(position.x,this.eye,position.z);this.view.rotation.set(this.pitch,this.yaw,0); }
  setSensitivity(value) { this.sensitivity=MathUtils.clamp(Number(value)||1,.25,2.5); }
  toggle() {
    this.enabled=!this.enabled;
    this.torch.intensity=this.enabled?this.power:0;
    this.torch.shadow.needsUpdate=this.enabled;
    return this.enabled;
  }
  look(dx,dy) {
    if(dx||dy)this.targetYaw-=dx*CAMERA.sensitivity*this.sensitivity;
    this.targetPitch=MathUtils.clamp(this.targetPitch-dy*CAMERA.sensitivity*this.sensitivity,CAMERA.minPitch,CAMERA.maxPitch);
    if(Math.abs(this.targetYaw)>Math.PI*3&&Math.abs(this.targetYaw-this.yaw)<Math.PI){
      const turns=Math.trunc(this.targetYaw/(2*Math.PI))*Math.PI*2;
      this.targetYaw-=turns;this.yaw-=turns;
    }
  }
  update(dt, player, time, seat = null, propsMoved = false) {
    this.yaw=MathUtils.damp(this.yaw,this.targetYaw,27,dt);
    this.pitch=MathUtils.damp(this.pitch,this.targetPitch,26,dt);
    const speed=Math.hypot(player.velocity.x,player.velocity.z);
    const motion=(!this.reducedMotion&&player.grounded)?Math.min(1,speed/PLAYER.speed):0;
    this.bobWeight=MathUtils.damp(this.bobWeight,motion,12,dt);
    this.phase+=dt*speed*2.62;
    this.eye=MathUtils.damp(this.eye,player.position.y+CAMERA.eye,player.grounded?20:25,dt);
    const sway=Math.cos(this.phase*.5)*.014*this.bobWeight;
    const bob=Math.sin(this.phase)*.023*this.bobWeight;
    const {x,y,z}=player.position;
    if(seat)this.seatDelta.set(seat.x-x,seat.y-y-CAMERA.eye,seat.z-z);
    else this.seatDelta.set(0,0,0);
    this.seatOffset.lerp(this.seatDelta,1-Math.exp(-dt*(this.reducedMotion?75:18)));
    const offset=this.seatOffset;
    this.view.position.set(x+offset.x+sway*Math.cos(this.yaw),this.eye+offset.y+bob,z+offset.z-sway*Math.sin(this.yaw));
    this.view.rotation.set(this.pitch+Math.sin(this.phase)*.0038*this.bobWeight,this.yaw,Math.cos(this.phase*.5)*.004*this.bobWeight);
    const fov=MathUtils.damp(this.view.fov,!this.reducedMotion&&player.sprinting?CAMERA.sprintFov:CAMERA.fov,8,dt);
    if(Math.abs(fov-this.view.fov)>.015){this.view.fov=fov;this.view.updateProjectionMatrix();}
    const p=this.view.position;
    const moved=this.lastShadow==null||Math.abs(this.lastYaw-this.yaw)+Math.abs(this.lastPitch-this.pitch)>.028||Math.hypot(p.x-this.lastX,p.y-this.lastY,p.z-this.lastZ)>.094;
    this.propsShadowDirty ||= propsMoved;
    if(this.enabled&&(moved||this.propsShadowDirty)&&(this.lastShadow==null||time-this.lastShadow>(this.compact?.125:.050))){
      this.torch.shadow.needsUpdate=true;this.lastShadow=time;this.propsShadowDirty=false;
      this.lastX=p.x;this.lastY=p.y;this.lastZ=p.z;this.lastYaw=this.yaw;this.lastPitch=this.pitch;
    }
  }
  get heading(){return MathUtils.euclideanModulo(-MathUtils.radToDeg(this.yaw),360);}
}
