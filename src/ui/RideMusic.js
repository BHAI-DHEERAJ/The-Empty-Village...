import { escapeVolume } from '../game/story/CretaFinale.js';

export class RideMusic {
  constructor(audio, signal, page = document) {
    this.audio = audio;
    this.page = page;
    this.riding = this.enabled = this.priming = false;
    page.addEventListener('visibilitychange', () => {
      if (page.hidden) audio.pause();
      else this.#play();
    }, { signal });
    const retry = event => {
      if (event.isTrusted && !event.repeat) this.#play();
    };
    // Some browsers only grant playback on a trusted gesture. Retry without
    // adding a permanent media control to the cinematic.
    page.addEventListener('click', retry, { signal });
    page.addEventListener('keydown', retry, { signal });
  }

  setSound(enabled) {
    this.enabled = enabled;
    this.audio.muted = !enabled || this.priming;
    if (enabled) this.#play();
    else this.audio.pause();
  }

  update(mode, time) {
    const riding = mode === 'drive' || mode === 'escape';
    if (riding) {
      const volume = mode === 'drive' ? .67 : escapeVolume(time);
      if (Math.abs(this.audio.volume - volume) > .004) this.audio.volume = volume;
    }
    if (riding === this.riding) return;
    this.riding = riding;
    if (riding) this.#play();
    else this.#rewind();
  }

  // A Continue into the village/repair starts the chase later, outside the
  // button gesture. Prime the same element silently while the gesture is live.
  prime() {
    if (!this.enabled || this.riding || this.priming || this.page.hidden || this.audio.error) return;
    this.priming = true;
    this.audio.muted = true;
    const finish = () => {
      this.priming = false;
      if (!this.riding || !this.enabled || this.page.hidden) this.#rewind();
      this.audio.muted = !this.enabled;
      this.#play();
    };
    this.audio.play().then(finish, finish);
  }

  #play() {
    if (!this.riding || !this.enabled || this.priming || this.page.hidden || this.audio.error || !this.audio.paused) return;
    this.audio.play().catch(() => { /* Hidden tabs and autoplay policies can interrupt playback. */ });
  }

  #rewind() {
    this.audio.pause();
    if (this.audio.currentTime > 0) this.audio.currentTime = 0;
  }

  dispose() {
    this.riding = this.enabled = false;
    this.audio.muted = true;
    this.#rewind();
  }
}
