import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { WORLD } from '../settings.js';
import { CANAL, MANSION, SQUARE, canalHeight, courtAt, localPoint, pathEdge } from './sceneryLayout.js';
import { nightMaterial } from './shaders.js';

const clamp=(v)=>Math.min(1,Math.max(0,v));
const smooth=(a,b,t)=>{const f=clamp((t-a)/(b-a));return f*f*(3-2*f);};

function blendAt(x,z){
  const edge=pathEdge(x,z), road=1-smooth(-.53,1.14,edge);
  const atField=smooth(48,54,x)*(1-smooth(142,152,x))*smooth(-33,-25,z)*(1-smooth(59,66,z));
  const crown=(1-smooth(-41,-27,x))*smooth(-78,-36,z)*(1-smooth(33,59,z));
  const bank=smooth(.03,.36,-canalHeight(x,z))*.80;
  const square=1-smooth(.76,1.17,Math.max(Math.abs(x-SQUARE.x)/(SQUARE.w*.5),Math.abs(z-SQUARE.z)/(SQUARE.d*.5)));
  const dirt=Math.max(atField*.93,bank,courtAt(x,z)*.62)*(1-road);
  const gravel=Math.min(.94,Math.max(square*.94,courtAt(x,z)*.40,Math.max(0,1-Math.abs(edge+.06)/1.07)*.32))*(1-bank*.54);
  return [road*(1-gravel),dirt*(1-gravel),gravel,crown*(1-gravel)*(1-road)*(1-dirt)];
}

// Clip the render surface against the actual rotated basement opening; a grid edge
// cannot span the stairwell or pierce an underground room.
const cutPlanes=[[0,1,MANSION.w*.5-.13],[0,-1,MANSION.w*.5-.13],[1,1,MANSION.d*.5-.13],[1,-1,MANSION.d*.5-.13]];
function split(poly,axis,sign,threshold){
  const a=[],b=[];
  let q=poly.at(-1),v=localPoint(MANSION,...q)[axis]*sign-threshold;
  for(const p of poly){
    const w=localPoint(MANSION,...p)[axis]*sign-threshold;
    if((v>0)!==(w>0)){
      const t=v/(v-w),k=[q[0]+t*(p[0]-q[0]),q[1]+t*(p[1]-q[1])];
      a.push(k);b.push(k);
    }
    (w>0?a:b).push(p);q=p;v=w;
  }
  return [a,b];
}
function outsideBasement(poly){
  const parts=[];
  for(const [axis,sign,threshold] of cutPlanes){
    const [outside,inside]=split(poly,axis,sign,threshold);
    if(outside.length>=3)parts.push(outside);
    if(inside.length<3)break;
    poly=inside;
  }
  return parts;
}

function axis(from,to,extra){
  const n=Math.ceil((to-from)/1.27),v=[];
  for(let i=0;i<=n;i++)v.push(from+(to-from)*i/n);
  for(const k of extra)if(k>from+.015&&k<to-.015&&!v.some(n=>Math.abs(n-k)<.028))v.push(k);
  return v.sort((a,b)=>a-b);
}
function patch(x0,z0,x1,z1){
  const canZ0=CANAL.z0,canZ1=CANAL.z1;
  const extraZ=[canZ0-.9,canZ0+.9,canZ1-.9,canZ1+.9];
  const extraX=[-CANAL.half-.64,-CANAL.half+.30,0,CANAL.half-.30,CANAL.half+.64].map(v=>v+CANAL.x);
  const x=axis(x0,x1,extraX),z=axis(z0,z1,extraZ);
  const vertices=[],uv=[],weight=[],indices=[];
  const put=(a,b)=>{
    vertices.push(a,canalHeight(a,b),b);uv.push(a*.4,-b*.4);weight.push(...blendAt(a,b));
    return vertices.length/3-1;
  };
  for(const j of z)for(const i of x)put(i,j);
  for(let j=0;j<z.length-1;j++)for(let i=0;i<x.length-1;i++){
    const a=j*x.length+i,c=a+x.length,d=c+1,e=a+1;
    if(x[i]<MANSION.x+13&&x[i+1]>MANSION.x-13&&z[j]<MANSION.z+12&&z[j+1]>MANSION.z-12){
      const pts=[[x[i],z[j]],[x[i],z[j+1]],[x[i+1],z[j+1]],[x[i+1],z[j]]];
      if(pts.some(p=>{const [u,v]=localPoint(MANSION,...p);return Math.abs(u)<MANSION.w*.5+1.87&&Math.abs(v)<MANSION.d*.5+1.87;})){
        for(const poly of outsideBasement(pts)){
          const face=poly.map(p=>put(...p));
          for(let k=1;k<face.length-1;k++)indices.push(face[0],face[k],face[k+1]);
        }
        continue;
      }
    }
    indices.push(a,c,d,a,d,e);
  }
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(vertices,3));
  g.setAttribute('uv',new Float32BufferAttribute(uv,2));
  g.setAttribute('blendWeights',new Float32BufferAttribute(weight,4));
  g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}

