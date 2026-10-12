/* Kinetic type helpers: split text into masked characters, roll-on-hover links, rolling digits, ticker. */
const K = (() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Fills el with one masked span per word, one inline-block per character. Returns the char elements. */
  function split(el, text) {
    el.textContent = '';
    el.setAttribute('aria-label', text);
    const chars = [];
    text.split(' ').forEach((word, wi, arr) => {
      const line = document.createElement('span');
      line.className = 'k-line';
      line.setAttribute('aria-hidden', 'true');
      for (const c of word) {
        const s = document.createElement('span');
        s.className = 'k-ch';
        s.textContent = c;
        line.appendChild(s);
        chars.push(s);
      }
      el.appendChild(line);
      if (wi < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return chars;
  }

  function enter(chars, { delay = 0, stagger = 0.035 } = {}) {
    if (reduce) { gsap.set(chars, { clearProps: 'all' }); return gsap.timeline(); }
    return gsap.fromTo(chars,
      { yPercent: 115, rotation: 6, scaleY: 1.35, transformOrigin: '0% 100%' },
      { yPercent: 0, rotation: 0, scaleY: 1, duration: 0.8, delay, stagger, ease: 'back.out(1.9)' });
  }

  function exit(chars) {
    if (reduce || !chars.length) return Promise.resolve();
    return new Promise(res => gsap.to(chars, {
      yPercent: -115, duration: 0.32, stagger: 0.016, ease: 'power3.in', onComplete: res,
    }));
  }

  /** Text that rolls to a second copy on hover. Put on any element with class roll-host. */
  function roll(text) {
    const wrap = document.createElement('span');
    wrap.className = 'k-roll';
    const inner = document.createElement('span');
    inner.textContent = text;
    inner.dataset.t = text;
    wrap.appendChild(inner);
    return wrap;
  }

  /** Rolling digit counter. Returns { set(n) }. */
  function counter(el, digits = 3) {
    el.textContent = '';
    const cols = [];
    for (let i = 0; i < digits; i++) {
      const d = document.createElement('span');
      d.className = 'digit';
      const col = document.createElement('span');
      col.className = 'digit-col';
      for (let n = 0; n < 10; n++) {
        const s = document.createElement('span');
        s.textContent = n;
        col.appendChild(s);
      }
      d.appendChild(col);
      el.appendChild(d);
      cols.push(col);
    }
    let last = -1;
    return {
      set(n) {
        n = Math.max(0, Math.min(10 ** digits - 1, Math.round(n)));
        if (n === last) return;
        last = n;
        const str = String(n).padStart(digits, '0');
        cols.forEach((col, i) => gsap.to(col, {
          yPercent: -Number(str[i]) * 10, duration: reduce ? 0 : 0.6, ease: 'expo.out', overwrite: true,
        }));
      },
    };
  }

  /** Infinite marquee that speeds up and skews with scroll-wheel velocity. */
  function ticker(track, phrases) {
    const unit = phrases.join('   •   ') + '   •   ';
    for (let i = 0; i < 6; i++) {
      const s = document.createElement('span');
      s.textContent = unit;
      track.appendChild(s);
    }
    let x = 0, vel = 0, skew = 0, speed = 0.7;
    const unitW = () => track.firstChild.getBoundingClientRect().width;
    window.addEventListener('wheel', e => { vel += Math.max(-60, Math.min(60, e.deltaY)) * 0.08; }, { passive: true });
    gsap.ticker.add(() => {
      vel *= 0.92;
      const w = unitW();
      if (!w) return;
      x -= (reduce ? 0.2 : speed) + vel;
      if (x <= -w) x += w;
      if (x > 0) x -= w;
      skew += ((reduce ? 0 : -vel * 1.2) - skew) * 0.15;
      gsap.set(track, { x, skewX: skew });
    });
  }

  return { split, enter, exit, roll, counter, ticker, reduce };
})();
