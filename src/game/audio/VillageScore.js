// Original, local score. Slow bowed notes, a detuned drone and struck metal
// harmonics, not a loop of random loud stings. Shared with the ambience mute.
const PHRASES = [
  { root: 38, notes: [50,57,51,undefined,56,undefined,45], colour: .82 },
  { root: 38, notes: [50,undefined,51,58,undefined,56,undefined], colour: .64 },
  { root: 35, notes: [47,54,49,undefined,50,undefined,39], colour: .56 },
  { root: 38, notes: [45,50,undefined,56,51,undefined,50], colour: .73 },
];
const hz = midi => 440 * 2 ** ((midi - 69) / 12);

export function createVillageScore(context, destination) {
  const mix = context.createGain(), low = context.createBiquadFilter();
  mix.gain.value = 0; low.type = 'lowpass'; low.frequency.value = 1540; low.Q.value = .48;
  low.connect(mix).connect(destination);
  const wave = context.createPeriodicWave(new Float32Array(7), new Float32Array([0, 1, .36, .52, .08, .15, .085]));
  const floor = context.createGain(), drone = context.createOscillator(), shadow = context.createOscillator();
  floor.gain.value = .059;
  drone.setPeriodicWave(wave);drone.frequency.value = hz(38);
  shadow.type = 'sine';shadow.frequency.value = hz(45) * .997;shadow.detune.value = -5;
  const dark = context.createBiquadFilter();dark.type = 'lowpass';dark.frequency.value = 386;
  const swell = context.createOscillator(), depth = context.createGain();
  swell.frequency.value = .063; depth.gain.value = .019;swell.connect(depth).connect(floor.gain);
  drone.connect(dark);shadow.connect(dark);dark.connect(floor).connect(low);
  drone.start();shadow.start();swell.start();
  let index = 0, phrase = 0, next = 0, audible = false;

  function note(pitch, start, offset, breath) {
    const osc = context.createOscillator(), partial = context.createOscillator();
    const env = context.createGain(), metallic = context.createGain(), pan = context.createStereoPanner();
    const frequency = hz(pitch), duration = 3.48 + breath * 1.8;
    osc.setPeriodicWave(wave);osc.frequency.value = frequency * .991;
    osc.frequency.setTargetAtTime(frequency,start+.14,.65);
    partial.type = 'sine';partial.frequency.value = frequency * 2.715;
    metallic.gain.setValueAtTime(.14,start);metallic.gain.setTargetAtTime(0,start+.15,.35);
    pan.pan.value = offset;
    env.gain.setValueAtTime(.0002,start);
    env.gain.exponentialRampToValueAtTime(.048+breath*.026,start+.58);
    env.gain.exponentialRampToValueAtTime(.0002,start+duration);
    osc.connect(env);partial.connect(metallic).connect(env);env.connect(pan).connect(low);
    osc.start(start);partial.start(start);osc.stop(start+duration+.06);partial.stop(start+duration+.06);
    osc.onended = () => { osc.disconnect();partial.disconnect();env.disconnect();metallic.disconnect();pan.disconnect(); };
  }

  return {
    setAudible(on) {
      if (on === audible) return;
      audible = on;
      const now = context.currentTime;
      mix.gain.setTargetAtTime(on ? .68 : 0,now,.42);
      if (on) next = Math.max(next,now+.63);
    },
    update() {
      if (!audible) return;
      const now = context.currentTime;
      if (now + .18 < next) return;
      // Resume after suspended tabs without queuing a pile of missed notes.
      next = Math.max(now+.045,next);
      const sequence = PHRASES[phrase];
      if (index === 0) {
        drone.frequency.setTargetAtTime(hz(sequence.root),next,1.7);
        shadow.frequency.setTargetAtTime(hz(sequence.root + 7),next,2.6);
      }
      const pitch = sequence.notes[index];
      if (pitch != null) note(pitch,next,Math.sin((phrase*7+index)*1.79)*.38,sequence.colour);
      next += [2.11,2.71,3.83,2.32,3.06,2.78,4.38][index];
      if (++index === sequence.notes.length) { index = 0;phrase = (phrase + 1) % PHRASES.length; }
    },
  };
}
