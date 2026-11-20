import { PLAYER, WORLD } from '../../settings.js';

const CELL = 7;
const NO_SOLIDS = Object.freeze([]);
const cellKey = (x,z) => `${Math.floor(x / CELL)}:${Math.floor(z / CELL)}`;

function box(x,z,w,d, yaw, bottom, top, tag) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x,z,w:w/2,d:d/2,c,s,bottom,top,tag };
}
function local(item,x,z) {
  const a=x-item.x,b=z-item.z;
  return [a*item.c-b*item.s,a*item.s+b*item.c];
}
function includes(item,x,z,extra=0) {
  const [a,b]=local(item,x,z);
  return Math.abs(a)<=item.w+extra&&Math.abs(b)<=item.d+extra;
}

// The same vertical capsule footprint used by player movement, sampled before
// moving props are allowed to sweep through an occupied spot.
export function touchesBox(item, feet, radius = PLAYER.radius, height = PLAYER.height) {
  if (feet.y >= item.top - .012 || feet.y + height <= item.bottom + .008) return false;
  const [u,v] = local(item, feet.x, feet.z);
  return Math.hypot(Math.max(0, Math.abs(u)-item.w), Math.max(0, Math.abs(v)-item.d)) < radius;
}

function overlapsBox(a, b) {
  if (a.bottom >= b.top - .008 || a.top <= b.bottom + .008) return false;
  const [u, v] = local(a, b.x, b.z);
  if (b.radius != null) return Math.hypot(Math.max(0, Math.abs(u) - a.w), Math.max(0, Math.abs(v) - a.d)) < b.radius;
  const c = Math.abs(a.c * b.c + a.s * b.s), s = Math.abs(a.s * b.c - a.c * b.s);
  if (Math.abs(u) >= a.w + b.w * c + b.d * s || Math.abs(v) >= a.d + b.w * s + b.d * c) return false;
  const [x, z] = local(b, a.x, a.z);
  return Math.abs(x) < b.w + a.w * c + a.d * s && Math.abs(z) < b.d + a.w * s + a.d * c;
}

export function poseBox(item, x, z, yaw) {
  item.x = x; item.z = z; item.c = Math.cos(yaw); item.s = Math.sin(yaw);
}

// Test the finite segment, not an infinite ray. For ramps subtract the local
// slope from Y before clipping so a stair opening is still a real opening.
function rayHits(item, a, dx, dy, dz) {
  let t0=.0001,t1=.9999, y=a.y, low=item.bottom, high=item.top;
  const x=a.x-item.x,z=a.z-item.z;
  if(item.radius!=null){
    const A=dx*dx+dz*dz,B=x*dx+z*dz,C=x*x+z*z-item.radius*item.radius;
    if(A<1e-10){if(C>0)return false;}
    else{
      const delta=B*B-A*C;
      if(delta<0)return false;
      const root=Math.sqrt(delta);
      t0=Math.max(t0,(-B-root)/A);t1=Math.min(t1,(-B+root)/A);
    }
  }else{
    const u=x*item.c-z*item.s,v=x*item.s+z*item.c;
    const du=dx*item.c-dz*item.s,dv=dx*item.s+dz*item.c;
    if(Math.abs(du)<1e-8){if(Math.abs(u)>item.w)return false;}
    else{
      const p=(-item.w-u)/du,q=(item.w-u)/du;
      t0=Math.max(t0,Math.min(p,q));t1=Math.min(t1,Math.max(p,q));
    }
    if(Math.abs(dv)<1e-8){if(Math.abs(v)>item.d)return false;}
    else{
      const p=(-item.d-v)/dv,q=(item.d-v)/dv;
      t0=Math.max(t0,Math.min(p,q));t1=Math.min(t1,Math.max(p,q));
    }
    if(item.front!=null){
      const slope=(item.back-item.front)/(2*item.d);
      y-=item.front+(item.d-v)*slope;
      dy+=slope*dv;low=-.16;high=0;
    }
  }
  if(t0>t1)return false;
  if(Math.abs(dy)<1e-8)return y>=low&&y<=high;
  const p=(low-y)/dy,q=(high-y)/dy;
  return Math.max(t0,Math.min(p,q))<=Math.min(t1,Math.max(p,q));
}

