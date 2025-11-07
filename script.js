// script.js — VibeFuse with persistence and presets (commit 3)
(() => {
  // DOM refs
  const moodInput = document.getElementById('mood');
  const generateBtn = document.getElementById('generate');
  const preview = document.getElementById('preview');
  const toggleAnimateBtn = document.getElementById('toggle-animate');
  const copyCssBtn = document.getElementById('copy-css');
  const savePresetBtn = document.getElementById('save-preset');
  const presetsWrap = document.getElementById('presets');
  const exportBtn = document.getElementById('export-presets');
  const importBtn = document.getElementById('import-presets');

  let animated = true;
  let current = null;
  const LS_KEY = 'vibefuse.presets.v1';

  // Simple deterministic hash -> seed
  function hashStringToSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  // seeded random generator (xorshift32-like)
  function seededRandom(seed) {
    let x = seed >>> 0;
    return function() {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return ((x >>> 0) / 4294967295);
    };
  }

  // generate two pleasing HSL colors from mood string
  function generateColorsFromMood(mood) {
    const seed = hashStringToSeed(mood.trim().toLowerCase() || 'neutral');
    const rnd = seededRandom(seed);
    // choose two hues, ensure distance for contrast
    const h1 = Math.floor(rnd() * 360);
    const h2 = (h1 + 120 + Math.floor(rnd() * 120)) % 360;
    // vary saturation/lightness for vibe
    const s1 = 55 + Math.floor(rnd() * 20); // 55-75
    const s2 = 45 + Math.floor(rnd() * 30); // 45-75
    const l1 = 40 + Math.floor(rnd() * 20); // 40-60
    const l2 = 35 + Math.floor(rnd() * 25); // 35-60
    return [
      `hsl(${h1} ${s1}% ${l1}%)`,
      `hsl(${h2} ${s2}% ${l2}%)`
    ];
  }

  // apply gradient to preview; if animated, create a subtle movement
  function applyGradient(colors, {animate = true} = {}) {
    const css = `background: linear-gradient(135deg, ${colors[0]}, ${colors[1]});`;
    preview.style.cssText = css + 'border-radius:10px;color:inherit;display:flex;align-items:center;justify-content:center;';
    preview.dataset.css = css;
    preview.textContent = ''; // we will show small label
    preview.style.position = 'relative';
    preview.style.backgroundSize = '';
    preview.style.animation = '';

    if (animate) {
      preview.style.backgroundSize = '200% 200%';
      preview.style.animation = 'vibeShift 8s ease-in-out infinite';
      ensureKeyframes();
    }
  }

  // create or ensure keyframes exist for vibeShift
  function ensureKeyframes() {
    const name = 'vibeShift';
    const doc = document;
    const styleId = 'vibefuse-animations';
    let style = doc.getElementById(styleId);
    if (!style) {
      style = doc.createElement('style');
      style.id = styleId;
      style.textContent = `
@keyframes ${name} {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}`;
      doc.head.appendChild(style);
    }
  }

  // LocalStorage helpers
  function loadPresets() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Failed to load presets', e);
      return [];
    }
  }
  function savePresets(arr) {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  }

  // Render presets list
  function renderPresets() {
    const list = loadPresets();
    presetsWrap.innerHTML = '';
    if (!list.length) {
      const d = document.createElement('div');
      d.className = 'small';
      d.textContent = 'No presets saved yet';
      presetsWrap.appendChild(d);
      return;
    }
    list.forEach((p, idx) => {
      const el = document.createElement('div');
      el.className = 'preset';
      el.title = `${p.mood} — click to apply. Right-click to remove.`;
      el.textContent = p.mood || `preset ${idx+1}`;
      el.style.background = `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})`;
      el.addEventListener('click', () => {
        current = p;
        moodInput.value = p.mood;
        animated = p.animated ?? true;
        applyGradient(p.colors, {animate: animated});
        preview.textContent = p.mood.toUpperCase();
      });
      el.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        if (confirm(`Remove preset "${p.mood}"?`)) {
          const arr = loadPresets();
          arr.splice(idx,1);
          savePresets(arr);
          renderPresets();
        }
      });
      presetsWrap.appendChild(el);
    });
  }

  // actions
  function generateFromInput() {
    const mood = moodInput.value || '';
    const colors = generateColorsFromMood(mood);
    current = {mood, colors};
    applyGradient(colors, {animate});
    preview.textContent = mood ? mood.toUpperCase() : 'Vibe';
  }

  function toggleAnimate() {
    animated = !animated;
    if (current) applyGradient(current.colors, {animate: animated});
    // visual feedback
    toggleAnimateBtn.textContent = animated ? 'Toggle Animate' : 'Toggle Animate';
  }

  async function copyCssToClipboard() {
    const css = preview.dataset.css || '';
    const full = `${css}\n/* Generated by VibeFuse */`;
    try {
      await navigator.clipboard.writeText(full);
      copyCssBtn.textContent = 'Copied!';
      setTimeout(() => (copyCssBtn.textContent = 'Copy CSS'), 1400);
    } catch (e) {
      copyCssBtn.textContent = 'Copy Failed';
      setTimeout(() => (copyCssBtn.textContent = 'Copy CSS'), 1400);
    }
  }

  function saveCurrentPreset() {
    if (!current) return alert('Generate a vibe first.');
    const arr = loadPresets();
    // keep uniqueness by mood
    const existing = arr.findIndex(p => (p.mood || '').toLowerCase() === (current.mood||'').toLowerCase());
    if (existing >= 0) {
      if (!confirm('A preset with that mood exists. Overwrite?')) return;
      arr.splice(existing,1);
    }
    arr.unshift({...current, animated});
    // cap to 30 presets
    if (arr.length > 30) arr.length = 30;
    savePresets(arr);
    renderPresets();
  }

  function exportPresets() {
    const arr = loadPresets();
    const blob = new Blob([JSON.stringify({exportedAt: new Date().toISOString(), presets: arr}, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vibefuse-presets.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importPresets() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = () => {
      const f = input.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          const incoming = parsed.presets ?? parsed;
          if (!Array.isArray(incoming)) throw new Error('Invalid file format');
          const cur = loadPresets();
          // merge (incoming first)
          const merged = [...incoming, ...cur].slice(0, 30);
          savePresets(merged);
          renderPresets();
          alert('Presets imported.');
        } catch (e) {
          alert('Failed to import presets: ' + e.message);
        }
      };
      reader.readAsText(f);
    };
    input.click();
  }

  // wire events
  generateBtn.addEventListener('click', generateFromInput);
  toggleAnimateBtn.addEventListener('click', () => { toggleAnimate(); });
  copyCssBtn.addEventListener('click', copyCssToClipboard);
  savePresetBtn.addEventListener('click', saveCurrentPreset);
  exportBtn.addEventListener('click', exportPresets);
  importBtn.addEventListener('click', importPresets);

  // initial
  renderPresets();
  generateFromInput();
})();
