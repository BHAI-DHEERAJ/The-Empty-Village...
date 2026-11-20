import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three';
import { ESCAPE, escapeRoad, FOREST_ESCAPE_LENGTH, MERGE_DISTANCE } from '../story/CretaFinale.js';
import { WORLD } from '../settings.js';
import { createForest } from './forest.js';
import { createGrassField } from './grass.js';
import { buildHighwayTraffic, buildHighwayWalkers } from './HighwayActors.js';
import { HIGHWAY, RAMP_HALF_WIDTH, SPUR_HALF_WIDTH, spurEdge } from './HighwayLayout.js';
import { imageMaterial } from './materials.js';
import { seededRandom } from './random.js';
import { nightMaterial } from './shaders.js';
import { lettering } from './village/lettering.js';
import { ModelBatch } from './village/modeling.js';
import { villagePalette } from './village/palette.js';

const PI=Math.PI;
const {x:centre,halfWidth,zMin,zMax,vergeX,laybyZ,laybyX}=HIGHWAY;
const long=zMax-zMin, mid=(zMax+zMin)*.5;
const wPos=new Vector3(),wDir=new Vector3();

function groundMaterial(texture,color){
  const material=imageMaterial(texture,{color,normalMap:null,aoMap:null,roughnessMap:null,roughness:.96});
  material.userData.tile=texture.tile;return material;
}

function pastureMaterial({grass,forest}){
  // Continue the same forest-floor albedo at the edge of the village mesh,
  // then blend into the open fields. No change to exploration bounds.
  const material=new MeshStandardMaterial({map:grass.albedo,roughness:.96});
  return nightMaterial(material,'highway-pasture',shader=>{
    shader.uniforms.uLitter={value:forest.albedo};
    shader.fragmentShader=`uniform sampler2D uLitter;\n${shader.fragmentShader}`.replace('#include <map_fragment>',`
      vec2 terrain=vec2(vNightWorld.x,-vNightWorld.z);
      vec3 lawn=texture2D(map,terrain/${grass.tile[0].toFixed(2)}).rgb;
      vec3 litter=texture2D(uLitter,terrain/${forest.tile[0].toFixed(2)}).rgb;
      float inside=1.-smoothstep(0.2,29.,max(0.,-terrain.x-${WORLD.halfSize.toFixed(1)}));
      float belt=smoothstep(-78.,-36.,vNightWorld.z)*(1.-smoothstep(33.,59.,vNightWorld.z));
      vec3 oldGround=mix(lawn,litter,belt)*vec3(.87,.94,.87);
      diffuseColor.rgb*=mix(lawn*vec3(.61,.72,.51),oldGround,inside);
    `);
  });
}

function spurSurface(group,road,asphalt){
  // The first metres overlap the original road gently; the paved part joins
  // below the highway deck, with no visible seam or floating ground.
  const start=FOREST_ESCAPE_LENGTH-5.6,end=MERGE_DISTANCE,count=Math.ceil((end-start)/.86);
  const geometry=(from,to,wide,height)=>{
    const positions=[],uv=[],index=[],n=Math.max(1,Math.ceil(count*(to-from)/(end-start)));
    for(let i=0;i<=n;i++){
      const d=from+(to-from)*i/n;
      escapeRoad(d,wPos,wDir);
      const ramp=Math.min(1,Math.max(0,(d-start)/5.6));
      const w=wide*(.42+.58*ramp);
      for(const s of [-1,1]){
        const x=wPos.x-wDir.z*s*w,z=wPos.z+wDir.x*s*w;
        positions.push(x,height,z);uv.push(x*.44,-z*.44);
      }
      if(i<n){const a=i*2;index.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));
    g.setIndex(index);g.computeVertexNormals();return g;
  };
  const dirt=new Mesh(geometry(start,end,SPUR_HALF_WIDTH,.009),road);dirt.name='Continuous dirt spur';group.add(dirt);
  const ramp=new Mesh(geometry(MERGE_DISTANCE-38,end,RAMP_HALF_WIDTH,.016),asphalt);ramp.name='Highway entrance ramp';group.add(ramp);
}

