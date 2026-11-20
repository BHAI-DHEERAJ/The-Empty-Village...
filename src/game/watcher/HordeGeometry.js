import { BufferAttribute, CylinderGeometry, LatheGeometry, Quaternion, SphereGeometry, Vector2, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Every rank mixes these five silhouettes. Both LODs are textured, lit 3D
// models; the distant ones just use fewer rings and limb segments.
export const GHOST_REGIMENTS = Object.freeze([
  { id:'guard', name:'Porcelain Guard', count:342, cloth:'hauntCloth', face:'hauntMask', color:0x929295, skin:0xe8e0ca, eyes:0xe8bc82, light:0x3c4258 },
  { id:'veil', name:'Veiled Procession', count:276, cloth:'veilLinen', face:'watcherSkin', color:0xb1beca, skin:0x303d50, eyes:0xb2edff, light:0x4a647b },
  { id:'runner', name:'Ash Runners', count:254, cloth:'watcherCloth', face:'watcherFace', color:0x857c7a, skin:0xd3c3af, eyes:0xceb4aa, light:0x403b50 },
  { id:'crawler', name:'Root Crawlers', count:186, cloth:'rootHide', face:'rootHide', color:0x877573, skin:0xb18169, eyes:0xf5a65d, light:0x4e302c },
  { id:'antler', name:'Antler Sentinels', count:142, cloth:'bark', face:'bark', color:0xb48570, skin:0xb09182, eyes:0xffb876, light:0x4b3231 },
].map(Object.freeze));
export const GHOST_COUNT = GHOST_REGIMENTS.reduce((sum,style)=>sum+style.count,0);

export function hordeGeometry(id, near) {
  const layers={body:[],face:[],eyes:[]};
  const sides=near?9:5, round=near?7:4;
  const a=new Vector3(),d=new Vector3(),turn=new Quaternion(),up=new Vector3(0,1,0);
  function attach(layer,geometry,swing=0,lift=0,pivot=0) {
    const {position}=geometry.attributes, stride=new Float32Array(position.count*2);
    for(let i=0;i<position.count;i++){
      const reach=Math.min(1,Math.abs(position.getY(i)-pivot)*1.74);
      stride[i*2]=swing*reach;stride[i*2+1]=lift*reach;
    }
    geometry.setAttribute('aStride',new BufferAttribute(stride,2));layers[layer].push(geometry);
  }
  function oval(layer,x,y,z,rx,ry,rz) {
    const eye=layer==='eyes';
    if(eye&&!near)return;
    const g=new SphereGeometry(1,eye?4:sides,eye?2:round);
    if(layer==='face'&&(id==='runner'||id==='guard')){
      const {position:p,uv}=g.attributes;
      for(let i=0;i<uv.count;i++)uv.setXY(i,.5+p.getX(i)*.4,.5+p.getY(i)*.45);
    }
    g.scale(rx,ry,rz);g.translate(x,y,z);attach(layer,g);
  }
  function shaft(layer,from,to,wide,tip,swing=0,lift=0,pivot=from[1]) {
    a.fromArray(from);d.fromArray(to).sub(a);const len=d.length();
    const g=new CylinderGeometry(tip,wide,len,near?7:4,1,true);
    turn.setFromUnitVectors(up,d.normalize());a.addScaledVector(d,len*.5);
    g.applyQuaternion(turn);g.translate(a.x,a.y,a.z);attach(layer,g,swing,lift,pivot);
  }
  function mantle(rings,flatten,seed=0) {
    const g=new LatheGeometry(rings.map(([r,y])=>new Vector2(r,y)),sides);
    const p=g.attributes.position, bottom=rings[0][1];
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),angle=Math.atan2(x,z);
      const fold=1+.08*Math.sin(angle*5+seed+y*.53)+.06*Math.cos(angle*3-y*1.4);
      const hem=Math.max(0,1-(y-bottom)*3.2);
      p.setXYZ(i,x*fold,y+hem*(.092*Math.cos(angle*4+seed)+.036*Math.sin(angle*3)),z*fold*flatten);
    }
    g.computeVertexNormals();attach('body',g);
  }
  const eyes=(y,z,x=.053,r=.024)=>{
    oval('eyes',-x,y,z,r,r*.55,.015);oval('eyes',x,y,z,r,r*.55,.015);
  };

  if(id==='crawler'){
    oval('body',0,.46,-.07,.279,.26,.58);
    oval('face',0,.422,.437,.176,.162,.219);
    eyes(.458,.62,.082,.027);
    for(const side of [-1,1])for(let i=0;i<3;i++){
      const z=.230-i*.34,wave=side*(i%2?-.29:.27),flank=side*(.57+i*.046);
      const joint=[flank,.29,z-.13];
      shaft('body',[side*.16,.47,z],joint,.082,.049,wave,.13,.51);
      shaft('body',joint,[flank+side*.105,.046,z+.09],.052,.024,wave,.13,.51);
    }
  }else if(id==='antler'){
    mantle([[.17,.78],[.19,1.22],[.24,1.91],[.33,2.13],[.16,2.37],[.085,2.48]],.62,1.4);
    oval('face',0,2.55,.016,.116,.195,.111);eyes(2.58,.120,.044,.024);
    for(const side of [-1,1]){
      shaft('body',[side*.075,1.50,.02],[side*.152,.085,-.02],.074,.037,side*.41,.19,1.50);
      shaft('body',[side*.265,2.16,0],[side*.406,.693,.153],.082,.029,-side*.30,.07,2.16);
      const root=[side*.073,2.641,-.021],fork=[side*.212,2.985,-.077];
      shaft('body',root,fork,.050,.027);
      shaft('body',fork,[side*.307,3.32,-.068],.028,.004);
      shaft('body',fork,[side*.398,3.12,.041],.021,.004);
    }
  }else if(id==='veil'){
    mantle([[.36,.126],[.32,.40],[.248,.87],[.284,1.26],[.338,1.56],[.205,1.84],[.09,1.94]],.74,2.3);
    oval('body',0,2.03,.002,.239,.305,.200);
    oval('face',0,2.0,.132,.141,.184,.092);eyes(2.01,.215,.051,.022);
    for(const side of [-1,1]){
      shaft('body',[side*.248,1.61,0],[side*.45,.614,.18],.13,.065,-side*.21,.067,1.6);
      if(near)shaft('face',[side*.447,.659,.164],[side*.499,.46,.218],.052,.031,-side*.21,.067,1.6);
    }
  }else{
    const porcelain=id==='guard',shoulder=porcelain?1.63:1.56,hip=porcelain?.91:.99;
    mantle([[porcelain?.34:.207,porcelain?.51:.87],[.225,1.03],[.29,shoulder],[.184,shoulder+.19],[.10,shoulder+.27]],porcelain?.70:.62,porcelain?.8:2.4);
    if(porcelain)oval('body',0,1.994,-.023,.201,.256,.177);
    oval('face',0,porcelain?2.015:1.90,porcelain?.092:.028,porcelain?.146:.126,.209,.118);
    eyes(porcelain?2.05:1.93,porcelain?.202:.141,.057,porcelain?.022:.016);
    for(const side of [-1,1]){
      const leg=side*(porcelain?.46:.59), lift=porcelain?.18:.25;
      const knee=[side*.139,.47,.151],ankle=[side*.162,.066,-.016];
      if(near){
        shaft('body',[side*.105,hip,.021],knee,.088,.059,leg,lift,hip);
        shaft('body',knee,ankle,.060,.039,leg,lift,hip);
        shaft('body',ankle,[side*.164,.055,.155],.046,.039,leg,lift,hip);
      }else shaft('body',[side*.105,hip,.021],ankle,.085,.039,leg,lift,hip);
      const bend=[side*.36,shoulder-.43,-.12];
      shaft('body',[side*.25,shoulder,-.011],bend,porcelain?.099:.076,.048,-side*.47,.078,shoulder);
      shaft(porcelain?'body':'face',bend,[side*.405,shoulder-.69,.34],.053,.033,-side*.47,.078,shoulder);
    }
  }
  return Object.fromEntries(Object.entries(layers).flatMap(([k,pieces])=>{
    if(!pieces.length)return [];
    const merged=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());
    return [[k,merged]];
  }));
}
