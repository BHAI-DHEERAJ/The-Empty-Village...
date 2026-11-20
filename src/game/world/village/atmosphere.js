import {
  AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute, InstancedMesh, Mesh,
  Object3D, PlaneGeometry, PointLight, Points, PointsMaterial, ShaderMaterial, Vector3,
} from 'three';
import { between, seededRandom } from '../random.js';
import { groundHeight, localPoint, worldPoint } from '../sceneryLayout.js';

export function pulse(time,phase){
  const r=(time+phase)%57;
  if(r>46.1&&r<48.2)return 0;
  if(r>44.9&&r<46.1)return Math.sin(r*29)+Math.sin(r*83)*.65>-.36?.93:.21;
  return .94+Math.sin(time*.57+phase)*.051;
}

function localLights(scene,nodes,compact){
  const pool=[new PointLight(0xffb770,0,14,1.72)];
  if(!compact)pool.push(new PointLight(0xffb770,0,13,1.78));
  pool.forEach((l,i)=>{l.name=`Pooled local fixture ${i+1}`;scene.add(l);});
  return (time,view,building,still,daylight,blackout)=>{
    const x=view.position.x,z=view.position.z;
    const eligible=[];
    for(const node of nodes){
      if(node.enabled&&!node.enabled()){node.glow.visible=false;continue;}
      const distance=(node.point.x-x)**2+(node.point.z-z)**2;
      const strength=(node.override ?? (still?.91:pulse(time,node.phase)))*(node.site?1:1-blackout);
      node.glow.visible=distance<76**2&&strength>.28;
      const appropriate=building?building.site.id===node.site:!node.site;
      if(appropriate&&distance<(node.override!=null?29:22)**2)eligible.push({node,distance,strength});
    }
    eligible.sort((a,b)=>(Number(b.node.override!=null)-Number(a.node.override!=null))*650+a.distance-b.distance);
    pool.forEach((l,i)=>{
      const e=eligible[i];
      if(!e){l.intensity=0;return;}
      const {node,strength,distance}=e;
      l.position.copy(node.point);
      l.intensity=(1-daylight*.92)*node.strength*strength*(node.override!=null?1:Math.max(0,Math.min(1,(484-distance)/137)));
      l.color.set(node.site?0xf2ba73:node.kind==='forest'?0xc88750:0xffb974);
    });
  };
}

const laneMist=[[.48,16.82,12,2.52],[-.18,28.7,21,3.17],[-2.5,-16.3,12,1.03],[3.1,-33.4,16,1.26],[3.0,-50.1,19,1.42],[-3.2,-76.3,15,1.02],[-.3,-90.6,17,1.08],
  [-17.7,-32.6,16,1.36],[-40.4,-16.1,22,1.78],[-62.2,-5.9,20,1.49],[-84.1,-8.8,23,2.1],[-105.1,-11.8,21,1.78],
  [69.5,14.2,18,1.26],[86.9,14,21,1.11],[83.1,-12.1,17,1.42],[104.5,25.3,24,1.29],[46,-34.9,21,1.05],[-49.1,-115.7,18,1.5]];
function roadsideMist(scene,photo){
  const mat=new ShaderMaterial({transparent:true,depthWrite:false,side:DoubleSide,toneMapped:false,uniforms:{uCloud:{value:photo},uDay:{value:0}},
    vertexShader:/* glsl */`
      varying vec2 vUv; varying float distanceToCamera;
      void main(){vUv=uv;vec4 local=modelViewMatrix*vec4(position,1.);distanceToCamera=-local.z;gl_Position=projectionMatrix*local;}`,
    fragmentShader:/* glsl */`
      uniform sampler2D uCloud; uniform float uDay; varying vec2 vUv; varying float distanceToCamera;
      void main(){
        vec4 realCloud=texture2D(uCloud,vUv);
        float fade=smoothstep(.00,.30,vUv.x)*smoothstep(.00,.30,1.-vUv.x)*smoothstep(.00,.31,vUv.y)*smoothstep(.00,.41,1.-vUv.y);
        float alpha=realCloud.a*fade*smoothstep(3.8,9.,distanceToCamera)*(1.-smoothstep(28.,55.,distanceToCamera))*.18;
        gl_FragColor=vec4(vec3(.057,.083,.127)+realCloud.rgb*.05,alpha*(1.-uDay));
        #include <colorspace_fragment>
      }`});
  const geometry=new PlaneGeometry(1,1);
  const sheets=laneMist.map(([x,z,w,h],i)=>{
    const obj=new Mesh(geometry,mat);
    obj.name='Low drift along the road';obj.scale.set(w,h,1);obj.renderOrder=2;
    scene.add(obj);return{obj,x,z,phase:i*7.17};
  });
  return (time,view,indoors,still,daylight)=>{
    mat.uniforms.uDay.value=daylight;
    for(const {obj,x,z,phase} of sheets){
      const range=(x-view.position.x)**2+(z-view.position.z)**2;
      obj.visible=daylight<.99&&!indoors&&range<58**2&&range>4**2;
      if(!obj.visible)continue;
      const t=still?0:time;
      obj.position.set(x+Math.sin(t*.125+phase)*2.58,.51+Math.sin(t*.12+phase)*.112,z+Math.cos(t*.082+phase)*1.57);
      obj.rotation.y=Math.atan2(view.position.x-obj.position.x,view.position.z-obj.position.z);
    }
  };
}

