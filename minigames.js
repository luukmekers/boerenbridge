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
  const cardHTML = c => `<div class="mg-card ${c.red ? 'red' : ''}"><span>${c.r}</span><span>${c.s}</span></div>`;
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
      icon: '🃏', name: 'Hoogste kaart', short: 'Laagste kaart verliest',
      rules: 'Iedereen trekt om de beurt een kaart. Wie de laagste kaart heeft, verliest. Aas is hoog; bij gelijke waarde telt de kleur (♠ laag, ♣ hoog).',
      worse: 'low',
      play(ps) { turns(this, ps); },
      setup: newDeck,
      turn(stage, deck, done) {
        stage.innerHTML = `<button class="btn">Trek een kaart</button>`;
        stage.querySelector('button').onclick = () => {
          const c = deck.pop();
          stage.innerHTML = cardHTML(c);
          done(c.v, c.r + c.s);
        };
      },
    },
    {
      icon: '🎲', name: 'Dobbelen', short: 'Laagste worp verliest',
      rules: 'Iedereen gooit om de beurt met twee dobbelstenen. De laagste totale worp verliest.',
      worse: 'low',
      play(ps) { turns(this, ps); },
      turn(stage, _, done) {
        const FACES = '⚀⚁⚂⚃⚄⚅';
        stage.innerHTML = `<div class="mg-dice">⚀ ⚀</div><button class="btn">Gooi!</button>`;
        const dice = stage.querySelector('.mg-dice');
        stage.querySelector('button').onclick = e => {
          e.currentTarget.remove();
          let n = 0;
          every(() => {
            const a = rnd(1, 6), b = rnd(1, 6);
            dice.textContent = `${FACES[a - 1]} ${FACES[b - 1]}`;
            if (++n === 12) {
              clearTimers();
              done(a + b, `${a} + ${b} = ${a + b}`);
            }
          }, 60);
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
      icon: '🤴', name: 'Boer trekken', short: 'Wie de boer trekt',
      rules: 'Om de beurt trek je een kaart van de stapel. Wie als eerste een boer trekt, verliest.',
      play(ps) {
        const g = this, deck = newDeck();
        let i = 0, last = null;
        const turn = () => {
          const p = ps[i];
          const w = show(`
            ${header(g)}
            <p class="mg-turn">Beurt: <b>${name(p)}</b></p>
            <div class="mg-stage">
              ${last ? `${cardHTML(last.c)}<p class="hint">${name(last.p)} trok ${last.c.r}${last.c.s} — geen boer</p>` : '<p class="hint">Nog geen kaart getrokken</p>'}
            </div>
            <button class="btn">Trek een kaart</button>
            <p class="hint" style="text-align:center">Nog ${deck.length} kaarten op de stapel</p>`);
          w.querySelector('.btn').onclick = () => {
            const c = deck.pop();
            if (c.r === 'B') {
              const w2 = show(`${header(g)}<div class="mg-stage">${cardHTML(c)}<p class="mg-res">💥 Boer! ${name(p)}</p></div><button class="btn">Uitslag</button>`);
              w2.querySelector('.btn').onclick = () => lose(p, g);
            } else {
              last = { p, c };
              i = (i + 1) % ps.length;
              turn();
            }
          };
        };
        turn();
      },
    },
    {
      icon: '🎡', name: 'Rad van fortuin', short: 'Het rad beslist',
      rules: 'Draai aan het rad. Waar de pijl op stopt, die verliest.',
      play(ps) {
        const g = this, n = ps.length, seg = 360 / n;
        const grad = ps.map((_, i) => `${COLORS[i % COLORS.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(',');
        const w = show(`
          ${header(g)}
          <div class="mg-wheel-box">
            <div class="mg-pointer"></div>
            <div class="mg-wheel" style="background:conic-gradient(${grad})">
              ${ps.map((p, i) => `<div class="lbl" style="transform:rotate(${(i + 0.5) * seg}deg)"><span>${name(p)}</span></div>`).join('')}
            </div>
          </div>
          <button class="btn">Draai!</button>`);
        const btn = w.querySelector('.btn'), wheel = w.querySelector('.mg-wheel');
        btn.onclick = () => {
          btn.disabled = true;
          const k = rnd(0, n - 1);
          const jitter = (Math.random() - 0.5) * seg * 0.7;
          wheel.style.transform = `rotate(${360 * 6 - (k + 0.5) * seg + jitter}deg)`;
          later(() => lose(ps[k], g), 4600);
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
    {
      icon: '🪙', name: 'Kop of munt', short: 'Laatste die fout gokt',
      rules: 'Iedereen kiest kop of munt, daarna wordt de munt gegooid. Wie goed gokt, is veilig. De rest gaat door naar de volgende ronde, tot er één over is: die verliest.',
      play(ps) {
        const g = this;
        let left = ps.slice(), round = 1;
        const turn = () => {
          const guess = {};
          const w = show(`
            ${header(g)}
            <p class="mg-turn">Ronde ${round} — nog ${left.length} in het spel</p>
            ${left.map(p => `
              <div class="mg-coinrow"><span>${name(p)}</span>
                <button class="mg-chip" data-p="${p}" data-v="K">Kop</button>
                <button class="mg-chip" data-p="${p}" data-v="M">Munt</button>
              </div>`).join('')}
            <div class="mg-coin">🪙</div>
            <button class="btn" data-flip disabled>Gooi de munt</button>`);
          const flip = w.querySelector('[data-flip]');
          w.querySelectorAll('.mg-chip').forEach(b => b.onclick = () => {
            guess[b.dataset.p] = b.dataset.v;
            w.querySelectorAll(`.mg-chip[data-p="${b.dataset.p}"]`).forEach(x => x.classList.toggle('on', x === b));
            flip.disabled = left.some(p => !guess[p]);
          });
          flip.onclick = () => {
            flip.disabled = true;
            w.querySelectorAll('.mg-chip').forEach(b => b.disabled = true);
            const coin = w.querySelector('.mg-coin');
            coin.classList.add('flip');
            const res = Math.random() < 0.5 ? 'K' : 'M';
            later(() => {
              const wrong = left.filter(p => guess[p] !== res);
              coin.textContent = res === 'K' ? 'KOP' : 'MUNT';
              let text;
              if (wrong.length === 0 || wrong.length === left.length) text = 'Niemand valt af — nog een keer!';
              else { left = wrong; text = `Veilig: ${ps.filter(p => !left.includes(p) && guess[p] === res).map(name).join(', ')}`; }
              round++;
              flip.insertAdjacentHTML('beforebegin', `<p class="mg-res">${text}</p>`);
              flip.textContent = left.length === 1 ? 'Uitslag' : 'Volgende ronde';
              flip.disabled = false;
              flip.onclick = () => left.length === 1 ? lose(left[0], g) : turn();
            }, 1100);
          };
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
    .mg-dice { font-size: 5.25rem; line-height: 1; }
    .mg-res { font-size: 1.25rem; font-weight: 700; text-align: center; color: var(--accent); }
    .mg-list { margin-top: 1rem; }
    .mg-list div { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--line); }
    .mg-result { text-align: center; padding: 2rem 0 0.5rem; }
    .mg-big { font-size: 4rem; }
    .mg-loser { font-size: 2.125rem; font-weight: 800; color: var(--accent); margin-top: 0.25rem; }
    .mg-stake { font-size: 1.125rem; margin: 0.25rem 0 0; }
    .mg-wheel-box { position: relative; width: min(86vw, 21.25rem); aspect-ratio: 1; margin: 1rem auto 0.5rem; }
    .mg-wheel { position: absolute; inset: 0; border-radius: 50%; transition: transform 4.2s cubic-bezier(.17,.67,.12,1); box-shadow: 0 0 0 0.25rem var(--surface-2); }
    .mg-wheel .lbl { position: absolute; inset: 0; }
    .mg-wheel .lbl span { position: absolute; left: 50%; top: 9%; transform: translateX(-50%); font-weight: 800; color: #111; max-width: 34%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.875rem; }
    .mg-pointer { position: absolute; left: 50%; top: -0.625rem; transform: translateX(-50%); border-left: 0.875rem solid transparent; border-right: 0.875rem solid transparent; border-top: 1.625rem solid var(--text); z-index: 2; }
    .mg-touch { position: relative; height: 58vh; border-radius: var(--radius); background: var(--surface-2); touch-action: none; overflow: hidden; user-select: none; -webkit-user-select: none; }
    .mg-touch .hint-c { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--muted); text-align: center; padding: 1.25rem; pointer-events: none; }
    .mg-dot { position: absolute; width: 5.625rem; height: 5.625rem; margin: -2.8125rem 0 0 -2.8125rem; border-radius: 50%; pointer-events: none; transition: transform .3s; }
    .mg-dot.win { transform: scale(1.6); box-shadow: 0 0 0 0.75rem rgba(255,255,255,.2); }
    .mg-msg { text-align: center; color: var(--muted); min-height: 1.375rem; }
    .mg-input { width: 100%; font: inherit; font-size: 2rem; text-align: center; padding: 0.75rem; border-radius: 0.75rem; border: 1px solid var(--line); background: var(--surface); color: var(--text); }
    .mg-bomb { font-size: 1.25rem; text-align: center; }
    .mg-bomb b { color: var(--accent); font-size: 1.75rem; }
    .mg-coinrow { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0; border-bottom: 1px solid var(--line); }
    .mg-coinrow span { flex: 1; font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .mg-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
    .mg-chip { padding: 0.625rem 1rem; border-radius: 62.4375rem; background: var(--surface-2); border: 1px solid var(--line); font-weight: 600; }
    .mg-chip.on { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
    .mg-chip:disabled { opacity: .6; }
    .mg-coin { font-size: 4rem; text-align: center; font-weight: 800; margin: 1rem 0 0.25rem; transition: transform 1s; }
    .mg-coin.flip { transform: rotateY(1800deg); }
  `;
  document.head.appendChild(css);

  return { open, GAMES };
})();
