/* Dino Run — a jungle railway endless runner, in the family of Subway Surfers.

   The first Dino Run was a row of three items every two seconds: correct, and
   empty. This one is built around what makes the genre fun: the screen is
   always full (wagons, logs, arches, fruit lines), wagons with a ramp can be
   climbed and run on, fruit lines show the way, and three power-ups break the
   rhythm — the magnet, the spring and the pterodactyl ride.

   All rules live in S, which is plain data with its own seeded random, so
   test/smoke.js can clone it and let a search bot run for minutes.

   World units are metres. Lanes are 0,1,2; z grows forward; the dino is at S.z. */
(function () {
  'use strict';
  var C = G.C, W = G.W, H = G.H, DT = 1 / 60;
  var LANE = 1.9, HOR = 280, F = 700, CAM_BACK = 7, CAM_H = 3.3, NEAR = 1.0;
  var S = null, quiet = false, acc = 0, touch = null;

  function saved() { var s = G.save.run || (G.save.run = {}); s.runs = s.runs || 0; s.bestM = s.bestM || 0; s.bestF = s.bestF || 0; return s; }
  function tune() {
    var p = G.level === 1;
    return { v0: p ? 9 : 11.5, vMax: p ? 14 : 20, ramp: p ? 75 : 80, jump: 7.4, superJump: 10.6, g: 22, gap: p ? 13 : 9 };
  }
  function rnd() {
    S.seed = (S.seed + 0x6D2B79F5) | 0;
    var t = S.seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function sfx(n) { if (!quiet) G.sfx(n); }
  function say(s) { if (!quiet) G.say(s); }

  /* ------------------------------------------------------------ patterns
     Each entry: [kind, lane, dz, a, b, only]. Kinds:
       L log (jump)   A arch (roll under)   R rock (change lane)
       W wagon (a = length)   WR wagon with ramp   M wagon that comes at you
       f fruit line (a = count, b = 'arc' | 'top' | 'low')   P power-up   H heart
     `only` = 'g' means Grande only. Every pattern leaves a lane-change-only
     route open for Piccolo: the 3-year-old never HAS to jump or roll. */
  var PATTERNS = [
    { id: 'frutti', len: 26, p: 1, o: [['f', 1, 0, 8], ['R', 0, 16], ['f', 2, 14, 5], ['L', 1, 22, 0, 0, 'g']] },
    { id: 'slalom', len: 36, p: 1, o: [['R', 0, 4], ['f', 1, 0, 4], ['R', 2, 16], ['f', 1, 12, 3], ['R', 1, 28], ['f', 0, 24, 4], ['L', 2, 30, 0, 0, 'g']] },
    { id: 'vagoni', len: 26, p: 1, o: [['W', 0, 0, 18], ['W', 2, 6, 18], ['f', 1, 0, 9]] },
    { id: 'rampa', len: 32, p: 1, o: [['WR', 1, 6, 22], ['f', 1, 3, 10, 'top'], ['R', 0, 14], ['R', 2, 14, 0, 0, 'g'], ['f', 2, 20, 4]] },
    { id: 'tronchi', len: 18, p: 1, o: [['L', 0, 10], ['L', 1, 10], ['L', 2, 10, 0, 0, 'g'], ['f', 1, 6, 5, 'arc']] },
    { id: 'rami', len: 18, p: 1, o: [['A', 1, 10], ['A', 0, 10, 0, 0, 'g'], ['A', 2, 10, 0, 0, 'g'], ['f', 1, 7, 5, 'low']] },
    { id: 'misto', len: 18, p: 0, o: [['L', 0, 10], ['A', 1, 10], ['R', 2, 10], ['f', 0, 6, 5, 'arc']] },
    { id: 'tunnel', len: 38, p: 0, o: [['W', 0, 0, 34], ['WR', 1, 4, 30], ['f', 1, 2, 12, 'top'], ['L', 2, 10], ['A', 2, 20], ['L', 2, 30], ['f', 2, 6, 3, 'arc']] },
    { id: 'arriva', len: 44, p: 0, o: [['M', 1, 42, 14], ['f', 0, 0, 10], ['R', 2, 22], ['f', 2, 4, 4]] },
    { id: 'zigzag', len: 32, p: 1, o: [['f', 0, 0, 4], ['f', 1, 10, 4], ['f', 2, 20, 4], ['L', 1, 4, 0, 0, 'g'], ['R', 0, 16], ['A', 1, 26, 0, 0, 'g']] },
    { id: 'binari', len: 30, p: 1, o: [['WR', 0, 4, 20], ['f', 0, 1, 9, 'top'], ['W', 2, 0, 24], ['R', 1, 16, 0, 0, 'g'], ['f', 1, 0, 4]] },
    { id: 'treno', len: 38, p: 0, o: [['W', 0, 0, 16], ['W', 0, 18, 16], ['W', 2, 8, 30], ['L', 1, 12], ['A', 1, 24], ['f', 1, 0, 6]] }
  ];
  var POWER = { id: 'power', len: 16, p: 1, o: [['P', 1, 8], ['f', 0, 0, 5], ['f', 2, 0, 5]] };
  var HEART = { id: 'cuore', len: 12, p: 1, o: [['H', 1, 6], ['f', 0, 2, 3], ['f', 2, 2, 3]] };

  function place(pat, z0) {
    var mirror = rnd() < .5;
    pat.o.forEach(function (e) {
      if (e[5] === 'g' && G.level !== 2) return;
      var lane = mirror ? 2 - e[1] : e[1], z = z0 + e[2], k = e[0];
      if (k === 'f') {
        var n = e[3], mode = e[4];
        for (var i = 0; i < n; i++) {
          var y = .55, fz = z + i * 2.2;
          if (mode === 'arc') y = .55 + Math.sin(Math.PI * i / (n - 1)) * 1.2;
          if (mode === 'top') y = fz - z >= 3 ? 2.25 : .55 + (fz - z) / 3 * 1.7;
          if (mode === 'low') y = .35;
          S.obs.push({ k: 'fruit', lane: lane, z: fz, y: y, got: false, kind: i % 4 });
        }
      } else if (k === 'P') {
        var types = ['magnet', 'spring', 'ptero'];
        S.obs.push({ k: 'power', lane: lane, z: z, y: .8, got: false, type: types[S.powers++ % 3] });
      } else if (k === 'H') S.obs.push({ k: 'heart', lane: lane, z: z, y: .8, got: false });
      else {
        var ob = { k: k === 'WR' ? 'W' : k, lane: lane, z: z, hit: false, col: S.nobs++ % 4 };
        if (k === 'L') { ob.len = .7; ob.h = .7; }
        if (k === 'A') { ob.len = .6; ob.h = 1.7; }
        if (k === 'R') { ob.len = 1.3; ob.h = 1.5; }
        if (k === 'W' || k === 'WR' || k === 'M') { ob.len = e[3]; ob.h = 1.8; ob.ramp = k === 'WR'; ob.moving = k === 'M'; }
        S.obs.push(ob);
      }
    });
  }
  function spawn() {
    var tn = tune();
    while (S.nextZ < S.z + 150) {
      var pat;
      if (S.hearts < 3 && S.nextZ - S.lastHeart > 160) { pat = HEART; S.lastHeart = S.nextZ; }
      else if (S.nextZ - S.lastPower > 240) { pat = POWER; S.lastPower = S.nextZ; }
      else {
        var ok = PATTERNS.filter(function (p) { return (p.p || G.level === 2) && p.id !== S.lastPat; });
        pat = ok[Math.floor(rnd() * ok.length)];
      }
      S.lastPat = pat.id;
      place(pat, S.nextZ);
      S.nextZ += pat.len + tn.gap + rnd() * 5;
    }
  }

  /* ------------------------------------------------------------ state */
  function reset(seed) {
    S = {
      phase: 'ready', t: 0, time: 0, z: 0, dist: 0, v: tune().v0, seed: seed === undefined ? (Date.now() & 0xffff) : seed,
      obs: [], nextZ: 30, lastPower: 60, lastHeart: 0, lastPat: '', powers: 0, nobs: 0,
      hearts: 3, fruit: 0, combo: 0, shield: 0, slow: 0, mag: 0, spring: 0, reason: '', reasonT: 0, heartFlash: 0, nudge: 0, timer: 0,
      p: { lane: 1, x: 1, y: 0, vy: 0, roll: 0, fly: 0 }
    };
    // a first line of fruit right away: the child sees the point of the game in the first second
    for (var i = 0; i < 8; i++) S.obs.push({ k: 'fruit', lane: 1, z: 8 + i * 2.2, y: .55, got: false, kind: i % 4 });
    spawn();
  }
  function start() { if (S.phase !== 'ready') return; S.phase = 'run'; sfx('win'); say('Via! Scorri per cambiare binario.'); }

  function tallAt(lane, z, y) {
    for (var i = 0; i < S.obs.length; i++) {
      var o = S.obs[i];
      if ((o.k === 'W' || o.k === 'M' || o.k === 'R') && o.lane === lane && z > o.z - .4 && z < o.z + o.len && y < o.h - .15) return o;
    }
    return null;
  }
  function baseAt(x, z) {
    var b = 0;
    for (var i = 0; i < S.obs.length; i++) {
      var o = S.obs[i];
      if (o.k !== 'W' && o.k !== 'M') continue;
      if (Math.abs(o.lane - x) > .5) continue;
      if (z >= o.z && z <= o.z + o.len) b = Math.max(b, o.h);
      else if (o.ramp && z >= o.z - 3.2 && z < o.z) b = Math.max(b, o.h * (z - (o.z - 3.2)) / 3.2);
    }
    return b;
  }

  function action(a) {
    if (a === 'pause') { if (S.phase === 'run') { S.phase = 'pause'; G.hush(); } else if (S.phase === 'pause') S.phase = 'run'; return; }
    if (S.phase !== 'run') return;
    var p = S.p, tn = tune();
    if (a === 'left' || a === 'right') {
      var to = p.lane + (a === 'left' ? -1 : 1);
      if (to < 0 || to > 2) { S.nudge = a === 'left' ? -.25 : .25; sfx('tap'); return; }
      if (p.fly <= 0 && tallAt(to, S.z, p.y)) { S.nudge = a === 'left' ? -.3 : .3; sfx('bad'); if (!quiet) G.shake(3); return; }
      p.lane = to; sfx('whoosh');
    }
    if (a === 'jump' && p.fly <= 0 && p.y - baseAt(p.x, S.z) < .05) { p.vy = S.spring > 0 ? tn.superJump : tn.jump; p.roll = 0; sfx('pop'); }
    if (a === 'duck' && p.fly <= 0) { p.roll = .62; if (p.y - baseAt(p.x, S.z) > .05) p.vy = Math.min(p.vy, -12); sfx('tap'); }
  }

  function hit(o, reason) {
    o.hit = true;
    if (S.shield > 0 || S.p.fly > 0) return;
    S.hearts--; S.shield = 2.2; S.slow = 1; S.combo = 0; S.heartFlash = 1; S.reason = reason; S.reasonT = 2;
    sfx('bad'); if (!quiet) G.shake(7); say(reason);
    // after a bump against something tall, step aside if a lane is free
    if (o.k !== 'L' && o.k !== 'A') {
      var p = S.p;
      [p.lane - 1, p.lane + 1].some(function (l) { if (l >= 0 && l <= 2 && !tallAt(l, S.z, p.y)) { p.lane = l; return true; } return false; });
    }
    if (S.hearts <= 0) { S.phase = 'dying'; S.timer = 1.2; }
  }
  function collect(o) {
    o.got = true;
    if (o.k === 'fruit') { S.fruit++; S.combo++; sfx('coin'); return; }
    if (o.k === 'heart') { S.hearts = Math.min(3, S.hearts + 1); S.heartFlash = 1.2; sfx('good'); say('Un cuore in più!'); return; }
    sfx('win');
    if (o.type === 'magnet') { S.mag = 10; say('Calamita! I frutti vengono da te'); }
    if (o.type === 'spring') { S.spring = 10; say('Molla! Salti altissimo'); }
    if (o.type === 'ptero') {
      S.p.fly = 6; S.p.roll = 0; say('Lo pterodattilo ti porta in volo!');
      for (var i = 0; i < 36; i++) S.obs.push({ k: 'fruit', lane: 1 + Math.round(Math.sin(i / 5)), z: S.z + 16 + i * 3, y: 4.4, got: false, kind: i % 4, sky: true });
    }
  }

  function step() {
    S.t += DT;
    if (S.phase === 'dying') { if ((S.timer -= DT) <= 0) end(); return; }
    if (S.phase !== 'run') return;
    var tn = tune(), p = S.p, i, o;
    S.time += DT;
    var target = tn.v0 + (tn.vMax - tn.v0) * Math.min(1, S.time / tn.ramp);
    S.v = target * (1 - .45 * S.slow);
    S.slow = Math.max(0, S.slow - DT); S.shield = Math.max(0, S.shield - DT); S.mag = Math.max(0, S.mag - DT); S.spring = Math.max(0, S.spring - DT);
    S.heartFlash = Math.max(0, S.heartFlash - DT); S.reasonT = Math.max(0, S.reasonT - DT);
    S.nudge *= Math.exp(-DT * 12);
    var dz = S.v * DT; S.z += dz; S.dist += dz;

    // wagons that come at you start moving only when close, so they sweep their own pattern only
    S.obs.forEach(function (o) { if (o.moving && o.z - S.z < 55) o.z -= 7 * DT; });

    p.x += (p.lane - p.x) * (1 - Math.exp(-DT * 18));
    if (Math.abs(p.lane - p.x) < .005) p.x = p.lane;
    p.roll = Math.max(0, p.roll - DT);
    var base = baseAt(p.x, S.z);
    if (p.fly > 0) {
      p.fly -= DT; p.y += (4.2 - p.y) * (1 - Math.exp(-DT * 4)); p.vy = 0;
      if (p.fly <= 0) { S.shield = Math.max(S.shield, 1.5); p.fly = 0; }
    } else {
      p.vy -= tn.g * DT; p.y += p.vy * DT;
      if (p.y <= base && base - p.y < .45) { p.y = base; p.vy = 0; }
      if (p.y < 0) { p.y = 0; p.vy = 0; }
    }

    for (i = S.obs.length - 1; i >= 0; i--) {
      o = S.obs[i];
      if (o.z + (o.len || 0) < S.z - 10) { S.obs.splice(i, 1); continue; }
      if (o.k === 'fruit' || o.k === 'power' || o.k === 'heart') {
        if (o.got) continue;
        if (S.mag > 0 && o.k === 'fruit' && !o.sky && o.z - S.z < 14 && o.z - S.z > -1) {
          var m = Math.min(1, DT * 9);
          o.lane += (p.x - o.lane) * m; o.y += (p.y + .6 - o.y) * m; o.z += (S.z - o.z) * m;
        }
        if (Math.abs(o.lane - p.x) < .6 && Math.abs(o.z - S.z) < .9 && Math.abs(o.y - (p.y + .6)) < 1.1) collect(o);
        continue;
      }
      if (o.hit || Math.abs(o.lane - p.x) > .55) continue;
      if (o.k === 'W' || o.k === 'M') {
        if (S.z > o.z - .3 && S.z < o.z + .5 && p.y < o.h - .3) hit(o, 'Attento al vagone!');
      } else if (S.z > o.z - .3 && S.z < o.z + o.len) {
        if (o.k === 'L' && p.y < .6) hit(o, 'Salta il tronco');
        if (o.k === 'R' && p.y < 1.45) hit(o, 'Cambia binario!');
        if (o.k === 'A' && p.roll <= 0 && p.y < 1.9) hit(o, 'Rotola sotto il ramo');
      }
    }
    spawn();
  }
  function end() {
    S.phase = 'over';
    var s = saved(); s.runs++; s.last = Math.floor(S.dist); s.bestM = Math.max(s.bestM, Math.floor(S.dist)); s.bestF = Math.max(s.bestF, S.fruit); G.saveNow();
    say('Bella corsa! ' + Math.floor(S.dist) + ' metri');
  }

  /* ================================================================ drawing */
  var camX = 0, camY = 0, camZ = 0;
  function proj(lane, y, z) { return projX((lane - 1) * LANE, y, z); }
  function projX(wx, y, z) { var dz = Math.max(NEAR, z - camZ), s = F / dz; return { x: 640 + (wx - camX) * s, y: HOR + (CAM_H + camY - y) * s, s: s }; }
  function poly(c, pts, col) { c.fillStyle = col; c.beginPath(); pts.forEach(function (q, i) { if (i) c.lineTo(q.x, q.y); else c.moveTo(q.x, q.y); }); c.closePath(); c.fill(); }
  function hash(n) { n = Math.imul(n ^ 0x5bd1e995, 0x27d4eb2d); n ^= n >>> 15; return ((n >>> 0) % 1000) / 1000; }

  function sky(c) {
    var g = c.createLinearGradient(0, 0, 0, HOR); g.addColorStop(0, '#6cc9ee'); g.addColorStop(1, '#d6f2ef');
    c.fillStyle = g; c.fillRect(0, 0, W, HOR + 2);
    c.fillStyle = '#fff5c8'; c.beginPath(); c.arc(1010, 130, 54, 0, 7); c.fill();
    var sh = -camX * 6, i;
    c.fillStyle = '#9cc7b5'; c.beginPath(); c.moveTo(-100, HOR);
    for (i = 0; i <= 15; i++) c.lineTo(-100 + i * 100 + sh * .3, HOR - 60 - (i % 3) * 38 - (i % 2) * 20);
    c.lineTo(1400, HOR); c.fill();
    c.fillStyle = '#4f9a6c'; c.beginPath(); c.moveTo(-100, HOR + 2);
    for (i = 0; i <= 42; i++) c.lineTo(-100 + i * 36 + sh * .6, HOR - 18 - Math.abs(Math.sin(i * 1.7)) * 26);
    c.lineTo(1400, HOR + 2); c.fill();
  }
  function ground(c) {
    c.fillStyle = '#5daa4f'; c.fillRect(0, HOR, W, H - HOR);
    var step = 4, z0 = Math.floor(camZ / step) * step, i, a, b, l;
    // grass bands that stream past: the main cue of speed
    for (i = 0; i < 40; i++) {
      var z = z0 + i * step; if (z < camZ + NEAR) continue;
      if (Math.floor(z / step) % 2) continue;
      a = projX(0, 0, z); b = projX(0, 0, z + step);
      c.fillStyle = '#6ab85b'; c.fillRect(0, b.y, W, a.y - b.y);
    }
    // track bed
    var hw = 1.5 * LANE + .5, zf = camZ + 170, zn = camZ + NEAR;
    poly(c, [projX(-hw - .35, 0, zn), projX(-hw, 0, zn), projX(-hw, 0, zf), projX(-hw - .35, 0, zf)], '#8d7556');
    poly(c, [projX(hw, 0, zn), projX(hw + .35, 0, zn), projX(hw + .35, 0, zf), projX(hw, 0, zf)], '#8d7556');
    poly(c, [projX(-hw, 0, zn), projX(hw, 0, zn), projX(hw, 0, zf), projX(-hw, 0, zf)], '#b99b72');
    // sleepers
    var sp = 1.3, s0 = Math.ceil(zn / sp) * sp;
    for (i = 0; i < 70; i++) {
      var sz = s0 + i * sp, col = Math.round(sz / sp) % 2 ? '#7a5634' : '#86603b';
      for (l = 0; l < 3; l++) poly(c, [proj(l - .36, 0, sz), proj(l + .36, 0, sz), proj(l + .36, 0, sz + .32), proj(l - .36, 0, sz + .32)], col);
    }
    // rails
    c.strokeStyle = '#d9dde0'; c.lineCap = 'round'; c.lineWidth = 6;
    for (l = 0; l < 3; l++) for (var r = -1; r <= 1; r += 2) {
      var ra = proj(l + r * .24, .08, zn), rb = proj(l + r * .24, .08, zf);
      c.beginPath(); c.moveTo(ra.x, ra.y); c.lineTo(rb.x, rb.y); c.stroke();
    }
  }
  function scenery(list) {
    var sp = 6, z0 = Math.floor(camZ / sp) * sp;
    for (var i = 1; i < 26; i++) {
      var z = z0 + i * sp, idx = Math.floor(z / sp);
      for (var side = -1; side <= 1; side += 2) {
        var hsh = hash(idx * 2 + (side > 0 ? 1 : 0)), zz = z + hsh * 2;
        list.push({ z: zz, far: zz, draw: sceneryItem(side * (4.4 + hsh * 3.5), zz, Math.floor(hsh * 5)) });
      }
    }
  }
  function sceneryItem(wx, z, kind) {
    return function (c) {
      var q = projX(wx, 0, z), s = q.s, k;
      if (q.x < -400 || q.x > W + 400) return;
      if (kind <= 1) {         // palm
        c.strokeStyle = '#8a5a32'; c.lineWidth = .35 * s; c.beginPath(); c.moveTo(q.x, q.y); c.quadraticCurveTo(q.x + .6 * s, q.y - 2 * s, q.x + .3 * s, q.y - 4 * s); c.stroke();
        c.fillStyle = '#2f8f4e';
        for (k = 0; k < 6; k++) { var a = k * 1.05 + .2; c.beginPath(); c.ellipse(q.x + .3 * s + Math.cos(a) * 1.1 * s, q.y - 4 * s + Math.sin(a) * .45 * s, 1.2 * s, .32 * s, a, 0, 7); c.fill(); }
      } else if (kind === 2) { // big tree
        c.fillStyle = '#7a4a26'; c.fillRect(q.x - .25 * s, q.y - 2.4 * s, .5 * s, 2.4 * s);
        c.fillStyle = '#28704a'; c.beginPath(); c.arc(q.x, q.y - 3.2 * s, 1.6 * s, 0, 7); c.fill();
        c.fillStyle = '#3f9a5c'; c.beginPath(); c.arc(q.x - .5 * s, q.y - 3.6 * s, .9 * s, 0, 7); c.fill();
      } else if (kind === 3) { // bush with flowers
        c.fillStyle = '#3b8f4f'; c.beginPath(); c.ellipse(q.x, q.y - .5 * s, 1.1 * s, .7 * s, 0, 0, 7); c.fill();
        c.fillStyle = C.pinkPop; c.beginPath(); c.arc(q.x - .4 * s, q.y - .8 * s, .14 * s, 0, 7); c.arc(q.x + .3 * s, q.y - .6 * s, .14 * s, 0, 7); c.fill();
      } else {                 // fern and a rock
        c.fillStyle = '#8e9a8e'; c.beginPath(); c.ellipse(q.x, q.y - .3 * s, .7 * s, .4 * s, 0, 0, 7); c.fill();
        c.fillStyle = '#63c777'; for (k = 0; k < 4; k++) { c.beginPath(); c.ellipse(q.x + (k - 1.5) * .35 * s, q.y - .7 * s, .15 * s, .6 * s, (k - 1.5) * .4, 0, 7); c.fill(); }
      }
    };
  }

  /* a box in world space: lane-centred, half width hw (lane units), y0..y1, z0..z1 */
  function box(c, lane, hw, y0, y1, z0, z1, col) {
    if (z1 < camZ + NEAR) return null;
    z0 = Math.max(z0, camZ + NEAR);
    var P = function (dl, y, z) { return proj(lane + dl, y, z); };
    var camLane = camX / LANE + 1;
    if (camLane < lane - hw) poly(c, [P(-hw, y0, z0), P(-hw, y0, z1), P(-hw, y1, z1), P(-hw, y1, z0)], col.side);
    else if (camLane > lane + hw) poly(c, [P(hw, y0, z0), P(hw, y0, z1), P(hw, y1, z1), P(hw, y1, z0)], col.side);
    if (CAM_H + camY > y1) poly(c, [P(-hw, y1, z0), P(hw, y1, z0), P(hw, y1, z1), P(-hw, y1, z1)], col.top);
    poly(c, [P(-hw, y0, z0), P(hw, y0, z0), P(hw, y1, z0), P(-hw, y1, z0)], col.front);
    return { a: P(-hw, y1, z0), b: P(hw, y0, z0) };
  }
  var WAGON = [
    { front: '#d9534f', side: '#b8403c', top: '#ec8a86' }, { front: '#3f7fd6', side: '#2f63ad', top: '#86b1ec' },
    { front: '#f0a53a', side: '#c9862a', top: '#f7c983' }, { front: '#8f5bd6', side: '#6f43ad', top: '#b996ea' }
  ];
  function drawObstacle(c, o) {
    var f, k;
    if (o.k === 'W' || o.k === 'M') {
      var col = o.moving ? { front: '#e8e2d0', side: '#c9c1aa', top: '#f6f1e2' } : WAGON[o.col];
      if (o.ramp && o.z > camZ + NEAR) {
        var zr = Math.max(o.z - 3.2, camZ + NEAR), hr = o.h * (zr - (o.z - 3.2)) / 3.2;
        poly(c, [proj(o.lane - .42, hr, zr), proj(o.lane + .42, hr, zr), proj(o.lane + .42, o.h, o.z), proj(o.lane - .42, o.h, o.z)], '#b07a44');
        c.strokeStyle = '#7a4a26';
        for (k = 1; k < 6; k++) {
          var zz = o.z - 3.2 + k * .55; if (zz < camZ + NEAR) continue;
          var a = proj(o.lane - .42, o.h * k / 5.8, zz), b = proj(o.lane + .42, o.h * k / 5.8, zz);
          c.lineWidth = Math.max(1, .05 * a.s); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
        }
      }
      f = box(c, o.lane, .46, .15, o.h, o.z, o.z + o.len, col);
      if (f && o.z > camZ + NEAR) {
        var w = f.b.x - f.a.x, h = f.b.y - f.a.y;
        c.fillStyle = o.moving ? '#3a4a5a' : 'rgba(30,40,60,.75)'; G.roundRect(c, f.a.x + w * .14, f.a.y + h * .14, w * .72, h * .34, w * .06); c.fill();
        c.fillStyle = '#2b1d12'; c.fillRect(f.a.x + w * .08, f.b.y - h * .1, w * .84, h * .1);
        if (o.moving) { c.fillStyle = C.sun; c.beginPath(); c.arc(f.a.x + w * .22, f.a.y + h * .72, w * .07, 0, 7); c.arc(f.a.x + w * .78, f.a.y + h * .72, w * .07, 0, 7); c.fill(); }
      }
    } else if (o.k === 'L') {
      f = box(c, o.lane, .44, 0, o.h, o.z, o.z + o.len, { front: '#9a6a3c', side: '#7a4a26', top: '#b07a44' });
      if (f) {
        var lw = f.b.x - f.a.x, my = (f.a.y + f.b.y) / 2, rr = (f.b.y - f.a.y) * .34;
        for (k = 0; k < 3; k++) {
          c.fillStyle = '#e8c38a'; c.beginPath(); c.arc(f.a.x + lw * (.2 + k * .3), my, rr, 0, 7); c.fill();
          c.strokeStyle = '#7a4a26'; c.lineWidth = Math.max(1, lw * .02); c.beginPath(); c.arc(f.a.x + lw * (.2 + k * .3), my, rr * .5, 0, 7); c.stroke();
        }
      }
    } else if (o.k === 'R') {
      var q = proj(o.lane, 0, Math.max(o.z, camZ + NEAR)), s = q.s;
      c.fillStyle = '#7d8a80'; c.beginPath(); c.moveTo(q.x - .8 * s, q.y); c.lineTo(q.x - .7 * s, q.y - .9 * s); c.lineTo(q.x - .2 * s, q.y - 1.5 * s); c.lineTo(q.x + .5 * s, q.y - 1.3 * s); c.lineTo(q.x + .85 * s, q.y - .5 * s); c.lineTo(q.x + .8 * s, q.y); c.fill();
      c.fillStyle = '#a3b0a5'; c.beginPath(); c.moveTo(q.x - .6 * s, q.y - .9 * s); c.lineTo(q.x - .2 * s, q.y - 1.4 * s); c.lineTo(q.x + .3 * s, q.y - 1.2 * s); c.lineTo(q.x, q.y - .8 * s); c.fill();
      c.fillStyle = '#63c777'; c.beginPath(); c.ellipse(q.x + .2 * s, q.y - 1.3 * s, .35 * s, .12 * s, .3, 0, 7); c.fill();
    } else if (o.k === 'A') {
      var post = { front: '#7a4a26', side: '#5a3a1c', top: '#8a5a32' };
      box(c, o.lane - .43, .05, 0, 1.75, o.z, o.z + .25, post);
      box(c, o.lane + .43, .05, 0, 1.75, o.z, o.z + .25, post);
      f = box(c, o.lane, .5, 1.0, 1.6, o.z, o.z + .3, { front: '#2f8f4e', side: '#1c5c33', top: '#63c777' });
      if (f) {
        var aw = f.b.x - f.a.x;
        c.fillStyle = '#1c5c33'; for (k = 0; k < 6; k++) { c.beginPath(); c.ellipse(f.a.x + aw * (.1 + k * .16), f.b.y + aw * .03, aw * .035, aw * .09, 0, 0, 7); c.fill(); }
        c.fillStyle = C.berry; c.beginPath(); c.arc(f.a.x + aw * .3, (f.a.y + f.b.y) / 2, aw * .04, 0, 7); c.arc(f.a.x + aw * .7, (f.a.y + f.b.y) / 2, aw * .04, 0, 7); c.fill();
      }
    }
  }
  function drawPickup(c, o) {
    var q = proj(o.lane, o.y + Math.sin(S.t * 5 + o.z) * .08, o.z), s = q.s;
    if (s < 4) return;
    if (o.k === 'fruit') { A.fruit(c, q.x, q.y, Math.max(3, .3 * s), ['fragola', 'banana', 'uva', 'mela'][o.kind]); return; }
    if (o.k === 'heart') { A.SHAPES.cuore(c, q.x, q.y, .38 * s, C.pinkPop); return; }
    c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(q.x, q.y, .55 * s, 0, 7); c.fill();
    c.strokeStyle = C.sun; c.lineWidth = .06 * s; c.stroke();
    powerIcon(c, o.type, q.x, q.y, .35 * s);
  }
  function powerIcon(c, type, x, y, r) {
    c.save(); c.lineCap = 'round';
    if (type === 'magnet') {
      c.strokeStyle = '#e8362b'; c.lineWidth = r * .45; c.beginPath(); c.arc(x, y - r * .1, r * .6, Math.PI, 0, true); c.stroke();
      c.strokeStyle = '#e9e2d0'; c.beginPath(); c.moveTo(x - r * .6, y - r * .1); c.lineTo(x - r * .6, y - r * .7); c.moveTo(x + r * .6, y - r * .1); c.lineTo(x + r * .6, y - r * .7); c.stroke();
    } else if (type === 'spring') {
      c.strokeStyle = '#4d80e4'; c.lineWidth = r * .22; c.beginPath();
      for (var i = 0; i <= 6; i++) c.lineTo(x + (i % 2 ? r * .55 : -r * .55), y + r * .7 - i * r * .23); c.stroke();
      c.fillStyle = C.berry; c.fillRect(x - r * .7, y - r * .85, r * 1.4, r * .25);
    } else {
      c.fillStyle = C.plum; c.beginPath(); c.moveTo(x - r, y); c.quadraticCurveTo(x - r * .4, y - r * .9, x, y - r * .1); c.quadraticCurveTo(x + r * .4, y - r * .9, x + r, y); c.quadraticCurveTo(x, y + r * .3, x - r, y); c.fill();
      c.fillStyle = C.tangerine; c.beginPath(); c.moveTo(x + r * .1, y - r * .1); c.lineTo(x + r * .7, y + r * .2); c.lineTo(x + r * .1, y + r * .2); c.fill();
    }
    c.restore();
  }

  function drawDino(c) {
    var p = S.p, base = baseAt(p.x, S.z), q = proj(p.x + S.nudge, p.y, S.z), s = q.s, sh = proj(p.x, base, S.z), k;
    c.fillStyle = 'rgba(30,20,0,.25)'; c.beginPath(); c.ellipse(sh.x, sh.y, .55 * s, .16 * s, 0, 0, 7); c.fill();
    if (S.shield > 0 && S.phase === 'run' && Math.sin(S.t * 28) > .3) return;
    var col = (G.account && G.account.color) || C.dino, dk = G.shade(col, -45), lt = G.shade(col, 35);
    var air = p.y - base > .05 || p.fly > 0, ph = S.dist * 1.6, lean = (p.lane - p.x) * .5;
    c.save(); c.translate(q.x, q.y);
    if (S.phase === 'dying' || S.phase === 'over') c.rotate(1.3);
    if (p.fly > 0) {
      // the pterodactyl carrying the dino
      var fl = Math.sin(S.t * 10) * .35 * s;
      c.fillStyle = C.plum;
      c.beginPath(); c.moveTo(0, -1.9 * s); c.quadraticCurveTo(-1.2 * s, -2.6 * s - fl, -2.3 * s, -2.0 * s - fl); c.quadraticCurveTo(-1.1 * s, -1.8 * s, 0, -1.6 * s); c.fill();
      c.beginPath(); c.moveTo(0, -1.9 * s); c.quadraticCurveTo(1.2 * s, -2.6 * s - fl, 2.3 * s, -2.0 * s - fl); c.quadraticCurveTo(1.1 * s, -1.8 * s, 0, -1.6 * s); c.fill();
      c.fillStyle = '#b996ea'; c.beginPath(); c.ellipse(0, -1.85 * s, .28 * s, .22 * s, 0, 0, 7); c.fill();
    }
    c.rotate(lean);
    c.lineJoin = 'round'; c.strokeStyle = G.shade(col, -80); c.lineWidth = Math.max(1.5, .045 * s);
    if (p.roll > 0) {
      // rolled into a ball, spikes spinning
      var ang = S.t * 18;
      c.fillStyle = col; c.beginPath(); c.arc(0, -.45 * s, .45 * s, 0, 7); c.fill(); c.stroke();
      c.fillStyle = C.sun;
      for (k = 0; k < 5; k++) { var a = ang + k * 1.26; c.beginPath(); c.moveTo(Math.cos(a) * .3 * s, -.45 * s + Math.sin(a) * .3 * s); c.lineTo(Math.cos(a + .25) * .55 * s, -.45 * s + Math.sin(a + .25) * .55 * s); c.lineTo(Math.cos(a + .5) * .3 * s, -.45 * s + Math.sin(a + .5) * .3 * s); c.fill(); }
      c.restore(); return;
    }
    var stride = air ? 0 : Math.sin(ph), bob = air ? 0 : Math.abs(Math.cos(ph)) * .06 * s;
    c.translate(0, -bob);
    function leg(side, lift) { c.fillStyle = dk; G.roundRect(c, side * .22 * s - .1 * s, -.42 * s - lift, .2 * s, .42 * s, .08 * s); c.fill(); c.stroke(); }
    if (air) { leg(-1, .12 * s); leg(1, .12 * s); } else { leg(-1, Math.max(0, stride) * .2 * s); leg(1, Math.max(0, -stride) * .2 * s); }
    // tail swinging toward the camera
    var tw = Math.sin(ph * .5) * .25 * s;
    c.fillStyle = col; c.beginPath(); c.moveTo(-.2 * s, -.55 * s); c.quadraticCurveTo(tw, -.1 * s, tw * 1.4, .12 * s); c.quadraticCurveTo(tw * .4, -.2 * s, .2 * s, -.55 * s); c.fill(); c.stroke();
    c.fillStyle = col; c.beginPath(); c.ellipse(0, -.85 * s, .42 * s, .5 * s, 0, 0, 7); c.fill(); c.stroke();
    var arm = air ? -.35 : stride * .25;
    c.beginPath(); c.ellipse(-.42 * s, -.95 * s + arm * s * .3, .09 * s, .2 * s, .5 - arm, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(.42 * s, -.95 * s - arm * s * .3, .09 * s, .2 * s, -.5 + arm, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(0, -1.45 * s, .34 * s, .3 * s, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = lt; c.beginPath(); c.ellipse(-.1 * s, -1.55 * s, .14 * s, .08 * s, -.3, 0, 7); c.fill();
    // spikes down the back
    c.fillStyle = C.sun;
    for (k = 0; k < 5; k++) { var sy = -1.72 * s + k * .26 * s, w = (k === 0 ? .1 : .14) * s; c.beginPath(); c.moveTo(-w, sy + .12 * s); c.lineTo(0, sy - .06 * s); c.lineTo(w, sy + .12 * s); c.fill(); c.stroke(); }
    c.restore();
    if (S.mag > 0) { c.save(); c.globalAlpha = .25 + .15 * Math.sin(S.t * 8); c.strokeStyle = '#e8362b'; c.lineWidth = .05 * s; c.beginPath(); c.arc(q.x, q.y - .9 * s, 1.1 * s, 0, 7); c.stroke(); c.restore(); }
    if (S.spring > 0) { c.strokeStyle = '#4d80e4'; c.lineWidth = .06 * s; c.beginPath(); for (k = 0; k <= 4; k++) c.lineTo(q.x + (k % 2 ? .18 : -.18) * s, sh.y - k * .07 * s); c.stroke(); }
  }

  function world(c) {
    var p = S.p;
    camX += (((p.x - 1) * LANE * .6) - camX) * .2; camY += ((p.y * .5 + (p.fly > 0 ? .8 : 0)) - camY) * .12; camZ = S.z - CAM_BACK;
    sky(c); ground(c);
    var list = [];
    scenery(list);
    S.obs.forEach(function (o) {
      if (o.got || o.z - camZ > 150) return;
      var far = o.z + (o.len || 0);
      if (far < camZ + NEAR) return;
      list.push({ far: far, z: o.z, draw: o.k === 'fruit' || o.k === 'power' || o.k === 'heart' ? function (cc) { drawPickup(cc, o); } : function (cc) { drawObstacle(cc, o); } });
    });
    // painter's order: whatever reaches beyond the dino goes before it, the rest after
    var before = list.filter(function (it) { return it.far > S.z + .01; }), after = list.filter(function (it) { return it.far <= S.z + .01; });
    var order = function (a, b) { return Math.max(b.z, camZ) - Math.max(a.z, camZ) || b.far - a.far; };
    before.sort(order); after.sort(order);
    before.forEach(function (it) { it.draw(c); });
    drawDino(c);
    after.forEach(function (it) { it.draw(c); });
    // speed lines once the run is fast
    var tn = tune(), sp = (S.v - tn.v0) / (tn.vMax - tn.v0);
    if (sp > .35 && S.phase === 'run') {
      c.strokeStyle = 'rgba(255,255,255,' + (.2 * sp).toFixed(3) + ')'; c.lineWidth = 3;
      for (var i = 0; i < 10; i++) { var a = hash(i + Math.floor(S.t * 12) * 17) * 6.28, r0 = 300 + hash(i * 7) * 120; c.beginPath(); c.moveTo(640 + Math.cos(a) * r0, 330 + Math.sin(a) * r0 * .6); c.lineTo(640 + Math.cos(a) * (r0 + 140), 330 + Math.sin(a) * (r0 + 140) * .6); c.stroke(); }
    }
  }

  function hud(c) {
    c.fillStyle = 'rgba(23,63,55,.86)'; G.roundRect(c, 16, 10, 1010, 78, 24); c.fill();
    for (var h = 0; h < 3; h++) {
      var alive = h < S.hearts, pulse = alive && S.heartFlash > 0 ? 1 + Math.sin(S.t * 38) * .2 : 1;
      c.save(); c.translate(58 + h * 52, 49); c.scale(pulse, pulse); A.SHAPES.cuore(c, 0, 0, 21, alive ? C.pinkPop : '#637c70'); c.restore();
    }
    A.fruit(c, 250, 49, 20, 'fragola'); G.text(String(S.fruit), 280, 50, { size: 34, color: C.cream, align: 'left' });
    G.text(Math.floor(S.dist) + ' m', 500, 50, { size: 32, color: C.cream });
    var x = 640;
    [['magnet', S.mag, 10], ['spring', S.spring, 10], ['ptero', S.p.fly, 6]].forEach(function (pw) {
      if (pw[1] <= 0) return;
      c.fillStyle = 'rgba(255,246,224,.9)'; c.beginPath(); c.arc(x, 49, 30, 0, 7); c.fill();
      powerIcon(c, pw[0], x, 52, 20);
      c.strokeStyle = C.sun; c.lineWidth = 6; c.beginPath(); c.arc(x, 49, 33, -Math.PI / 2, -Math.PI / 2 + 6.283 * pw[1] / pw[2]); c.stroke();
      x += 80;
    });
    if (S.combo >= 10) G.text('SUPER ×' + S.combo, 930, 50, { size: 26, color: C.sun });
    G.ui.button({ id: 'run-pause', x: 1080, y: 6, w: 180, h: 88, r: 24, color: C.water, label: 'Ⅱ', fontSize: 40, onTap: function () { action('pause'); } });
    if (S.reasonT > 0 && S.phase === 'run') G.text(S.reason, 640, 150, { size: 38, color: C.cream, stroke: C.leafDeep, strokeWidth: 9 });
  }
  function hints(c) {
    // quiet reminders of where to tap, never buttons that cover the track
    if (S.phase !== 'run' || S.time > 8) return;
    c.save(); c.globalAlpha = Math.max(0, 1 - S.time / 8) * .8;
    [[-1, 90], [1, 1190]].forEach(function (d) { c.fillStyle = 'rgba(255,246,224,.55)'; c.beginPath(); c.arc(d[1], 560, 58, 0, 7); c.fill(); c.fillStyle = C.leafDeep; c.beginPath(); c.moveTo(d[1] + d[0] * 26, 560); c.lineTo(d[1] - d[0] * 18, 530); c.lineTo(d[1] - d[0] * 18, 590); c.fill(); });
    c.restore();
  }
  function panel(c, title, sub) {
    c.fillStyle = 'rgba(18,61,41,.66)'; c.fillRect(0, 0, W, H);
    c.fillStyle = C.cream; G.roundRect(c, 250, 120, 780, 470, 36); c.fill();
    G.text(title, 640, 196, { size: 56, color: C.leafDeep });
    if (sub) G.text(sub, 640, 258, { size: 28, color: C.ink, maxWidth: 700 });
  }
  function howto(c, x, y, icon, label) {
    c.fillStyle = '#e9f3e1'; G.roundRect(c, x - 80, y - 60, 160, 150, 22); c.fill();
    icon(c, x, y - 10); G.text(label, x, y + 66, { size: 22, color: C.leafDeep });
  }
  function arrow(c, x, y, ang) { c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = C.leaf; c.beginPath(); c.moveTo(34, 0); c.lineTo(-6, -30); c.lineTo(-6, -12); c.lineTo(-30, -12); c.lineTo(-30, 12); c.lineTo(-6, 12); c.lineTo(-6, 30); c.fill(); c.restore(); }
  function draw(c) {
    world(c); hints(c); hud(c);
    if (S.phase === 'ready') {
      panel(c, 'Dino Run', 'Corri sui binari della giungla e prendi tutti i frutti!');
      howto(c, 400, 370, function (cc, x, y) { arrow(cc, x - 24, y, Math.PI); arrow(cc, x + 24, y, 0); }, 'cambia binario');
      howto(c, 580, 370, function (cc, x, y) { arrow(cc, x, y, -Math.PI / 2); }, 'salta');
      howto(c, 760, 370, function (cc, x, y) { arrow(cc, x, y, Math.PI / 2); }, 'rotola');
      howto(c, 940, 370, function (cc, x, y) { powerIcon(cc, 'ptero', x, y, 40); }, 'vola!');
      G.ui.button({ id: 'run-start', x: 470, y: 486, w: 340, h: 96, r: 28, color: C.leaf, label: 'VIA!', onTap: start });
    } else if (S.phase === 'pause' || S.phase === 'over') {
      var s = saved(), over = S.phase === 'over';
      panel(c, over ? 'Bella corsa!' : 'Pausa', over ? Math.floor(S.dist) + ' metri  ·  ' + S.fruit + ' frutti' : 'Riparti quando vuoi');
      if (over) {
        G.text('Record: ' + s.bestM + ' metri  ·  ' + s.bestF + ' frutti', 640, 320, { size: 26, color: C.leafDeep });
        if (s.last >= s.bestM && s.runs > 1) G.text('NUOVO RECORD!', 640, 380, { size: 40, color: C.tangerine });
      }
      G.ui.button({ id: 'run-again', x: 330, y: 440, w: 300, h: 110, r: 26, color: C.leaf, label: over ? 'Riprova' : 'Continua', onTap: function () { if (over) { reset(); start(); } else action('pause'); } });
      G.ui.button({ id: 'run-menu', x: 650, y: 440, w: 300, h: 110, r: 26, color: C.tangerine, label: 'Menu', onTap: function () { G.go('menu'); } });
    }
  }

  function swipe(dx, dy) { return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy < 0 ? 'jump' : 'duck'); }
  function onDown(p) { if (!touch && S.phase === 'run') touch = { id: p.id, x: p.x, y: p.y }; }
  function onMove(p) {
    // act as soon as the swipe is clear, like the games children already know
    if (!touch || p.id !== touch.id) return;
    var dx = p.x - touch.x, dy = p.y - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 55) { touch = null; action(swipe(dx, dy)); }
  }
  function onUp(p) {
    if (!touch || p.id !== touch.id) return;
    var dx = p.x - touch.x, dy = p.y - touch.y; touch = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) { action(p.x < 640 ? 'left' : 'right'); return; }  // a tap moves toward the side you touch
    action(swipe(dx, dy));
  }

  G.scene('run', {
    hud: false, back: false,
    enter: function () { touch = null; acc = 0; reset(); },
    update: function (dt) { acc += dt; var n = 0; while (acc >= DT && n < 4) { step(); acc -= DT; n++; } if (n === 4) acc = 0; },
    draw: draw, onDown: onDown, onUp: onUp, onMove: onMove,
    onCancel: function () { touch = null; },
    exit: function () { touch = null; }
  });
  window.addEventListener('keydown', function (e) {
    if (G.current !== 'run' || e.repeat) return;
    if (e.key === 'Enter' && S.phase === 'ready') { start(); return; }
    var a = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', ArrowDown: 'duck', ' ': 'jump', Escape: 'pause', a: 'left', d: 'right', w: 'jump', s: 'duck' }[e.key];
    if (a) { e.preventDefault(); action(a); }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { touch = null; if (G.current === 'run' && S && S.phase === 'run') S.phase = 'pause'; } });

  G.scene('menu', {
    hud: false, back: false,
    enter: function () { reset(1); },
    draw: function (c) {
      if (!S || S.phase !== 'ready') reset(1);
      S.t += G.dt; S.dist += G.dt * 7; S.z += G.dt * 7; spawn();
      world(c);
      G.text('DINO RUN', 640, 150, { size: 96, color: C.cream, stroke: C.leafDeep, strokeWidth: 16 });
      var s = saved();
      if (s.runs) G.text('Record: ' + s.bestM + ' metri  ·  ' + s.bestF + ' frutti', 640, 236, { size: 30, color: C.cream, stroke: C.leafDeep, strokeWidth: 7 });
      G.ui.button({ id: 'play', x: 430, y: 470, w: 420, h: 116, r: 30, color: C.leaf, label: 'CORRI!', onTap: function () { G.go('run'); } });
      G.ui.button({ id: 'profiles', x: 24, y: 596, w: 300, h: 100, color: C.water, label: 'Cambia dino', onTap: function () { G.accounts.logout(); G.go('accesso'); } });
      G.ui.button({ id: 'parents', x: 976, y: 596, w: 280, h: 100, color: C.bark, label: 'Genitori', onTap: function () { G.go('gate'); } });
    }
  });

  /* hooks for the tests */
  G.runState = function () { return S; };
  G.runAction = action; G.runStart = start;
  G.run = { reset: reset, step: step, snap: function () { return JSON.stringify(S); }, load: function (s) { S = JSON.parse(s); }, quiet: function (q) { quiet = q; }, baseAt: function (x, z) { return baseAt(x, z); }, PATTERNS: PATTERNS };
})();
