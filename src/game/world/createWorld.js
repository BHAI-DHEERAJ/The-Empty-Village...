import { AmbientLight, Color, DirectionalLight, FogExp2, HemisphereLight, MathUtils } from 'three';
import { WORLD } from '../settings.js';
import { createForest } from './forest.js';
import { createGrassField } from './grass.js';
import { CollisionWorld } from './physics/CollisionWorld.js';
import { groundHeight, localPoint } from './sceneryLayout.js';
import { fogClock } from './shaders.js';
import { createSky, moonDirection, sunDirection } from './sky.js';
import { addRain } from './Storm.js';
import { createTerrain } from './terrain.js';
import { createVillage } from './village/createVillage.js';

export function createWorld(scene,textures,{compact=false,reducedMotion=false,chapter=null}={}){
  scene.background=new Color(WORLD.fogColor);
  scene.fog=new FogExp2(WORLD.fogColor,WORLD.fogDensity);
  const moon=new DirectionalLight(0x9bb5ed,.71);
  moon.name='Cool moonlight';moon.castShadow=!compact;
  moon.shadow.mapSize.setScalar(compact?640:1536);
  Object.assign(moon.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:.9,far:100});
  moon.shadow.camera.updateProjectionMatrix();moon.shadow.normalBias=.034;moon.shadow.bias=-.00014;
  moon.shadow.autoUpdate=false;moon.shadow.needsUpdate=true;
  const skyFill=new HemisphereLight(0xb1c2dc,0x666053,.93);
  skyFill.name='Low night sky fill';
  const ambient=new AmbientLight(0x8b97af,.168);
  scene.add(moon,moon.target,skyFill,ambient);
  const collision=new CollisionWorld(groundHeight);
  createTerrain(scene,textures);
  const sky=createSky(scene,textures);
  const rain=addRain(scene,{compact,reducedMotion});
  const forest=createForest(scene,textures,collision,{compact});
  const grass=createGrassField(scene,textures,{compact});
  const village=createVillage(scene,textures,collision,{compact,reducedMotion,chapter});
  const nightFog=new Color(WORLD.fogColor),dayFog=new Color(0xd7c7af),nightLight=new Color(0x9bb5ed),dayLight=new Color(0xffe1af);
  const nightFill=new Color(0xb1c2dc),dayFill=new Color(0xe1e8f3);
  let lastX=Infinity,lastZ=Infinity,lastTime=0,lastDay=-1,interiorBlend=0;
  let lastPropShadow=-Infinity, propShadowDirty=false;
  return {
    story:village.story,collision,buildings:village.buildings,actions:village.actions,vehicles:village.vehicles,roomAt:village.roomAt,locationAt:village.locationAt,
    update(time,view,player,torch=true,propsMoved=false,atmosphere={}){
      const position=player.position, current=village.roomAt(position);
      const delta=Math.max(0,Math.min(.22,time-lastTime));lastTime=time;
      let target=0;
      if(current){
        const {site,plan}=current,[x,z]=localPoint(site,position.x,position.z);
        const c=plan.court;
        if(!c||x<c.x0||x>c.x1||z<c.z0||z>c.z1)
          target=position.y<-.20?1:Math.min(1,Math.max(0,(site.d*.5-z)*.78));
      }
      interiorBlend=MathUtils.damp(interiorBlend,target,5.5,delta);
      const daylight=atmosphere.daylight??0,weather=atmosphere.weather,rainfall=weather?.rain??0;
      const flash=reducedMotion||atmosphere.quiet?0:weather?.flash??0;
      skyFill.intensity=1.09-interiorBlend*.55+daylight*.48*(1-interiorBlend*.62)+flash*.70*(1-interiorBlend*.77);
      ambient.intensity=.227-interiorBlend*.092+daylight*.185;
      moon.intensity=(compact ? .66-interiorBlend*.50 : .74)+daylight*1.45*(1-interiorBlend*.90)+flash*.54*(1-interiorBlend*.67);
      moon.color.copy(nightLight).lerp(dayLight,daylight);skyFill.color.copy(nightFill).lerp(dayFill,daylight);
      scene.fog.color.copy(nightFog).lerp(dayFog,daylight);scene.background.copy(scene.fog.color);
      fogClock.value=reducedMotion?0:time;
      sky.update(reducedMotion?0:time,view,flash,daylight,rainfall);
      rain(time,view,rainfall,!!current);
      forest.update(view,reducedMotion?0:time);grass.update(time,view);
      village.updateVehicles(delta,view);
      const behind=view.position.z>-.4 && view.quaternion.y**2+view.quaternion.z**2>.78;
      const density=atmosphere.fog ?? MathUtils.lerp(WORLD.fogDensity+rainfall*.009+(behind&&chapter?.opening==='play' ? .006 : 0),.0085,daylight);
      scene.fog.density=atmosphere.cinematic&&atmosphere.fog!=null?density:MathUtils.damp(scene.fog.density,density,4.9,delta);
      village.update(time,view,current,torch,daylight,atmosphere.blackout??0);
      // Stable shadow box; no subpixel re-render while standing still or looking around.
      const shadow=atmosphere.cinematic?view.position:position;
      const x=Math.round(shadow.x/2.5)*2.5,z=Math.round(shadow.z/2.5)*2.5;
      if(lastX!==x||lastZ!==z||Math.abs(lastDay-daylight)>.09){
        lastX=x;lastZ=z;lastDay=daylight;moon.target.position.set(x,0,z);
        moon.position.copy(moonDirection).lerp(sunDirection,daylight).normalize().multiplyScalar(42).add(moon.target.position);
        moon.shadow.needsUpdate=true;
      }
      propShadowDirty ||= propsMoved;
      if(!compact&&propShadowDirty&&time-lastPropShadow>.11){
        moon.shadow.needsUpdate=true;lastPropShadow=time;propShadowDirty=false;
      }
      return current;
    },
    dispose(){grass.dispose();},
  };
}
