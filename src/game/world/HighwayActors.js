import {
  CircleGeometry, Color, CylinderGeometry, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, Frustum, Group,
  InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Object3D, Sphere, SphereGeometry, Vector3,
} from 'three';
import { HIGHWAY, HIGHWAY_TRAFFIC, HIGHWAY_WALKERS, TRAFFIC_SIZE, trafficZ, walkerZ } from './HighwayLayout.js';
import { imageMaterial } from './materials.js';
import { ModelBatch } from './village/modeling.js';

const origin=new Color(0xffffff);
const carColors=[0xc2d3db,0xa84434,0x506f82,0xe1bf77,0xddd6c6,0x5f7972,0x9a7d62,0xa596b0].map(c=>new Color(c));
const clothes=[0xc59365,0xf1e5bc,0x628286,0xb56352,0x839064,0x8c7598].map(c=>new Color(c));
const skins=[0xa57856,0xd7a888,0xaa7f61,0xb99c71].map(c=>new Color(c));

function contactShadow(group,capacity,opacity){
  const shape=new CircleGeometry(1,12).rotateX(-Math.PI/2),values=[];
  for(let i=0;i<shape.getAttribute('position').count;i++)values.push(1,1,1,i===0?opacity:0);
  shape.setAttribute('color',new Float32BufferAttribute(values,4));
  const mat=new MeshBasicMaterial({color:0x1b1d19,vertexColors:true,transparent:true,depthWrite:false});
  const pool=new InstancedMesh(shape,mat,capacity);
  pool.name='Soft contact shadows';pool.instanceMatrix.setUsage(DynamicDrawUsage);pool.frustumCulled=false;group.add(pool);
  return pool;
}

function vehicleModel(kind,p,paint,glass,head,tail){
  const group=new Group(),b=new ModelBatch(group),lorry=kind==='lorry',van=kind==='van';
  const {halfWidth:halfW,halfLength:halfL}=TRAFFIC_SIZE[kind];
  const top=lorry?1.84:van?1.82:1.43, deck=lorry?.98:.79;
  const f=-halfL,r=halfL;
  b.box(p.rubber,0,.40,0,halfW*1.87,.27,halfL*1.93);
  b.box(paint,0,.67,0,halfW*2,.50,halfL*2-.081);
  b.box(p.iron,0,.52,f,halfW*1.95,.116,.095);
  b.box(p.iron,0,.56,r,halfW*1.95,.128,.095);
  const yA=top-.12, zA=lorry?f+.32:f+(van?.38:.97), zB=lorry?f+2.25:r-(van?.28:.79);
  b.box(paint,0,yA+.11,(zA+zB)*.5,halfW*1.69,.102,zB-zA+.10);
  const windA=zA-(lorry?.19:van?.24:.50),windB=zB+(van?.045:.47);
  const u=halfW*.91,v=halfW*.81;
  const quad=(mat,a,c,d,e)=>b.panel(mat,[a,c,d,e],[[0,0],[1,0],[1,1],[0,1]],[0,1,2,0,2,3]);
  quad(glass,[u,deck,windA],[-u,deck,windA],[-v,yA,zA],[v,yA,zA]);
  quad(glass,[-u,deck,windB],[u,deck,windB],[v,yA,zB],[-v,yA,zB]);
  for(const side of [-1,1]){
    const x=halfW*side;
    const panel=[[side*u,deck,windA],[side*u,deck,windB],[side*v,yA,zB],[side*v,yA,zA]];
    quad(glass,...(side>0?panel:[...panel].reverse()));
    for(const [base,end] of [[windA,zA],[windB,zB],[(windA+windB)*.5,(zA+zB)*.5]]){
      b.beam(paint,[side*u,deck,base],[side*v,yA,end],.049,4);
    }
    b.box(p.darkGlass,x+side*.043,deck+.12,windA+.174,.14,.102,.18);
    b.box(p.darkGlass,x,.778,f+.188,.05,.057,.14);
    b.box(head,x*.69,.739,f-.034,halfW*.42,.115,.024);
    b.box(tail,x*.77,.763,r+.009,halfW*.34,.118,.024);
    for(const z of [f+.84,r-.81,...(lorry?[r-1.49]:[])]){
      b.cylinder(p.rubber,x*.967,.288,z,.294,.294,.183,{rz:Math.PI/2,sides:12});
      b.cylinder(p.iron,x+side*.066,.288,z,.149,.149,.040,{rz:Math.PI/2,sides:8});
    }
  }
  b.box(p.black,0,.679,f-.036,halfW*.67,.146,.043);
  b.box(p.chalk,0,.573,r+.060,.39,.083,.014);
  if(lorry){
    b.box(p.tractorRed,0,1.45,1.07,halfW*2.03,1.48,5.16);
    b.box(p.board,0,2.21,1.07,halfW*2.1,.089,5.2);
    b.box(p.chalk,0,1.30,r+.018,1.96,.078,.039);
    for(const side of [-1,1])for(let i=0;i<8;i++)b.box(p.rust,side*(halfW+.025),1.52,-1.16+i*.65,.042,1.28,.045);
    b.box(p.bulb,0,top+.19,zA+.21,1.14,.085,.23);
  }
  b.finish(kind);
  return group.children;
}

