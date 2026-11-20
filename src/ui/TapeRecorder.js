import { VOICE_LINES } from '../game/audio/VoiceLines.js';

const stamp=value=>{
  const time=Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
  return `${String(Math.floor(time/60)).padStart(2,'0')}:${String(time%60).padStart(2,'0')}`;
};
export class TapeRecorder {
  constructor(shell,{signal,change,mix}){
    const find=id=>shell.querySelector(`#${id}`);
    this.panel=find('tape-recorder');this.audio=find('tape-audio');this.deck=find('tape-deck');
    this.title=find('tape-title');this.label=find('tape-label');this.transcript=find('tape-transcript');
    this.play=find('tape-play');this.read=find('tape-read');this.progress=find('tape-progress');
    this.time=find('tape-time');this.status=find('tape-status');this.closeButton=find('tape-close');
    this.audio.volume=.78;
    const on=(node,event,listener)=>node.addEventListener(event,listener,{signal});
    on(this.closeButton,'click',()=>this.close());
    on(find('tape-rewind'),'click',()=>{if(this.audio.readyState)this.audio.currentTime=0;this.#position();});
    on(this.play,'click',()=>{
      if(!this.audio.paused){this.audio.pause();return;}
      this.status.textContent='टेप चल रहा है…';
      const id=this.recording;
      this.audio.play().catch(()=>{
        if(id===this.recording&&this.open&&this.audio.paused)this.status.textContent='आवाज़ नहीं चली। फिर प्ले दबाओ या नीचे संदेश पढ़ो।';
      });
    });
    on(this.read,'click',()=>{this.#heard();this.close();});
    on(this.audio,'playing',()=>{
      if(!this.open){this.audio.pause();return;}
      this.#heard();this.deck.toggleAttribute('data-playing',true);mix(true);
      this.play.textContent='रोकें';this.status.textContent='रिकॉर्डिंग चल रही है';
    });
    const stopped=()=>{
      this.deck.toggleAttribute('data-playing',false);mix(false);this.play.textContent='चलाओ';
      if(this.audio.ended)this.status.textContent='रिकॉर्डिंग ख़त्म';
      else if(this.open&&this.audio.currentTime>0)this.status.textContent='टेप रुका है';
    };
    on(this.audio,'pause',stopped);on(this.audio,'ended',stopped);
    on(this.audio,'error',()=>{if(this.open)this.status.textContent='रिकॉर्डिंग नहीं खुली। संदेश नीचे लिखा है।';});
    for(const type of ['timeupdate','loadedmetadata'])on(this.audio,type,()=>this.#position());
    on(this.panel,'close',()=>{
      this.audio.pause();stopped();this.complete=null;change(false,this.opener);
    });
    on(document,'visibilitychange',()=>{if(document.hidden&&this.open)this.audio.pause();});
    this.change=change;
  }
  get open(){return this.panel.open;}
  show(recording,complete=null){
    const tape=VOICE_LINES[recording];
    if(!tape?.title||this.open)return false;
    this.opener=document.activeElement;this.complete=complete;this.recording=recording;
    if(document.pointerLockElement)document.exitPointerLock();
    this.audio.src=tape.src;
    this.title.textContent=tape.title;this.label.textContent=tape.label;this.transcript.textContent=tape.text;
    this.status.textContent='आवाज़ सुनो या संदेश पढ़ो';this.play.textContent='चलाओ';
    this.read.hidden=!complete;this.read.textContent='संदेश पढ़ लिया · जारी रखो';this.progress.value=0;this.time.textContent='00:00 / --:--';
    this.panel.showModal();this.change(true);return true;
  }
  close(){if(this.open){this.audio.pause();this.panel.close();}}
  #heard(){const done=this.complete;this.complete=null;if(done){this.read.textContent='संदेश पढ़ लिया';done();}}
  #position(){
    this.progress.value=this.audio.duration>0?this.audio.currentTime/this.audio.duration:0;
    this.time.textContent=`${stamp(this.audio.currentTime)} / ${stamp(this.audio.duration)}`;
  }
}
