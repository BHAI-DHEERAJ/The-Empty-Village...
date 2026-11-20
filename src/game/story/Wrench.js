// A small double-ended spanner, modelled in the same steel palette as the
// CRETA's engine. Local Y is up; the length of the tool is along Z.
export function modelWrench(batch, palette) {
  const steel = palette.iron, edge = palette.cement;
  batch.box(steel,0,0,-.025,.034,.018,.273,{rz:.035,shadow:true});
  batch.beam(edge,[0,.010,-.135],[0,.010,.103],.007,5);
  batch.ring(steel,0,0,.127,.037,.012,{rx:-Math.PI/2,shadow:true});
  batch.box(steel,0,0,-.168,.077,.020,.044);
  for (const side of [-1,1]) {
    batch.box(steel,side*.031,0,-.199,.018,.020,.057,{ry:side*.18,shadow:true});
    batch.box(edge,side*.029,.011,-.193,.008,.004,.045,{ry:side*.18});
  }
}