function fringeTrees(){
  const random=seededRandom(48142),trees=[],samples=[];
  for(let d=FOREST_ESCAPE_LENGTH;d<MERGE_DISTANCE;d+=1.8){escapeRoad(d,wPos,wDir);samples.push([wPos.x,wPos.z]);}
  for(let j=0;j<10;j++)for(let i=0;i<10;i++){
    const x=-206+i*5.91+random()*4.3,z=-27+j*7.05+random()*5.7;
    if(x> -147.5||x< -204&&z>2&&z<39||samples.some(([a,b])=>(a-x)**2+(b-z)**2<4.5**2))continue;
    const thinning=1-Math.max(0,(-x-181)/30);
    if(random()>.43+thinning*.56)continue;
    trees.push({x,z,h:5.4+random()*5.7,kind:random()<.60?0:1,ry:random()*2*PI,girth:.78+random()*.34,tint:.70+random()*.39});
  }
  // Shelter trees behind the stop and windbreaks in the distance.
  for(let i=0;i<33;i++){
    const east=i<19;
    const x=east?-180-random()*12:-259-random()*45,z=east?47+i*3.67+random()*5:-151+(i-19)*28.3+random()*9;
    trees.push({x,z,h:4.8+random()*4.9,kind:i%2,ry:random()*2*PI,girth:.77+random()*.27,tint:.75+random()*.29});
  }
  return trees;
}

function highwayTerrain(group,textures,p){
  const dirt=groundMaterial(textures.road,0xbeb5a1),asphalt=groundMaterial(textures.gravel,0x555b63),
    shoulder=groundMaterial(textures.gravel,0xa59b85),field=pastureMaterial(textures),
    meadow=groundMaterial(textures.earth,0xc8ae7a),paint=new MeshBasicMaterial({color:0xede5cc}),
    yellow=new MeshBasicMaterial({color:0xcda251}),silver=new MeshStandardMaterial({color:0xa5b0b4,roughness:.65,metalness:.27});
  const b=new ModelBatch(group);
  // Base beyond the square playable terrain, then stretches of pasture.
  b.box(field,-260,-.063,17,176.06,.12,600);
  b.box(field,-130,-.071,230,84.1,.12,126);
  b.box(field,-130,-.071,-227,84.1,.12,112);
  b.box(meadow,-283,.008,26,73,.01,476);
  for(let i=0;i<8;i++)b.box(field,-248-i*7.6,.016,83-i*12.7,2.48,.012,404-i*15.6);
  b.box(shoulder,centre,.002,mid,2*halfWidth+4.6,.016,long);
  b.box(asphalt,centre,.011,mid,2*halfWidth,.023,long);
  b.box(p.cement,centre,.19,mid,.87,.34,long);
  b.box(p.rock,centre,.36,mid,.59,.105,long);
  for(const side of [-1,1]){
    const edge=centre+side*(halfWidth-.35);
    if(side<0)b.box(paint,edge,.025,mid,.103,.008,long);
    else{
      b.box(paint,edge,.025,(zMin+13)*.5,.103,.008,13-zMin);
      b.box(paint,edge,.025,(zMax+43)*.5,.103,.008,zMax-43);
      for(let z=15;z<42;z+=3.7)b.box(paint,edge,.025,z,.103,.008,1.91);
    }
    b.box(yellow,centre+side*.72,.025,mid,.096,.008,long);
    const railX=centre+side*(halfWidth+1.35);
    for(let z=zMin+3;z<zMax-2;z+=5.9){
      if(side>0&&z>=3&&z<=51.5)continue;
      b.box(silver,railX,.56,z,.156,.183,5.86);
      b.box(p.iron,railX,.36,z-2.32,.112,.73,.113);
      if(Math.round((z-zMin)/5.9)%2===0)b.box(paint,railX-side*.081,.61,z-1.65,.016,.048,.159);
    }
    for(let z=zMin+4.0;z<zMax-3;z+=10.8)b.box(paint,centre+side*4.48,.025,z,.117,.008,4.1);
    for(let i=0;i<9;i++){
      const z=-143+i*42+side*11, x=centre+side*(halfWidth+1.96);
      if(side>0&&z>0&&z<51)continue;
      b.cylinder(silver,x,3.87,z,.042,.089,7.72,{sides:7});
      b.beam(silver,[x,7.55,z],[x-side*1.72,7.84,z],.034,6);
      b.box(p.iron,x-side*1.57,7.83,z,.52,.133,.23);
      b.box(p.bulb,x-side*1.62,7.753,z,.31,.027,.134);
    }
  }
  const tile=groundMaterial(textures.floor,0xc9bcaa);
  b.box(tile,vergeX+.62,.087,laybyZ+3.0,3.55,.17,57.4);
  b.box(shoulder,laybyX+1.3,.036,laybyZ,12.74,.075,56.2);
  b.box(p.chalk,vergeX-1.13,.138,laybyZ+3,.19,.26,57.38);
  for(let i=0;i<27;i++)b.box(i%2===0?p.chalk:p.iron,vergeX-1.23,.217,laybyZ-24+i*2.07,.035,.105,2.05);
  for(let i=0;i<5;i++){
    const z=laybyZ-15+i*7.2;
    b.box(paint,laybyX,.083,z,2.96,.014,.082);
    b.box(p.bulb,vergeX-1.05,.481,z,.135,.20,.154);
    b.box(p.iron,vergeX-1.05,.285,z,.101,.40,.11);
  }
  b.finish('Highway paving, reflectors and railings');
  spurSurface(group,dirt,asphalt);
}

