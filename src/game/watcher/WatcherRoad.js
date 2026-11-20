import { Vector3 } from 'three';
import { ROUTES } from '../world/sceneryLayout.js';
import { clearRushLane } from './WatcherRush.js';

// Make several physically clear cuts across each authored route. Either end
// can be the entrance; the choice is made in the explorer's current view.
export function createRoadCrossings(collision) {
  const routes=[];
  for(const {id,width,path} of ROUTES)for(let i=1;i<path.length;i++){
    const [a,b]=path[i-1], [x,z]=path[i], dx=x-a,dz=z-b,d=Math.hypot(dx,dz);
    if(d<3.9)continue;
    const ux=dx/d,uz=dz/d;
    for(const f of [.27,.51,.77]){
      const center=new Vector3(a+dx*f,0,b+dz*f), spread=width+1.23;
      for(const angle of [.24,-.24,0]){
        const shift=new Vector3(uz*Math.cos(angle)+ux*Math.sin(angle),0,-ux*Math.cos(angle)+uz*Math.sin(angle)).multiplyScalar(spread);
        const left=center.clone().sub(shift),right=center.clone().add(shift);
        if(!clearRushLane(collision,left,right))continue;
        routes.push({ id:`${id}/cross/${i}/${f}`, road:id, center, left,right,ux,uz,width });
        break;
      }
    }
  }
  return routes;
}

export function chooseRoadCrossing(routes,sight,feet,velocity,lastSide,lastId) {
  const options=[];
  const length=Math.hypot(velocity.x,velocity.z);
  if(length<.68)return null;
  for(const cut of routes){
    if(cut.id===lastId)continue;
    const {center,ux,uz,width}=cut, dx=center.x-feet.x,dz=center.z-feet.z, r=Math.hypot(dx,dz);
    const alignment = Math.abs(velocity.x*ux+velocity.z*uz)/length;
    if(r<(length>4.4?18.5:13.5) || r>33 || Math.abs(-dx*uz+dz*ux)>width+.88 || alignment<.56 || (dx*velocity.x+dz*velocity.z)<r*length*.48)continue;
    const spot={ pos:center, scale:1 };
    if(sight.bearing(spot)<.81 || !sight.observe(spot).visible)continue;
    options.push({cut,weight:Math.abs(r-19)-sight.bearing(spot)*3});
  }
  options.sort((a,b)=>a.weight-b.weight);
  for(const {cut} of options){
    const cameraLeft=sight.screenX({pos:cut.left,scale:1})<sight.screenX({pos:cut.right,scale:1})?cut.left:cut.right;
    const cameraRight=cameraLeft===cut.left?cut.right:cut.left;
    const side=-lastSide;
    const [from,to]=side>0?[cameraLeft,cameraRight]:[cameraRight,cameraLeft];
    return { id:cut.id, from,to,yaw:Math.atan2(to.x-from.x,to.z-from.z),side };
  }
  return null;
}
