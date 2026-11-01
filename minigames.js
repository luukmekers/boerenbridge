// Minigames om te bepalen wie deelt of wie de punten bijhoudt.
// Gebruik: MiniGames.open({ players: ['Anna', ...], stake: 'dealer' | 'keeper', onDone: index => {} })
const MiniGames = (() => {
  // ---- hulpjes ----
  const SUITS = [['♠', false], ['♥', true], ['♦', true], ['♣', false]];
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'V', 'H', 'A'];
  const STAKE = { dealer: 'gaat delen', keeper: 'houdt de punten bij' };
  const COLORS = ['#f5b301', '#3ddc84', '#5ab0ff', '#ff6b8b', '#b98cff', '#ff9f43', '#2ee6d6', '#e8eaf0', '#ffd166', '#9be564', '#ff7ae0', '#a3b1ff'];

  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const newDeck = () => shuffle(SUITS.flatMap(([s, red], si) => RANKS.map((r, i) => ({ r, s, red, v: (i + 2) * 4 + si }))));
  const cardHTML = (c, cls = '') => `<div class="mg-card ${cls} ${c.red ? 'red' : ''}"><span>${c.r}</span><span>${c.s}</span></div>`;
  const SIMON = ['#3ddc84', '#ff5c5c', '#f5d000', '#5ab0ff'];
  const INK = [['rood', '#ff5c5c'], ['blauw', '#5ab0ff'], ['groen', '#3ddc84'], ['geel', '#f5d000']];
  const fmt1 = v => v.toFixed(1).replace('.', ',');

  function makeSum() {
    const t = rnd(0, 2);
    let a, b, q, ans;
    if (t === 0) { a = rnd(12, 69); b = rnd(6, 39); q = `${a} + ${b}`; ans = a + b; }
    else if (t === 1) { a = rnd(25, 99); b = rnd(6, a - 6); q = `${a} − ${b}`; ans = a - b; }
    else { a = rnd(3, 9); b = rnd(3, 12); q = `${a} × ${b}`; ans = a * b; }
    // foute antwoorden die er dichtbij liggen, zodat gokken niet helpt
    const opts = new Set([ans]);
    for (const d of shuffle([-10, -2, -1, 1, 2, 10, t === 2 ? a : 3, t === 2 ? -a : -3])) {
      if (opts.size === 4) break;
      if (ans + d > 0) opts.add(ans + d);
    }
    return { q, ans, opts: shuffle([...opts]) };
  }

  // Hoe rond is een getekende lijn? null = te klein of te kort om mee te tellen.
  function rateCircle(pts) {
    if (pts.length < 15) return null;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const radii = pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
    const r = radii.reduce((a, b) => a + b) / radii.length;
    if (r < 25) return null;
    const sd = Math.sqrt(radii.reduce((s, v) => s + (v - r) ** 2, 0) / radii.length);
    // hoeveel graden je rond bent gegaan
    let turn = 0;
    for (let i = 1; i < pts.length; i++) {
      let d = Math.atan2(pts[i][1] - cy, pts[i][0] - cx) - Math.atan2(pts[i - 1][1] - cy, pts[i - 1][0] - cx);
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      turn += d;
    }
    const cover = Math.abs(turn);
    if (cover < Math.PI) return null;
    const gap = Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) / r;
    const score = Math.max(0, 100 - sd / r * 250 - Math.max(0, gap - 0.25) * 40) * Math.min(1, cover / (2 * Math.PI * 0.95));
    return { score, cx, cy, r };
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let root = null, ctx = null, timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const every = (fn, ms) => timers.push(setInterval(fn, ms));
  const clearTimers = () => { timers.forEach(t => { clearTimeout(t); clearInterval(t); }); timers = []; };
  const name = p => esc(ctx.players[p]);
  const all = () => ctx.players.map((_, i) => i);

  function show(html) {
    clearTimers();
    root.innerHTML = `<div class="mg-wrap">${html}</div>`;
    root.scrollTop = 0;
    const x = root.querySelector('[data-x]');
    if (x) x.onclick = close;
    return root.querySelector('.mg-wrap');
  }
  const header = g => `<div class="mg-top"><h1>${g.icon} ${g.name}</h1><button class="mg-x" data-x aria-label="Sluiten">✕</button></div>`;

  // ---- schermen ----
  function open(opts) {
    ctx = opts;
    if (!root) {
      root = document.createElement('div');
      root.id = 'mg';
      document.body.appendChild(root);
    }
    menu();
  }

  function close() {
    clearTimers();
    if (root) root.remove();
    root = null;
  }

  function menu() {
    const w = show(`
      <div class="mg-top"><h1>Minigame</h1><button class="mg-x" data-x aria-label="Sluiten">✕</button></div>
      <p class="sub">De verliezer ${STAKE[ctx.stake]}.</p>
      <button class="btn" data-random>🎲 Willekeurig spel</button>
      <div class="mg-grid">${GAMES.map((g, i) => `
        <button class="mg-tile" data-g="${i}"><span class="mg-ic">${g.icon}</span><b>${g.name}</b><small>${g.short}</small></button>`).join('')}
      </div>`);
    w.querySelector('[data-random]').onclick = () => intro(GAMES[rnd(0, GAMES.length - 1)]);
    w.querySelectorAll('[data-g]').forEach(b => b.onclick = () => intro(GAMES[+b.dataset.g]));
  }

  function intro(g) {
    const w = show(`
      ${header(g)}
      <p class="mg-rules">${g.rules}</p>
      <p class="hint">De verliezer ${STAKE[ctx.stake]}.</p>
      <button class="btn" data-go>Start</button>
      <button class="btn ghost" data-menu>Ander spel</button>`);
    w.querySelector('[data-go]').onclick = () => g.play(all());
    w.querySelector('[data-menu]').onclick = menu;
  }

  function lose(p, g) {
    const w = show(`
      <div class="mg-result">
        <div class="mg-big">${g.icon}</div>
        <p class="hint">${g.name}</p>
        <div class="mg-loser">${name(p)}</div>
        <p class="mg-stake">${STAKE[ctx.stake]}</p>
      </div>
      <button class="btn" data-ok>Akkoord</button>
      <div class="row">
        <button class="btn ghost" data-again>Nog een keer</button>
        <button class="btn ghost" data-menu>Ander spel</button>
      </div>`);
    w.querySelector('[data-ok]').onclick = () => { const done = ctx.onDone; close(); done(p); };
    w.querySelector('[data-again]').onclick = () => g.play(all());
    w.querySelector('[data-menu]').onclick = menu;
  }

  const scoreList = results => results.length
    ? `<div class="mg-list">${results.map(r => `<div><span>${name(r.p)}</span><b>${r.label}</b></div>`).join('')}</div>`
    : '';

  // Om de beurt een poging; de slechtste score verliest. Bij gelijkspel spelen alleen de gelijken opnieuw.
  function turns(g, contenders) {
    const results = [];
    const shared = g.setup ? g.setup() : null;
    let i = 0;

    function next() {
      const p = contenders[i];
      const w = show(`
        ${header(g)}
        <p class="mg-turn">Beurt: <b>${name(p)}</b> <span class="hint">(${i + 1}/${contenders.length})</span></p>
        <div class="mg-stage"></div>
        <div class="mg-after"></div>
        ${scoreList(results)}`);
      g.turn(w.querySelector('.mg-stage'), shared, (v, label) => {
        results.push({ p, v, label });
        const last = i + 1 === contenders.length;
        const after = w.querySelector('.mg-after');
        after.innerHTML = `<p class="mg-res">${label}</p>
          <button class="btn">${last ? 'Uitslag' : `Volgende: ${name(contenders[i + 1])}`}</button>`;
        after.querySelector('button').onclick = () => { i++; last ? finish() : next(); };
      });
    }

    function finish() {
      const vals = results.map(r => r.v);
      const worst = g.worse === 'low' ? Math.min(...vals) : Math.max(...vals);
      const losers = results.filter(r => r.v === worst).map(r => r.p);
      if (losers.length === 1) return lose(losers[0], g);
      const w = show(`
        ${header(g)}
        <h2>Gelijkspel!</h2>
        <p>${losers.map(name).join(' en ')} spelen nog een keer.</p>
        ${scoreList(results)}
        <button class="btn" data-go>Verder</button>`);
      w.querySelector('[data-go]').onclick = () => turns(g, losers);
    }

    next();
  }

  // ---- de spellen ----
  const GAMES = [
    {
      icon: '🧠', name: 'Kleurenreeks', short: 'Onthoud de reeks',
      rules: 'Er lichten een paar vlakken op. Tik ze daarna in dezelfde volgorde na. Elke ronde komt er één kleur bij. Wie de kortste reeks onthoudt, verliest.',
      worse: 'low',
      play(ps) { turns(this, ps); },
      // iedereen krijgt dezelfde reeks
      setup: () => Array.from({ length: 30 }, () => rnd(0, 3)),
      turn(stage, seq, done) {
        stage.innerHTML = `
          <div class="mg-simon">${SIMON.map((c, i) => `<button class="mg-sq" data-i="${i}" style="--c:${c}"></button>`).join('')}</div>
          <p class="mg-msg">Tik op Start en kijk goed</p>
          <button class="btn">Start</button>`;
        const sqs = [...stage.querySelectorAll('.mg-sq')], msg = stage.querySelector('.mg-msg');
        let len = 3, pos = 0, input = false;
        const flash = (i, ms) => { sqs[i].classList.add('lit'); later(() => sqs[i].classList.remove('lit'), ms); };
        const playSeq = () => {
          input = false; pos = 0;
          msg.textContent = `Kijk goed… (${len} kleuren)`;
          const step = Math.max(380, 650 - len * 20);
          for (let k = 0; k < len; k++) later(() => flash(seq[k], step * 0.7), 500 + k * step);
          later(() => { input = true; msg.textContent = 'Jouw beurt!'; }, 500 + len * step);
        };
        stage.querySelector('.btn').onclick = e => { e.currentTarget.remove(); playSeq(); };
        sqs.forEach(s => s.onpointerdown = () => {
          if (!input) return;
          const i = +s.dataset.i;
          flash(i, 180);
          if (i !== seq[pos]) {
            input = false;
            msg.textContent = 'Fout!';
            return done(len - 1, `${len - 1} kleuren goed`);
          }
          if (++pos < len) return;
          input = false;
          if (len === seq.length) return done(len, `${len} kleuren goed`);
          len++;
          msg.textContent = 'Goed!';
          later(playSeq, 700);
        });
      },
    },
    {
      icon: '🃏', name: 'Kaartgeheugen', short: 'Welke kaart ontbreekt?',
      rules: 'Je ziet een paar kaarten. Daarna is er één weg: welke? Elke ronde komt er een kaart bij. Wie de minste rondes goed heeft, verliest.',
      worse: 'low',
      play(ps) { turns(this, ps); },
      setup() {
        const rounds = [];
        for (let n = 3; n <= 12; n++) {
          const d = newDeck(), shown = d.splice(0, n), miss = shown[rnd(0, n - 1)];
          // lastige keuzes: dezelfde waarde en dezelfde kleur als de ontbrekende kaart
          const opts = [miss, ...[d.find(c => c.r === miss.r), d.find(c => c.s === miss.s)].filter(Boolean)];
          while (opts.length < 4) opts.push(d.find(c => !opts.includes(c)));
          rounds.push({ shown, rest: shuffle(shown.filter(c => c !== miss)), miss, opts: shuffle(opts) });
        }
        return rounds;
      },
      turn(stage, rounds, done) {
        stage.innerHTML = `
          <p class="mg-msg">Tik op Start en onthoud de kaarten</p>
          <div class="mg-cards"></div>
          <div class="mg-picks"></div>
          <button class="btn">Start</button>`;
        const msg = stage.querySelector('.mg-msg'), cards = stage.querySelector('.mg-cards'), picks = stage.querySelector('.mg-picks');
        let k = 0;
        const round = () => {
          const r = rounds[k];
          picks.innerHTML = '';
          cards.innerHTML = r.shown.map(c => cardHTML(c, 'sm')).join('');
          msg.textContent = `Ronde ${k + 1}: onthoud deze ${r.shown.length} kaarten`;
          later(() => {
            cards.innerHTML = r.rest.map(c => cardHTML(c, 'sm')).join('');
            msg.textContent = 'Welke kaart ontbreekt?';
            picks.innerHTML = r.opts.map((c, i) => `<button class="mg-pick" data-i="${i}">${cardHTML(c, 'sm')}</button>`).join('');
            picks.querySelectorAll('.mg-pick').forEach(b => b.onclick = () => {
              picks.querySelectorAll('.mg-pick').forEach(x => x.disabled = true);
              const good = r.opts[+b.dataset.i] === r.miss;
              picks.children[r.opts.indexOf(r.miss)].classList.add('right');
              if (!good) {
                b.classList.add('wrong');
                return done(k, `${k} ${k === 1 ? 'ronde' : 'rondes'} goed`);
              }
              if (++k === rounds.length) return done(k, `${k} rondes goed`);
              msg.textContent = 'Goed!';
              later(round, 800);
            });
          }, 2000 + 400 * r.shown.length);
        };
        stage.querySelector('.btn').onclick = e => { e.currentTarget.remove(); round(); };
      },
    },
    {
      icon: '🎯', name: 'Stop de balk', short: 'Stop precies in het midden',
      rules: 'Een streepje schuift heen en weer. Tik op het vlak als het precies in het midden staat. Je krijgt 3 pogingen en het gaat steeds sneller. Wie gemiddeld het verst naast zit, verliest.',
      worse: 'high',
      play(ps) { turns(this, ps); },
      turn(stage, _, done) {
        const SPEEDS = [0.7, 1.1, 1.6]; // keer heen per seconde
        stage.innerHTML = `
          <div class="mg-track"><div class="mg-zone"></div><div class="mg-mark"></div></div>
          <p class="mg-msg">Tik op het vlak om te starten</p>`;
        const track = stage.querySelector('.mg-track'), mark = stage.querySelector('.mg-mark'), msg = stage.querySelector('.mg-msg');
        let phase = 'idle', attempt = 0, t0 = 0;
        const offs = [];
        const posAt = now => { const ph = ((now - t0) / 1000 * SPEEDS[attempt]) % 2; return ph < 1 ? ph : 2 - ph; };
        const start = () => {
          phase = 'run'; t0 = performance.now(); mark.classList.remove('hit');
          msg.textContent = `Poging ${attempt + 1} van 3`;
          every(() => { mark.style.left = posAt(performance.now()) * 100 + '%'; }, 16);
        };
        track.onpointerdown = () => {
          if (phase === 'idle') return start();
          if (phase !== 'run') return;
          clearTimers();
          const x = posAt(performance.now()), off = Math.abs(x - 0.5) * 100;
          mark.style.left = x * 100 + '%'; mark.classList.add('hit');
          offs.push(off);
          msg.textContent = `${fmt1(off)}% ernaast`;
          if (++attempt < 3) { phase = 'pause'; return later(start, 1100); }
          phase = 'done';
          const avg = offs.reduce((a, b) => a + b) / offs.length;
          done(avg, `gemiddeld ${fmt1(avg)}% ernaast`);
        };
      },
    },
    {
      icon: '🧱', name: 'Toren bouwen', short: 'Bouw de hoogste toren',
      rules: 'Een blok schuift heen en weer. Tik om het neer te leggen. Wat over de rand steekt valt eraf, dus je blok wordt steeds smaller. Mis je de toren helemaal, dan ben je klaar. De laagste toren verliest.',
      worse: 'low',
      play(ps) { turns(this, ps); },
      turn(stage, _, done) {
        const ROWS = 9;
        stage.innerHTML = `<div class="mg-tower"></div><p class="mg-msg">Tik op het vlak om te beginnen</p>`;
        const tower = stage.querySelector('.mg-tower'), msg = stage.querySelector('.mg-msg');
        const layers = [{ l: 20, w: 60 }];
        let phase = 'idle', t0 = 0, mv = null;
        const level = () => layers.length - 1;
        const speed = () => Math.min(120, 40 + 6 * level()); // % van de breedte per seconde
        const xAt = now => {
          const w = layers[level()].w, range = 100 - w, d = (now - t0) / 1000 * speed() % (2 * range);
          return d < range ? d : 2 * range - d;
        };
        const blk = (b, i, cls) => `<div class="mg-blk ${cls}" style="left:${b.l}%;width:${b.w}%;bottom:${i * 100 / ROWS}%;height:calc(${100 / ROWS}% - 2px)"></div>`;
        const draw = () => {
          const off = Math.max(0, layers.length + 1 - ROWS);
          tower.innerHTML = layers.map((b, i) => i < off ? '' : blk(b, i - off, i ? '' : 'base')).join('')
            + blk({ l: 0, w: layers[level()].w }, layers.length - off, 'mv');
          mv = tower.querySelector('.mv');
          t0 = performance.now();
        };
        tower.onpointerdown = () => {
          if (phase === 'idle') {
            phase = 'run'; draw(); msg.textContent = 'Hoogte: 0';
            return every(() => { mv.style.left = xAt(performance.now()) + '%'; }, 16);
          }
          if (phase !== 'run') return;
          const prev = layers[level()], x = xAt(performance.now());
          let l = Math.max(x, prev.l), w = Math.min(x + prev.w, prev.l + prev.w) - l;
          if (Math.abs(x - prev.l) < 1.5) { l = prev.l; w = prev.w; } // bijna perfect telt als perfect
          if (w <= 0) {
            phase = 'done'; clearTimers();
            mv.style.left = x + '%'; mv.classList.add('miss');
            return done(level(), `${level()} ${level() === 1 ? 'verdieping' : 'verdiepingen'}`);
          }
          layers.push({ l, w });
          msg.textContent = `Hoogte: ${level()}`;
          draw();
        };
      },
    },
    {
      icon: '➕', name: 'Snelrekenen', short: 'Zoveel mogelijk sommen',
      rules: 'Je hebt 20 seconden. Tik bij elke som het goede antwoord. Goed is +1 punt, fout is −1 punt. Wie de minste punten heeft, verliest.',
      worse: 'low',
      play(ps) { turns(this, ps); },
      setup: () => Array.from({ length: 80 }, makeSum),
      turn(stage, sums, done) {
        stage.innerHTML = `
          <div class="mg-timer">20,0 s · 0 punten</div>
          <div class="mg-q">Klaar?</div>
          <div class="mg-opts"></div>
          <button class="btn">Start</button>`;
        const timer = stage.querySelector('.mg-timer'), q = stage.querySelector('.mg-q'), opts = stage.querySelector('.mg-opts');
        let k = 0, pts = 0, t0 = 0, over = false;
        const tick = () => { timer.textContent = `${fmt1(Math.max(0, 20 - (performance.now() - t0) / 1000))} s · ${pts} punten`; };
        const ask = () => {
          const s = sums[k];
          q.textContent = s.q;
          opts.innerHTML = s.opts.map(v => `<button class="mg-opt" data-v="${v}">${v}</button>`).join('');
          opts.querySelectorAll('.mg-opt').forEach(b => b.onclick = () => {
            if (over) return;
            pts += +b.dataset.v === s.ans ? 1 : -1;
            q.classList.toggle('bad', +b.dataset.v !== s.ans);
            k++; tick(); ask();
          });
        };
        stage.querySelector('.btn').onclick = e => {
          e.currentTarget.remove();
          t0 = performance.now(); ask();
          every(tick, 100);
          later(() => {
            over = true; clearTimers(); tick();
            q.classList.remove('bad'); q.textContent = 'Tijd!';
            opts.querySelectorAll('.mg-opt').forEach(b => b.disabled = true);
            done(pts, `${pts} ${pts === 1 || pts === -1 ? 'punt' : 'punten'}`);
          }, 20000);
        };
      },
    },
    {
      icon: '🎨', name: 'Kleurwoord', short: 'Tik de kleur, niet het woord',
      rules: 'Je ziet een kleur geschreven in een andere kleur, bijvoorbeeld ROOD in blauwe letters. Tik de kleur van de letters (hier: blauw). 15 woorden, elke fout kost 2 strafseconden. De traagste verliest.',
      worse: 'high',
      play(ps) { turns(this, ps); },
      setup: () => Array.from({ length: 15 }, () => {
        const w = rnd(0, 3);
        return { w, ink: (w + rnd(1, 3)) % 4 };
      }),
      turn(stage, items, done) {
        stage.innerHTML = `
          <div class="mg-word">Klaar?</div>
          <div class="mg-opts">${INK.map(([n], i) => `<button class="mg-opt" data-i="${i}" disabled>${n}</button>`).join('')}</div>
          <p class="mg-msg"></p>
          <button class="btn">Start</button>`;
        const word = stage.querySelector('.mg-word'), msg = stage.querySelector('.mg-msg'), btns = [...stage.querySelectorAll('.mg-opt')];
        let k = 0, errors = 0, t0 = 0;
        const showItem = () => {
          const it = items[k];
          word.textContent = INK[it.w][0].toUpperCase();
          word.style.color = INK[it.ink][1];
          msg.textContent = `${k + 1} / ${items.length}${errors ? ` · ${errors} fout` : ''}`;
        };
        btns.forEach(b => b.onclick = () => {
          if (+b.dataset.i !== items[k].ink) errors++;
          if (++k < items.length) return showItem();
          btns.forEach(x => x.disabled = true);
          const s = (performance.now() - t0) / 1000 + errors * 2;
          word.textContent = `${fmt1(s)} s`; word.style.color = '';
          msg.textContent = errors ? `inclusief ${errors * 2} strafseconden` : 'geen fouten!';
          done(s, `${fmt1(s)} s (${errors} fout)`);
        });
        stage.querySelector('.btn').onclick = e => {
          e.currentTarget.remove();
          btns.forEach(x => x.disabled = false);
          t0 = performance.now(); showItem();
        };
      },
    },
    {
      icon: '⭕', name: 'Perfecte cirkel', short: 'Teken de rondste cirkel',
      rules: 'Teken met één vinger in één keer een cirkel op het vlak. De app meet hoe rond hij is en of hij dicht is. Wie de laagste score heeft, verliest.',
      worse: 'low',
      play(ps) { turns(this, ps); },
      turn(stage, _, done) {
        stage.innerHTML = `<canvas class="mg-canvas"></canvas><p class="mg-msg">Teken een cirkel</p>`;
        const cv = stage.querySelector('canvas'), msg = stage.querySelector('.mg-msg'), g = cv.getContext('2d');
        const size = cv.clientWidth, dpr = window.devicePixelRatio || 1;
        cv.width = cv.height = size * dpr;
        g.scale(dpr, dpr);
        g.lineCap = 'round';
        const css = getComputedStyle(document.documentElement);
        let pts = [], drawing = false, finished = false;
        const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
        cv.onpointerdown = e => {
          if (finished || drawing) return;
          drawing = true;
          try { cv.setPointerCapture(e.pointerId); } catch {}
          pts = [pos(e)];
          g.clearRect(0, 0, size, size);
          msg.textContent = 'Teken een cirkel';
        };
        cv.onpointermove = e => {
          if (!drawing) return;
          const p = pos(e), l = pts.at(-1);
          pts.push(p);
          g.strokeStyle = css.getPropertyValue('--accent').trim(); g.lineWidth = 5; g.setLineDash([]);
          g.beginPath(); g.moveTo(...l); g.lineTo(...p); g.stroke();
        };
        cv.onpointerup = cv.onpointercancel = () => {
          if (!drawing) return;
          drawing = false;
          const res = rateCircle(pts);
          if (!res) {
            g.clearRect(0, 0, size, size);
            msg.textContent = 'Te klein of niet rond genoeg getekend, probeer opnieuw';
            return;
          }
          finished = true;
          // de perfecte cirkel ter vergelijking
          g.strokeStyle = css.getPropertyValue('--muted').trim(); g.lineWidth = 2; g.setLineDash([6, 6]);
          g.beginPath(); g.arc(res.cx, res.cy, res.r, 0, 2 * Math.PI); g.stroke();
          msg.textContent = '';
          done(res.score, `${fmt1(res.score)}% rond`);
        };
      },
    },
    {
      icon: '⚡', name: 'Reactietest', short: 'Traagste verliest',
      rules: 'Tik op het vlak en wacht tot het groen wordt. Tik dan zo snel mogelijk. Te vroeg tikken telt als de slechtste tijd. De traagste verliest.',
      worse: 'high',
      play(ps) { turns(this, ps); },
      turn(stage, _, done) {
        stage.innerHTML = `<div class="mg-pad">Tik om te beginnen</div>`;
        const pad = stage.querySelector('.mg-pad');
        let phase = 'idle', t0 = 0;
        pad.onpointerdown = () => {
          if (phase === 'idle') {
            phase = 'wait';
            pad.className = 'mg-pad red';
            pad.textContent = 'Wacht op groen…';
            later(() => { phase = 'go'; t0 = performance.now(); pad.className = 'mg-pad green'; pad.textContent = 'TIK!'; }, rnd(1500, 4500));
          } else if (phase === 'wait') {
            phase = 'done'; clearTimers();
            pad.className = 'mg-pad'; pad.textContent = 'Te vroeg!';
            done(99999, 'Te vroeg getikt');
          } else if (phase === 'go') {
            phase = 'done';
            const ms = Math.round(performance.now() - t0);
            pad.className = 'mg-pad'; pad.innerHTML = `<span class="big">${ms}</span>ms`;
            done(ms, `${ms} ms`);
          }
        };
      },
    },
    {
      icon: '⏱️', name: 'Stopwatch', short: 'Stop op 5,00 seconden',
      rules: 'Start de klok en stop hem op precies 5,00 seconden. Na 2 seconden wordt de klok onzichtbaar. Wie er het verst naast zit, verliest.',
      worse: 'high',
      play(ps) { turns(this, ps); },
      turn(stage, _, done) {
        stage.innerHTML = `<div class="mg-pad"><span class="big">0,00</span><span>Tik om te starten</span></div>`;
        const pad = stage.querySelector('.mg-pad');
        const big = pad.querySelector('.big'), sub = pad.querySelector('span:last-child');
        let phase = 'idle', t0 = 0;
        const fmt = s => s.toFixed(2).replace('.', ',');
        pad.onpointerdown = () => {
          if (phase === 'idle') {
            phase = 'run'; t0 = performance.now(); sub.textContent = 'Tik om te stoppen';
            every(() => {
              const s = (performance.now() - t0) / 1000;
              big.textContent = s < 2 ? fmt(s) : '?,??';
            }, 30);
          } else if (phase === 'run') {
            phase = 'done'; clearTimers();
            const s = (performance.now() - t0) / 1000, off = Math.abs(s - 5);
            big.textContent = fmt(s); sub.textContent = 'seconden';
            done(off, `${fmt(s)} s (${fmt(off)} ernaast)`);
          }
        };
      },
    },
    {
      icon: '👆', name: 'Snel tikken', short: 'Minste tikken verliest',
      rules: 'Tik in 5 seconden zo vaak mogelijk op het vlak. De tijd start bij je eerste tik. Wie de minste tikken heeft, verliest.',
      worse: 'low',
      play(ps) { turns(this, ps); },
      turn(stage, _, done) {
        stage.innerHTML = `<div class="mg-pad"><span class="big">0</span><span>Tik om te beginnen</span></div>`;
        const pad = stage.querySelector('.mg-pad');
        const big = pad.querySelector('.big'), sub = pad.querySelector('span:last-child');
        let phase = 'idle', count = 0, t0 = 0;
        pad.onpointerdown = () => {
          if (phase === 'done') return;
          if (phase === 'idle') {
            phase = 'run'; t0 = performance.now();
            every(() => { sub.textContent = `nog ${Math.max(0, 5 - (performance.now() - t0) / 1000).toFixed(1)} s`; }, 100);
            later(() => {
              phase = 'done'; clearTimers();
              pad.className = 'mg-pad'; sub.textContent = 'tikken';
              done(count, `${count} tikken`);
            }, 5000);
          }
          big.textContent = ++count;
        };
      },
    },
    {
      icon: '☝️', name: 'Vinger kiezen', short: 'Vingers op het scherm',
      rules: 'Leg de telefoon op tafel. Iedereen legt één vinger op het scherm en houdt hem stil. Na een paar tellen kiest de app één vinger: die verliest.',
      play(ps) {
        const g = this;
        const w = show(`
          ${header(g)}
          <div class="mg-touch"><div class="hint-c">Iedereen een vinger op het scherm…</div></div>
          <p class="mg-msg"></p>
          <div class="mg-who"></div>`);
        const area = w.querySelector('.mg-touch'), msg = w.querySelector('.mg-msg'), hint = area.querySelector('.hint-c');
        const fingers = new Map();
        let color = 0, picked = false, wait = null;

        const restart = () => {
          clearTimeout(wait);
          msg.textContent = fingers.size >= 2 ? `${fingers.size} vingers… stil houden!` : '';
          hint.style.display = fingers.size ? 'none' : '';
          if (fingers.size >= 2) wait = setTimeout(pick, 2500);
        };
        const pos = e => { const r = area.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

        area.onpointerdown = e => {
          if (picked) return;
          const dot = document.createElement('div');
          dot.className = 'mg-dot';
          dot.style.background = COLORS[color++ % COLORS.length];
          [dot.style.left, dot.style.top] = pos(e).map(v => v + 'px');
          area.appendChild(dot);
          fingers.set(e.pointerId, dot);
          restart();
        };
        area.onpointermove = e => {
          const dot = fingers.get(e.pointerId);
          if (dot) [dot.style.left, dot.style.top] = pos(e).map(v => v + 'px');
        };
        area.onpointerup = area.onpointercancel = e => {
          if (picked) return;
          const dot = fingers.get(e.pointerId);
          if (dot) { dot.remove(); fingers.delete(e.pointerId); restart(); }
        };

        function pick() {
          picked = true;
          const dots = [...fingers.values()];
          const win = dots[rnd(0, dots.length - 1)];
          dots.forEach(d => d !== win && d.remove());
          win.classList.add('win');
          msg.textContent = 'Deze vinger is gekozen! Van wie is hij?';
          const who = w.querySelector('.mg-who');
          who.innerHTML = `<div class="mg-chips">${ps.map(p => `<button class="mg-chip" data-p="${p}">${name(p)}</button>`).join('')}</div>`;
          who.querySelectorAll('[data-p]').forEach(b => b.onclick = () => lose(+b.dataset.p, g));
        }
      },
    },
    {
      icon: '💣', name: 'Bomgetal', short: 'Raad niet het bomgetal',
      rules: 'Er zit een bom verstopt onder een getal van 1 tot 100. Om de beurt noem je een getal; het bereik wordt steeds kleiner. Wie het bomgetal raadt, verliest.',
      play(ps) {
        const g = this, bomb = rnd(1, 100);
        let lo = 1, hi = 100, i = 0, note = '';
        const turn = () => {
          const p = ps[i];
          const w = show(`
            ${header(g)}
            <p class="mg-turn">Beurt: <b>${name(p)}</b></p>
            <p class="mg-bomb">💣 ergens tussen <b>${lo}</b> en <b>${hi}</b></p>
            <input class="mg-input" type="number" inputmode="numeric" min="${lo}" max="${hi}" placeholder="${lo}–${hi}">
            <p class="mg-msg">${note}</p>
            <button class="btn">Raad</button>`);
          const input = w.querySelector('input'), msg = w.querySelector('.mg-msg');
          const go = () => {
            const v = +input.value;
            if (!Number.isInteger(v) || v < lo || v > hi || input.value === '') { msg.textContent = `Kies een getal van ${lo} tot ${hi}`; return; }
            if (v === bomb) {
              const w2 = show(`${header(g)}<div class="mg-result"><div class="mg-big">💥</div><p class="mg-res">BOEM! Het was ${bomb}</p></div><button class="btn">Uitslag</button>`);
              w2.querySelector('.btn').onclick = () => lose(p, g);
              return;
            }
            if (v < bomb) lo = v + 1; else hi = v - 1;
            note = `${name(p)} koos ${v}: veilig`;
            i = (i + 1) % ps.length;
            turn();
          };
          w.querySelector('.btn').onclick = go;
          input.onkeydown = e => { if (e.key === 'Enter') go(); };
          input.focus();
        };
        turn();
      },
    },
  ];

  // ---- stijl ----
  const css = document.createElement('style');
  css.textContent = `
    #mg { position: fixed; inset: 0; background: var(--bg); z-index: 20; overflow-y: auto; }
    .mg-wrap { max-width: 35rem; margin: 0 auto; padding: calc(env(safe-area-inset-top) + 0.5rem) 1rem calc(1.5rem + env(safe-area-inset-bottom)); }
    .mg-top { display: flex; align-items: center; justify-content: space-between; gap: 0.625rem; }
    .mg-top h1 { font-size: 1.375rem; }
    .mg-x { width: 2.75rem; height: 2.75rem; flex: none; border-radius: 0.75rem; background: var(--surface); border: 1px solid var(--line); font-size: 1.125rem; }
    .mg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem; margin-top: 1rem; }
    .mg-tile { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 0.875rem; text-align: left; display: flex; flex-direction: column; gap: 0.25rem; }
    .mg-ic { font-size: 1.75rem; }
    .mg-tile small { color: var(--muted); font-size: 0.8125rem; }
    .mg-rules { font-size: 1.0625rem; }
    .mg-turn { font-size: 1.125rem; margin: 0.5rem 0 0.75rem; }
    .mg-stage { min-height: 7.5rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; }
    .mg-pad { width: 100%; height: 16.25rem; border-radius: var(--radius); background: var(--surface-2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.375rem; font-size: 1.375rem; font-weight: 700; user-select: none; -webkit-user-select: none; touch-action: manipulation; text-align: center; padding: 0.75rem; cursor: pointer; }
    .mg-pad.red { background: #7a1f1f; }
    .mg-pad.green { background: #1f7a45; }
    .mg-pad .big { font-size: 3.5rem; font-variant-numeric: tabular-nums; }
    .mg-card { width: 6.875rem; height: 9.75rem; border-radius: 0.75rem; background: #f4f1e8; color: #111; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 800; line-height: 1.1; box-shadow: 0 0.375rem 1.25rem rgba(0,0,0,.4); }
    .mg-card.red { color: #c62828; }
    .mg-card.sm { width: 3.25rem; height: 4.625rem; font-size: 1.25rem; border-radius: 0.5rem; box-shadow: 0 0.2rem 0.5rem rgba(0,0,0,.4); }
    .mg-cards { display: flex; flex-wrap: wrap; gap: 0.375rem; justify-content: center; min-height: 4.625rem; }
    .mg-picks { display: flex; gap: 0.625rem; justify-content: center; }
    .mg-picks:not(:empty) { width: 100%; border-top: 1px solid var(--line); padding-top: 0.875rem; margin-top: 0.25rem; }
    .mg-pick { background: none; padding: 0; border-radius: 0.5rem; }
    .mg-pick .mg-card { outline: 2px solid var(--accent); }
    .mg-pick.right .mg-card { outline: 0.1875rem solid var(--good); }
    .mg-pick.wrong .mg-card { outline: 0.1875rem solid var(--bad); }
    .mg-simon { display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem; width: min(80vw, 18rem); }
    .mg-sq { aspect-ratio: 1; border-radius: var(--radius); background: var(--c); opacity: .25; transition: opacity .1s; touch-action: manipulation; }
    .mg-sq.lit { opacity: 1; box-shadow: 0 0 1.5rem var(--c); }
    .mg-track { position: relative; width: 100%; height: 7rem; border-radius: var(--radius); background: var(--surface-2); overflow: hidden; touch-action: manipulation; user-select: none; -webkit-user-select: none; cursor: pointer; }
    .mg-zone { position: absolute; left: 50%; top: 0; bottom: 0; width: 6%; transform: translateX(-50%); background: rgba(61,220,132,.18); border-left: 2px solid var(--good); border-right: 2px solid var(--good); }
    .mg-mark { position: absolute; left: 0; top: 0.75rem; bottom: 0.75rem; width: 0.375rem; margin-left: -0.1875rem; border-radius: 0.25rem; background: var(--accent); }
    .mg-mark.hit { background: var(--text); box-shadow: 0 0 0.75rem var(--text); }
    .mg-tower { position: relative; width: 100%; height: 18rem; border-radius: var(--radius); background: var(--surface-2); overflow: hidden; touch-action: manipulation; user-select: none; -webkit-user-select: none; cursor: pointer; }
    .mg-blk { position: absolute; border-radius: 0.25rem; background: var(--accent); }
    .mg-blk.base { background: var(--muted); }
    .mg-blk.mv { background: #5ab0ff; }
    .mg-blk.miss { background: var(--bad); }
    .mg-timer { color: var(--muted); font-variant-numeric: tabular-nums; }
    .mg-q { font-size: 2.5rem; font-weight: 800; text-align: center; font-variant-numeric: tabular-nums; }
    .mg-q.bad { color: var(--bad); }
    .mg-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem; width: 100%; }
    .mg-opt { height: 4rem; border-radius: 0.75rem; background: var(--surface-2); border: 1px solid var(--line); font-size: 1.375rem; font-weight: 700; touch-action: manipulation; }
    .mg-opt:disabled { opacity: .4; }
    .mg-word { font-size: 3rem; font-weight: 900; letter-spacing: .04em; min-height: 4rem; text-align: center; }
    .mg-res { font-size: 1.25rem; font-weight: 700; text-align: center; color: var(--accent); }
    .mg-list { margin-top: 1rem; }
    .mg-list div { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--line); }
    .mg-result { text-align: center; padding: 2rem 0 0.5rem; }
    .mg-big { font-size: 4rem; }
    .mg-loser { font-size: 2.125rem; font-weight: 800; color: var(--accent); margin-top: 0.25rem; }
    .mg-stake { font-size: 1.125rem; margin: 0.25rem 0 0; }
    .mg-canvas { display: block; width: min(100%, 21rem); aspect-ratio: 1; border-radius: var(--radius); background: var(--surface-2); touch-action: none; }
    .mg-touch { position: relative; height: 58vh; border-radius: var(--radius); background: var(--surface-2); touch-action: none; overflow: hidden; user-select: none; -webkit-user-select: none; }
    .mg-touch .hint-c { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--muted); text-align: center; padding: 1.25rem; pointer-events: none; }
    .mg-dot { position: absolute; width: 5.625rem; height: 5.625rem; margin: -2.8125rem 0 0 -2.8125rem; border-radius: 50%; pointer-events: none; transition: transform .3s; }
    .mg-dot.win { transform: scale(1.6); box-shadow: 0 0 0 0.75rem rgba(255,255,255,.2); }
    .mg-msg { text-align: center; color: var(--muted); min-height: 1.375rem; }
    .mg-input { width: 100%; font: inherit; font-size: 2rem; text-align: center; padding: 0.75rem; border-radius: 0.75rem; border: 1px solid var(--line); background: var(--surface); color: var(--text); }
    .mg-bomb { font-size: 1.25rem; text-align: center; }
    .mg-bomb b { color: var(--accent); font-size: 1.75rem; }
    .mg-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
    .mg-chip { padding: 0.625rem 1rem; border-radius: 62.4375rem; background: var(--surface-2); border: 1px solid var(--line); font-weight: 600; }
    .mg-chip.on { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
  `;
  document.head.appendChild(css);

  return { open, GAMES };
})();