export function createTerrain(scene,textures){
  const ids=['grass','road','earth','gravel','forest'];
  const material=nightMaterial(new MeshStandardMaterial({name:'Village earth, worn lanes, fields, and forest litter',map:textures.grass.albedo,roughness:1}),'district-terrain',(s)=>{
    ids.forEach((id,i)=>{
      const {albedo,normal,orm}=textures[id];
      s.uniforms[`uColor${i}`]={value:albedo};s.uniforms[`uNormal${i}`]={value:normal};
      if(i<3)s.uniforms[`uData${i}`]={value:orm};
    });
    s.vertexShader=`attribute vec4 blendWeights; varying vec4 vBlend; varying vec2 vGround;\n${s.vertexShader}`
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvBlend=blendWeights; vGround=position.xz;');
    const samples=ids.map((id,i)=>{
      const data=i===3?1:i===4?2:i;
      return `vec2 g${i}=p/${textures[id].tile[0].toFixed(2)}; vec2 dx${i}=dFdx(g${i}),dy${i}=dFdy(g${i});
      if (m${i}>.018) {
        clay += textureGrad(uColor${i},g${i},dx${i},dy${i}).rgb*m${i};
        grain += (textureGrad(uNormal${i},g${i},dx${i},dy${i}).xyz*2.-1.)*m${i};
        data += textureGrad(uData${data},g${i},dx${i},dy${i}).rg*m${i};
      }`;
    }).join('\n');
    s.fragmentShader=`varying vec4 vBlend; varying vec2 vGround;
      uniform sampler2D uColor0,uColor1,uColor2,uColor3,uColor4;
      uniform sampler2D uNormal0,uNormal1,uNormal2,uNormal3,uNormal4;
      uniform sampler2D uData0,uData1,uData2;\n${s.fragmentShader}`
      .replace('#include <map_fragment>',/* glsl */`
      vec2 p=vec2(vGround.x,-vGround.y);
      float m1=vBlend.x, m2=vBlend.y, m3=vBlend.z, m4=vBlend.w;
      float m0=max(0.,1.-m1-m2-m3-m4);
      vec3 clay=vec3(0.),grain=vec3(0.);vec2 data=vec2(0.);
      ${samples}
      float fields=m2*smoothstep(49.,56.,vGround.x)*smoothstep(-31.,-24.,vGround.y)*(1.-smoothstep(60.,68.,vGround.y));
      float rows=1.-(.5+.5*cos(vGround.x*3.94+vGround.y*.0435))*.16*fields;
      diffuseColor.rgb *= clay*rows*mix(vec3(.87,.94,.87),vec3(1.19,1.09,.94),m1+m2*.6);
      `).replace('#include <normal_fragment_maps>',/* glsl */`
      vec3 groundTangent=normalize(mat3(viewMatrix)*vec3(1.,0.,0.));
      vec3 groundBitangent=normalize(cross(normal,groundTangent));
      normal=normalize(mat3(groundTangent,groundBitangent,normal)*normalize(vec3(grain.xy*.37,max(.18,grain.z))));
      `).replace('#include <roughnessmap_fragment>','float roughnessFactor = clamp(.62+data.g*.36,.70,.99);')
      .replace('#include <aomap_fragment>','reflectedLight.indirectDiffuse *= mix(1., data.r, .49);');
  });
  const radius=WORLD.halfSize,tile=25;
  for(let z=-radius;z<radius;z+=tile)for(let x=-radius;x<radius;x+=tile){
    const ground=new Mesh(patch(x,z,Math.min(radius,x+tile),Math.min(radius,z+tile)),material);
    ground.name='Connected terrain section';ground.receiveShadow=true;scene.add(ground);
  }
}
