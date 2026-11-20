// Keep the standard Three.js PBR and shadow pipeline. Integrate a shallow, moving
// layer of cool air near the ground without baking haze into any surface image.
export const fogClock = {value:0};
export function nightMaterial(material,name,extend=()=>{}){
  material.customProgramCacheKey=()=>`empty-village/night/${name}`;
  material.onBeforeCompile=(shader)=>{
    extend(shader);
    shader.uniforms.uFogClock=fogClock;
    shader.vertexShader=`varying vec3 vNightWorld;\n${shader.vertexShader}`.replace(
      '#include <fog_vertex>',
      /* glsl */`#include <fog_vertex>
        vec4 nightWorld=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          nightWorld=instanceMatrix*nightWorld;
        #endif
        vNightWorld=(modelMatrix*nightWorld).xyz;
      `);
    shader.fragmentShader=`uniform float uFogClock; varying vec3 vNightWorld;\n${shader.fragmentShader}`.replace(
      '#include <fog_fragment>',
      /* glsl */`
      #ifdef USE_FOG
        float range=length(cameraPosition-vNightWorld);
        float zone=(1.-smoothstep(-56.,-33.,vNightWorld.x))*smoothstep(-86.,-46.,vNightWorld.z);
        float underside=exp(-max((vNightWorld.y+cameraPosition.y)*.5-.12,0.)*.44);
        float flow=.83+.19*sin(vNightWorld.x*.139+vNightWorld.z*.075-uFogClock*.36)
                       +.10*sin(vNightWorld.z*.151+vNightWorld.x*.046+uFogClock*.23);
        float fogDepth=range*fogDensity*(.82+.42*zone+(.25+.30*zone)*underside*flow);
        float air=1.-exp(-fogDepth*fogDepth);
        float drift=(.12+.06*zone)*underside*flow*smoothstep(5.,37.,range);
        gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,air+(1.-air)*drift);
      #endif
      `);
  };
  return material;
}
