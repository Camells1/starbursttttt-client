/* Animated sky: drifting nebula, twinkling stars, and starbursts that pop and fade. */
(() => {
  const cv = document.getElementById('bg');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['#ffffff', '#9db8ff', '#3e86ff', '#8b5cf6', '#c4a8ff', '#ffd23f'];
  let W = 0, H = 0, dpr = 1;
  let stars = [], bursts = [], nextBurst = 0, shooters = [], nextShooter = 0, last = 0;
  let mx = 0, my = 0, tx = 0, ty = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((W * H) / 9000);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      z: 0.2 + Math.random() * 0.8,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      ph: Math.random() * 6.28, sp: 0.6 + Math.random() * 1.8,
    }));
  }
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', e => { tx = (e.clientX / W - 0.5); ty = (e.clientY / H - 0.5); }, { passive: true });

  const NEB = [
    { c: '62,134,255', r: 0.55, ax: 0.18, ay: 0.25, sx: 0.00007, sy: 0.00005, a: 0.20 },
    { c: '139,92,246', r: 0.5, ax: 0.78, ay: 0.7, sx: 0.00006, sy: 0.00008, a: 0.18 },
    { c: '255,210,63', r: 0.28, ax: 0.62, ay: 0.12, sx: 0.00009, sy: 0.00006, a: 0.07 },
  ];

  function nebula(t) {
    for (const n of NEB) {
      const x = W * (n.ax + 0.12 * Math.sin(t * n.sx * 1000 + n.ax * 9) + mx * 0.04);
      const y = H * (n.ay + 0.12 * Math.cos(t * n.sy * 1000 + n.ay * 7) + my * 0.04);
      const r = Math.max(W, H) * n.r;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${n.c},${n.a})`);
      g.addColorStop(1, `rgba(${n.c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function spark(x, y, r, rot, color, alpha) {
    // four-point sparkle
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i;
      const rr = i % 2 === 0 ? r : r * 0.22;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function addBurst() {
    bursts.push({
      x: W * (0.08 + Math.random() * 0.84), y: H * (0.1 + Math.random() * 0.75),
      born: performance.now(), life: 1800 + Math.random() * 1400,
      size: 22 + Math.random() * 34, rot: Math.random() * 1.5,
      c: ['#ffd23f', '#9db8ff', '#c4a8ff', '#ffffff'][Math.floor(Math.random() * 4)],
    });
  }

  function frame(now) {
    mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    nebula(now);

    for (const s of stars) {
      if (!reduce) { s.x -= 0.32 * s.z; s.y += 0.1 * s.z; }
      if (s.x < -2) s.x = W + 2;
      if (s.y > H + 2) s.y = -2;
      const tw = 0.55 + 0.45 * Math.sin(now * 0.001 * s.sp + s.ph);
      const px = s.x + mx * 22 * s.z, py = s.y + my * 22 * s.z;
      ctx.globalAlpha = tw * (0.35 + 0.65 * s.z);
      ctx.fillStyle = s.c;
      const r = 0.6 + s.z * 1.5;
      ctx.fillRect(px - r / 2, py - r / 2, r, r);
    }

    if (!reduce && now > nextBurst) {
      addBurst();
      nextBurst = now + 900 + Math.random() * 1600;
    }
    bursts = bursts.filter(b => now - b.born < b.life);
    for (const b of bursts) {
      const t = (now - b.born) / b.life;
      const e = 1 - Math.pow(1 - Math.min(1, t * 2.2), 3);
      const a = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
      // glow core
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.size * 0.9 * e);
      g.addColorStop(0, b.c); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 0.16 * a; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.size * 0.9 * e, 0, 6.283); ctx.fill();
      // rays
      spark(b.x, b.y, b.size * e, b.rot + t * 0.6, b.c, 0.5 * a);
      spark(b.x, b.y, b.size * 0.6 * e, b.rot + 0.785 + t * 0.6, b.c, 0.35 * a);
    }
    // shooting stars
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (!reduce && now > nextShooter) {
      const ang = 0.35 + Math.random() * 0.35;
      shooters.push({
        x: Math.random() * W * 1.1 - W * 0.1, y: Math.random() * H * 0.5,
        vx: Math.cos(ang) * (650 + Math.random() * 500), vy: Math.sin(ang) * (650 + Math.random() * 500),
        len: 90 + Math.random() * 130, life: 0, max: 0.9 + Math.random() * 0.7,
        c: ['255,255,255', '157,184,255', '255,210,63', '196,168,255'][Math.floor(Math.random() * 4)],
      });
      nextShooter = now + 1200 + Math.random() * 2800;
    }
    shooters = shooters.filter(o => o.life < o.max);
    for (const o of shooters) {
      o.life += dt; o.x += o.vx * dt; o.y += o.vy * dt;
      const k = o.life / o.max;
      const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      const sp = Math.hypot(o.vx, o.vy);
      const tx2 = o.x - (o.vx / sp) * o.len, ty2 = o.y - (o.vy / sp) * o.len;
      const g = ctx.createLinearGradient(o.x, o.y, tx2, ty2);
      g.addColorStop(0, 'rgba(' + o.c + ',' + (0.9 * a) + ')');
      g.addColorStop(1, 'rgba(' + o.c + ',0)');
      ctx.globalAlpha = 1;
      ctx.strokeStyle = g; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(tx2, ty2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
      ctx.beginPath(); ctx.arc(o.x, o.y, 1.8, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!reduce) requestAnimationFrame(frame);
  }

  resize();
  if (reduce) {
    for (let i = 0; i < 6; i++) addBurst();
    bursts.forEach(b => { b.born = performance.now() - b.life * 0.4; });
    frame(performance.now());
  } else {
    requestAnimationFrame(frame);
  }
})();
