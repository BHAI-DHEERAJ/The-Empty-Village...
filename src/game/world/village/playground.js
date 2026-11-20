import { Group, MathUtils, Vector3 } from 'three';
import { makeSeat } from '../../interaction/InteractionController.js';
import { ModelBatch } from './modeling.js';
import { table } from './props.js';

// Spring motion is bounded, and camera movement can be disabled separately
// without losing the ability to ride either piece of equipment.
function rocker(object, axis, limit, stiffness, type) {
  let angle = 0, velocity = 0, direction = 0, occupied = false;
  return {
    object, type,
    get occupied() { return occupied; },
    start(seat, reduced) { occupied = true; velocity += (seat.side ?? 1) * (reduced ? .12 : .49); },
    leave() { occupied = false; direction = 0; },
    pump(input, reduced) { direction = input * (reduced ? .23 : 1); },
    jolt() { if (!occupied) velocity += type === 'swing' ? .94 : .68; },
    tick(dt) {
      if (!occupied && Math.abs(angle) + Math.abs(velocity) < .002) {
        if (object.rotation[axis] === 0) return false;
        object.rotation[axis] = angle = velocity = 0;
        return true;
      }
      const steps = Math.max(1, Math.ceil(dt / .024)), h = dt / steps;
      for (let i = 0; i < steps; i++) {
        velocity += (direction * 2.8 - stiffness * angle - velocity * (occupied ? .65 : 1.09)) * h;
        angle += velocity * h;
        if (Math.abs(angle) > limit) { angle = MathUtils.clamp(angle, -limit, limit); velocity *= -.29; }
      }
      object.rotation[axis] = angle;
      return true;
    },
  };
}

export function addPlayground(b, p, collision, actions) {
  const minX=34,maxX=55,back=-33.85;
  for (const x of [minX,maxX]) for (let i=0;i<8;i++) {
    const z=back+i*1.32;
    b.box(p.brick,x,.36,z,.28,.72,1.29,{shadow:true});b.box(p.cement,x,.75,z,.34,.069,1.28);
    collision.addBox(x,z,.29,1.29,0,0,.79,'school-boundary');
  }
  const benches = [[38.2,-29.1,Math.PI/2],[51.8,-31.3,-Math.PI/2],[49.2,-24.7,Math.PI]];
  for (const [i,[x,z,ry]] of benches.entries()) {
    b.within(x,0,z,ry,a=>{
      table(a,p,0,0,0,1.64,.41,.47);
      a.box(p.wood,0,.75,-.20,1.63,.12,.081,{shadow:true});
      for(const s of [-1,1])a.box(p.rust,s*.65,.46,-.20,.059,.83,.067);
    });
    const solid=collision.addBox(x,z,1.65,.50,ry,0,.85,'playground-bench');
    actions.push(makeSeat({id:`yard-bench-${i}`,name:'मैदान की बेंच',at:new Vector3(x,.507,z),yaw:ry,ignore:[solid]}));
  }

  const cx=44.5,cz=-26.7;
  for(const s of [-1,1]){
    const x=cx+s*1.54;
    for(const q of [-1,1]){
      b.beam(p.dullTeal,[x,0,cz+q*.85],[x,2.39,cz],.047,7,true);
      b.box(p.cement,x,.032,cz+q*.85,.19,.071,.19);
      collision.addCircle(x,cz+q*.67,.13,1.45,0,'swing-leg');
    }
  }
  b.beam(p.rust,[cx-1.69,2.38,cz],[cx+1.69,2.38,cz],.055,8,true);
  for (const side of [-1,1]) {
    const x=cx+.67*side;
    const pivot=new Group();pivot.name='Chain swing pivot';pivot.position.set(x,2.35,cz);b.group.add(pivot);
    const model=new ModelBatch(pivot);
    for(const j of [-1,1]){
      model.ring(p.rust,j*.24,.004,0,.062,.011,{ry:Math.PI/2});
      for(let n=0;n<22;n++)model.ring(p.iron,j*.234,-.06-n*.077,0,.029,.0065,{ry:n%2?Math.PI*.5:.14,sx:.73,sy:1.36});
    }
    model.box(p.wood,0,-1.797,0,.59,.057,.223,{rz:side*.035,shadow:true});
    model.finish('Swing seat, links and weathered wood');
    const machine=rocker(pivot,'x',.345,6.15,'swing');
    actions.push(makeSeat({id:side<0?'yard-swing-west':'yard-swing-east',name:'चेन वाला झूला',label:'झूले पर बैठो',
      at:new Vector3(x,.582,cz), machine, eye:out=>{
        pivot.localToWorld(out.set(.009,-1.768,0));out.y+=.77;return out;
      }}));
  }

  const x=47.12,z=-30.12,h=.62;
  b.box(p.cement,x,.086,z,.63,.172,.52,{shadow:true});
  for(const s of [-1,1]){
    b.beam(p.iron,[x-.20,.15,z+s*.18],[x,h,z+s*.129],.043,7,true);
    b.beam(p.iron,[x+.20,.15,z+s*.18],[x,h,z+s*.129],.043,7,true);
  }
  b.beam(p.rust,[x,h,z-.24],[x,h,z+.24],.061,10);
  const base=collision.addBox(x,z,.60,.54,0,0,.66,'seesaw-base');
  const pivot=new Group();pivot.name='Seesaw beam pivot';pivot.position.set(x,h,z);b.group.add(pivot);
  const board=new ModelBatch(pivot);
  board.box(p.paintedWood,0,.047,0,2.91,.097,.193,{shadow:true});
  board.box(p.rust,0,.02,0,.29,.139,.222);
  for(const s of [-1,1]) {
    board.box(p.wood,s*1.18,.125,0,.49,.080,.391,{shadow:true,rz:s*.022});
    const xx=s*.89;
    board.cord(p.iron,[[xx,.07,-.11],[xx,.30,-.10],[xx,.37,0],[xx,.30,.10],[xx,.07,.11]],.016,{segments:10});
    board.box(p.rubber,s*1.37,-.04,0,.17,.088,.22);
  }
  board.finish('Seesaw with sprung plank and iron handles');
  const machine=rocker(pivot,'z',.301,5.4,'seesaw');
  for(const side of [-1,1]){
    const seat=makeSeat({id:`yard-seesaw-${side<0?'west':'east'}`,name:'ऊपर-नीचे वाला झूला',label:'झूला खेलो',at:new Vector3(x+side*1.18,h+.166,z),
      machine,ignore:[base],eye:out=>{pivot.localToWorld(out.set(side*1.18,.166,0));out.y+=.77;return out;}});
    seat.side=side;
    actions.push(seat);
  }
}
