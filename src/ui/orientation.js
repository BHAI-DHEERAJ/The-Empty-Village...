/* Phones and tablets play the village in landscape. The overlay is CSS-driven;
   this module adds the fullscreen + orientation-lock shortcut where supported. */
const gate = document.getElementById('orientation-gate');
const enter = document.getElementById('orientation-enter');
const note = document.getElementById('orientation-note');
const hint = document.getElementById('orientation-hint');

const coarsePointer = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const canFullscreen = typeof document.documentElement.requestFullscreen === 'function';
const canLock = 'orientation' in window.screen && typeof window.screen.orientation.lock === 'function';

async function enterLandscape() {
  let locked = false;
  enter.disabled = true;
  try {
    if (!document.fullscreenElement && canFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch {
    // A browser can refuse fullscreen outside a direct tap; the rotate prompt still works.
  }
  try {
    if (canLock) {
      await window.screen.orientation.lock('landscape');
      locked = true;
    }
  } catch {
    // iOS Safari has no orientation lock, so the CSS prompt is the fallback.
  }
  enter.disabled = false;
  if (!locked && note) {
    note.textContent = 'अब फ़ोन को क्षैतिज में घुमाओ — गाँव लैंडस्केप में सबसे अच्छा दिखता है।';
  }
}

if (gate && coarsePointer) {
  if ((canFullscreen || canLock) && enter) {
    enter.removeAttribute('hidden');
    hint?.removeAttribute('hidden');
    enter.addEventListener('click', enterLandscape);
  }
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement && canLock) {
      window.screen.orientation.lock('landscape').catch(() => {});
    }
  });
}
