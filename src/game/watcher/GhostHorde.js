import { Color, DynamicDrawUsage, Frustum, Group, InstancedBufferAttribute, InstancedMesh, MathUtils, Matrix4, MeshBasicMaterial, Object3D, PointLight, Sphere, Vector3 } from 'three';
import { imageMaterial } from '../world/materials.js';
import { seededRandom } from '../world/random.js';
import { groundHeight } from '../world/sceneryLayout.js';
import { nightMaterial } from '../world/shaders.js';
import { ESCAPE, escapeRoad, MERGE_DISTANCE } from '../story/CretaFinale.js';
import { GHOST_COUNT, GHOST_REGIMENTS, hordeGeometry } from './HordeGeometry.js';

const {smoothstep}=MathUtils;
const TAU=Math.PI*2, COLS=30, STEP=.61;
const CHASE_LIMIT=MERGE_DISTANCE-52;
const road=[];
{
  const p=new Vector3(),v=new Vector3();
  // Ghosts never sample the motorway, including their look-ahead for turns.
  for(let d=0;d<CHASE_LIMIT+27;d+=STEP){escapeRoad(d,p,v);road.push([p.x,p.z,v.x,v.z]);}
}

export function ghostRanks(seed) {
  const random=seededRandom(seed),styles=GHOST_REGIMENTS.flatMap((style,i)=>Array(style.count).fill(i));
  for(let i=styles.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[styles[i],styles[j]]=[styles[j],styles[i]];}
  return styles.map((style,i)=>({
    style, rank:Math.floor(i/COLS),column:i%COLS-(COLS-1)*.5+(random()-.5)*.68,
    stride:random()*TAU, stagger:(random()-.5)*1.06, size:.81+random()*.34,
    tone:.63+random()*.37, cadence:.89+random()*.24,
  }));
}

export function ghostEnvelope(t,distance) {
  const forming=smoothstep(t,.28,2.4), closing=smoothstep(t,ESCAPE.skid,ESCAPE.impact+2.35);
  const leftBehind=smoothstep(t,ESCAPE.breakaway+.75,ESCAPE.dawn);
  const visibility=forming*(1-smoothstep(t,ESCAPE.dawn-1.50,ESCAPE.dawn));
  const opening=15.6*(1-smoothstep(t,.25,ESCAPE.roll));
  return {front:Math.min(CHASE_LIMIT,distance-6.29-opening+closing*4.31-leftBehind*28),closing,leftBehind,visibility};
}

// Cache the road frame; calculating 1,200 spline derivatives every render
// isn't necessary. Negative distance follows the main village lane north.
function sample(distance,lateral,out){
  if(distance<0){out.set(.72+Math.max(-.49,distance*.027)-lateral,0,13.12+distance);return out;}
  const u=distance/STEP, i=Math.min(road.length-2,Math.floor(u)),a=road[i],b=road[i+1],s=Math.min(1,u-i);
  const x=a[0]+(b[0]-a[0])*s,z=a[1]+(b[1]-a[1])*s;
  const fx=a[2]+(b[2]-a[2])*s,fz=a[3]+(b[3]-a[3])*s;
  return out.set(x-fz*lateral,0,z+fx*lateral);
}