export function buildHighwayTraffic(group,textures,p){
  const traffic=new Group();traffic.name='Highway · flowing traffic';group.add(traffic);
  const paint=imageMaterial(textures.carBody,{color:0xe6e5db,normalMap:null,metalnessMap:null,aoMap:null,roughnessMap:null,metalness:.24,roughness:.67});
  paint.userData.tile=textures.carBody.tile;
  const glass=imageMaterial(textures.glass,{color:0x5d7888,roughness:.64,side:DoubleSide,normalMap:null});
  const head=new MeshBasicMaterial({color:0xffe6b6}),tail=new MeshBasicMaterial({color:0xcd3826});
  const parked=[
    {kind:'van',paint:4,x:HIGHWAY.laybyX,z:HIGHWAY.laybyZ-11.3,direction:-1},
    {kind:'sedan',paint:3,x:HIGHWAY.laybyX+.4,z:HIGHWAY.laybyZ+15.1,direction:1},
  ];
  const streams=['sedan','van','lorry'].map(kind=>{
    const cars=[...HIGHWAY_TRAFFIC,...parked].filter(v=>v.kind===kind);
    const shadow=contactShadow(traffic,cars.length,.59);
    const parts=vehicleModel(kind,p,paint,glass,head,tail).map(src=>{
      const pool=new InstancedMesh(src.geometry,src.material,cars.length);
      pool.name=`Highway · ${kind} ${src.material===paint?'paintwork':'details'}`;
      pool.frustumCulled=false;pool.instanceMatrix.setUsage(DynamicDrawUsage);traffic.add(pool);
      if(src.material===paint)cars.forEach((car,i)=>pool.setColorAt(i,carColors[car.paint]));
      return pool;
    });
    return {cars,parts,shadow,lorry:kind==='lorry'};
  });
  const pose=new Object3D(),clip=new Frustum(),matrix=new Matrix4(),bounds=new Sphere();
  return {group:traffic,count:HIGHWAY_TRAFFIC.length,update(relTime,view){
    const visible=view.position.x< -135;
    traffic.visible=visible;
    if(!visible)return;
    clip.setFromProjectionMatrix(matrix.multiplyMatrices(view.projectionMatrix,view.matrixWorldInverse));
    for(const {cars,parts,shadow,lorry} of streams){
      let index=0;
      for(const car of cars){
        const lane=car.lane,z=lane?trafficZ(car,relTime):car.z,x=lane?.x??car.x,y=lane?.029:.078;
        // Loop seams at the horizon won't need matrices in any of the cuts.
        if(Math.abs(z-view.position.z)>183)continue;
        bounds.center.set(x,y+.94,z);bounds.radius=lorry?4.7:2.8;
        if(!clip.intersectsSphere(bounds))continue;
        pose.position.set(x,y,z);pose.scale.set(1,1,1);
        pose.rotation.y=(lane?.direction??car.direction)>0?Math.PI:0;pose.updateMatrix();
        for(const part of parts){
          part.setMatrixAt(index,pose.matrix);
          if(part.material===paint)part.setColorAt(index,carColors[car.paint]);
        }
        pose.position.y+=.002;pose.scale.set(lorry?1.46:1.14,1,lorry?4.9:2.99);pose.updateMatrix();
        shadow.setMatrixAt(index,pose.matrix);index++;
      }
      shadow.count=index;shadow.instanceMatrix.needsUpdate=true;
      for(const part of parts){
        part.count=index;part.instanceMatrix.needsUpdate=true;
        if(part.instanceColor)part.instanceColor.needsUpdate=true;
      }
    }
  }};
}

