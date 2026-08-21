    // ========= HOSTED CONFIG =========
    const GITHUB_USER = "DerHaseMitHut";
    const ASSETS_REPO = "HasesPokeGrid-Assets";
    const ASSET_BASE = `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${ASSETS_REPO}@main`;

    const MAPPING_URL = `./dex_de.json`;
    const PRESET_URL  = `./grid_preset.json`;

    const IMG_URL       = (id) => `${ASSET_BASE}/pokemon/${id}.png`;
    const SHINY_IMG_URL = (id) => `${ASSET_BASE}/pokemon/shiny/${id}.png`;
    const CRY_URL       = (id) => `${ASSET_BASE}/Pokemon%20Cries/${id}.ogg`;

    const SHINY_SPARKLE_URL = `${ASSET_BASE}/ShinySparkle.gif`;
    const SHINY_SOUND_URL   = `${ASSET_BASE}/ShinySound.mp3`;

    const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfgrOxqxCUwZd4MOKgoHKLTXj6AI6Lcu4P_DnsLWy-8VSEXpA/viewform?usp=header";

    // ========= CONFIG =========
    const SHINY_CHANCE = 0.05;
    const SPARKLE_DURATION_MS = 1000;

    const LS_CRY_VOL = 'pokegrid_cry_vol';
    const LS_SHINY_VOL = 'pokegrid_shiny_vol';
    const LS_TOUR_DONE = 'pokegrid_tutorial_done';

    // ========= State =========
    let dex = [];
    let dexByKey = new Map();

    let selectedCell = null;
    let deleteMode = false;
    let presenter = false;

    let communityDatasetCount = 0;
    const communityCounts = new Map();
    // overlayKey(r,c,groupKey) -> Map(rawFormKey -> {count, names:Set, display})
    // Behält die konkrete Form (z.B. "Choreogel Baile") fest, auch wenn die
    // Punktzahl über alle Formen einer Art zusammengezählt wird.
    const communityFormBreakdown = new Map();
    let communityMaxCount = 0;

    const communityCellIndex = new Map();
    let otherHoverMode = false;

    let shinyAudio = new Audio();
    const cryAudio = new Audio();

    const toastEl = document.getElementById('toast');
    const autoStatus = document.getElementById('autoStatus');
    const commStatus = document.getElementById('commStatus');
    const scoreEl = document.getElementById('cornerScore');

    const cells = Array.from(document.querySelectorAll('.cell'));
    const headerSpans = Array.from(document.querySelectorAll('.hdrText, .rowhdrText'));
    const input = document.getElementById('pokeInput');
    const dd = document.getElementById('dd');
    const bgLayer = document.getElementById('bgLayer');
    const stageEl = document.getElementById('stage');

    const cryVolEl = document.getElementById('cryVol');
    const shinyVolEl = document.getElementById('shinyVol');

    // ===== Mobile elements =====
    const mIn = document.getElementById('mobilePokeInput');
    const mRandom = document.getElementById('mRandom');
    const mDelete = document.getElementById('mDelete');
    const mExport = document.getElementById('mExport');
    const mTour = document.getElementById('mTour');

    const mdd = document.getElementById('mdd');
    let mddIndex = -1;

    // ===== Tutorial elements =====
    const tourEl = document.getElementById('tour');
    const tourTextEl = document.getElementById('tourText');
    const tourStepEl = document.getElementById('tourStep');
    const tourBackBtn = document.getElementById('tourBack');
    const tourSkipBtn = document.getElementById('tourSkip');
    const tourNextBtn = document.getElementById('tourNext');
    const tutorialBtn = document.getElementById('tutorialBtn');

    const tourCard = document.getElementById('tourCard');
    const tourDim = document.getElementById('tourDim');
    const tourSpot = document.getElementById('tourSpot');

    let tourIndex = 0;
    let tourActive = false;

    // ========= helpers =========
    function toast(msg){
      if (!toastEl) return;
      toastEl.textContent = msg || '';
      if (msg) setTimeout(() => { if (toastEl.textContent === msg) toastEl.textContent=''; }, 2400);
    }
    function setStatus(text){ if (autoStatus) autoStatus.textContent = text; }
    function setCommStatus(){ if (commStatus) commStatus.textContent = `Community-Datensätze: ${communityDatasetCount}`; }

    function clamp01(v){ return Math.max(0, Math.min(1, v)); }
    function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

    function isMobileView(){
      return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
    }

    // Auto-scroll: wenn Zelle außerhalb ist, Stage dahin scrollen
    function scrollCellIntoView(cell){
      if (!isMobileView()) return;
      if (!stageEl || !cell) return;

      const stageRect = stageEl.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();

      const pad = 14;

      const leftBound  = stageRect.left + pad;
      const rightBound = stageRect.right - pad;
      const topBound   = stageRect.top + pad;
      const botBound   = stageRect.bottom - pad - 120; // Bottom Bar

      let dx = 0, dy = 0;

      if (cellRect.left < leftBound) dx = cellRect.left - leftBound;
      else if (cellRect.right > rightBound) dx = cellRect.right - rightBound;

      if (cellRect.top < topBound) dy = cellRect.top - topBound;
      else if (cellRect.bottom > botBound) dy = cellRect.bottom - botBound;

      if (dx !== 0 || dy !== 0){
        stageEl.scrollBy({ left: dx, top: dy, behavior: 'smooth' });
      }
    }

    function loadVolumePrefs(){
      const c = localStorage.getItem(LS_CRY_VOL);
      const s = localStorage.getItem(LS_SHINY_VOL);
      if (cryVolEl && c != null) cryVolEl.value = String(Math.max(0, Math.min(100, Number(c))));
      if (shinyVolEl && s != null) shinyVolEl.value = String(Math.max(0, Math.min(100, Number(s))));
    }
    function applyCryVolume(){
      const v = cryVolEl ? Number(cryVolEl.value ?? 25) : 25;
      cryAudio.volume = clamp01(v / 100);
      localStorage.setItem(LS_CRY_VOL, String(v));
    }
    function applyShinyVolume(){
      const v = shinyVolEl ? Number(shinyVolEl.value ?? 55) : 55;
      shinyAudio.volume = clamp01(v / 100);
      localStorage.setItem(LS_SHINY_VOL, String(v));
    }

    loadVolumePrefs();
    applyCryVolume();
    applyShinyVolume();
    if (cryVolEl) cryVolEl.addEventListener('input', applyCryVolume);
    if (shinyVolEl) shinyVolEl.addEventListener('input', applyShinyVolume);

    function idxToRC(idx){
      const i = Number(idx);
      return { r: Math.floor(i/5), c: i % 5 };
    }
    function overlayKey(r,c,pokeKey){ return `${r},${c},${pokeKey}`; }

    function normKey(s){
      s = (s||'').trim().toLowerCase().replace(/ß/g,'ss').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
      s = s.replace(/[^a-z0-9\s\-']/g,' ').replace(/-/g,' ').replace(/\s+/g,' ').trim();
      return s;
    }

    // ===== form grouping =====
    // Mega/Gigadynamax/Battle-Formen (z.B. "glurak-mega-x", "durengard-shield")
    // zählen als dieselbe Antwort wie die Basis-Form. Regionalformen
    // (Alola/Galar/Hisui/Paldea) bleiben eigenständige Pokémon.
    const REGION_LABELS = { alola:'Alola', galar:'Galar', hisui:'Hisui', paldea:'Paldea' };
    let groupKeyByPokeKey = new Map();
    let groupDisplayByGroupKey = new Map();

    function regionTagFromSlug(slug){
      slug = slug || '';
      if (/-cap$/.test(slug)) return ''; // Pikachu-Cap-Kostüme sind keine Regionalformen
      const m = /-(alola|galar|hisui|paldea)(?:-|$)/.exec(slug);
      return m ? m[1] : '';
    }

    function computeGroupKey(entry){
      const base = normKey(entry.species_de || entry.display || entry.key || '');
      const region = regionTagFromSlug(entry.slug);
      return region ? `${base}__${region}` : base;
    }

    function toGroupKey(pokeKey){
      return groupKeyByPokeKey.get(pokeKey) || pokeKey;
    }

    function buildGroupMaps(){
      groupKeyByPokeKey = new Map();
      groupDisplayByGroupKey = new Map();
      dex.forEach(e => {
        const gk = computeGroupKey(e);
        groupKeyByPokeKey.set(e.key, gk);
        if (!groupDisplayByGroupKey.has(gk)){
          const region = regionTagFromSlug(e.slug);
          const base = e.species_de || e.display;
          groupDisplayByGroupKey.set(gk, region ? `${base} (${REGION_LABELS[region]})` : base);
        }
      });
    }

    function baseNameNoExt(filename){
      return String(filename || '').split(/[\\/]/).pop().replace(/\.json$/i,'').trim();
    }

    function escapeHtml(s){
      return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
        .replaceAll('"','&quot;').replaceAll("'","&#039;");
    }

    // ===== header fit (shrink until it fits) =====
    const measureEl = document.createElement('div');
    measureEl.style.position = 'fixed';
    measureEl.style.left = '-99999px';
    measureEl.style.top = '0';
    measureEl.style.visibility = 'hidden';
    measureEl.style.pointerEvents = 'none';
    measureEl.style.whiteSpace = 'normal';
    document.body.appendChild(measureEl);

    function fitHeaderText(span, max=18, min=6){
      const parent = span.parentElement;
      const pCS = getComputedStyle(parent);
      const cs = getComputedStyle(span);

      const padX = (parseFloat(pCS.paddingLeft)||0) + (parseFloat(pCS.paddingRight)||0);
      const padY = (parseFloat(pCS.paddingTop)||0) + (parseFloat(pCS.paddingBottom)||0);
      const safe = 10;

      const maxW = Math.max(20, parent.clientWidth  - padX - safe);
      const maxH = Math.max(20, parent.clientHeight - padY - safe);

      measureEl.style.width = maxW + 'px';
      measureEl.style.fontFamily = cs.fontFamily;
      measureEl.style.fontWeight = cs.fontWeight;
      measureEl.style.letterSpacing = cs.letterSpacing;
      measureEl.style.textTransform = cs.textTransform;
      measureEl.style.wordBreak = cs.wordBreak;
      measureEl.style.overflowWrap = cs.overflowWrap;
      measureEl.style.hyphens = cs.hyphens;
      measureEl.style.whiteSpace = 'normal';

      const text = span.textContent;

      for (let size=max; size>=min; size--){
        span.style.fontSize = size + 'px';
        measureEl.style.fontSize = size + 'px';
        measureEl.style.lineHeight = (size * 1.08) + 'px';
        measureEl.textContent = text;
        void measureEl.offsetHeight;
        if (measureEl.scrollHeight <= maxH) return;
      }
      span.style.fontSize = min + 'px';
    }

    function startEditHeader(span){
      if (span.isContentEditable) return;
      span.dataset.prev = span.textContent;
      span.contentEditable = "true";
      span.focus();
      document.execCommand('selectAll', false, null);
    }
    function finishEditHeader(span){
      if (!span.isContentEditable) return;
      span.contentEditable = "false";
      span.textContent = (span.textContent || '').trim() || span.dataset.prev || '—';
      fitHeaderText(span);
    }
    function cancelEditHeader(span){
      if (!span.isContentEditable) return;
      span.textContent = span.dataset.prev || span.textContent;
      span.contentEditable = "false";
      fitHeaderText(span);
    }

    headerSpans.forEach(sp => {
      sp.addEventListener('click', (e) => { e.stopPropagation(); startEditHeader(sp); });
      sp.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); cancelEditHeader(sp); }
        if (e.key === 'Enter')  { e.preventDefault(); sp.blur(); }
      });
      sp.addEventListener('blur', () => finishEditHeader(sp));
    });

    // ===== cells =====
    function selectCell(cell){
      if (selectedCell) selectedCell.classList.remove('selected');
      selectedCell = cell;
      cell.classList.add('selected');
      scrollCellIntoView(cell);
    }
    function isEmpty(cell){ return !cell.dataset.pid; }

    function hideInlay(cell){
      const ov = cell.querySelector('.inlayOverlay');
      if (ov) ov.classList.remove('show');
    }
    function hideAllInlays(){ cells.forEach(hideInlay); }

    function clearCell(cell){
      hideInlay(cell);
      cell.dataset.pid = '';
      cell.dataset.pokeKey = '';
      cell.innerHTML = '<div class="hint">leer</div>';
      updateCommunityOverlayForCell(cell);
      recalcCommunityScore();
    }

    function ensureInlayOverlay(cell){
      let ov = cell.querySelector('.inlayOverlay');
      if (ov) return ov;

      ov = document.createElement('div');
      ov.className = 'inlayOverlay';
      ov.innerHTML = `<div class="inlayList"></div>`;
      cell.appendChild(ov);

      ov.addEventListener('mouseenter', () => ov.classList.add('show'));
      ov.addEventListener('mouseleave', () => ov.classList.remove('show'));

      return ov;
    }

    function showInlay(cell, html){
      const ov = ensureInlayOverlay(cell);
      ov.querySelector('.inlayList').innerHTML = html;
      ov.classList.add('show');
    }

    function getPrettyNameFromKey(key){ return groupDisplayByGroupKey.get(key) || dexByKey.get(key) || key; }

    function buildOtherAnswersHtmlForCell(cell){
      const idx = cell.dataset.idx;
      if (idx == null) return '';
      const {r,c} = idxToRC(idx);

      const cellKey = `${r},${c}`;
      const byMon = communityCellIndex.get(cellKey);
      if (!byMon) return '';

      const currentKey = toGroupKey(cell.dataset.pokeKey || '');
      const rows = [];

      for (const [k, rec] of byMon.entries()){
        if (!k || k === currentKey) continue;
        const names = rec.names ? [...rec.names].sort((a,b)=>a.localeCompare(b)) : [];
        rows.push({
          name: getPrettyNameFromKey(k),
          count: rec.count||0,
          who: names.length ? names.join('\n') : '—'
        });
      }

      if (!rows.length) return '';
      rows.sort((a,b)=> (b.count-a.count) || a.name.localeCompare(b.name));

      return rows.map(r => `
        <div class="inlayRow">
          <div class="inlayMon">
            <span>${escapeHtml(r.name)}</span>
            <span class="inlayCount">(${r.count})</span>
          </div>
          <div class="inlayMeta">${escapeHtml(r.who)}</div>
        </div>
      `).join('');
    }

    // cell events
    cells.forEach((c, idx) => {
      c.dataset.idx = String(idx);

      c.addEventListener('click', () => {
        if (deleteMode){
          if (c.dataset.pid) clearCell(c);
          return;
        }
        selectCell(c);
      });

      c.addEventListener('mouseenter', () => {
        if (isMobileView()) return;
        if (!otherHoverMode) return;
        if (!c.dataset.pid) return;
        if (communityDatasetCount <= 0) return;

        const html = buildOtherAnswersHtmlForCell(c);
        if (!html){ hideInlay(c); return; }
        showInlay(c, html);
      });

      c.addEventListener('mouseleave', () => {
        if (isMobileView()) return;
        hideInlay(c);
      });
    });

    // ===== random/reset =====
    function randomEmptyCell(){
      const empties = cells.filter(isEmpty);
      if (!empties.length){ toast('Keine leeren Felder mehr.'); return null; }
      const pick = empties[Math.floor(Math.random()*empties.length)];
      cells.forEach(c => c.classList.remove('marked'));
      pick.classList.add('marked');
      selectCell(pick);
      scrollCellIntoView(pick);
      return pick;
    }

    function resetGrid(){
      hideAllInlays();
      cells.forEach(c => {
        c.classList.remove('marked','selected','delete-mode');
        c.dataset.pid = '';
        c.dataset.pokeKey = '';
        c.innerHTML = '<div class="hint">leer</div>';
        updateCommunityOverlayForCell(c);
      });
      deleteMode = false;
      const del = document.getElementById('deleteBtn');
      if (del) del.textContent = 'Löschen';
      syncMobileDeleteLabel();
      selectCell(cells[0]);
      randomEmptyCell();
      recalcCommunityScore();
    }

    // ===== community overlays =====
    function updateCommunityOverlayForCell(cell){
      const pokeKey = cell.dataset.pokeKey || '';
      const idx = cell.dataset.idx;
      if (!pokeKey || idx == null){
        cell.classList.remove('comm-hit');
        cell.style.removeProperty('--commAlpha');
        const wrap = cell.querySelector('.commBadgeWrap');
        if (wrap) wrap.remove();
        return;
      }

      const {r,c} = idxToRC(idx);
      const k = overlayKey(r,c,toGroupKey(pokeKey));
      const count = communityCounts.get(k) || 0;

      if (count <= 0){
        cell.classList.remove('comm-hit');
        cell.style.removeProperty('--commAlpha');
        const wrap = cell.querySelector('.commBadgeWrap');
        if (wrap) wrap.remove();
        return;
      }

      const max = Math.max(1, communityMaxCount);
      const t = Math.min(1, count / max);
      const alpha = 0.06 + t * 0.16;

      cell.classList.add('comm-hit');
      cell.style.setProperty('--commAlpha', String(alpha));

      let wrap = cell.querySelector('.commBadgeWrap');
      if (!wrap){
        wrap = document.createElement('div');
        wrap.className = 'commBadgeWrap';
        wrap.innerHTML = `
          <div class="commBadge"></div>
          <div class="commTip">
            <div class="tTitle">Wer hatte das hier?</div>
            <div class="tListViewport"><div class="tList"></div></div>
          </div>
        `;
        wrap.addEventListener('mouseenter', () => applyCommTipAutoscroll(wrap.querySelector('.tList')));
        cell.appendChild(wrap);
      }
      wrap.querySelector('.commBadge').textContent = String(count);
      wrap.querySelector('.tList').innerHTML = buildFormBreakdownHtml(k) || '<div class="inlayMeta">—</div>';
    }

    // Baut die Aufschlüsselung nach konkreter Form für das "Wer hatte das
    // hier?"-Popup (z.B. Choreogel Baile 2 / Pom Pom 2 / Sensu 2), auch wenn
    // die Punktzahl über alle Formen einer Art zusammengezählt wird.
    function buildFormBreakdownHtml(mapKey){
      const forms = communityFormBreakdown.get(mapKey);
      if (!forms || !forms.size) return '';

      const rows = [...forms.values()].sort((a,b) => (b.count-a.count) || a.display.localeCompare(b.display));

      return rows.map(row => {
        const names = row.names.size ? [...row.names].sort((a,b)=>a.localeCompare(b)).join('\n') : '—';
        return `
          <div class="inlayRow">
            <div class="inlayMon">
              <span>${escapeHtml(row.display)}</span>
              <span class="inlayCount">(${row.count})</span>
            </div>
            <div class="inlayMeta">${escapeHtml(names)}</div>
          </div>
        `;
      }).join('');
    }

    // Lässt die Namensliste im "Wer hatte das hier?"-Popup langsam
    // von allein durchscrollen, falls mehr Namen da sind als sichtbar passen.
    function applyCommTipAutoscroll(listEl){
      listEl.classList.remove('autoscroll');
      listEl.style.removeProperty('--scrollDist');
      listEl.style.removeProperty('--scrollDur');

      const viewport = listEl.parentElement;
      requestAnimationFrame(() => {
        const overflow = listEl.scrollHeight - viewport.clientHeight;
        if (overflow > 2){
          // Lesetempo statt Zeilen zählen (robust ggü. beliebigem HTML-Inhalt).
          const dur = Math.min(30, Math.max(4, overflow / 22));
          listEl.style.setProperty('--scrollDist', `-${overflow}px`);
          listEl.style.setProperty('--scrollDur', `${dur.toFixed(1)}s`);
          listEl.classList.add('autoscroll');
        }
      });
    }

    function recalcCommunityScore(){
      let score = 0;
      for (const cell of cells){
        const pokeKey = cell.dataset.pokeKey || '';
        const idx = cell.dataset.idx;
        if (!pokeKey || idx == null) continue;
        const {r,c} = idxToRC(idx);
        const k = overlayKey(r,c,toGroupKey(pokeKey));
        const count = communityCounts.get(k) || 0;
        if (count > 0) score += count;
      }
      scoreEl.textContent = String(score);
    }

    function refreshAllCommunityOverlays(){
      cells.forEach(c => updateCommunityOverlayForCell(c));
      recalcCommunityScore();
    }

    // ===== placing pokemon =====
    function playSparkleOnce(cell){
      const old = cell.querySelector('.sparkle');
      if (old) old.remove();
      const wrap = document.createElement('div');
      wrap.className = 'sparkle';
      const img = document.createElement('img');
      img.src = SHINY_SPARKLE_URL + `#t=${Date.now()}`;
      img.alt = 'Shiny';
      wrap.appendChild(img);
      cell.appendChild(wrap);
      setTimeout(() => wrap.remove(), SPARKLE_DURATION_MS);
    }

    function playShinySoundAndThen(fnAfter){
      try{
        shinyAudio.pause();
        shinyAudio.currentTime = 0;
        const onEnd = () => { shinyAudio.removeEventListener('ended', onEnd); fnAfter?.(); };
        shinyAudio.addEventListener('ended', onEnd);
        const p = shinyAudio.play();
        if (p && p.catch) p.catch(() => { shinyAudio.removeEventListener('ended', onEnd); setTimeout(()=>fnAfter?.(), SPARKLE_DURATION_MS); });
      }catch{
        setTimeout(()=>fnAfter?.(), SPARKLE_DURATION_MS);
      }
    }

    async function playCry(id){
      try{
        cryAudio.pause();
        cryAudio.currentTime = 0;
        cryAudio.src = CRY_URL(id);
        applyCryVolume();
        await cryAudio.play();
      }catch{}
    }

    async function placePokemon(entry){
      if (!entry) return;
      if (!selectedCell) randomEmptyCell();
      if (!selectedCell) return;

      hideInlay(selectedCell);

      const wantShiny = Math.random() < SHINY_CHANCE;
      const url = wantShiny ? SHINY_IMG_URL(entry.id) : IMG_URL(entry.id);

      selectedCell.dataset.pid = String(entry.id);
      selectedCell.dataset.pokeKey = String(entry.key || normKey(entry.display || ''));

      selectedCell.innerHTML = '';
      const img = document.createElement('img');
      img.alt = entry.display;
      img.src = url;
      selectedCell.appendChild(img);

      updateCommunityOverlayForCell(selectedCell);
      recalcCommunityScore();

      if (wantShiny){
        playSparkleOnce(selectedCell);
        playShinySoundAndThen(() => playCry(entry.id));
      } else {
        playCry(entry.id);
      }
    }

    // ===== autocomplete (DESKTOP) =====
    let ddIndex = -1;
    function hideDD(){ dd.classList.remove('show'); dd.innerHTML=''; ddIndex=-1; }
    function showDD(items){
      dd.innerHTML = '';
      items.forEach((it, idx) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = it.display;
        b.addEventListener('click', () => {
          input.value = it.display;
          hideDD();
          placePokemon(it);
          input.focus(); input.select();
        });
        if (idx === 0) b.classList.add('active');
        dd.appendChild(b);
      });
      dd.classList.add('show');
      ddIndex = 0;
    }

    function searchDex(q){
      q = normKey(q);
      if (!q || !dex.length) return [];
      const starts = [];
      const contains = [];
      for (const e of dex){
        const k = e.key || '';
        if (k.startsWith(q)) starts.push(e);
        else if (k.includes(q)) contains.push(e);
        if (starts.length + contains.length >= 24) break;
      }
      return starts.concat(contains).slice(0, 12);
    }

    input.addEventListener('input', () => {
      if (isMobileView()) return;
      const items = searchDex(input.value);
      if (!items.length){ hideDD(); return; }
      showDD(items);
    });

    input.addEventListener('keydown', (e) => {
      if (isMobileView()) return;
      if (!dd.classList.contains('show')){
        if (e.key === 'Enter'){
          const q = normKey(input.value);
          const exact = dex.find(x => (x.key||'') === q) || null;
          if (exact) placePokemon(exact);
        }
        return;
      }
      const buttons = Array.from(dd.querySelectorAll('button'));
      if (e.key === 'ArrowDown'){ e.preventDefault(); ddIndex = Math.min(ddIndex+1, buttons.length-1); }
      else if (e.key === 'ArrowUp'){ e.preventDefault(); ddIndex = Math.max(ddIndex-1, 0); }
      else if (e.key === 'Enter'){ e.preventDefault(); buttons[ddIndex]?.click(); return; }
      else if (e.key === 'Escape'){ e.preventDefault(); hideDD(); return; }

      buttons.forEach(b => b.classList.remove('active'));
      buttons[ddIndex]?.classList.add('active');
      buttons[ddIndex]?.scrollIntoView({block:'nearest'});
    });

    document.addEventListener('click', (e) => { if (!e.target.closest('.field')) hideDD(); });

    // ===== autocomplete (MOBILE) =====
    function hideMDD(){
      if (!mdd) return;
      mdd.classList.remove('show');
      mdd.innerHTML = '';
      mddIndex = -1;
    }
    function showMDD(items){
      if (!mdd) return;
      mdd.innerHTML = '';
      items.forEach((it, idx) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = it.display;
        b.addEventListener('click', () => {
          mIn.value = it.display;
          hideMDD();
          placePokemon(it);
          mIn.focus();
          mIn.select();
        });
        if (idx === 0) b.classList.add('active');
        mdd.appendChild(b);
      });
      mdd.classList.add('show');
      mddIndex = 0;
    }

    if (mIn){
      mIn.addEventListener('input', () => {
        if (!isMobileView()) return;
        const items = searchDex(mIn.value);
        if (!items.length){ hideMDD(); return; }
        showMDD(items);
      });

      mIn.addEventListener('keydown', (e) => {
        if (!isMobileView()) return;

        if (!mdd.classList.contains('show')){
          if (e.key === 'Enter'){
            const q = normKey(mIn.value);
            const exact = dex.find(x => (x.key||'') === q) || null;
            if (exact) placePokemon(exact);
          }
          return;
        }

        const buttons = Array.from(mdd.querySelectorAll('button'));
        if (e.key === 'ArrowDown'){ e.preventDefault(); mddIndex = Math.min(mddIndex+1, buttons.length-1); }
        else if (e.key === 'ArrowUp'){ e.preventDefault(); mddIndex = Math.max(mddIndex-1, 0); }
        else if (e.key === 'Enter'){ e.preventDefault(); buttons[mddIndex]?.click(); return; }
        else if (e.key === 'Escape'){ e.preventDefault(); hideMDD(); return; }

        buttons.forEach(b => b.classList.remove('active'));
        buttons[mddIndex]?.classList.add('active');
        buttons[mddIndex]?.scrollIntoView({block:'nearest'});
      });
    }

    document.addEventListener('click', (e) => {
      if (!isMobileView()) return;
      if (e.target.closest('#mobileBar') || e.target.closest('#mdd')) return;
      hideMDD();
    });

    // ===== Mobile Bar wiring =====
    function syncMobileDeleteLabel(){
      if (!mDelete) return;
      mDelete.textContent = deleteMode ? 'Abbrechen' : 'Löschen';
    }

    mRandom?.addEventListener('click', () => document.getElementById('randomBtn')?.click());
    mDelete?.addEventListener('click', () => document.getElementById('deleteBtn')?.click());
    mExport?.addEventListener('click', () => document.getElementById('exportBtn')?.click());
    mTour?.addEventListener('click', () => document.getElementById('tutorialBtn')?.click());

    // ===== background picker =====
    let bgObjectUrl = null;
    async function pickBackground(){
      try{
        const [fh] = await window.showOpenFilePicker({
          types: [{ description:'Bilder', accept: { 'image/*': ['.png','.jpg','.jpeg','.webp','.gif'] } }],
          multiple:false
        });
        const file = await fh.getFile();
        if (bgObjectUrl) URL.revokeObjectURL(bgObjectUrl);
        bgObjectUrl = URL.createObjectURL(file);
        bgLayer.style.backgroundImage = `url("${bgObjectUrl}")`;
        bgLayer.style.opacity = '0.55';
      }catch{}
    }
    function clearBackground(){
      if (bgObjectUrl) URL.revokeObjectURL(bgObjectUrl);
      bgObjectUrl = null;
      bgLayer.style.backgroundImage = '';
      bgLayer.style.opacity = '0';
    }

    // ===== export/import community =====
    function downloadJson(obj, filename){
      const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function buildMySolutionPayload(){
      const cellsOut = [];
      cells.forEach((cell) => {
        const pid = cell.dataset.pid || '';
        const pokeKey = cell.dataset.pokeKey || '';
        if (!pid || !pokeKey) return;
        const idx = cell.dataset.idx;
        const {r,c} = idxToRC(idx);
        cellsOut.push({ r, c, id: Number(pid), key: pokeKey });
      });

      const presetCols = Array.from(document.querySelectorAll('.hdr .hdrText')).map(s => s.textContent);
      const presetRows = Array.from(document.querySelectorAll('.rowhdr .rowhdrText')).map(s => s.textContent);

      return {
        version: 1,
        createdAt: new Date().toISOString(),
        gridSize: 5,
        columns: presetCols,
        rows: presetRows,
        cells: cellsOut
      };
    }

    function exportAndOpenForm(){
      const nameRaw = prompt(
        'Bitte benenne die Datei nach dir (z.B. DerHaseMitHut.json):',
        'DeinName.json'
      );
      if (nameRaw === null) return;

      let fn = String(nameRaw).trim();
      if (!fn) { toast('Export abgebrochen.'); return; }
      if (!fn.toLowerCase().endsWith('.json')) fn += '.json';

      const payload = buildMySolutionPayload();
      downloadJson(payload, fn);

      setTimeout(() => window.open(GOOGLE_FORM_URL, '_blank', 'noopener'), 250);
      toast('Exportiert. Formular wird geöffnet…');
    }

    function addCommunityDataset(dataset, who){
      if (!dataset || !Array.isArray(dataset.cells)) return;
      for (const it of dataset.cells){
        const r = Number(it.r), c = Number(it.c);
        const rawKey = String(it.key || '').trim();
        if (!Number.isFinite(r) || !Number.isFinite(c) || !rawKey) continue;
        if (r<0||r>4||c<0||c>4) continue;

        const key = toGroupKey(rawKey);
        const mapKey = overlayKey(r,c,key);
        const next = (communityCounts.get(mapKey) || 0) + 1;
        communityCounts.set(mapKey, next);
        communityMaxCount = Math.max(communityMaxCount, next);

        let forms = communityFormBreakdown.get(mapKey);
        if (!forms){ forms = new Map(); communityFormBreakdown.set(mapKey, forms); }
        let frec = forms.get(rawKey);
        if (!frec){ frec = { count:0, names:new Set(), display: dexByKey.get(rawKey) || rawKey }; forms.set(rawKey, frec); }
        frec.count += 1;
        if (who) frec.names.add(who);

        const cellKey = `${r},${c}`;
        let byMon = communityCellIndex.get(cellKey);
        if (!byMon){ byMon = new Map(); communityCellIndex.set(cellKey, byMon); }
        let rec = byMon.get(key);
        if (!rec){ rec = { count:0, names:new Set() }; byMon.set(key, rec); }
        rec.count += 1;
        if (who) rec.names.add(who);
      }
    }

    async function importCommunityAdditive(){
      const handles = await window.showOpenFilePicker({
        types: [{ description:'JSON', accept: { 'application/json':['.json'] } }],
        multiple: true
      });
      let loaded = 0;
      for (const fh of handles){
        const file = await fh.getFile();
        const obj = JSON.parse(await file.text());
        addCommunityDataset(obj, baseNameNoExt(file.name));
        loaded++;
      }
      communityDatasetCount += loaded;
      setCommStatus();
      refreshAllCommunityOverlays();
    }

    function clearCommunity(){
      hideAllInlays();
      communityDatasetCount = 0;
      communityCounts.clear();
      communityFormBreakdown.clear();
      communityCellIndex.clear();
      communityMaxCount = 0;
      setCommStatus();
      refreshAllCommunityOverlays();
    }

    // ===== Tutorial logic (unchanged) =====
    function clearTourGlows(){
      document.querySelectorAll('.tourGlow').forEach(el => el.classList.remove('tourGlow'));
    }

    function getExampleCellAndHeaders(){
      const cell = cells[0];
      const col = document.getElementById('colHdr0');
      const row = document.getElementById('rowHdr0');
      return { cell, col, row };
    }

    const TOUR_STEPS = [
      { text:
`Herzlich willkommen zu Hases PokéGrid. Danke, dass Du mitmachst.

Deine Aufgabe ist es, alle 25 Felder der Tabelle mit verschiedenen Pokémon zu füllen.
Dabei gibt es KEIN richtig oder falsch.

Nehme einfach das Pokémon, das DU für am passendsten hältst. Achte aber darauf, dass Du A) kein Pokémon doppelt verwendest und B) das Pokémon auf BEIDE Kategorien zutreffen muss!` },
      { text:`Um die Tabelle zu füllen, klicke hier auf „Zufälliges leeres Feld“.`,
        highlight: () => [isMobileView() ? document.getElementById('mRandom') : document.getElementById('randomBtn')] },
      { text:
`Nutze dann die Eingabemaske, um ein Pokémon auszuwählen, und bestätige es mit Enter.

Dann kannst Du erneut ein zufälliges leeres Feld auswählen lassen, bis alle Felder gefüllt sind.`,
        highlight: () => {
          const { cell, col, row } = getExampleCellAndHeaders();
          const inp = isMobileView() ? document.getElementById('mobilePokeInput') : document.getElementById('pokeInput');
          return [inp, cell, col, row];
        } },
      { text:`Wenn Du eine Auswahl ändern möchtest, z.B. weil Du ein Pokémon, dass Du schon genutzt hast, woanders für besser passend findest, klicke die Zelle an und füge einfach ein neues Pokémon ein.` },
      { text:
`Ist die Tabelle gefüllt, lade mir Deine Antwort hoch:

Klicke auf „Export“, benenne die .json Datei nach Dir (z.B. „DerHaseMitHut.json“).
Dieser Name würde dann im Video sichtbar sein.

Im automatisch geöffneten Google Formular lädst Du dann diese .json Datei hoch. Fertig! Sollte sich keine Seite öffnen, klicke in der Spalte rechts auf den Knopf "Link zum Formular", der dir den Link in die Zwischenablage kopiert oder schicke mir die Datei auf Discord.`,
        highlight: () => [isMobileView() ? document.getElementById('mExport') : document.getElementById('exportBtn')] },
      { text:
`Nun viel Spaß!

Wenn noch Fragen sind, meld Dich gerne bei mir auf Discord!
(Meinen Server findest Du unter jedem meiner Videos verlinkt!)

Hase!` }
    ];

    function unionRect(rects){
      const xs1 = rects.map(r=>r.left);
      const ys1 = rects.map(r=>r.top);
      const xs2 = rects.map(r=>r.right);
      const ys2 = rects.map(r=>r.bottom);
      return { left: Math.min(...xs1), top: Math.min(...ys1), right: Math.max(...xs2), bottom: Math.max(...ys2) };
    }

    function setSpotlightRect(rect){
      if (!rect){
        tourDim.style.opacity = '1';
        return;
      }
      tourDim.style.opacity = '0';
    }

    function positionTourCardNear(rect){
      const margin = 14;
      const gap = 14;

      const cw = tourCard.offsetWidth;
      const ch = tourCard.offsetHeight;

      if (!rect){
        const x = Math.round((window.innerWidth - cw) / 2);
        const y = Math.round((window.innerHeight - ch) / 2);
        tourCard.style.left = `${clamp(x, margin, window.innerWidth - cw - margin)}px`;
        tourCard.style.top  = `${clamp(y, margin, window.innerHeight - ch - margin)}px`;
        return;
      }

      const spaceRight = window.innerWidth - rect.right - margin;
      const spaceLeft  = rect.left - margin;
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;

      let left, top;

      if (spaceRight >= cw + gap){
        left = rect.right + gap;
        top = clamp(rect.top + (rect.bottom-rect.top)/2 - ch/2, margin, window.innerHeight - ch - margin);
      } else if (spaceLeft >= cw + gap){
        left = rect.left - gap - cw;
        top = clamp(rect.top + (rect.bottom-rect.top)/2 - ch/2, margin, window.innerHeight - ch - margin);
      } else if (spaceBelow >= ch + gap){
        left = clamp(rect.left + (rect.right-rect.left)/2 - cw/2, margin, window.innerWidth - cw - margin);
        top = rect.bottom + gap;
      } else {
        left = clamp(rect.left + (rect.right-rect.left)/2 - cw/2, margin, window.innerWidth - cw - margin);
        top = clamp(rect.top - gap - ch, margin, window.innerHeight - ch - margin);
      }

      tourCard.style.left = `${Math.round(left)}px`;
      tourCard.style.top  = `${Math.round(top)}px`;
    }

    function renderTour(){
      const total = TOUR_STEPS.length;
      const step = TOUR_STEPS[tourIndex];

      tourTextEl.textContent = step.text;
      tourStepEl.textContent = `Tutorial ${tourIndex+1}/${total}`;

      tourBackBtn.disabled = tourIndex === 0;
      tourBackBtn.style.opacity = tourIndex === 0 ? .55 : 1;

      tourNextBtn.textContent = (tourIndex === total-1) ? 'Fertig' : 'Weiter';

      clearTourGlows();

      let highlightEls = [];
      if (typeof step.highlight === 'function'){
        highlightEls = (step.highlight() || []).filter(Boolean);
        highlightEls.forEach(el => el.classList.add('tourGlow'));
      }

      if (!highlightEls.length){
        setSpotlightRect(null);
        positionTourCardNear(null);
      } else {
        const rects = highlightEls.map(el => el.getBoundingClientRect());
        const rect = unionRect(rects);
        setSpotlightRect(rect);
        requestAnimationFrame(() => positionTourCardNear(rect));
      }
    }

    function startTour(force=false){
      if (!force && localStorage.getItem(LS_TOUR_DONE) === '1') return;
      tourActive = true;
      tourIndex = 0;
      tourEl.classList.add('show');
      tourEl.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => { positionTourCardNear(null); renderTour(); });
    }

    function endTour(markDone=true){
      tourActive = false;
      clearTourGlows();
      setSpotlightRect(null);
      tourEl.classList.remove('show');
      tourEl.setAttribute('aria-hidden', 'true');
      if (markDone) localStorage.setItem(LS_TOUR_DONE, '1');
    }

    tourBackBtn.addEventListener('click', () => { if (!tourActive) return; tourIndex = Math.max(0, tourIndex - 1); renderTour(); });
    tourNextBtn.addEventListener('click', () => { if (!tourActive) return; if (tourIndex >= TOUR_STEPS.length - 1) { endTour(true); return; } tourIndex++; renderTour(); });
    tourSkipBtn.addEventListener('click', () => endTour(true));
    tutorialBtn?.addEventListener('click', () => startTour(true));
    document.addEventListener('keydown', (e) => { if (!tourActive) return; if (e.key === 'Escape') endTour(true); });

    window.addEventListener('resize', () => {
      headerSpans.forEach(sp => fitHeaderText(sp));
      if (tourActive) renderTour();
    });

    // ===== controls =====
    document.getElementById('randomBtn').addEventListener('click', () => {
      hideAllInlays();
      randomEmptyCell();
    });

    const deleteBtn = document.getElementById('deleteBtn');
    function setDeleteMode(on){
      deleteMode = on;
      deleteBtn.textContent = on ? 'Abbrechen' : 'Löschen';
      syncMobileDeleteLabel();
      cells.forEach(c => c.classList.toggle('delete-mode', on));
    }
    deleteBtn.addEventListener('click', () => setDeleteMode(!deleteMode));

    document.getElementById('resetBtn').addEventListener('click', () => {
      if (confirm('Wirklich alle Zellen leeren? (Titel bleiben)')) resetGrid();
    });

    document.getElementById('exportBtn').addEventListener('click', exportAndOpenForm);

    const formLinkBtn = document.getElementById('formLinkBtn');
    let formLinkResetTimer = null;
    function flashFormLinkBtn(text){
      clearTimeout(formLinkResetTimer);
      if (!formLinkBtn.dataset.origText) formLinkBtn.dataset.origText = formLinkBtn.textContent;
      formLinkBtn.textContent = text;
      formLinkResetTimer = setTimeout(() => {
        formLinkBtn.textContent = formLinkBtn.dataset.origText;
      }, 1800);
    }

    formLinkBtn.addEventListener('click', async () => {
      try{
        await navigator.clipboard.writeText(GOOGLE_FORM_URL);
        toast('Formular-Link kopiert!');
        flashFormLinkBtn('✅ Link kopiert!');
      }catch{
        const ta = document.createElement('textarea');
        ta.value = GOOGLE_FORM_URL;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try{
          document.execCommand('copy');
          toast('Formular-Link kopiert!');
          flashFormLinkBtn('✅ Link kopiert!');
        }catch{
          toast('Kopieren fehlgeschlagen.');
          flashFormLinkBtn('❌ Kopieren fehlgeschlagen');
        }
        ta.remove();
      }
    });

    document.getElementById('importCommBtn').addEventListener('click', importCommunityAdditive);
    document.getElementById('clearCommBtn').addEventListener('click', () => { if (confirm('Community-Daten wirklich löschen?')) clearCommunity(); });

    document.getElementById('bgPickBtn').addEventListener('click', pickBackground);
    document.getElementById('bgClearBtn').addEventListener('click', clearBackground);

    const presenterBtn = document.getElementById('presenterBtn');
    function togglePresenter(){
      presenter = !presenter;
      document.body.classList.toggle('presenter', presenter);
      hideAllInlays();
    }
    presenterBtn.addEventListener('click', togglePresenter);

    const otherHoverBtn = document.getElementById('otherHoverBtn');
    function updateOtherHoverBtn(){ otherHoverBtn.textContent = `Community-Antworten: ${otherHoverMode ? 'AN' : 'AUS'}`; }
    otherHoverBtn.addEventListener('click', () => {
      otherHoverMode = !otherHoverMode;
      updateOtherHoverBtn();
      if (!otherHoverMode) hideAllInlays();
    });
    updateOtherHoverBtn();

    document.addEventListener('keydown', (e) => {
      if (tourActive) return;
      if (e.target.matches('input,[contenteditable="true"]')) return;
      if (e.key.toLowerCase() === 'r') { hideAllInlays(); randomEmptyCell(); }
      if (e.key.toLowerCase() === 'd') setDeleteMode(!deleteMode);
      if (e.key.toLowerCase() === 'h') togglePresenter();
    });

    // ===== Hosted init =====
    async function initHosted(){
      try{
        setStatus('Status: lädt Daten…');

        const mapRes = await fetch(MAPPING_URL, { cache: "no-store" });
        const mapObj = await mapRes.json();
        dex = Array.isArray(mapObj.entries) ? mapObj.entries : [];
        dexByKey = new Map(dex.map(e => [e.key, e.display]));
        buildGroupMaps();

        try{
          const preRes = await fetch(PRESET_URL, { cache: "no-store" });
          if (preRes.ok){
            const preset = await preRes.json();
            if (preset){
              const cols = Array.isArray(preset.columns) ? preset.columns : [];
              const rows = Array.isArray(preset.rows) ? preset.rows : [];
              const colSpans = Array.from(document.querySelectorAll('.hdr .hdrText'));
              const rowSpans = Array.from(document.querySelectorAll('.rowhdr .rowhdrText'));
              for (let i=0;i<Math.min(5,colSpans.length,cols.length);i++) colSpans[i].textContent = cols[i] ?? colSpans[i].textContent;
              for (let i=0;i<Math.min(5,rowSpans.length,rows.length);i++) rowSpans[i].textContent = rows[i] ?? rowSpans[i].textContent;
            }
          }
        }catch{}

        shinyAudio = new Audio(SHINY_SOUND_URL);
        applyShinyVolume();

        setStatus(`Eingerichtet ✅ (${dex.length} Einträge)`);
        headerSpans.forEach(sp => fitHeaderText(sp));
        toast('Bereit.');

        setCommStatus();
        recalcCommunityScore();

        // Tutorial automatisch (nur einmal)
        startTour(false);

      }catch(err){
        console.error(err);
        setStatus('Fehler: Daten konnten nicht geladen werden');
        toast('Bitte prüfe: dex_de.json & grid_preset.json im Pages-Repo.');
      }
    }

    // init UI
    selectCell(cells[0]);
    randomEmptyCell();
    setCommStatus();
    recalcCommunityScore();
    syncMobileDeleteLabel();

    initHosted();