function paint(material, uniforms){
  return nightMaterial(material,'horde-gait',shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=`uniform float uHordeTime,uHordeStride; attribute vec2 aGhostBeat,aStride;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        float stride = uHordeTime * (12.4 * aGhostBeat.y) + aGhostBeat.x;
        transformed.z += aStride.x * sin(stride) * uHordeStride;
        transformed.y += aStride.y * max(0., cos(stride) * sign(aStride.x)) * uHordeStride;`);
    shader.fragmentShader=`uniform float uHordeFade;\n${shader.fragmentShader}`.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
      if(uHordeFade < .998 && fract(52.9829 * fract(dot(gl_FragCoord.xy, vec2(.06711,.00584)))) > uHordeFade) discard;`);
  });
}

export function createGhostHorde(scene,textures,{seed=1,compact=false,leader=null}={}) {
  const group=new Group();group.name=`Escape · ${GHOST_COUNT} apparitions`;group.visible=false;scene.add(group);
  const fill=new PointLight(0xc8daff,0,37,1.65);fill.name='Escape · cold chase light';group.add(fill);
  const uniforms={uHordeTime:{value:0},uHordeStride:{value:0},uHordeFade:{value:0}};
  const agents=ghostRanks(seed^0x10cd35), pose=new Object3D(), point=new Vector3(), tint=new Color();
  const clip=new Frustum(), projection=new Matrix4(), bounds=new Sphere();
  const regiments=GHOST_REGIMENTS.map(style=>{
    function bucket(near){
      // Distant ranks keep their real geometry and the same gait, but only
      // need their albedo under the fog, not every village light and PBR map.
      const distant=(surface,color)=>new MeshBasicMaterial({map:textures[surface].albedo,color:new Color(color).multiplyScalar(.42)});
      const materials=near?{
        body:imageMaterial(textures[style.cloth],{color:style.color,emissive:style.light,emissiveIntensity:style.id==='veil'?.30:.22}),
        face:imageMaterial(textures[style.face],{color:style.skin,emissive:0xbaa58e,emissiveIntensity:style.id==='veil'?.08:.14}),
        eyes:new MeshBasicMaterial({color:style.eyes}),
      }:{body:distant(style.cloth,style.color),face:distant(style.face,style.skin)};
      const meshes=Object.entries(hordeGeometry(style.id,near)).map(([part,geometry])=>{
        const mat=materials[part];
        const phases=new InstancedBufferAttribute(new Float32Array(style.count*2),2).setUsage(DynamicDrawUsage);
        geometry.setAttribute('aGhostBeat',phases);
        const mesh=new InstancedMesh(geometry,paint(mat,uniforms),style.count);
        mesh.name=`${style.name} · ${near?'near':'ranks'} ${part}`;mesh.count=0;
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);mesh.frustumCulled=false;
        // Allocate the colour buffer once, not in the first pursuit frame.
        mesh.instanceColor=new InstancedBufferAttribute(new Float32Array(style.count*3),3).setUsage(DynamicDrawUsage);
        group.add(mesh);return {mesh,phases};
      });
      return {used:0,meshes};
    }
    return {style,near:bucket(true),far:bucket(false)};
  });
  let last=-Infinity,lastAspect;
  const api={group,regiments,count:agents.length,activeCount:0,visibleCount:0,
    hide(){group.visible=false;leader?.hide();last=-Infinity;api.activeCount=api.visibleCount=0;},
    update(time,view,car,motion,reducedMotion=false){
      const {front,closing,leftBehind,visibility}=ghostEnvelope(time,motion.distance);
      if(visibility<.02){if(group.visible)api.hide();return;}
      group.visible=true;api.activeCount=agents.length;uniforms.uHordeTime.value=time;
      uniforms.uHordeStride.value=(reducedMotion?.50:1)*(.61+motion.speed*.32+closing*.22);
      uniforms.uHordeFade.value=visibility;
      const shadowCamera=motion.shot==='cockpit'||motion.shot==='restart';
      fill.position.copy(view.position).add(point.set(1.48,1.64,-.98));
      fill.intensity=(shadowCamera?0:motion.shot==='surround'?34:42)*visibility;
      if(time===last&&lastAspect===view.aspect)return;
      last=time;lastAspect=view.aspect;
      // The whole formation moves on the timeline, but send only instances
      // near the camera frustum to the GPU (especially in the cockpit cuts).
      clip.setFromProjectionMatrix(projection.multiplyMatrices(view.projectionMatrix,view.matrixWorldInverse));
      const cx=view.position.x,cz=view.position.z,target=car.position;
      const nearSq=(compact?10.8:16)**2,width=.79+closing*.27,rankStep=1.78-closing*.30;
      api.visibleCount=0;
      for(const r of regiments)r.near.used=r.far.used=0;
      for(const agent of agents){
        const {style,rank,column,stride,size,stagger,tone,cadence}=agent,beat=time*12.4*cadence+stride;
        let lateral=column*width+Math.sin(time*1.9+stride)*(.35+closing*.26);
        if(rank<6)lateral*=.72+rank*.064;
        const flank=closing*Math.max(0,1-rank/5)*Math.min(1,Math.abs(lateral)*.22);
        const distance=front-rank*rankStep+stagger+flank*5.6+Math.sin(time*1.04+stride)*.55-Math.abs(column)*.041;
        sample(distance,lateral+motion.offset*.65*closing,point);
        const dx=point.x-target.x,dz=point.z-target.z,r2=dx*dx+dz*dz;
        const safe=3.24+(style===3?.42:0);
        if(r2<safe*safe){const k=safe/Math.max(.00001,Math.sqrt(r2));point.x=target.x+dx*k;point.z=target.z+dz*k;}
        point.y=groundHeight(point.x,point.z);
        bounds.center.copy(point).y+=size;
        bounds.radius=style===4?2.56:1.68;
        if(!clip.intersectsSphere(bounds))continue;
        const eyeSq=(point.x-cx)**2+(point.z-cz)**2;
        const regiment=regiments[style],bucket=eyeSq<nearSq?regiment.near:regiment.far,index=bucket.used++;
        const bob=(style===1?.12+.083*Math.sin(beat*.46):.046*Math.abs(Math.sin(beat)))*(reducedMotion?.45:1);
        pose.position.copy(point).y+=bob;
        const lead=Math.min(18,9+rank*.24);
        // Face the next piece of road, then turn toward the stalled car on
        // the close flanks. Far ranks don't cross a bend diagonally.
        sample(distance+lead,lateral,point);
        const tx=MathUtils.lerp(point.x,target.x,flank*.66),tz=MathUtils.lerp(point.z,target.z,flank*.66);
        const lean=style===3?.04:style===1?.045:style===2?.23:.15;
        pose.rotation.set(lean*(1-leftBehind*.4),Math.atan2(tx-pose.position.x,tz-pose.position.z),Math.sin(beat)*(reducedMotion?.025:.067));
        pose.scale.set(size*(style===3?1.13:1),size,size);pose.updateMatrix();
        tint.setRGB(tone*.97,tone,tone*1.025);
        for(const {mesh,phases} of bucket.meshes){mesh.setMatrixAt(index,pose.matrix);mesh.setColorAt(index,tint);phases.setXY(index,stride,cadence);}
      }
      for(const r of regiments)for(const bucket of [r.near,r.far]){
        api.visibleCount+=bucket.used;
        for(const {mesh,phases} of bucket.meshes){
          mesh.count=bucket.used;mesh.instanceMatrix.needsUpdate=mesh.instanceColor.needsUpdate=phases.needsUpdate=true;
        }
      }
      if(leader){
        sample(front-7.1,-1.8+motion.offset*.55,point);
        leader.group.position.copy(point).y=groundHeight(point.x,point.z);
        leader.group.rotation.y=Math.atan2(target.x-point.x,target.z-point.z);
        leader.group.visible=true;leader.veil(visibility);leader.eyes(.88);
        leader.run(time*1.66,reducedMotion?.39:.76,closing*.24);
      }
    },
  };
  return api;
}