export function buildHighwayWalkers(group,textures){
  const refuge=new Group();refuge.name='Highway · people on the footpath';group.add(refuge);
  const fabric=imageMaterial(textures.linen,{normalMap:null,roughnessMap:null,aoMap:null});
  const skin=new MeshStandardMaterial({color:0xe7bc9d,roughness:.87});
  const hair=new MeshStandardMaterial({color:0x382d28,roughness:.91}),tread=new MeshStandardMaterial({color:0x51493e,roughness:.91});
  const cylinder=new CylinderGeometry(.88,1,1,8),oval=new SphereGeometry(1,8,5);
  const batch=(g,m,n,name)=>{
    const mesh=new InstancedMesh(g,m,n);mesh.name=name;mesh.frustumCulled=false;refuge.add(mesh);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);return mesh;
  };
  const n=HIGHWAY_WALKERS.length,shirt=batch(cylinder,fabric,n,'Kurtas and jackets'),heads=batch(oval,skin,n,'Faces'),
    caps=batch(oval,hair,n,'Hair and scarves'),legs=batch(cylinder,fabric,n*4,'Walking legs'),arms=batch(cylinder,fabric,n*2,'Walking arms'),
    shoes=batch(oval,tread,n*2,'Shoes'),hands=batch(oval,skin,n*2,'Hands'),shadow=contactShadow(refuge,n,.45);
  const pose=new Object3D(),shade=new Color(0x4d535a),up=new Vector3(0,1,0);
  const a=new Vector3(),b=new Vector3(),delta=new Vector3();
  for(let i=0;i<n;i++){
    const hue=clothes[HIGHWAY_WALKERS[i].style],tone=skins[i%skins.length];
    shirt.setColorAt(i,hue);heads.setColorAt(i,tone);
    caps.setColorAt(i,i%3===1?clothes[(i+1)%clothes.length].clone().multiplyScalar(2.3):origin);
    for(let j=0;j<2;j++){
      legs.setColorAt(i*4+j*2,shade);legs.setColorAt(i*4+j*2+1,shade);
      arms.setColorAt(i*2+j,hue);hands.setColorAt(i*2+j,tone);
    }
  }
  function part(mesh,index,x,y,z,yaw,sx,sy,sz){
    pose.position.set(x,y,z);pose.rotation.set(0,yaw,0);pose.scale.set(sx,sy,sz);pose.updateMatrix();mesh.setMatrixAt(index,pose.matrix);
  }
  function segment(mesh,index,x,y,z,toX,toY,toZ,r){
    a.set(x,y,z);b.set(toX,toY,toZ);delta.subVectors(b,a);const len=delta.length();
    pose.position.copy(a).lerp(b,.5);pose.quaternion.setFromUnitVectors(up,delta.divideScalar(len));
    pose.scale.set(r,len,r);pose.updateMatrix();mesh.setMatrixAt(index,pose.matrix);
  }
  return {group:refuge,count:n,update(t,reduced,view){
    refuge.visible=view.position.x< -149&&Math.abs(view.position.z-HIGHWAY.laybyZ)<118;
    if(!refuge.visible)return;
    HIGHWAY_WALKERS.forEach((w,i)=>{
      const {z,direction}=walkerZ(w,t),y=.172,turn=direction>0?0:Math.PI,phase=t*6.2+w.phase;
      const rhythm=w.idle?0:Math.sin(phase),bob=Math.abs(rhythm)*(reduced?.012:.032);
      const height=.93+(i%5)*.040,tunic=i%3!==2;
      const headY=y+(1.49+bob)*height;
      part(shirt,i,w.x,y+((tunic?1.00:1.052)+bob)*height,z,turn,.185+(i%3)*.011,(tunic?.73:.57)*height,.124);
      part(heads,i,w.x,headY,z,turn,.090,.118*height,.090);
      part(caps,i,w.x,headY+.064*height,z-direction*.020,turn,.094,.080*height,.093);
      part(shadow,i,w.x,y+.003,z,0,.40,1,.37);
      for(const side of [-1,1]){
        const j=i*2+Number(side>0),stride=side*rhythm*(reduced?.54:1);
        const lift=w.idle?0:Math.max(0,side*Math.cos(phase))*(reduced?.058:.135)*height;
        const x=w.x+side*.088,footZ=z+direction*stride*.30,kneeZ=z+direction*(stride*.16+lift*.49);
        const ankleY=y+.066+lift,kneeY=y+.38*height+lift*.59;
        segment(legs,j*2,x,y+(.728+bob)*height,z,x,kneeY,kneeZ,.067);
        segment(legs,j*2+1,x,kneeY,kneeZ,x,ankleY,footZ,.059);
        part(shoes,j,x,ankleY-.025,footZ+direction*.046,turn,.069,.041,.122);
        const armX=w.x+side*.208,handY=y+(.847+bob+Math.abs(stride)*.056+(w.idle?.11:0))*height;
        const handZ=z+direction*(w.idle?.168:-stride*.184);
        segment(arms,j,armX,y+(1.245+bob)*height,z,armX+side*.028,handY,handZ,.047);
        part(hands,j,armX+side*.032,handY-.032,handZ,turn,.040,.065,.046);
      }
    });
    for(const mesh of [shirt,heads,caps,legs,arms,shoes,hands,shadow])mesh.instanceMatrix.needsUpdate=true;
  }};
}
