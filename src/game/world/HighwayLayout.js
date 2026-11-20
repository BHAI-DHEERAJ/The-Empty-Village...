import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';

// The finale uses the same forest exit as the arrival, then a separate spur
// and motorway outside the investigation map. Distances are in world metres.
export const HIGHWAY = Object.freeze({
  x:-224, halfWidth:9.45, zMin:-218, zMax:268, mergeZ:38.6, vergeX:-210.7,
  laybyX:-203.2, laybyZ:70.4,
});
export const HIGHWAY_LANES = Object.freeze([
  {x:HIGHWAY.x+6.30,direction:1,speed:12.4,lead:62,slots:10},
  {x:HIGHWAY.x+2.65,direction:1,speed:15.0,lead:32,slots:9},
  {x:HIGHWAY.x-2.65,direction:-1,speed:14.2,lead:53,slots:10},
  {x:HIGHWAY.x-6.30,direction:-1,speed:11.7,lead:71,slots:9},
].map(Object.freeze));
export const EXIT_LANE = HIGHWAY_LANES[0];
export const SPUR_HALF_WIDTH=2.43, RAMP_HALF_WIDTH=2.36;
export const TRAFFIC_SIZE=Object.freeze({
  sedan:Object.freeze({halfWidth:.85,halfLength:2.13}),
  van:Object.freeze({halfWidth:.91,halfLength:2.32}),
  lorry:Object.freeze({halfWidth:1.07,halfLength:3.83}),
});

const points=[[-135,8.3],[-138.2,7.53],[-142.4,5.69],[-147.8,5.78],[-163.6,6.15],[-179.2,8.23],[-194.5,12.9],[-205.7,15.48],
  [-213.1,20.10],[-216.94,26.9],[EXIT_LANE.x,33.8],[EXIT_LANE.x,HIGHWAY.mergeZ]];
export const highwaySpur = new CatmullRomCurve3(points.map(([x,z])=>new Vector3(x,0,z)));
highwaySpur.arcLengthDivisions=640;
export const SPUR_LENGTH=highwaySpur.getLength();

const nodes=highwaySpur.getSpacedPoints(Math.ceil(SPUR_LENGTH));
const segments=nodes.slice(1).map(({x,z},i)=>{
  const {x:a,z:b}=nodes[i],dx=x-a,dz=z-b;
  return {a,b,dx,dz,n:dx*dx+dz*dz,minX:Math.min(a,x)-5,maxX:Math.max(a,x)+5};
});
export function spurEdge(x,z) {
  let edge=3;
  for(const {a,b,dx,dz,n,minX,maxX} of segments){
    if(x<minX||x>maxX)continue;
    const u=MathUtils.clamp(((x-a)*dx+(z-b)*dz)/n,0,1);
    edge=Math.min(edge,Math.hypot(x-a-u*dx,z-b-u*dz)-SPUR_HALF_WIDTH);
  }
  return edge;
}

// One closed procession per lane. The gap around the CRETA is authored at
// merge time (relTime = 0), not guessed from a random spawning timer.
const length=HIGHWAY.zMax-HIGHWAY.zMin;
export const HIGHWAY_TRAFFIC=Object.freeze(HIGHWAY_LANES.flatMap((lane,i)=>{
  return Array.from({length:lane.slots},(_,n)=>Object.freeze({
    // The fast lane has a pair of cars overtaking together, offset from the merge gap.
    lane, z:i===1&&n===lane.slots-1?lane.lead-16.8:lane.lead+n*length/lane.slots,
    kind:(i*7+n*3+n%3)%11<2?'lorry':(i+n)%5===0?'van':'sedan',
    paint:(i*3+n)%8,
  }));
}));
export function trafficZ(vehicle,relTime) {
  return HIGHWAY.zMin+MathUtils.euclideanModulo(vehicle.z-HIGHWAY.zMin+vehicle.lane.direction*vehicle.lane.speed*relTime,length);
}

const refugeOffset=[-18.5,-15.9,-12.8,-7.5,-5.7,-3.0,-1.4,.2,2.8,5.4,7.9,10.4,13.9,17.2,19.6,23.5];
export const HIGHWAY_WALKERS=Object.freeze(refugeOffset.map((offset,i)=>Object.freeze({
  x:HIGHWAY.vergeX+.05+(i%4)*.68,z:HIGHWAY.laybyZ+offset,style:i%6,
  direction:i%4>=2?-1:1,step:.85+(i%5)*.072,phase:i*1.997,idle:i===3||i===5||i===7||i===12,
})));

export function walkerZ(walker,t) {
  // Reflect along the protected sidewalk. There is no path across traffic.
  const from=HIGHWAY.laybyZ-24,to=HIGHWAY.laybyZ+30,span=to-from;
  const folded=MathUtils.euclideanModulo(walker.z-from+(walker.idle?0:walker.direction*walker.step*t),span*2);
  return {z:from+Math.min(folded,span*2-folded),direction:folded<=span?walker.direction:-walker.direction};
}
