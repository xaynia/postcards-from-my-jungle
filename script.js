'use strict';

/*
  This version loads animal language phrases from:
  /data/phrases.json

  Expected shape:
  {
    "phrases": [
      {
        "id": 1,
        "intent": "Greeting",
        "animal_text": "salo-mii raku",
        "english_gloss": "Hello, friend.",
        "mood": "friendly"
      }
    ]
  }
*/

const CONFIG = {
  imageCount: 4,
  soundCount: 4,

  // Filenames used when postcards.json is missing:
  // images/animal-001.webp ... images/animal-050.webp
  imagePrefix: 'animal-',
  imagePad:
  3,
  imageExt: 'jpg',

  // sounds/beast-01.wav ... sounds/beast-04.wav
  soundPrefix: 'sound-',
  soundPad: 2,
  soundExt: 'wav',

  autoAdvanceMs: 9000
};

const $ = (sel) => document.querySelector(sel);

const els = {
  img: $('#animalImg'),
  name: $('#animalName'),
  meta: $('#animalMeta'),
  phrase: $('#animalPhrase'),
  gloss: $('#animalGloss'),
  counter: $('#counter'),
  download: $('#downloadLink'),

  prev: $('#prevBtn'),
  next: $('#nextBtn'),
  play: $('#playBtn'),

  progress: $('#progress'),
  timeNow: $('#timeNow'),
  timeDur: $('#timeDur'),
  volume: $('#volume'),

  autoAdvance: $('#autoAdvanceToggle'),
  autoSound: $('#autoSoundToggle'),
  shuffle: $('#shuffleBtn'),

  toggleGloss: $('#toggleGlossBtn'),
  copy: $('#copyBtn'),

  thumbs: $('#thumbs'),
  audio: $('#audio'),

  toast: $('#toast')
};

let deck = [];
let idx = 0;

let hasUserGesture = false;
let autoTimer = null;
let toastTimer = null;

