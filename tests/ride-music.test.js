import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESCAPE, escapeVolume } from '../src/game/story/CretaFinale.js';
import { RideMusic } from '../src/ui/RideMusic.js';

function setup(play = async function () { this.paused = false; }) {
  const listeners = new Map();
  const page = { hidden: false, addEventListener: (name, callback) => listeners.set(name, callback) };
  const audio = { currentTime: 0, volume: 1, muted: true, paused: true, starts: 0,
    play() { this.starts++; return play.call(this); }, pause() { this.paused = true; } };
  const music = new RideMusic(audio, new AbortController().signal, page);
  const emit = (name, event = {}) => listeners.get(name)(event);
  return { music, audio, page, emit };
}

test('the song is automatic in drive and escape, follows the existing mix, and rewinds between scenes', () => {
  const { music, audio, page, emit } = setup();
  music.setSound(true);
  music.update('menu', 0);
  assert.equal(audio.starts, 0);
  music.update('drive', 0);
  assert.equal(audio.volume, .67);
  assert.equal(audio.paused, false);
  assert.equal(audio.muted, false);
  audio.currentTime = 9;
  music.update('drive', 9);
  assert.equal(audio.starts, 1);
  music.update('arrived', 60);
  assert.ok(audio.paused && audio.currentTime === 0);
  music.update('repair', 0);
  music.update('final-repair', 2);
  assert.equal(audio.starts, 1);
  music.update('escape', 0);
  assert.equal(audio.starts, 2);
  music.update('escape', ESCAPE.impact + 1);
  assert.equal(audio.volume, escapeVolume(ESCAPE.impact + 1));
  music.update('escape', ESCAPE.breakaway + 5);
  assert.equal(audio.volume, escapeVolume(ESCAPE.breakaway + 5));
  audio.currentTime = 31;
  page.hidden = true;
  emit('visibilitychange');
  assert.ok(audio.paused && audio.currentTime === 31);
  emit('click', { isTrusted: true });
  assert.equal(audio.starts, 2);
  page.hidden = false;
  emit('visibilitychange');
  assert.ok(!audio.paused && audio.currentTime === 31);
  music.update('ending', ESCAPE.end);
  assert.ok(audio.paused && audio.currentTime === 0);
  emit('click', { isTrusted: true });
  assert.equal(audio.starts, 3);
});

test('sound-off suppresses playback and priming even on a trusted gesture', () => {
  const { music, audio, emit } = setup();
  music.setSound(false);
  music.prime();
  music.update('drive', 0);
  emit('click', { isTrusted: true });
  assert.equal(audio.starts, 0);
  assert.ok(audio.muted && audio.paused);
  music.setSound(true);
  assert.ok(!audio.muted && !audio.paused);
  music.setSound(false);
  assert.ok(audio.muted && audio.paused);
});

test('a Continue can prime the later chase without any song leaking into exploration', async () => {
  const { music, audio } = setup();
  music.setSound(true);
  music.update('play', 0);
  music.prime();
  assert.ok(audio.muted && !audio.paused);
  await Promise.resolve();
  assert.ok(audio.paused && audio.currentTime === 0);
  music.update('escape', 0);
  assert.ok(!audio.muted && !audio.paused);
  music.dispose();
  assert.ok(audio.muted && audio.paused);
});

test('a blocked autoplay attempt can recover on a trusted gesture without frame-by-frame play calls', async () => {
  const { music, audio, emit } = setup(async function () {
    if (this.starts === 1) throw new DOMException('Autoplay denied', 'NotAllowedError');
    this.paused = false;
  });
  music.setSound(true);
  music.update('escape', 0);
  await Promise.resolve();
  assert.equal(audio.paused, true);
  music.update('escape', 1);
  emit('click', { isTrusted: false });
  emit('keydown', { isTrusted: true, repeat: true });
  assert.equal(audio.starts, 1);
  emit('click', { isTrusted: true });
  assert.equal(audio.starts, 2);
  assert.equal(audio.paused, false);
});
