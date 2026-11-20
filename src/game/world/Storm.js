import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, MathUtils, Vector3 } from 'three';
import { between, seededRandom } from './random.js';

// A storm cell has a buildup, rain, spaced flashes and delayed thunder. The
// schedule advances on active play time, not while the phone/menu is open.
export class Storm {
  constructor({random=Math.random,onThunder=()=>{},reducedMotion=false}={}){
    this.random=random;this.onThunder=onThunder;this.reducedMotion=reducedMotion;
    this.time=0;this.next=between(random,10,18);this.cell=null;
    this.state={rain:0,flash:0};this.point=new Vector3();
  }
  update(dt,eye,indoors=false){
    if(dt<=0)return this.state;
    this.time+=dt;
    if(!this.cell&&this.time>=this.next){
      const start=this.time,duration=between(this.random,21,33);
      this.cell={start,duration,bolts:[{age:3.6,delay:1.34},{age:duration*.62,delay:2.13}]};
    }
    const {state,cell}=this;
    state.rain=state.flash=0;
    if(!cell)return state;
    const age=this.time-cell.start;
    if(age>=cell.duration){this.cell=null;this.next=this.time+between(this.random,32,70);return state;}
    state.rain=MathUtils.smoothstep(age,0,5.4)*(1-MathUtils.smoothstep(age,cell.duration-5,cell.duration))*.84;
    for(const bolt of cell.bolts){
      const since=age-bolt.age;
      if(!this.reducedMotion&&since>=0&&since<.51){
        // Single rolling glow, no high-frequency pulse or full-screen white.
        state.flash=Math.max(state.flash,MathUtils.smoothstep(since,0,.12)*(1-MathUtils.smoothstep(since,.13,.51))*.66);
      }
      if(!bolt.heard&&since>=bolt.delay){
        bolt.heard=true;this.point.copy(eye);this.point.x-=10;this.point.y+=4.2;this.point.z-=7;
        this.onThunder(this.point,indoors?.51:1.10);
      }
    }
    return state;
  }
}

export function addRain(scene,{compact=false,reducedMotion=false}={}){
  const random=seededRandom(211809),amount=compact?112:245;
  const seeds=Array.from({length:amount},()=>[between(random,-9,9),between(random,-10,10),random(),between(random,.12,.42),between(random,7.5,11.8)]);
  const data=new BufferAttribute(new Float32Array(amount*6),3),shape=new BufferGeometry();shape.setAttribute('position',data);
  const paint=new LineBasicMaterial({name:'Windblown rain',color:0xb5c8dc,transparent:true,opacity:0,depthWrite:false});
  const rain=new LineSegments(shape,paint);rain.name='बारिश की बूँदें';rain.frustumCulled=false;rain.visible=false;scene.add(rain);
  return (time,view,strength,indoors)=>{
    rain.visible=strength>.06&&!indoors&&!reducedMotion;
    if(!rain.visible)return;
    paint.opacity=strength*.37;
    rain.position.set(Math.round(view.position.x/2)*2,view.position.y-1.35,Math.round(view.position.z/2)*2);
    for(let i=0;i<amount;i++){
      const [x,z,phase,length,speed]=seeds[i],y=5.35*(1-((phase+time*speed/5.35)%1));
      const drift=y*.16;
      data.setXYZ(i*2,x+drift,y,z-y*.105);
      data.setXYZ(i*2+1,x+drift+length*.16,y+length,z-y*.105-length*.105);
    }
    data.needsUpdate=true;
  };
}