function showToast(msg) {
  if (!msg) return;
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function pad(n, width) {
  return String(n).padStart(width, '0');
}

function formatTime(s) {
  if (!Number.isFinite(s) || s <= 0) return '0:00';
  const m = Math.floor(s / 60);
  const r = Math.floor(s - m * 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

function normalizePhrases(json) {
  const arr = Array.isArray(json?.phrases) ? json.phrases : [];
  return arr
    .filter((p) => p && typeof p.animal_text === 'string')
    .map((p) => ({
      id: Number(p.id ?? 0),
      intent: String(p.intent ?? '').trim(),
      animal_text: String(p.animal_text ?? '').trim(),
      english_gloss: String(p.english_gloss ?? '').trim(),
      mood: String(p.mood ?? '').trim()
    }))
    .filter((p) => p.animal_text.length > 0);
}

async function loadPhrases() {
  try {
    const res = await fetch('./data/phrases.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`phrases.json HTTP ${res.status}`);
    const json = await res.json();
    const phrases = normalizePhrases(json);
    if (!phrases.length) throw new Error('No phrases found in data/phrases.json');
    return phrases;
  } catch (err) {
    console.warn('[phrases] load failed:', err);
    showToast('Could not load data/phrases.json. Phrases will be empty.');
    return [];
  }
}

function findPhraseById(id, phrases) {
  const target = Number(id);
  if (!Number.isFinite(target)) return null;
  return phrases.find((p) => Number(p.id) === target) ?? null;
}

function phraseForIndex(i, phrases) {
  if (!phrases.length) return null;
  const j = ((i % phrases.length) + phrases.length) % phrases.length;
  return phrases[j];
}

function buildDefaultDeck(phrases) {
  const out = [];

  for (let i = 1; i <= CONFIG.imageCount; i++) {
    const p = phraseForIndex(i - 1, phrases);
    const soundIndex = ((i - 1) % CONFIG.soundCount) + 1;

    out.push({
      id: i,
      name: `Specimen ${pad(i, 2)}`,
      image: `images/${CONFIG.imagePrefix}${pad(i, CONFIG.imagePad)}.${CONFIG.imageExt}`,
      sound: `sounds/${CONFIG.soundPrefix}${pad(soundIndex, CONFIG.soundPad)}.${CONFIG.soundExt}`,

      phrase: p?.animal_text ?? '',
      gloss: p?.english_gloss ?? '',
      intent: p?.intent ?? '',
      mood: p?.mood ?? ''
    });
  }

  return out;
}

function hydrateDeck(cards, phrases) {
  if (!Array.isArray(cards) || !cards.length) return [];

  return cards.map((c, i) => {
    const phraseId = c?.phrase_id ?? c?.phraseId ?? c?.phraseID ?? null;
    const phraseIndexRaw = c?.phrase_index ?? c?.phraseIndex ?? null;

    let p = null;

    if (phrases.length) {
      if (phraseId != null) {
        p = findPhraseById(phraseId, phrases);
      }

      if (!p && phraseIndexRaw != null) {
        const pi = Number(phraseIndexRaw);
        if (Number.isFinite(pi)) {
          // If someone uses 1..N, convert to 0..N-1 when it fits.
          const normalized = pi >= 1 && pi <= phrases.length ? pi - 1 : pi;
          p = phraseForIndex(normalized, phrases);
        }
      }

      if (!p) {
        p = phraseForIndex(i, phrases);
      }
    }

    const name = c?.name ?? `Specimen ${pad(i + 1, 2)}`;

    return {
      id: c?.id ?? i + 1,
      name,

      image: c?.image ?? '',
      sound: c?.sound ?? '',

      phrase: (c?.phrase ?? p?.animal_text ?? '').toString(),
      gloss: (c?.gloss ?? p?.english_gloss ?? '').toString(),
      intent: (c?.intent ?? p?.intent ?? '').toString(),
      mood: (c?.mood ?? p?.mood ?? '').toString()
    };
  });
}

// Optional: supply a postcards.json array like:
// [{ "name":"...", "image":"images/x.webp", "sound":"sounds/y.wav", "phrase_id": 3 }, ...]
async function loadDeck(phrases) {
  try {
    const res = await fetch('./postcards.json', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        const hydrated = hydrateDeck(json, phrases);
        if (hydrated.length) return hydrated;
      }
    }
  } catch (_) {
    // ignore and fall back
  }
  return buildDefaultDeck(phrases);
}

function stopAudio() {
  els.audio.pause();
  els.audio.currentTime = 0;
  els.play.textContent = 'Play sound';
}

async function tryPlayAudio() {
  try {
    await els.audio.play();
    els.play.textContent = 'Pause';
  } catch (_) {
    showToast('Audio blocked. Click Play sound once to enable.');
  }
}

function updateCounter() {
  els.counter.textContent = `${idx + 1} / ${deck.length}`;
}

function setGlossButton() {
  const hasGloss = Boolean(deck[idx]?.gloss);
  els.toggleGloss.disabled = !hasGloss;
  if (!hasGloss) {
    els.gloss.hidden = true;
    els.toggleGloss.textContent = 'Show translation';
  }
}

function formatMeta(card) {
  const parts = [];
  if (card.intent) parts.push(`intent: ${card.intent}`);
  if (card.mood) parts.push(`mood: ${card.mood}`);
  parts.push(`image: ${card.image}`);
  parts.push(`sound: ${card.sound}`);
  return parts.join(' | ');
}

function render() {
  if (!deck.length) return;

  const card = deck[idx];

  updateCounter();

  // Main image
  els.img.src = card.image;
  els.img.alt = card.name || `Postcard ${idx + 1}`;

  // Text
  els.name.textContent = card.name || `Postcard ${idx + 1}`;
  els.meta.textContent = formatMeta(card);

  els.phrase.textContent = card.phrase || '';
  els.gloss.textContent = card.gloss || '';
  setGlossButton();

  // Download link (works for same-origin assets on GitHub Pages)
  els.download.href = card.image;
  els.download.download = (card.name || `postcard-${idx + 1}`).replaceAll(' ', '-');

  // Sound
  stopAudio();
  els.audio.src = card.sound;
  els.audio.load();

  // Thumbs highlight
  [...els.thumbs.querySelectorAll('.thumb')].forEach((b) => {
    const i = Number(b.dataset.index);
    b.setAttribute('aria-current', i === idx ? 'true' : 'false');
  });

  // Preload neighbors for smoother browsing
  preloadNeighbor(1);
  preloadNeighbor(-1);

  // Auto-sound (only after first gesture)
  if (els.autoSound.checked && hasUserGesture) {
    tryPlayAudio();
  } else if (els.autoSound.checked && !hasUserGesture) {
    showToast('Click anywhere once to enable audio.');
  }
}

function preloadNeighbor(delta) {
  if (!deck.length) return;
  const j = (idx + delta + deck.length) % deck.length;
  const src = deck[j]?.image;
  if (!src) return;
  const im = new Image();
  im.decoding = 'async';
  im.src = src;
}

function setIndex(next) {
  if (!deck.length) return;
  idx = (next + deck.length) % deck.length;
  render();
}

function shuffleArray(a) {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildThumbs() {
  els.thumbs.innerHTML = '';

  const placeholder =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="172">
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.25)"/>
        <path d="M0 120 Q60 80 120 120 T240 120 V172 H0 Z" fill="rgba(255,255,255,0.08)"/>
      </svg>`
    );

  for (let i = 0; i < deck.length; i++) {
    const card = deck[i];

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb';
    btn.dataset.index = String(i);
    btn.setAttribute('role', 'listitem');
    btn.setAttribute('aria-current', i === idx ? 'true' : 'false');
    btn.title = card.name || `Postcard ${i + 1}`;

    const img = document.createElement('img');
    img.alt = card.name || `Thumbnail ${i + 1}`;
    img.decoding = 'async';
    img.loading = 'lazy';
    img.src = placeholder;
    img.dataset.src = card.image;

    const cap = document.createElement('div');
    cap.className = 'tcap';
    cap.textContent = card.name || `Postcard ${i + 1}`;

    btn.appendChild(img);
    btn.appendChild(cap);

    btn.addEventListener('click', () => setIndex(i));

    els.thumbs.appendChild(btn);
  }

  // Lazy-load thumbnails with IntersectionObserver
  const thumbImgs = [...els.thumbs.querySelectorAll('img[data-src]')];

  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(
      (entries, observer) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const im = e.target;
          const src = im.dataset.src;
          if (src) im.src = src;
          im.removeAttribute('data-src');
          observer.unobserve(im);
        }
      },
      { root: els.thumbs, rootMargin: '220px' }
    );

    thumbImgs.forEach((im) => obs.observe(im));
  } else {
    // Fallback: load all thumbs
    thumbImgs.forEach((im) => {
      im.src = im.dataset.src;
      im.removeAttribute('data-src');
    });
  }
}

function syncProgressUI() {
  const dur = els.audio.duration;
  const cur = els.audio.currentTime;

  els.timeNow.textContent = formatTime(cur);
  els.timeDur.textContent = formatTime(dur);

  if (Number.isFinite(dur) && dur > 0) {
    els.progress.value = String((cur / dur) * 100);
  } else {
    els.progress.value = '0';
  }
}

function setupEvents() {
  // Track a first gesture for autoplay policies
  const markGesture = () => {
    hasUserGesture = true;
  };
  window.addEventListener('pointerdown', markGesture, { once: true });
  window.addEventListener('keydown', markGesture, { once: true });

  els.prev.addEventListener('click', () => setIndex(idx - 1));
  els.next.addEventListener('click', () => setIndex(idx + 1));

  els.shuffle.addEventListener('click', () => {
    const current = deck[idx];
    deck = shuffleArray(deck);
    idx = Math.max(0, deck.findIndex((c) => c === current));
    if (idx < 0) idx = 0;
    buildThumbs();
    render();
    showToast('Shuffled.');
  });

  els.play.addEventListener('click', async () => {
    if (els.audio.paused) {
      await tryPlayAudio();
    } else {
      els.audio.pause();
      els.play.textContent = 'Play sound';
    }
  });

  els.volume.addEventListener('input', () => {
    els.audio.volume = Number(els.volume.value);
  });

  els.audio.addEventListener('timeupdate', syncProgressUI);
  els.audio.addEventListener('loadedmetadata', syncProgressUI);
  els.audio.addEventListener('ended', () => {
    els.play.textContent = 'Play sound';
  });

  els.progress.addEventListener('input', () => {
    const dur = els.audio.duration;
    if (!Number.isFinite(dur) || dur <= 0) return;
    const pct = Number(els.progress.value) / 100;
    els.audio.currentTime = dur * pct;
  });

  els.autoAdvance.addEventListener('change', () => {
    if (els.autoAdvance.checked) {
      window.clearInterval(autoTimer);
      autoTimer = window.setInterval(() => setIndex(idx + 1), CONFIG.autoAdvanceMs);
      showToast('Auto-advance on.');
    } else {
      window.clearInterval(autoTimer);
      autoTimer = null;
      showToast('Auto-advance off.');
    }
  });

  els.autoSound.addEventListener('change', () => {
    if (els.autoSound.checked) {
      showToast('Auto-play sound on (needs a click first).');
      if (hasUserGesture) tryPlayAudio();
    } else {
      showToast('Auto-play sound off.');
    }
  });

  els.toggleGloss.addEventListener('click', () => {
    const willShow = els.gloss.hidden;
    els.gloss.hidden = !willShow;
    els.toggleGloss.textContent = willShow ? 'Hide translation' : 'Show translation';
  });

  els.copy.addEventListener('click', async () => {
    const text = (deck[idx]?.phrase || '').trim();
    if (!text) return showToast('No phrase to copy.');
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied.');
    } catch (_) {
      showToast('Copy failed. Select text manually.');
    }
  });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') setIndex(idx - 1);
    if (e.key === 'ArrowRight') setIndex(idx + 1);
    if (e.key === ' ') {
      e.preventDefault();
      els.play.click();
    }
  });
}

async function init() {
  const phrases = await loadPhrases();
  deck = await loadDeck(phrases);

  if (!deck.length) {
    els.name.textContent = 'No postcards found.';
    return;
  }

  setupEvents();
  buildThumbs();
  render();

  // Initial volume
  els.audio.volume = Number(els.volume.value);

  showToast(`Loaded ${deck.length} postcards and ${phrases.length} phrases.`);
}

init();
