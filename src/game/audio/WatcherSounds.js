// A small, local one-shot library. The whisper has breath formants, not speech,
// and footsteps follow the actor with no non-positional appearance sting.
const signatures = {
  'road-rustle':[.89,.11], 'road-step':[.28,.175], joint:[.36,.093],
  breath: [1.78, .078], whisper: [1.28, .081], creak: [.88, .115], steps: [1.12, .144], 'rush-step': [.24, .24], vanish: [.57, .061],
};

function makeSound(context, type) {
  const [length] = signatures[type];
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * length), context.sampleRate);
  const y = buffer.getChannelData(0);
  let low = 0, mid = 0, phase = 0, peak = .1;
  for (let i = 0; i < y.length; i++) {
    const t = i / context.sampleRate, x = t / length, raw = Math.random() * 2 - 1;
    low += .034 * (raw - low);
    mid += .177 * (raw - mid);
    const breath = (mid - low) * .86 + low * .67;
    if (type === 'breath') {
      const first = Math.exp(-((x - .27) ** 2) / .014), second = Math.exp(-((x - .70) ** 2) / .025);
      y[i] = breath * (first * .57 + second * .75);
    } else if (type === 'whisper') {
      const formants = .38 + .23 * Math.sin(19 * t) + .17 * Math.sin(35 * t - .6);
      y[i] = (breath * .62 + (raw - mid) * .14) * formants * Math.sin(Math.PI * x) ** 2;
    } else if (type === 'creak' || type === 'joint') {
      phase += (193 - x * 76 + 25 * Math.sin(17 * t)) / context.sampleRate;
      const ripple = (.52 + .30 * Math.sin(t * 44)) * Math.sin(Math.PI * x) ** 2;
      y[i] = (Math.sin(phase * 6.283) * .31 + Math.sin(phase * 17.64) * .12 + low * .75) * ripple;
    } else if (type === 'rush-step' || type === 'road-step') {
      y[i] = Math.min(1, t * 125) * Math.exp(-t * 19) *
        (low * 1.16 + (mid - low) * .66 + .57 * Math.sin((430 - 950 * t) * t));
    } else if (type === 'steps') {
      const a = t - .045, b = t - .586;
      const pulse = (v) => v < 0 ? 0 : Math.min(v * 70, 1) * Math.exp(-v * 18);
      y[i] = pulse(a) * (low + .32 * Math.sin(a * 380)) + pulse(b) * (low * .64 + .24 * Math.sin(b * 315));
    } else y[i] = breath * Math.sin(Math.PI * x) ** 2 * (1 - x * .55);
    y[i] *= Math.min(1, x * 32, (1 - x) * 26);
    peak = Math.max(peak, Math.abs(y[i]));
  }
  for (let i = 0; i < y.length; i++) y[i] /= peak;
  return buffer;
}

export function createWatcherSounds(context, output) {
  const buffers = new Map();
  return (type, position, clarity) => {
    if (context.state !== 'running' || !Object.hasOwn(signatures, type)) return;
    if (!buffers.has(type)) buffers.set(type, makeSound(context, type));
    const source = context.createBufferSource();
    source.buffer = buffers.get(type);
    source.playbackRate.value = .91 + Math.random() * .18;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = (type === 'rush-step' ? 870 : type === 'road-step' ? 1240 : type === 'steps' ? 540 : 1400) * (.47 + clarity * .53);
    const level = context.createGain();
    level.gain.value = signatures[type][1] * clarity;
    const panner = context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 3.4;
    panner.maxDistance = 42;
    panner.rolloffFactor = 1.32;
    const { x, y, z } = position;
    if (panner.positionX) {
      panner.positionX.value = x;
      panner.positionY.value = y;
      panner.positionZ.value = z;
    } else panner.setPosition(x, y, z);
    source.connect(filter).connect(level).connect(panner).connect(output);
    source.onended = () => { source.disconnect(); filter.disconnect(); level.disconnect(); panner.disconnect(); };
    source.start();
  };
}