export class CollisionWorld {
  constructor(ground = () => WORLD.groundY) {
    this.ground = ground;
    this.cells = new Map();
    this.solids = [];
    this.mobile = [];
    this.floors = [];
  }
  #insert(item, destination, reachX, reachZ) {
    destination.push(item);
    for(let z=Math.floor((item.z-reachZ-.59)/CELL);z<=Math.floor((item.z+reachZ+.59)/CELL);z++) {
      for(let x=Math.floor((item.x-reachX-.59)/CELL);x<=Math.floor((item.x+reachX+.59)/CELL);x++) {
        const key=`${x}:${z}`;
        if(!this.cells.has(key))this.cells.set(key,{solids:[],floors:[]});
        this.cells.get(key)[destination===this.solids?'solids':'floors'].push(item);
      }
    }
    return item;
  }
  addBox(x,z,w,d,yaw,bottom,top,tag='wall') {
    const item=box(x,z,w,d,yaw,bottom,top,tag);
    return this.#insert(item,this.solids,Math.abs(item.c)*item.w+Math.abs(item.s)*item.d,Math.abs(item.s)*item.w+Math.abs(item.c)*item.d);
  }
  // Index once around the hinge and its whole sweep; pose changes never leave
  // the registered cells and never allocate new solids each frame.
  addHingedBox(x,z,w,d,bottom,top,tag='moving-door') {
    const envelope=Math.hypot(w,d/2)+.06;
    return this.#insert(box(x,z,w,d,0,bottom,top,tag),this.solids,envelope,envelope);
  }
  // The village has just two vehicles. Query them separately so moving one
  // doesn't have to rebuild the static broad-phase or leave stale grid entries.
  addMobileBox(x,z,w,d,yaw,bottom,top,tag='vehicle') {
    const item=box(x,z,w,d,yaw,bottom,top,tag);
    this.solids.push(item);
    this.mobile.push(item);
    return item;
  }
  boxOccupied(item, ignore) {
    for (const body of this.mobile) if (body !== ignore && overlapsBox(item,body)) return true;
    const wx=Math.abs(item.c)*item.w+Math.abs(item.s)*item.d, wz=Math.abs(item.s)*item.w+Math.abs(item.c)*item.d;
    for(let z=Math.floor((item.z-wz)/CELL);z<=Math.floor((item.z+wz)/CELL);z++) {
      for(let x=Math.floor((item.x-wx)/CELL);x<=Math.floor((item.x+wx)/CELL);x++) {
        const cell=this.cells.get(`${x}:${z}`);
        if(!cell)continue;
        for(const body of cell.solids) if (body !== ignore && overlapsBox(item,body)) return true;
        for(const floor of cell.floors) if (Number.isFinite(floor.bottom) && overlapsBox(item,floor)) return true;
      }
    }
    return false;
  }
  addCircle(x,z,radius,top,bottom=0,tag='trunk') {
    if(!(radius>0))return null;
    return this.#insert({x,z,radius,top,bottom,tag},this.solids,radius,radius);
  }
  addFloor(x,z,w,d,yaw,top,{thickness=.17, tag='floor', oneSided=false}={}) {
    const item=box(x,z,w,d,yaw,oneSided ? -Infinity : top-thickness,top,tag);
    return this.#insert(item,this.floors,Math.abs(item.c)*item.w+Math.abs(item.s)*item.d,Math.abs(item.s)*item.w+Math.abs(item.c)*item.d);
  }
  addRamp(x,z,w,d,yaw,front,back) {
    const item=box(x,z,w,d,yaw,-Infinity,Math.max(front,back),'stair');
    item.front=front;item.back=back;
    return this.#insert(item,this.floors,Math.abs(item.c)*item.w+Math.abs(item.s)*item.d,Math.abs(item.s)*item.w+Math.abs(item.c)*item.d);
  }
  supportAt(x,z,maxY=Infinity) {
    const ground=this.ground(x,z);
    let y=ground<=maxY ? ground : -Infinity;
    for(const floor of this.cells.get(cellKey(x,z))?.floors??[]) {
      const [u,v]=local(floor,x,z);
      if(Math.abs(u)>floor.w+.035 || Math.abs(v)>floor.d+.035)continue;
      const top=floor.front==null ? floor.top : floor.front+(floor.back-floor.front)*Math.max(0,Math.min(1,(floor.d-v)/(2*floor.d)));
      if(y<top&&top<=maxY)y=top;
    }
    return y;
  }
  ceilingAt(x,z,headBefore,headAfter) {
    let y=Infinity;
    for(const floor of this.cells.get(cellKey(x,z))?.floors??[]) {
      if(floor.bottom>=headBefore-.028&&floor.bottom<headAfter&&floor.bottom<y&&includes(floor,x,z,.018))y=floor.bottom;
    }
    return y;
  }
  // Floor edges can be roofs when approached from underneath (especially beside
  // the mansion's stairwell). Keep the head out while preserving legal step-ups.
  headroomAt(x,z,feet,height=PLAYER.height) {
    return !(this.cells.get(cellKey(x,z))?.floors??[]).some(floor=>
      Number.isFinite(floor.bottom) && feet<floor.top-.024 && feet+height>floor.bottom+.008 &&
      includes(floor,x,z,.016));
  }
  // A read-only LOS query. Walk only the cells touched by the segment, and
  // test each wall, pillar, trunk, or slab at most once, regardless of its size.
  blocksSight(from,to,ignore) {
    const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z;
    for (const item of this.mobile) if (!ignore?.includes(item) && rayHits(item,from,dx,dy,dz)) return true;
    let x=Math.floor(from.x/CELL),z=Math.floor(from.z/CELL);
    const endX=Math.floor(to.x/CELL),endZ=Math.floor(to.z/CELL);
    const sx=Math.sign(dx),sz=Math.sign(dz),tx=dx===0?Infinity:CELL/Math.abs(dx),tz=dz===0?Infinity:CELL/Math.abs(dz);
    let nextX=dx===0?Infinity:((x+(sx>0?1:0))*CELL-from.x)/dx;
    let nextZ=dz===0?Infinity:((z+(sz>0?1:0))*CELL-from.z)/dz;
    const tested=new Set();
    for(;;){
      const cell=this.cells.get(`${x}:${z}`);
      if(cell){
        for(const item of cell.solids){
          if(tested.has(item)||ignore?.includes(item))continue;
          if(rayHits(item,from,dx,dy,dz))return true;
          tested.add(item);
        }
        for(const item of cell.floors){
          if(tested.has(item)||!Number.isFinite(item.bottom)&&item.front==null)continue;
          if(rayHits(item,from,dx,dy,dz))return true;
          tested.add(item);
        }
      }
      if(x===endX&&z===endZ)return false;
      if(z===endZ||x!==endX&&nextX<=nextZ){x+=sx;nextX+=tx;}
      else{z+=sz;nextZ+=tz;}
    }
  }
  resolve(position,velocity,radius=PLAYER.radius,height=PLAYER.height,ignore) {
    for(let pass=0;pass<3;pass++) {
      let touched=false;
      const locals=this.cells.get(cellKey(position.x,position.z))?.solids??NO_SOLIDS;
      for(let i=0;i<locals.length+this.mobile.length;i++) {
        const item=i<locals.length?locals[i]:this.mobile[i-locals.length];
        if(item===ignore||position.y>=item.top-.012||position.y+height<=item.bottom+.008)continue;
        let nx,nz,penetration;
        if(item.radius!=null) {
          const x=position.x-item.x,z=position.z-item.z;
          const distance=Math.hypot(x,z);
          penetration=radius+item.radius-distance;
          if(!(penetration>0))continue;
          nx=distance>.0001?x/distance:1;nz=distance>.0001?z/distance:0;
        } else {
          const [u,v]=local(item,position.x,position.z);
          const nearX=Math.max(-item.w,Math.min(item.w,u)),nearZ=Math.max(-item.d,Math.min(item.d,v));
          const dx=u-nearX,dz=v-nearZ,dist=Math.hypot(dx,dz);
          if(dist>=radius)continue;
          let ax,az;
          if(dist>.0001){ax=dx/dist;az=dz/dist;penetration=radius-dist;}
          else if(item.w-Math.abs(u)<item.d-Math.abs(v)){ax=Math.sign(u)||1;az=0;penetration=radius+item.w-Math.abs(u);}
          else{ax=0;az=Math.sign(v)||1;penetration=radius+item.d-Math.abs(v);}
          nx=ax*item.c+az*item.s;nz=-ax*item.s+az*item.c;
        }
        touched=true;
        position.x+=nx*(penetration+1e-5);position.z+=nz*(penetration+1e-5);
        const impact=velocity.x*nx+velocity.z*nz;
        if(impact<0){velocity.x-=nx*impact;velocity.z-=nz*impact;}
      }
      if(!touched)break;
    }
  }
}
