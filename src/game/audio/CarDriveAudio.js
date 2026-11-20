import { carMotion, INTRO, SHIFTS } from '../story/IntroSequence.js';
import { seededRandom } from '../world/random.js';

const TAU=Math.PI*2;
const shift=(at,from,to)=>[[at-.15,from,.62],[at+.11,to,.26],[at+.63,to+4,.50]];
const MOTOR=[ // Story seconds, cylinder rhythm (Hz), engine load.
  [0,31,0],[.33,31,.04],[.56,37,.30],[.80,52,.70],[1.12,47,.53],
  ...shift(SHIFTS[0],63,43),[7.8,54,.53],[INTRO.dial,49,.40],[19.9,56,.51],
  ...shift(SHIFTS[1],64,46),[31.4,51,.49],[INTRO.milestone,55,.57],[42.8,56,.52],
  ...shift(SHIFTS[2],58,42),[51.2,49,.51],[INTRO.brake,46,.38],
  [INTRO.end-2.25,36,.30],[INTRO.end-1.0,37,.21],[INTRO.end,25,.085],
];
export function rideMix(time){
  const speed=carMotion(time).speed;
  const t=Math.min(MOTOR.at(-1)[0],Math.max(0,time));
  const i=Math.max(1,MOTOR.findIndex(row=>row[0]>=t));
  const [a,p0,l0]=MOTOR[i-1],[b,p1,l1]=MOTOR[i];
  const u=(t-a)/(b-a);
  const flutter=1+Math.sin(t*9.1)*.014+Math.sin(t*3.35)*.018;
  return {speed,rpm:(p0+(p1-p0)*u)*flutter,load:l0+(l1-l0)*u};
}

// All effects are original, local PCM. Stagger the short transients so a key
// click, the starter skipping teeth, shifting and gravel don't sound alike.
const SHOTS=Object.fromEntries(Object.entries({
  'car-key': [.31,.15,780,250,[0,.107],'metal',.48],
  'car-crank': [.56,.24,61,89,[0,.070,.144,.223,.295],'ratchet',.72],
  'car-catch': [.68,.28,41,75,[0,.09,.15,.196,.24,.29,.34,.39,.44,.49],'ratchet',.40],
  'car-shift': [.48,.16,165,107,[0,.14,.211],'metal',.53],
  'car-radio': [.26,.088,607,357,[0,.059],'switch',.41],
  'car-gravel': [.50,.116,288,165,[0,.037,.122,.203,.257],'gravel',.47],
  'car-rattle': [.45,.127,344,247,[0,.033,.062,.157,.184],'metal',.29],
  'car-letter': [.57,.105,846,399,[0,.063,.185,.285,.375],'paper',-.37],
  'car-branch': [.74,.224,1034,572,[0,.055,.173,.344,.433],'scrape',.73],
  'car-brake': [.69,.147,1412,620,[0,.395],'brake',.49],
  'car-passing': [1.64,.22,133,69,[],'passing',-.64],
  'car-cough': [.52,.175,59,27,[0,.13,.29],'ratchet',.65],
  'car-tree-hit': [.93,.34,117,41,[0,.07,.224,.41],'impact',-.52],
  'car-stop': [.89,.147,107,53,[0,.12,.389,.64],'settle',.47],
}).map(([id,[duration,volume,f0,f1,impacts,kind,pan]])=>[id,{duration,volume,f0,f1,impacts,kind,pan}]));

