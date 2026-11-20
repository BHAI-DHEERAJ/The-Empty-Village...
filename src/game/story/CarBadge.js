import { ExtrudeGeometry, MeshStandardMaterial, Path, Shape } from 'three';
import { nightMaterial } from '../world/shaders.js';
import { ModelBatch } from '../world/village/modeling.js';

// Cut lettering rather than a canvas decal: no mirrored back face, missing
// Latin font or coplanar depth fights when a shot gets close to the car.
const glyphs={
  C:[[[.78,1],[.19,1],[0,.81],[0,.19],[.19,0],[.78,0],[.78,.17],[.27,.17],[.18,.26],[.18,.74],[.27,.83],[.78,.83]]],
  R:[[[0,0],[0,1],[.61,1],[.78,.83],[.78,.57],[.62,.41],[.8,0],[.60,0],[.41,.39],[.18,.39],[.18,0]],[[.18,.56],[.53,.56],[.61,.64],[.61,.75],[.53,.83],[.18,.83]]],
  E:[[[0,0],[0,1],[.77,1],[.77,.83],[.18,.83],[.18,.61],[.66,.61],[.66,.44],[.18,.44],[.18,.17],[.77,.17],[.77,0]]],
  T:[[[0,1],[.80,1],[.80,.83],[.49,.83],[.49,0],[.31,0],[.31,.83],[0,.83]]],
  A:[[[0,0],[.29,1],[.51,1],[.80,0],[.62,0],[.55,.25],[.25,.25],[.18,0]],[[.30,.41],[.50,.41],[.40,.78]]],
};
export const CRETA_NAME='CRETA';
const advance=.99, total=advance*(CRETA_NAME.length-1)+.80;

export function mountCretaBadges(car){
  const metal=nightMaterial(new MeshStandardMaterial({color:0xe2dfd1,roughness:.39,metalness:.24,
    emissive:0x63584a,emissiveIntensity:.37}),'creta-chrome');
  const batch=new ModelBatch(car);
  const trace=(path,points,scale)=>{
    for(const [i,[x,y]] of points.entries())path[i?'lineTo':'moveTo'](x*scale,y*scale);
    path.closePath();
  };
  for(const [name,x,y,z,yaw,h] of [
    ['front',0,.936,-2.208,Math.PI,.113],['rear',0,.847,2.100,0,.123],['dash',-.185,1.105,-.355,0,.063],
  ]){
    batch.within(x,y,z,yaw,b=>{
      for(const [i,char] of [...CRETA_NAME].entries()){
        const shape=new Shape(),[outline,hole]=glyphs[char];trace(shape,outline,h);
        if(hole){const path=new Path();trace(path,hole,h);shape.holes.push(path);}
        b.add(new ExtrudeGeometry(shape,{depth:h*.082,bevelEnabled:false}),metal,h*(i*advance-total/2),-h/2,0);
      }
    });
    batch.finish(`CRETA badge · ${name}`);
  }
}
