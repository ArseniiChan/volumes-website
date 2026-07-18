/* Volumes point-cloud hero — Three.js, one draw call.
   A stylized, downsampled warehouse interior (never licensable fidelity):
   floor, rack columns, warm shelf beams, one overhead light streak,
   teal instrument accents, drifting dust. The pointer deforms the field
   locally; the field springs back. Everything else is still. */

import * as THREE from '../vendor/three.module.min.js';

export function start(container, opts) {
  opts = opts || {};

  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W = opts.poster ? 1600 : container.clientWidth;
  var H = opts.poster ? 1000 : container.clientHeight;

  var renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: !!opts.poster
  });
  renderer.setPixelRatio(opts.poster ? 1 : DPR);
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 1);
  container.appendChild(renderer.domElement);

  /* portrait framing: widen the view so the racks stay in frame */
  function fovFor(aspect) { return aspect < 0.8 ? 92 : 75; }
  var camera = new THREE.PerspectiveCamera(fovFor(W / H), W / H, 10, 4000);
  camera.position.set(0, 30, 0);
  camera.lookAt(0, -35, -700); /* slight downward pitch: the floor must read */
  var scene = new THREE.Scene();

  /* ---------- build the capture ---------- */
  /* Coordinates mirror the approved comp: x right, y up, depth away from
     camera. The cloud group sits at Z=-700 and sways around its own axis. */
  var D = 2; /* density factor → ~13k points */
  var pos = [], col = [], size = [], amp = [], seed = [];

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pt(x, yDown, zMock, r, g, b, s, driftAmp, vMin, vMax) {
    pos.push(x, -yDown, -zMock);
    var v = rnd(vMin === undefined ? 0.55 : vMin, vMax === undefined ? 1.0 : vMax);
    col.push(r / 255 * v, g / 255 * v, b / 255 * v);
    size.push(s);
    amp.push(driftAmp || 0);
    seed.push(Math.random());
  }

  var i, rx, ry, side;
  /* floor — the brightest large surface after the streak */
  for (i = 0; i < 2600 * D; i++) {
    if (Math.random() < .75) pt(rnd(-900, 900), rnd(180, 260) + rnd(-8, 8), rnd(-500, 900), 200, 190, 172, rnd(.5, 1.2), 0, .6, 1.0);
    else pt(rnd(-900, 900), rnd(180, 260) + rnd(-8, 8), rnd(-500, 900), 130, 140, 150, rnd(.5, 1.2), 0, .6, 1.0);
  }
  /* rack columns — legible verticals */
  var racks = [-620, -380, 380, 620];
  for (var c = 0; c < racks.length; c++) {
    rx = racks[c];
    for (i = 0; i < 260 * D; i++) pt(rx + rnd(-14, 14), rnd(-260, 200), rnd(-300, 700), 150, 155, 165, rnd(.5, 1.3), 0, .65, 1.0);
  }
  /* warm shelf beams — the orange that says "warehouse" */
  var beams = [-180, -40, 100];
  for (var bIdx = 0; bIdx < beams.length; bIdx++) {
    ry = beams[bIdx];
    for (i = 0; i < 330 * D; i++) {
      side = Math.random() < .5 ? -1 : 1;
      pt(side * rnd(380, 620), ry + rnd(-10, 10), rnd(-300, 700), 205, 122, 58, rnd(.6, 1.4), 0, .7, 1.05);
    }
  }
  /* overhead light streak */
  for (i = 0; i < 420 * D; i++) pt(rnd(-260, 260), rnd(-330, -290) + rnd(-8, 8), rnd(-100, 400), 240, 244, 250, rnd(.7, 1.7), 0, .8, 1.2);
  /* teal instrument accents */
  for (i = 0; i < 120 * D; i++) pt(rnd(-700, 700), rnd(-260, 240), rnd(-400, 800), 62, 198, 198, rnd(.4, 1.0));

  /* ---- workbench for the manipulator (the arm itself is articulated,
     built as its own point objects after the material exists) ---- */
  var BENCH = [152, 147, 138], WARM = [205, 122, 58];
  for (i = 0; i < 850; i++) pt(rnd(130, 430), 100 + rnd(0, 12), rnd(60, 200), BENCH[0], BENCH[1], BENCH[2], rnd(.6, 1.0), 0, .6, .95);
  [[142, 72], [418, 72], [142, 188], [418, 188]].forEach(function (leg) {
    for (var k = 0; k < 70; k++) pt(leg[0] + rnd(-5, 5), rnd(112, 178), leg[1] + rnd(-5, 5), BENCH[0], BENCH[1], BENCH[2], rnd(.55, .9), 0, .55, .85);
  });
  /* the workpiece on the bench, in the gripper's work zone */
  for (i = 0; i < 90; i++) pt(rnd(155, 195), rnd(90, 102), rnd(115, 155), WARM[0], WARM[1], WARM[2], rnd(.6, 1.0), 0, .7, 1.0);
  /* drifting dust — atmosphere, must stay quieter than structure */
  for (i = 0; i < 950 * D; i++) pt(rnd(-900, 900), rnd(-320, 250), rnd(-500, 900), 200, 205, 215, rnd(.3, .7), rnd(2, 5), .3, .6);

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  geo.setAttribute('aAmp', new THREE.Float32BufferAttribute(amp, 1));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));

  var touchy = !opts.poster && window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var uniforms = {
    uTime: { value: 0 },
    uDPR: { value: opts.poster ? 1 : DPR },
    uPointer: { value: new THREE.Vector3(1e5, 1e5, -700) },
    uStrength: { value: 0 },
    uRadius: { value: touchy ? 270 : 175 },
    uPush: { value: touchy ? 58 : 42 }
  };

  var mat = new THREE.ShaderMaterial({
    uniforms: uniforms,
    transparent: false,
    depthWrite: true,
    vertexShader: [
      'attribute vec3 aColor;',
      'attribute float aSize;',
      'attribute float aAmp;',
      'attribute float aSeed;',
      'uniform float uTime;',
      'uniform float uDPR;',
      'uniform vec3 uPointer;',
      'uniform float uStrength;',
      'uniform float uRadius;',
      'uniform float uPush;',
      'varying vec3 vColor;',
      'void main(){',
      '  vColor = aColor;',
      '  vec4 wp = modelMatrix * vec4(position, 1.0);',
      /* dust drift, structure stays still */
      '  wp.y += sin(uTime * 0.4 + aSeed * 6.2831) * aAmp;',
      '  wp.x += cos(uTime * 0.27 + aSeed * 4.7) * aAmp * 0.6;',
      /* local deformation under the pointer, springs back via uStrength */
      '  vec3 d = wp.xyz - uPointer;',
      '  float dist = length(d);',
      '  float fall = smoothstep(uRadius, 0.0, dist);',
      '  wp.xyz += normalize(d + vec3(0.0001)) * fall * uStrength * uPush;',
      '  vec4 mv = viewMatrix * wp;',
      '  gl_Position = projectionMatrix * mv;',
      '  gl_PointSize = clamp(aSize * 1.9 * uDPR * (520.0 / -mv.z), 0.75, 6.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vColor;',
      'void main(){ gl_FragColor = vec4(vColor, 1.0); }'
    ].join('\n')
  });

  var cloud = new THREE.Points(geo, mat);
  var group = new THREE.Group();
  group.position.set(0, 0, -700);
  group.add(cloud);
  scene.add(group);

  /* ---- the manipulator: a UR-style cobot as an articulated joint chain.
     Each link is its own Points object of ring-sampled cylinders (the rings
     read as a scanned machine), parented into an FK hierarchy so the arm
     genuinely moves: base yaw sweeps, elbow flexes, gripper stays low. ---- */
  var STEEL = [190, 196, 208], JOINT2 = [230, 234, 244], TEAL2 = [62, 198, 198];

  function partArrays() { return { pos: [], col: [], size: [], amp: [], seed: [] }; }
  function partPush(A, x, y, z, c, vMin, vMax, s) {
    A.pos.push(x, y, z);
    var v = rnd(vMin, vMax);
    A.col.push(c[0] / 255 * v, c[1] / 255 * v, c[2] / 255 * v);
    A.size.push(s || rnd(.8, 1.3));
    A.amp.push(0);
    A.seed.push(Math.random());
  }
  /* cylinder as stacked rings along a local axis, centered at (ox,oy,oz) */
  function ringCyl(A, axis, ox, oy, oz, r, len, c, vMin, vMax) {
    var nRings = Math.max(2, Math.round(len / 5));
    var perRing = Math.max(10, Math.round(r * 1.6));
    for (var q = 0; q < nRings; q++) {
      var a = -len / 2 + len * q / (nRings - 1);
      for (var k = 0; k < perRing; k++) {
        var ang = (k / perRing) * 6.2832 + rnd(-.12, .12);
        var rr = r * rnd(.94, 1.05);
        var u = Math.cos(ang) * rr, w = Math.sin(ang) * rr;
        if (axis === 'y') partPush(A, ox + u, oy + a, oz + w, c, vMin, vMax);
        else if (axis === 'z') partPush(A, ox + u, oy + w, oz + a, c, vMin, vMax);
        else partPush(A, ox + a, oy + u, oz + w, c, vMin, vMax);
      }
    }
  }
  function toPoints(A) {
    var g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3));
    g2.setAttribute('aColor', new THREE.Float32BufferAttribute(A.col, 3));
    g2.setAttribute('aSize', new THREE.Float32BufferAttribute(A.size, 1));
    g2.setAttribute('aAmp', new THREE.Float32BufferAttribute(A.amp, 1));
    g2.setAttribute('aSeed', new THREE.Float32BufferAttribute(A.seed, 1));
    return new THREE.Points(g2, mat);
  }

  /* bench top is at mock yDown 100, z 140 → local (x, -100, -140) */
  var armRoot = new THREE.Group();
  armRoot.position.set(310, -100, -140);
  group.add(armRoot);

  var j1 = new THREE.Group(); armRoot.add(j1);            /* base yaw */
  var A_base = partArrays();
  ringCyl(A_base, 'y', 0, 10, 0, 26, 20, STEEL, .7, 1.0); /* pedestal */
  ringCyl(A_base, 'y', 0, 26, 0, 20, 14, JOINT2, .8, 1.15); /* shoulder drum */
  j1.add(toPoints(A_base));

  var j2 = new THREE.Group(); j2.position.set(0, 36, 0); j1.add(j2); /* shoulder pitch */
  var A_upper = partArrays();
  ringCyl(A_upper, 'z', 0, 0, 0, 18, 44, JOINT2, .8, 1.2);  /* shoulder knuckle */
  ringCyl(A_upper, 'y', 0, 62, 0, 12.5, 116, STEEL, .75, 1.1); /* upper tube */
  j2.add(toPoints(A_upper));

  var j3 = new THREE.Group(); j3.position.set(0, 122, 0); j2.add(j3); /* elbow */
  var A_fore = partArrays();
  ringCyl(A_fore, 'z', 0, 0, 0, 15, 38, JOINT2, .8, 1.2);   /* elbow knuckle */
  ringCyl(A_fore, 'y', 0, 54, 0, 9.5, 100, STEEL, .75, 1.1); /* forearm tube */
  j3.add(toPoints(A_fore));

  var j4 = new THREE.Group(); j4.position.set(0, 106, 0); j3.add(j4); /* wrist */
  var A_wrist = partArrays();
  ringCyl(A_wrist, 'z', 0, 4, 0, 9, 24, JOINT2, .8, 1.2);   /* wrist knuckle */
  ringCyl(A_wrist, 'y', 0, 16, 0, 8, 10, TEAL2, .9, 1.15);  /* teal collar */
  ringCyl(A_wrist, 'y', 0, 25, 0, 7, 8, STEEL, .8, 1.15);   /* palm */
  j4.add(toPoints(A_wrist));

  /* parallel-jaw fingers: separate objects so the gripper can open/close */
  function finger() {
    var A = partArrays();
    ringCyl(A, 'y', 0, 10, 0, 2.8, 20, STEEL, .8, 1.2);
    var g3 = new THREE.Group();
    g3.position.set(0, 28, 0);
    g3.add(toPoints(A));
    j4.add(g3);
    return g3;
  }
  var fingerL = finger(), fingerR = finger();
  fingerL.position.x = -8.5; fingerR.position.x = 8.5;

  var arm = { j1: j1, j2: j2, j3: j3, j4: j4, fL: fingerL, fR: fingerR };

  /* ---------- pointer → world point on the cloud plane ---------- */
  var pointerTarget = new THREE.Vector3(1e5, 1e5, -700);
  var strengthTarget = 0;
  var lastMove = -1e4;
  var rayDir = new THREE.Vector3();

  /* parallax: the camera drifts through the room — gyro on phones,
     cursor position on desktop. Slow and small, per the motion rules. */
  var parTX = 0, parTY = 30;
  var tiltEvents = 0, permState = 'no-permission-api', lastTilt = '—';
  var dbg = null;
  if (!opts.poster && new URLSearchParams(location.search).has('debug')) {
    dbg = document.createElement('div');
    dbg.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;color:#3ec6c6;' +
      'font:11px/1.5 monospace;background:rgba(0,0,0,.7);padding:8px;pointer-events:none;white-space:pre;';
    document.body.appendChild(dbg);
  }

  function onMove(e) {
    var ndcX = (e.clientX / container.clientWidth) * 2 - 1;
    var ndcY = -(e.clientY / container.clientHeight) * 2 + 1;
    rayDir.set(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
    var t = (-700 - camera.position.z) / rayDir.z;
    pointerTarget.copy(camera.position).addScaledVector(rayDir, t);
    lastMove = performance.now();
    if (!touchy) { parTX = ndcX * 26; parTY = 30 + ndcY * 16; }
  }

  var baseBeta = null, baseGamma = null;
  function onTilt(e) {
    if (e.beta === null || e.gamma === null) return;
    tiltEvents++;
    lastTilt = e.beta.toFixed(1) + '/' + e.gamma.toFixed(1);
    var beta = e.beta, gamma = e.gamma;
    var angle = (screen.orientation && screen.orientation.angle) || 0;
    if (angle === 90) { var tmp = beta; beta = -gamma; gamma = tmp; }
    else if (angle === -90 || angle === 270) { var tmp2 = beta; beta = gamma; gamma = -tmp2; }
    if (baseBeta === null) { baseBeta = beta; baseGamma = gamma; }
    /* re-center the neutral pose very slowly (~30s) so a held lean stays leaned */
    baseBeta += (beta - baseBeta) * 0.0006;
    baseGamma += (gamma - baseGamma) * 0.0006;
    var dg = Math.max(-25, Math.min(25, gamma - baseGamma));
    var db = Math.max(-25, Math.min(25, beta - baseBeta));
    parTX = (dg / 25) * 95;
    parTY = 30 - (db / 25) * 60;
  }
  function bindTilt() { window.addEventListener('deviceorientation', onTilt, { passive: true }); }

  if (!opts.poster) {
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    window.addEventListener('pointerleave', function () { lastMove = -1e4; });
    window.addEventListener('pointerup', function () { lastMove = -1e4; });

    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      /* iOS: motion access needs a user gesture. Ask from several gesture
         types — Safari is picky about which ones carry user activation. */
      permState = 'waiting for first tap';
      var asked = false;
      var askOnce = function () {
        if (asked) return;
        DeviceOrientationEvent.requestPermission()
          .then(function (state) {
            asked = true;
            permState = state;
            ['pointerdown', 'touchend', 'click'].forEach(function (ev) {
              window.removeEventListener(ev, askOnce);
            });
            if (state === 'granted') bindTilt();
          })
          .catch(function (err) { permState = 'ask failed: ' + err; });
      };
      ['pointerdown', 'touchend', 'click'].forEach(function (ev) {
        window.addEventListener(ev, askOnce);
      });
    } else if ('DeviceOrientationEvent' in window) {
      permState = 'bound without prompt';
      bindTilt();
    }
  }

  /* ---------- loop ---------- */
  var t = 0;
  var running = true;
  var stage = document.querySelector('.stage');
  var introStart = performance.now(); /* one slow settle-in, then stillness */
  var introPlayed = false; /* if the tab loads hidden, replay the settle on first view */
  var stats = { frames: 0, since: performance.now() };
  window.__heroStats = stats;
  window.__hero = { renderer: renderer, scene: scene, camera: camera, uniforms: uniforms, group: group, arm: arm };

  function frame() {
    if (!running) return;
    t += 0.0022;
    uniforms.uTime.value = t * 10.0;
    group.rotation.y = Math.sin(t) * 0.06;

    strengthTarget = (performance.now() - lastMove < 120) ? 1 : 0;
    uniforms.uStrength.value += (strengthTarget - uniforms.uStrength.value) * 0.1;
    uniforms.uPointer.value.lerp(pointerTarget, 0.18);

    /* the arm works: slow base sweep, gentle elbow flex, gripper kept low.
       The jaws close as the elbow dips — reach, pinch, release. */
    arm.j1.rotation.y = 0.25 + Math.sin(t * 2.1) * 0.38;
    arm.j2.rotation.z = 0.85 + Math.sin(t * 1.5 + 1.2) * 0.05;
    arm.j3.rotation.z = 1.52 + Math.sin(t * 2.6 + 0.5) * 0.10;
    arm.j4.rotation.z = 0.72 - Math.sin(t * 2.6 + 0.5) * 0.08;
    var grip = Math.max(0, Math.sin(t * 2.6 + 0.9));
    var gap = 8.5 - 5 * grip * grip;
    arm.fL.position.x = -gap;
    arm.fR.position.x = gap;

    var introK = Math.min(1, (performance.now() - introStart) / 3000);
    if (introK < 1) introPlayed = true;
    var settle = 1 - Math.pow(1 - introK, 3);
    camera.position.x += (parTX - camera.position.x) * 0.075;
    camera.position.y += (parTY + (1 - settle) * 34 - camera.position.y) * 0.075;
    camera.position.z = (1 - settle) * 150;
    /* counter-shifted look target roughly doubles the perceived parallax */
    camera.lookAt(-camera.position.x * 0.55, -35 - (camera.position.y - 30) * 0.55, -700);

    /* the interface floats against the room: the fixed center layer is what
       the eye anchors on, so it must drift opposite the camera to read as depth */
    if (stage) {
      stage.style.transform = 'translate3d(' + (-camera.position.x * 0.14).toFixed(1) + 'px,' +
        ((camera.position.y - 30) * 0.14).toFixed(1) + 'px,0)';
    }

    if (dbg) {
      dbg.textContent = 'perm:   ' + permState +
        '\nevents: ' + tiltEvents +
        '\ntilt:   ' + lastTilt +
        '\ntarget: ' + parTX.toFixed(0) + '/' + parTY.toFixed(0) +
        '\ncam:    ' + camera.position.x.toFixed(0) + '/' + camera.position.y.toFixed(0);
    }

    renderer.render(scene, camera);
    stats.frames++;
    requestAnimationFrame(frame);
  }

  if (opts.poster) {
    /* deterministic single frame for the build-time poster capture */
    group.rotation.y = 0.02;
    arm.j1.rotation.y = 0.25;
    arm.j2.rotation.z = 0.85;
    arm.j3.rotation.z = 1.52;
    arm.j4.rotation.z = 0.72;
    renderer.render(scene, camera);
    window.__posterReady = true;
    return renderer.domElement;
  }

  function onResize() {
    W = container.clientWidth; H = container.clientHeight;
    camera.aspect = W / H;
    camera.fov = fovFor(camera.aspect);
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
  }
  window.addEventListener('resize', onResize);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { running = false; }
    else if (!running) {
      if (!introPlayed) introStart = performance.now();
      running = true;
      requestAnimationFrame(frame);
    }
  });

  requestAnimationFrame(frame);
  return renderer.domElement;
}