function restStop(group,p){
  const b=new ModelBatch(group),teaGlow=new MeshBasicMaterial({color:0xdfa66b});
  b.within(-198.43,.06,laybyZ-1.1,-PI/2,a=>{
    a.box(p.cement,0,.078,0,17.21,.17,7.61);
    a.box(p.mutedOchre,0,1.41,-.63,15.96,2.68,5.63);
    a.box(p.rock,0,.35,2.211,15.99,.49,.11);
    a.box(p.roof,0,2.88,-.50,16.63,.41,6.24,{rx:.04});
    a.box(p.darkWood,0,2.42,3.35,16.67,.12,2.25,{rx:.068});
    for(let i=0;i<9;i++){
      const awning=i%2===0?p.tractorRed:p.cloth,x=-7.42+i*1.855;
      a.box(awning,x,2.49,3.35,1.851,.033,2.32,{rx:.068});
      a.box(awning,x,2.314,4.484,1.851,.244,.068);
    }
    for(const x of [-7.8,-3.84,.0,3.84,7.8])a.cylinder(p.iron,x,1.247,4.29,.041,.045,2.48,{sides:6});
    a.box(p.board,0,2.84,2.79,10.87,.65,.138);
    lettering(a,p.chalk,'सुबह की चाय  /  DHABA',0,2.85,2.864,.356,9.93);
    for(const x of [-5.9,-2.34,3.89,6.59]){
      a.box(p.darkWood,x,1.55,2.21,2.24,1.44,.131);a.box(teaGlow,x,1.58,2.287,1.94,1.19,.032);
      for(const u of [-.59,0,.59])a.box(p.iron,x+u,1.58,2.313,.061,1.29,.037);
      a.box(p.wood,x,.90,2.51,2.33,.11,.61);a.box(p.iron,x,1.59,2.32,1.93,.055,.036);
    }
    a.box(p.door,.573,1.15,2.23,1.56,2.09,.152);
    for(const x of [-5.8,-1.86,4.88]){
      a.box(p.wood,x,.72,3.39,1.35,.123,.64);
      for(const i of [-1,1])a.box(p.timber,x+i*.53,.375,3.39,.061,.68,.50);
      a.cylinder(p.pottery,x,.82,3.47,.088,.066,.135,{sides:8});
      a.box(p.dullTeal,x,.39,4.09,1.31,.094,.30);
      a.box(p.bulb,x,2.42,3.34,.16,.071,.144);
    }
    // Kettle, steel cups and a counter looking out on the lay-by.
    a.box(p.dullTeal,.48,.70,3.97,1.84,1.11,.89);
    a.box(p.timber,.48,1.269,3.97,1.98,.108,1.0);
    a.pot(p.iron,.88,1.32,4.04,[[.080,0],[.142,.06],[.154,.165],[.109,.229],[.105,.251]]);
    a.beam(p.iron,[1.01,1.44,4.04],[1.24,1.58,4.07],.037);
    for(let i=0;i<5;i++)a.cylinder(p.chalk,-.25+i*.19,1.36,3.97,.047,.035,.088,{sides:7});
  });
  b.within(-210.82,0,12.36,PI/2,a=>{
    for(const x of [-1.45,1.45]){
      a.cylinder(p.iron,x,1.40,0,.048,.051,2.85,{sides:7});
      a.box(p.chalk,x,.28,0,.125,.32,.132);
    }
    a.box(p.board,0,2.37,0,3.81,1.14,.11);
    lettering(a,p.chalk,'हिसार · राजमार्ग',0,2.55,.061,.33,3.52);
    lettering(a,p.chalk,'HISAR / HIGHWAY',0,2.17,.061,.20,3.10);
  });
  b.within(-211.93,0,laybyZ+8.7,PI,a=>{
    a.cylinder(p.iron,0,1.41,0,.047,.055,2.84,{sides:7});
    a.box(p.board,0,2.41,.044,2.08,.79,.095);
    lettering(a,p.chalk,'ढाबा',0,2.56,.096,.26,1.88);
    lettering(a,p.chalk,'TEA STOP',0,2.30,.096,.173,1.87);
  });
  const r=seededRandom(48127);
  for(let i=0;i<18;i++){
    const x=-265-r()*47,z=-181+i*25.5+r()*12;
    const height=.9+r()*3.9,width=4+r()*9;
    b.box(i%3===0?p.mutedLime:i%2===0?p.mutedOchre:p.mutedPlaster,x,height*.5,z,width,height,5.65);
    b.box(p.roof,x,height+.05,z,width+.45,.29,6.15,{rx:.08});
    if(i%2===0)b.box(p.darkGlass,x+width*.5+.015,height*.64,z,.048,.47,2.52);
  }
  b.finish('Haryana highway dhaba and signs');
}

export function createHighwayScene(scene,textures,{compact=false,collision=null}={}){
  const group=new Group();group.name='Haryana highway · dawn';group.visible=false;scene.add(group);
  const p=villagePalette(textures);
  highwayTerrain(group,textures,p);restStop(group,p);
  const forest=createForest(group,textures,collision,{compact,trees:fringeTrees()});
  const grass=createGrassField(group,textures,{compact,bounds:[-207.7,-WORLD.halfSize,-38,50],edgeAt:spurEdge});
  const traffic=buildHighwayTraffic(group,textures,p),walkers=buildHighwayWalkers(group,textures);
  return {group,traffic,walkers,
    hide(){group.visible=false;},
    update(time,view,reduced){
      group.visible=true;
      forest.update(view,reduced?0:time);grass.update(reduced?0:time,view);
      const sinceMerge=time-ESCAPE.merge;
      traffic.update(sinceMerge,view);walkers.update(sinceMerge,reduced,view);
    },
    dispose(){grass.dispose();},
  };
}