export function carShot(context,id){
  if(!Object.hasOwn(SHOTS,id))return null;
  const {duration,f0,f1,impacts,kind}=SHOTS[id],rate=context.sampleRate;
  const buffer=context.createBuffer(1,Math.ceil(rate*duration),rate),out=buffer.getChannelData(0);
  const random=seededRandom(id.length*8491+f0);
  let phase=0,slow=0,mid=0;
  for(let i=0;i<out.length;i++){
    const t=i/rate,x=t/duration,n=random()*2-1;
    slow+=.056*(n-slow);mid+=.24*(n-mid);
    const sweep=kind==='passing'?.5+.5*Math.tanh((x-.43)*8):x;
    phase+=(f0+(f1-f0)*sweep)*(1+Math.sin(t*36)*.036)/rate;
    const tone=Math.sin(TAU*phase);
    let burst=0;
    for(const hit of impacts){
      const age=t-hit;
      if(age>=0)burst+=Math.min(1,age*547)*Math.exp(-age*(kind==='ratchet'?24:kind==='gravel'?39:34))*(1-hit/duration*.66);
    }
    let value;
    if(kind==='impact')value=(.57*tone+.84*slow+.29*mid+.27*(n-mid)*Math.exp(-t*13))*burst;
    else if(kind==='ratchet')value=(.43*tone+.22*Math.sin(TAU*phase*2.91)+.68*slow+.24*(mid-slow))*burst;
    else if(kind==='gravel')value=(.55*mid+.31*(n-mid)+.16*tone)*burst;
    else if(kind==='paper')value=(.21*tone+.64*(n-mid))*(.66+.34*Math.sin(t*43))*burst;
    else if(kind==='scrape')value=(.43*mid+.42*(n-mid)+.14*tone)*burst+.18*(mid-slow)*Math.sin(Math.PI*x)**2;
    else if(kind==='passing')value=(.36*tone+.13*Math.sin(TAU*phase*2)+.75*slow+.39*mid)*Math.sin(Math.PI*x)**2.3;
    else if(kind==='brake')value=(.30*tone+.10*Math.sin(TAU*phase*2.07)+.41*mid)*Math.sin(Math.PI*x)**1.55+.21*slow*burst;
    else if(kind==='settle')value=(.45*tone*Math.exp(-t*5)+.38*slow+.14*Math.sin(TAU*phase*11))*burst;
    else value=(.37*tone+.18*Math.sin(TAU*phase*2.37)+.31*mid)*burst;
    out[i]=value*Math.min(1,(duration-t)*35);
  }
  return buffer;
}

// Uneven layers of heels, dirt, and a low ground rumble. Wrap the hits
// across the buffer edge so the rolling footfalls don't have a loop gap.
export function hordeFootfalls(context){
  const rate=context.sampleRate, size=Math.ceil(3.7*rate), body=context.createBuffer(1,size,rate);
  const data=body.getChannelData(0),random=seededRandom(84491);
  for(let i=0;i<54;i++){
    const start=Math.floor((i+random()*.89)/54*size),salt=52+random()*134,weight=.18+random()*.47;
    let grit=0;
    for(let n=0;n<.23*rate;n++){
      const t=n/rate, noise=random()*2-1;
      grit+=.17*(noise-grit);
      const kick=Math.sin(TAU*salt*t*(1-t*.8))*.49*Math.exp(-t*27);
      const heel=(grit*.56+noise*.13)*Math.exp(-t*17);
      data[(start+n)%size]+=weight*Math.min(1,t*380)*(kick+heel);
    }
  }
  for(let i=0;i<size;i++)data[i]=Math.tanh(data[i]);
  return body;
}

