import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { WORLD } from '../settings.js';

// The low crooked-village skyline leaves the moon to the right of the main road.
export const moonDirection = new Vector3(.39,.36,-.865).normalize();
export const sunDirection = new Vector3(-.84,.38,.40).normalize();
const east=new Vector3().crossVectors(moonDirection,new Vector3(0,1,0)).normalize();
const up=new Vector3().crossVectors(east,moonDirection).normalize();

export function createSky(scene,textures){
  const uniforms={uNight:{value:textures.sky.albedo},uCloud:{value:textures.fog.albedo},uMoon:{value:textures.lunar.albedo},
    uHorizon:{value:new Color(WORLD.fogColor)},uTime:{value:0},uFlash:{value:0},uDay:{value:0},uStorm:{value:0},
    uSunDir:{value:sunDirection},uMoonDir:{value:moonDirection},uEast:{value:east},uUp:{value:up}};
  const m=new ShaderMaterial({side:BackSide,depthWrite:false,toneMapped:false,uniforms,
    vertexShader:/* glsl */`varying vec3 vSky;void main(){vSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:/* glsl */`
      uniform sampler2D uNight,uCloud,uMoon;
      uniform vec3 uHorizon,uSunDir,uMoonDir,uEast,uUp;
      uniform float uTime,uFlash,uDay,uStorm;
      varying vec3 vSky;
      void main(){
        vec3 ray=normalize(vSky);
        float h=max(.0,ray.y);
        float angle=atan(ray.x,-ray.z);
        // The panorama supplies the real cloud and star detail; the alternate crop avoids
        // duplicating the panorama's low photographic glare under our separate moon.
        vec2 UV=vec2(fract(.174+angle*.15915+uTime*.00019),.538+asin(clamp(ray.y,-.99,.99))*.308);
        vec3 photo=texture2D(uNight,UV).rgb;
        vec3 blue=vec3(.006,.011,.024)+photo*vec3(.22,.30,.40);
        vec3 sky=mix(uHorizon,blue,smoothstep(-.055,.29,ray.y));
        vec2 cloudP=vec2(fract(.29+angle*.33+uTime*.0012),clamp(.36+h*.87,0.,1.));
        vec4 cloud=texture2D(uCloud,cloudP);
        float toward=max(0.,dot(uMoonDir,ray));
        float halo=pow(toward,29.)*.061+pow(toward,240.)*.083;
        vec2 disk=.5+vec2(dot(ray,uEast),dot(ray,uUp))/.049;
        vec3 lunar=vec3(0.);
        if(toward>.97&&all(greaterThan(disk,vec2(0.)))&&all(lessThan(disk,vec2(1.))))lunar=texture2D(uMoon,disk).rgb;
        sky+=vec3(.32,.44,.72)*halo*(.76+cloud.a*.57);
        sky+=lunar*vec3(.69,.79,.97)*(1.-cloud.a*.56);
        sky=mix(sky,blue*1.19+vec3(.019,.026,.047)+cloud.rgb*.09,cloud.a*.29*smoothstep(.031,.23,h));
        float farFlash=pow(max(0.,dot(ray,normalize(vec3(-.74,.18,-.63)))),9.);
        float sundot=max(0.,dot(ray,uSunDir));
        vec3 day=mix(vec3(.75,.60,.43),vec3(.20,.42,.65),smoothstep(-.06,.66,ray.y));
        day=mix(day,vec3(.67,.65,.59)+cloud.rgb*.20,cloud.a*.67);
        day+=vec3(.98,.61,.25)*(pow(sundot,30.)*.36+smoothstep(.9990,.9996,sundot)*.65);
        sky=mix(sky,day,uDay);
        sky=mix(sky,vec3(.046,.064,.089)+cloud.rgb*.035,uStorm*(.43+h*.26));
        sky+=(vec3(.09,.12,.20)+vec3(.33,.43,.64)*farFlash)*uFlash;
        gl_FragColor=vec4(sky,1.);
        #include <colorspace_fragment>
      }
    `});
  const dome=new Mesh(new SphereGeometry(290,36,24),m);
  dome.name='Photographed night sky and lunar disc';dome.frustumCulled=false;dome.renderOrder=-20;scene.add(dome);
  return {update(time,view,flash,daylight=0,storm=0){
    dome.position.copy(view.position);uniforms.uTime.value=time;uniforms.uFlash.value=flash;
    uniforms.uDay.value=daylight;uniforms.uStorm.value=storm;
  }};
}
