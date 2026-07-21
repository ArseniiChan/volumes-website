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

  var i;
  /* A clean capture STAGE, not a literal warehouse: a soft ground haze that
     grounds the turntable, one overhead key light, quiet atmosphere. Reads
     as an intentional dark studio for a scan — restraint, not clutter. */

  /* ground haze — a low, cool, fading floor centred under the stage */
  for (i = 0; i < 1500 * D; i++) {
    var gx = rnd(-780, 780), gz = rnd(-500, 820);
    var fade = 1 - Math.min(1, Math.abs(gx) / 780);           /* brighter toward centre */
    pt(gx, rnd(212, 250) + rnd(-6, 6), gz, 150, 156, 168, rnd(.4, 1.0), 0, .28, .32 + .5 * fade);
  }
  /* overhead key light — a soft luminous pool above the stage */
  for (i = 0; i < 360 * D; i++) pt(rnd(-230, 230), rnd(-336, -292) + rnd(-6, 6), rnd(-120, 380), 236, 242, 250, rnd(.6, 1.5), 0, .5, 1.05);
  /* a faint volumetric shaft falling from the key light toward the stage */
  for (i = 0; i < 260 * D; i++) { var s = Math.random(); pt(rnd(-70, 70) * (1 + s), -300 + s * 480, rnd(-40, 220), 210, 220, 236, rnd(.35, .8), 0, .12, .28); }
  /* whisper of warm + teal near the floor (work light), low and contained */
  for (i = 0; i < 90 * D; i++) pt(rnd(-300, 300), rnd(150, 220), rnd(-60, 320), 206, 138, 78, rnd(.4, .9), 0, .35, .7);
  for (i = 0; i < 110 * D; i++) pt(rnd(-560, 560), rnd(-140, 200), rnd(-300, 700), 62, 198, 198, rnd(.3, .75));

  /* the robot + its table are built together below as one rig (armRoot),
     so the machine always sits on its surface. */
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
  /* cylinder as stacked rings along a local axis, centered at (ox,oy,oz).
     Dense enough that the silhouette reads as a solid scanned part.
     Brightness lifts with height (yTop) so the rig looks lit from above. */
  function ringCyl(A, axis, ox, oy, oz, r, len, c, vMin, vMax) {
    var nRings = Math.max(4, Math.round(len / 1.6));   /* dense: the subject is a high-fidelity scan */
    var perRing = Math.max(30, Math.round(r * 4.2));
    for (var q = 0; q < nRings; q++) {
      var a = -len / 2 + len * q / (nRings - 1);
      for (var k = 0; k < perRing; k++) {
        var ang = (k / perRing) * 6.2832 + rnd(-.1, .1);
        var rr = r * rnd(.96, 1.04);
        var u = Math.cos(ang) * rr, w = Math.sin(ang) * rr;
        if (axis === 'y') partPush(A, ox + u, oy + a, oz + w, c, vMin, vMax);
        else if (axis === 'z') partPush(A, ox + u, oy + w, oz + a, c, vMin, vMax);
        else partPush(A, ox + a, oy + u, oz + w, c, vMin, vMax);
      }
    }
  }
  /* dense planar grid → reads as a genuine solid surface, not a scatter */
  function slab(A, x0, x1, y0, y1, z0, z1, nx, nz, c, vMin, vMax) {
    for (var ix = 0; ix < nx; ix++) for (var iz = 0; iz < nz; iz++) {
      partPush(A, x0 + (x1 - x0) * (ix / (nx - 1)) + rnd(-2, 2),
                  rnd(y0, y1),
                  z0 + (z1 - z0) * (iz / (nz - 1)) + rnd(-2, 2), c, vMin, vMax);
    }
  }
  /* filled disc — an ellipse in perspective reads as solid ground at any angle */
  function disc(A, cx, cy, cz, r, n, c, vMin, vMax) {
    for (var k = 0; k < n; k++) {
      var t = Math.random() * 6.2832, rr = Math.sqrt(Math.random()) * r;
      partPush(A, cx + Math.cos(t) * rr, cy + rnd(-1.5, 1.5), cz + Math.sin(t) * rr, c, vMin, vMax);
    }
  }
  function ring(A, cx, cy, cz, r, n, c, vMin, vMax) {
    for (var k = 0; k < n; k++) {
      var t = (k / n) * 6.2832;
      partPush(A, cx + Math.cos(t) * r * rnd(.99, 1.01), cy + rnd(-1, 1), cz + Math.sin(t) * r * rnd(.99, 1.01), c, vMin, vMax);
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

  /* The rig sits in armRoot-local space: +y up, tabletop at y=0 (the robot
     bolts to it), legs drop to the floor (~y-84), robot builds upward.
     The whole thing moves as a unit so the machine never leaves its table. */
  var TABLE = [150, 150, 158], WARM = [214, 150, 92], EDGE = [186, 189, 197];
  var armRoot = new THREE.Group();
  function placeArm(aspect) {
    if (aspect < 0.8) { armRoot.position.set(12, -300, 20); armRoot.scale.setScalar(0.95); }  /* portrait: lower-frame, below the copy */
    else { armRoot.position.set(20, -230, 150); armRoot.scale.setScalar(1.35); }              /* landscape: lower-frame centerpiece */
  }
  placeArm(W / H);
  group.add(armRoot);

  /* --- the robot stands on a glowing teal scan-turntable. Teal pops where
     grey goes invisible, so the ring plants the robot as solid ground at any
     angle. A bright arc sweeps around it (rotated in frame()) — an active
     scan in progress, which is exactly the capture story. --- */
  var A_static = partArrays();
  disc(A_static, 0, -1, 0, 86, 1000, TEAL2, .26, .5);    /* filled glow platform */
  ring(A_static, 0, -2, 0, 110, 360, TEAL2, .3, .6);     /* faint outer halo */
  for (var yy = -4; yy >= -16; yy -= 3) ring(A_static, 0, yy, 0, 86, 220, EDGE, .5, .82); /* platform edge wall */
  armRoot.add(toPoints(A_static));

  /* the rotating scan plate: bright rim + a hot sweeping arc */
  var A_scan = partArrays();
  ring(A_scan, 0, 0, 0, 88, 640, TEAL2, .8, 1.15);       /* bright base rim */
  for (i = 0; i < 340; i++) {                             /* the sweep arc (bright segment) */
    var sa = (i / 340) * 0.85;
    partPush(A_scan, Math.cos(sa) * 88 * rnd(.99, 1.01), rnd(-1, 1), Math.sin(sa) * 88 * rnd(.99, 1.01), [190, 255, 255], 1.05, 1.5);
  }
  var scanPlate = toPoints(A_scan);
  armRoot.add(scanPlate);

  /* warm work-light pool + the part being handled, under the gripper */
  var A_work = partArrays();
  for (i = 0; i < 320; i++) partPush(A_work, rnd(-46, 46), rnd(-1, 3), rnd(-38, 42), WARM, .45, .85); /* glow pool on the table */
  for (i = 0; i < 170; i++) partPush(A_work, rnd(-17, 17), rnd(1, 24), 42 + rnd(0, 26), WARM, .8, 1.15); /* workpiece block */
  armRoot.add(toPoints(A_work));

  /* --- the articulated arm, base bolted to the tabletop (local y0) --- */
  var j1 = new THREE.Group(); armRoot.add(j1);            /* base yaw */
  var A_base = partArrays();
  ringCyl(A_base, 'y', 0, 6, 0, 34, 12, JOINT2, .8, 1.15);  /* base plate on the table */
  ringCyl(A_base, 'y', 0, 22, 0, 26, 24, STEEL, .72, 1.05); /* pedestal */
  ringCyl(A_base, 'y', 0, 40, 0, 21, 16, JOINT2, .85, 1.2); /* shoulder drum */
  j1.add(toPoints(A_base));

  var j2 = new THREE.Group(); j2.position.set(0, 50, 0); j1.add(j2); /* shoulder pitch */
  var A_upper = partArrays();
  ringCyl(A_upper, 'z', 0, 0, 0, 19, 46, JOINT2, .85, 1.2);   /* shoulder knuckle */
  ringCyl(A_upper, 'y', 0, 64, 0, 13, 120, STEEL, .78, 1.12); /* upper tube */
  j2.add(toPoints(A_upper));

  var j3 = new THREE.Group(); j3.position.set(0, 126, 0); j2.add(j3); /* elbow */
  var A_fore = partArrays();
  ringCyl(A_fore, 'z', 0, 0, 0, 16, 40, JOINT2, .85, 1.2);    /* elbow knuckle */
  ringCyl(A_fore, 'y', 0, 56, 0, 10, 104, STEEL, .78, 1.12);  /* forearm tube */
  j3.add(toPoints(A_fore));

  var j4 = new THREE.Group(); j4.position.set(0, 110, 0); j3.add(j4); /* wrist */
  var A_wrist = partArrays();
  ringCyl(A_wrist, 'z', 0, 4, 0, 10, 26, JOINT2, .85, 1.2);   /* wrist knuckle */
  ringCyl(A_wrist, 'y', 0, 18, 0, 8.5, 12, TEAL2, .95, 1.2);  /* teal collar */
  ringCyl(A_wrist, 'y', 0, 28, 0, 7.5, 9, STEEL, .82, 1.15);  /* palm */
  j4.add(toPoints(A_wrist));

  /* parallel-jaw fingers: separate objects so the gripper can open/close */
  function finger() {
    var A = partArrays();
    ringCyl(A, 'y', 0, 11, 0, 3, 22, STEEL, .82, 1.2);
    var g3 = new THREE.Group();
    g3.position.set(0, 30, 0);
    g3.add(toPoints(A));
    j4.add(g3);
    return g3;
  }
  var fingerL = finger(), fingerR = finger();
  fingerL.position.x = -9; fingerR.position.x = 9;

  var arm = { j1: j1, j2: j2, j3: j3, j4: j4, fL: fingerL, fR: fingerR, scan: scanPlate };

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
    arm.scan.rotation.y -= 0.014;                          /* scan sweep circles the platform */

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
    placeArm(camera.aspect);
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