function floatingLeaves(scene,leaf,{compact}){
  const random=seededRandom(51514),n=compact?12:22;
  const object=new InstancedMesh(new PlaneGeometry(1,1),leaf,n);object.frustumCulled=false;object.name='Occasional leaves caught by the wind';scene.add(object);
  const pose=new Object3D();
  const sources=laneMist.map(([x,z],i)=>[x+(i%2===0?2.6:-3.4),z-1.3]);
  const leaves=Array.from({length:n},(_,i)=>({source:sources[i%sources.length],interval:between(random,11.8,31.6),phase:random(),r:between(random,1.7,4.6),turn:random()*6.28,size:between(random,.070,.151),h:between(random,1.6,4.2)}));
  return (t,view,indoors,still)=>{
    object.visible=!indoors&&!still;
    if(!object.visible)return;
    let count=0;
    for(const {source:[x,z],interval,phase,r,turn,size,h} of leaves){
      const p=(t/interval+phase)%1/.52;
      if(p>=1||(x-view.position.x)**2+(z-view.position.z)**2>28**2)continue;
      const gust=t*1.11+turn;
      const s=size*Math.min(1,p*9,(1-p)*9);
      const a=x+Math.cos(gust*.49)*r+p*2.3,b=z+Math.sin(gust*.24)*r;
      pose.position.set(a,groundHeight(a,b)+h*(1-p)+.048,b);pose.rotation.set(gust*.93,gust*.65,Math.cos(gust)*.9);
      pose.scale.set(s,s*1.21,.01);pose.updateMatrix();object.setMatrixAt(count++,pose.matrix);
    }
    object.count=count;object.instanceMatrix.needsUpdate=true;
  };
}

function airDust(scene,textures,compact){
  const number=compact?27:54;
  const place=new Float32BufferAttribute(new Float32Array(number*3),3), g=new BufferGeometry();g.setAttribute('position',place);
  const m=new PointsMaterial({name:'Photo-mapped dust',map:textures.fog.albedo,color:0xb5a687,size:.066,blending:AdditiveBlending,transparent:true,depthWrite:false,opacity:.47});
  const points=new Points(g,m);points.name='Dust drifting through the torchlight';points.frustumCulled=false;points.visible=false;scene.add(points);
  const data=[],look=new Vector3();
  let prev;
  function reset(building,r){
    prev=r;data.length=0;
    const random=seededRandom(51251+Math.round(building.site.x*719)+Math.round(r.x0*100));
    const max=Math.min(2.31,building.site.eave-.18);
    for(let i=0;i<number;i++){
      const [x,z]=worldPoint(building.site,between(random,r.x0+.15,r.x1-.15),between(random,r.z0+.15,r.z1-.15));
      data.push({x,z,y:r.base+between(random,.47,max),phase:between(random,0,6.283)});
    }
  }
  return (time,camera,building,torch,still)=>{
    points.visible=Boolean(building)&&!still;
    if(!points.visible)return;
    const [a,b]=localPoint(building.site,camera.position.x,camera.position.z);
    const h=camera.position.y-1.61;
    const r=building.plan.rooms.find(r=>!r.locked&&Math.abs(r.base-h)<.95&&a>r.x0&&a<r.x1&&b>r.z0&&b<r.z1);
    if(!r){points.visible=false;return;}
    if(r!==prev)reset(building,r);
    camera.getWorldDirection(look);
    let count=0;
    for(const {x,y,z,phase} of data){
      const drift=time*.52+phase;
      const xx=x+.161*Math.sin(drift),yy=y+.084*Math.cos(drift*.62),zz=z+.182*Math.cos(drift*.81);
      const dx=xx-camera.position.x,dy=yy-camera.position.y,dz=zz-camera.position.z;
      const length=Math.hypot(dx,dy,dz);
      const beam=(dx*look.x+dy*look.y+dz*look.z)/length;
      if(length>.52&&length<14&&(torch&&beam>.89 || !torch&&beam>.96&&phase<2))place.setXYZ(count++,xx,yy,zz);
    }
    m.opacity=torch?.48:.18;
    g.setDrawRange(0,count);place.needsUpdate=true;
  };
}

export function addAtmosphere(scene,buildings,textures,p,nodes,{compact=false,reducedMotion=false}={}){
  const fixtures=localLights(scene,nodes,compact), drift=roadsideMist(scene,textures.fog.albedo),leaves=floatingLeaves(scene,p.leaf,{compact}), dust=airDust(scene,textures,compact);
  return (time,camera,current,torch,daylight,blackout)=>{
    fixtures(time,camera,current,reducedMotion,daylight,blackout);drift(time,camera,current,reducedMotion,daylight);leaves(time,camera,current,reducedMotion);dust(time,camera,current,torch,reducedMotion);
    for(const building of buildings){
      const {site,movers}=building;
      const range=(site.x-camera.position.x)**2+(site.z-camera.position.z)**2;
      if(range<20**2&&!reducedMotion)for(const {kind,object,phase} of movers){
        if(kind==='cloth'){object.rotation.x=.037*Math.sin(time*1.17+phase);object.rotation.z=.012*Math.sin(time*.73+phase);}
        if(kind==='fan')object.rotation.y=.047*Math.sin(time*.98+phase);
        if(kind==='wire'){object.rotation.x=.073*Math.sin(time*.87+phase);object.rotation.z=.102*Math.sin(time*1.41+phase);}
      }

    }
  };
}
