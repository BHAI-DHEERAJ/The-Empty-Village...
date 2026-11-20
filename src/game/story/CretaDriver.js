import { CylinderGeometry, Group, MathUtils, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { ModelBatch } from '../world/village/modeling.js';
import { ESCAPE } from './CretaFinale.js';

export function createCretaDriver(car, palette, wheel) {
  const group=new Group(),body=new Group(),head=new Group();
  group.name='Krish · driver';group.visible=false;car.add(group);group.add(body);body.add(head);
  const skin=new MeshStandardMaterial({color:0xab7654,roughness:.85});
  const jacket=new ModelBatch(body);
  jacket.ball(palette.leather,.398,1.03,.267,.192,{sx:1.12,sy:1.40,sz:.64});
  jacket.ball(skin,.389,1.275,.245,.060,{sx:1.02,sy:1.25,sz:1.02});
  jacket.finish('Krish · jacket');
  head.position.set(.389,1.422,.244);
  const face=new ModelBatch(head);
  face.ball(skin,0,0,0,.098,{sx:.89,sy:1.19,sz:1.05});
  face.ball(skin,0,-.019,-.095,.026,{sx:.76,sy:1.18,sz:1.25});
  face.ball(palette.rubber,0,.035,.021,.098,{sx:.94,sy:.97,sz:.97});
  face.finish('Krish · face and hair');
  const forearm=new CylinderGeometry(.042,.062,1,8),up=new Vector3(0,1,0);
  const wrist=new Vector3(),delta=new Vector3(),grip=new Vector3(),elbow=new Vector3();
  const arms=[-1,1].map(side=>{
    const sleeve=new Mesh(forearm,palette.leather);
    const hand=new Group(),bat=new ModelBatch(hand);
    bat.ball(palette.rubber,0,0,0,.052,{sy:.68,sz:1.10});bat.finish('Krish · driving glove');
    group.add(sleeve,hand);
    return {side,sleeve,hand};
  });
  return {
    hide(){group.visible=false;},
    pose(t,shot,reduced){
      group.visible=true;body.visible=shot!=='cockpit'&&shot!=='restart'&&shot!=='windshield';
      head.rotation.y=reduced?0:wheel.rotation.z*.35;
      const crank=MathUtils.smoothstep(t,ESCAPE.restart+.02,ESCAPE.restart+.32)
        *(1-MathUtils.smoothstep(t,ESCAPE.catch,ESCAPE.reverse+.35));
      const c=Math.cos(wheel.rotation.z),s=Math.sin(wheel.rotation.z);
      for(const {side,sleeve,hand} of arms){
        const u=.167*side,v=.066;
        grip.copy(wheel.position).add(wrist.set(u*c-v*s,u*s+v*c,-.022));
        if(side>0)grip.lerp(wrist.set(.581,.957,-.323),crank);
        hand.position.copy(grip);hand.rotation.set(-.24,side*.23,wheel.rotation.z);
        elbow.set(.392+side*.172,.964,.261);delta.copy(grip).sub(elbow);
        sleeve.scale.y=delta.length();sleeve.position.copy(elbow).addScaledVector(delta,.51);
        sleeve.quaternion.setFromUnitVectors(up,delta.normalize());
      }
    },
  };
}
