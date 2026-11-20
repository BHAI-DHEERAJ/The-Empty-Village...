import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Points, ShaderMaterial, Vector3 } from 'three';
import { seededRandom } from '../world/random.js';
import { ESCAPE, IMPACT_TREE } from './CretaFinale.js';
import { branchPose } from './FinaleHazards.js';

export function createImpactDust(scene,{compact=false}={}) {
  const total=compact?33:54, random=seededRandom(3936);
  const motes=Array.from({length:total},()=>({dx:(random()-.38)*3.7,dz:(random()-.54)*3.2,dy:.55+random()*1.98,wait:random()*.22,scale:5.4+random()*19}));
  const geometry=new BufferGeometry(), p=new Float32Array(total*3), size=new Float32Array(total);
  geometry.setAttribute('position',new BufferAttribute(p,3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('aSize',new BufferAttribute(size,1).setUsage(DynamicDrawUsage));
  const uniforms={opacity:{value:0},sawdust:{value:new Color(0xd99d62)}};
  const material=new ShaderMaterial({transparent:true,depthWrite:false,uniforms,
    vertexShader:`attribute float aSize;
      void main(){ vec4 v=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*v;
        gl_PointSize=clamp(aSize*4.7/-v.z,1.,32.); }`,
    fragmentShader:`uniform vec3 sawdust; uniform float opacity;
      void main(){ float r=length(gl_PointCoord*2.-1.); float alpha=(1.-smoothstep(.12,1.,r))*opacity;
        if(alpha<.007)discard; gl_FragColor=vec4(sawdust,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const points=new Points(geometry,material);points.visible=false;points.frustumCulled=false;points.name='Forest strikes · bark and dust';scene.add(points);
  const branch=new Vector3(),dir=new Vector3(),tree=new Vector3(IMPACT_TREE.x+.29,.52,IMPACT_TREE.z-.26);
  branchPose(new Vector3(),branch,dir);
  return {
    hide(){points.visible=false;},
    update(time,reduced){
      const scrape=time>=ESCAPE.brush, age=time-(scrape?ESCAPE.brush:ESCAPE.impact),limit=scrape?1.02:2.12;
      points.visible=!reduced&&age>=0&&age<limit;
      if(!points.visible)return;
      const origin=scrape?branch:tree;
      uniforms.sawdust.value.setHex(scrape?0xe5bb7f:0xd99d62);
      uniforms.opacity.value=(scrape?.56:.41)*Math.min(1,age*24)*(1-age/limit)**1.5;
      for(let i=0;i<total;i++){
        const m=motes[i],u=Math.max(0,age-m.wait*(scrape?.33:1)),v=(1-Math.exp(-2.4*u))*.62;
        const travel=scrape?u*5.2:0;
        p[i*3]=origin.x+m.dx*v+dir.x*travel;p[i*3+1]=origin.y+Math.max(-.37,m.dy*u-(scrape?2.2:.91)*u*u);
        p[i*3+2]=origin.z+m.dz*v+dir.z*travel;
        size[i]=m.scale*(scrape?.36+u*.41:.73+u*.93);
      }
      geometry.attributes.position.needsUpdate=geometry.attributes.aSize.needsUpdate=true;
    },
  };
}
