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
  var pos = [], col = [], size = [], amp = [], seed = [], armLever = [];

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pt(x, yDown, zMock, r, g, b, s, driftAmp, vMin, vMax, lever) {
    pos.push(x, -yDown, -zMock);
    var v = rnd(vMin === undefined ? 0.55 : vMin, vMax === undefined ? 1.0 : vMax);
    col.push(r / 255 * v, g / 255 * v, b / 255 * v);
    size.push(s);
    amp.push(driftAmp || 0);
    seed.push(Math.random());
    armLever.push(lever || 0);
  }

  /* dense scatter primitives for the manipulator: points hug the surface
     of a tube so the silhouette stays crisp at sparse density */
  function capsule(a, b, r, n, c, vMin, vMax, levA, levB) {
    var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    var ux = dx / len, uy = dy / len, uz = dz / len;
    for (var k = 0; k < n; k++) {
      var f = Math.random();
      /* random vector minus its axial component → perpendicular offset */
      var ox = rnd(-1, 1), oy = rnd(-1, 1), oz = rnd(-1, 1);
      var dot = ox * ux + oy * uy + oz * uz;
      ox -= dot * ux; oy -= dot * uy; oz -= dot * uz;
      var m = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
      var rr = r * (0.65 + 0.35 * Math.random());
      pt(a[0] + dx * f + ox / m * rr, a[1] + dy * f + oy / m * rr, a[2] + dz * f + oz / m * rr,
         c[0], c[1], c[2], rnd(.7, 1.2), 0, vMin, vMax,
         levA === undefined ? 0 : levA + (levB - levA) * f);
    }
  }
  function blob(cen, r, n, c, vMin, vMax, lev) {
    for (var k = 0; k < n; k++) {
      var ox = rnd(-1, 1), oy = rnd(-1, 1), oz = rnd(-1, 1);
      var m = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
      var rr = r * (0.7 + 0.3 * Math.random());
      pt(cen[0] + ox / m * rr, cen[1] + oy / m * rr, cen[2] + oz / m * rr,
         c[0], c[1], c[2], rnd(.75, 1.25), 0, vMin, vMax, lev || 0);
    }
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

  /* ---- the manipulator: one robot arm at a workbench, the room's actor ----
     Densest, brightest object in the scene so it reads first. The forearm
     assembly carries a lever weight (aArm) driving a ~20s breathing arc. */
  var STEEL = [190, 196, 208], JOINT = [228, 232, 242], BENCH = [152, 147, 138], TEAL = [62, 198, 198], WARM = [205, 122, 58];
  /* workbench: top slab + legs */
  for (i = 0; i < 620; i++) pt(rnd(240, 460), 100 + rnd(0, 12), rnd(220, 300), BENCH[0], BENCH[1], BENCH[2], rnd(.6, 1.0), 0, .6, .95);
  [[248, 228], [452, 228], [248, 292], [452, 292]].forEach(function (leg) {
    capsule([leg[0], 112, leg[1]], [leg[0], 178, leg[1]], 5, 60, BENCH, .55, .85);
  });
  /* base plate + shoulder */
  capsule([350, 100, 260], [350, 86, 260], 24, 150, STEEL, .7, 1.0);
  blob([350, 72, 260], 16, 160, JOINT, .85, 1.2);
  /* upper link → elbow: high apex */
  capsule([350, 72, 260], [287, -38, 240], 10, 420, STEEL, .75, 1.1);
  blob([287, -38, 240], 13, 150, JOINT, .85, 1.2);
  /* forearm → wrist (breathing assembly): wide reach left */
  capsule([287, -38, 240], [205, 42, 220], 8, 400, STEEL, .75, 1.1, 0, .6);
  blob([205, 42, 220], 10, 120, TEAL, .9, 1.15, .65);
  /* gripper prongs */
  capsule([205, 52, 220], [193, 88, 214], 4.5, 90, STEEL, .8, 1.15, .8, 1);
  capsule([205, 52, 220], [219, 88, 226], 4.5, 90, STEEL, .8, 1.15, .8, 1);
  /* the workpiece on the bench, under the gripper */
  for (i = 0; i < 80; i++) pt(rnd(187, 227), rnd(92, 104), rnd(212, 232), WARM[0], WARM[1], WARM[2], rnd(.6, 1.0), 0, .7, 1.0);
  /* drifting dust — atmosphere, must stay quieter than structure */
  for (i = 0; i < 950 * D; i++) pt(rnd(-900, 900), rnd(-320, 250), rnd(-500, 900), 200, 205, 215, rnd(.3, .7), rnd(2, 5), .3, .6);

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  geo.setAttribute('aAmp', new THREE.Float32BufferAttribute(amp, 1));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  geo.setAttribute('aArm', new THREE.Float32BufferAttribute(armLever, 1));

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
      'attribute float aArm;',
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
      /* the arm breathes: forearm assembly rises through a slow shallow arc */
      '  wp.y += sin(uTime * 0.25) * aArm * 6.0;',
      '  wp.x -= (1.0 - cos(uTime * 0.25)) * aArm * 1.5;',
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
  window.__hero = { renderer: renderer, scene: scene, camera: camera, uniforms: uniforms, group: group };

  function frame() {
    if (!running) return;
    t += 0.0022;
    uniforms.uTime.value = t * 10.0;
    group.rotation.y = Math.sin(t) * 0.06;

    strengthTarget = (performance.now() - lastMove < 120) ? 1 : 0;
    uniforms.uStrength.value += (strengthTarget - uniforms.uStrength.value) * 0.1;
    uniforms.uPointer.value.lerp(pointerTarget, 0.18);

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