export function createCarDriveAudio(context,output){
  let drive,roadBed,crowdBed;
  const shots=new Map();
  const filter=(type,hz,q=.72)=>{
    const f=context.createBiquadFilter();f.type=type;f.frequency.value=hz;f.Q.value=q;return f;
  };
  const gain=(level=0)=>{const g=context.createGain();g.gain.value=level;return g;};
  const noise=()=>{
    const random=seededRandom(7719),duration=3.1;
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate);
    const p=buffer.getChannelData(0);let drift=0;
    for(let i=0;i<p.length;i++){
      const n=random()*2-1;drift+=.24*(n-drift);
      p[i]=(n*.49+drift*.90)*Math.min(1,i/280,(p.length-i-1)/280);
    }
    return buffer;
  };
  function begin(){
    const engine=context.createOscillator(),jitter=context.createOscillator(),variation=gain(1.27);
    const wave=context.createPeriodicWave(new Float32Array(8),Float32Array.of(0,.63,.37,.23,.17,.107,.082,.046));
    engine.setPeriodicWave(wave);engine.frequency.value=38;
    jitter.frequency.value=13.9;jitter.connect(variation).connect(engine.frequency);
    const hood=filter('lowpass',328,.88),volume=gain(),road=gain(),air=gain();
    const dust=filter('bandpass',233,.42),wind=filter('bandpass',913,.56);
    const tires=context.createBufferSource();tires.buffer=roadBed??=noise();tires.loop=true;
    engine.connect(hood).connect(volume).connect(output);
    tires.connect(dust).connect(road).connect(output);
    tires.connect(wind).connect(air).connect(output);
    engine.start();jitter.start();tires.start();
    return {engine,jitter,variation,hood,volume,road,air,dust,wind,tires};
  }
  function stop(abrupt=false){
    if(!drive)return;
    const graph=drive;drive=null;
    const time=context.currentTime,duration=abrupt?.12:.54;
    for(const node of [graph.volume,graph.road,graph.air,graph.crowdLevel])node?.gain.setTargetAtTime(0,time,abrupt?.027:.11);
    graph.engine.frequency.setTargetAtTime(16,time,.16);
    for(const source of [graph.engine,graph.jitter,graph.tires,graph.crowdSource])source?.stop(time+duration);
    graph.engine.onended=()=>{for(const node of Object.values(graph))node.disconnect();};
  }
  return {
    update(t,{rpm,load,speed,crowd=0,paved=0}=rideMix(t)){
      drive??=begin();
      const now=context.currentTime;
      if(crowd>.005&&!drive.crowdSource){
        drive.crowdLevel=gain();drive.crowdLevel.connect(output);
        drive.crowdSource=context.createBufferSource();
        drive.crowdSource.buffer=crowdBed??=hordeFootfalls(context);drive.crowdSource.loop=true;
        drive.crowdSource.connect(drive.crowdLevel);drive.crowdSource.start();
      }
      drive.crowdLevel?.gain.setTargetAtTime(crowd*.48,now,.18);
      drive.engine.frequency.setTargetAtTime(rpm,now,.073);
      drive.volume.gain.setTargetAtTime(load*.14,now,load===0?.053:.085);
      drive.hood.frequency.setTargetAtTime(204+load*306,now,.16);
      const gravel=1-.14*Math.min(1,Math.max(0,(t-INTRO.homes)/3));
      drive.dust.frequency.setTargetAtTime(233+paved*178,now,.16);
      drive.road.gain.setTargetAtTime(.13*speed*gravel*(.88+.12*(1-paved)*Math.sin(t*8.7))*(1-.39*paved),now,.13);
      drive.air.gain.setTargetAtTime(.079*speed**1.6,now,.18);
    },
    cue(id){
      if(!Object.hasOwn(SHOTS,id))return;
      if(!shots.has(id))shots.set(id,carShot(context,id));
      const {volume,pan}=SHOTS[id];
      const source=context.createBufferSource(),level=gain(volume);source.buffer=shots.get(id);
      const stereo=context.createStereoPanner?.();
      source.connect(level);
      if(stereo){
        stereo.pan.value=pan;
        if(id==='car-passing'){
          stereo.pan.setValueAtTime?.(pan,context.currentTime);
          stereo.pan.linearRampToValueAtTime?.(.52,context.currentTime+SHOTS[id].duration);
        }
        level.connect(stereo).connect(output);
      }else level.connect(output);
      source.onended=()=>{source.disconnect();level.disconnect();stereo?.disconnect();};
      source.start();
    },
    stop,
  };
}
