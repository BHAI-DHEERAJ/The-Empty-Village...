import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { carShot, createCarDriveAudio, hordeFootfalls, rideMix } from '../src/game/audio/CarDriveAudio.js';
import { ESCAPE, ESCAPE_CUES, escapeMotor, escapeVolume } from '../src/game/story/CretaFinale.js';
import { VOICE_LINES } from '../src/game/audio/VoiceLines.js';
import { RADIO_TRACK } from '../src/game/audio/RadioTrack.js';
import { CAR_BEATS, carMotion, INTRO, SHIFTS } from '../src/game/story/IntroSequence.js';
import { VILLAGE_EN_LABEL, VILLAGE_LABEL } from '../src/game/world/VillageName.js';

test('starter, acceleration, shift and braking follow the camera ride',()=>{
  assert.equal(INTRO.end,60);
  assert.deepEqual(carMotion(0),{position:0,speed:0});
  assert.deepEqual(carMotion(INTRO.end),{position:1,speed:0});
  assert.ok(carMotion(1.5).speed>0&&carMotion(1.5).speed<1);
  assert.equal(carMotion(8).speed,1);
  assert.ok(carMotion(INTRO.end-.5).speed<.25);
  let last=0;
  for(let t=0;t<=INTRO.end;t+=.05){
    const {position}=carMotion(t);
    assert.ok(position>=last&&position<=1);
    const {rpm,load,speed}=rideMix(t);
    assert.ok(rpm>0&&rpm<80&&load>=0&&load<1&&speed>=0&&speed<=1,`motor mix at ${t}s`);
    last=position;
  }
  for(const at of SHIFTS){
    assert.ok(rideMix(at-.15).rpm>rideMix(at+.11).rpm+10);
    assert.ok(rideMix(at-.15).load>rideMix(at+.11).load);
  }
  assert.ok(rideMix(INTRO.milestone).load>.4);
  assert.ok(rideMix(INTRO.brake).rpm>rideMix(INTRO.end).rpm+10);
  assert.equal(rideMix(0).load,0);
});

test('each authored car cue has a distinct local sample with a non-clipping signal',()=>{
  const rate=12000;
  const context={sampleRate:rate,createBuffer(channels,n,fs){
    assert.equal(channels,1);assert.equal(fs,rate);
    const data=new Float32Array(n);return {getChannelData:()=>data};
  }};
  const names=[...new Set([...CAR_BEATS,...ESCAPE_CUES].map(([,id])=>id).filter(id=>id.startsWith('car-'))), 'car-stop'];
  assert.ok(names.includes('car-branch')&&names.includes('car-passing'));
  const hashes=new Set();
  for(const id of names){
    const data=carShot(context,id).getChannelData();
    const peak=data.reduce((p,x)=>Math.max(Math.abs(x),p),0);
    const energy=data.reduce((e,x)=>e+x*x,0)/data.length;
    assert.ok(peak>.14&&peak<1,id);
    assert.ok(energy>.0002,id);
    hashes.add(`${data.length}/${energy.toFixed(6)}`);
  }
  assert.equal(hashes.size,names.length);
});

test('one-shot playback wires a finite volume and stereo position into the audio graph',()=>{
  let starts=0,pans=0;
  const param=(lo,hi)=>({set value(n){assert.ok(Number.isFinite(n)&&n>=lo&&n<=hi);}});
  const node=(props={})=>({connect(next){return next;},disconnect(){},...props});
  const context={sampleRate:8000,
    createBuffer(channels,n){const data=new Float32Array(n);return {getChannelData:()=>data};},
    createBufferSource:()=>node({start(){assert.ok(this.buffer);starts++;}}),
    createGain:()=>node({gain:param(0,1)}),
    createStereoPanner:()=>{pans++;return node({pan:param(-1,1)});},
  };
  const audio=createCarDriveAudio(context,node());
  for(const [,id] of CAR_BEATS)audio.cue(id);
  audio.cue('car-stop');audio.cue('car-passing');
  assert.equal(starts,CAR_BEATS.length+2);assert.equal(pans,starts);
});

test('the chase mixes footfalls and the song across a timed engine cut and restart',()=>{
  const before=escapeMotor(ESCAPE.pursuit),stalled=escapeMotor(ESCAPE.impact+2),running=escapeMotor(ESCAPE.breakaway+2);
  assert.ok(before.speed>.8&&before.load>.5);
  assert.equal(stalled.load,0);assert.ok(stalled.crowd>before.crowd);
  assert.equal(escapeMotor(ESCAPE.catch-.03).load,0);
  assert.ok(escapeMotor(ESCAPE.catch).load>0&&running.load>.5);
  assert.equal(escapeMotor(ESCAPE.dawn).crowd,0);
  assert.equal(escapeMotor(ESCAPE.brush).paved,0);
  assert.equal(escapeMotor(ESCAPE.highway).paved,1);
  assert.equal(escapeMotor(ESCAPE.end).speed,0);
  assert.ok(escapeVolume(ESCAPE.pursuit)>.7&&escapeVolume(ESCAPE.impact+1)<.4);
  assert.ok(escapeVolume(ESCAPE.breakaway+1.5)>.7&&escapeVolume(ESCAPE.end)<.05);
  for(const [,id] of ESCAPE_CUES.filter(([,id])=>id.startsWith('stalker-'))){
    assert.ok(VOICE_LINES[id].text);
    assert.ok(readFileSync(new URL(VOICE_LINES[id].src)).length>20_000);
  }
  const context={sampleRate:12000,createBuffer(ch,n){const data=new Float32Array(n);return {getChannelData:()=>data};}};
  const sound=hordeFootfalls(context).getChannelData(0);
  const rms=Math.sqrt(sound.reduce((sum,sample)=>sum+sample**2,0)/sound.length);
  assert.ok(rms>.025&&rms<.3);
  assert.ok(sound.every(x=>Math.abs(x)<1));
});

test('the radio bundles the uploaded MP3 and the setting is Satrod Kalan, HR',()=>{
  const url=new URL(RADIO_TRACK.src);
  assert.equal(url.protocol,'file:');
  assert.match(decodeURI(url.pathname),/\/src\/Teri Ramjhol Pari - Masoom Sharma\.mp3$/);
  const data=readFileSync(url);
  assert.ok(data.length>1_000_000,'the asset must be the audio file, not a link or pointer');
  assert.ok(data.toString('ascii',0,3)==='ID3'||(data[0]===0xff&&(data[1]&0xe0)===0xe0));
  assert.equal(RADIO_TRACK.title,'Teri Ramjhol Pari');
  assert.equal(VILLAGE_EN_LABEL,'Satrod Kalan, HR');
  assert.equal(VILLAGE_LABEL,'सातरोड कलां, हरियाणा');
});
