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

  /* ---------- pointer → world point on the cloud plane ---------- */
  var pointerTarget = new THREE.Vector3(1e5, 1e5, -700);
  var strengthTarget = 0;
  var lastMove = -1e4;
  var rayDir = new THREE.Vector3();

  /* parallax: the camera drifts through the room — gyro on phones,
     cursor position on desktop. Slow and small, per the motion rules. */
  var parTX = 0, parTY = 30;

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
      var asked = false;
      var askOnce = function () {
        if (asked) return;
        DeviceOrientationEvent.requestPermission()
          .then(function (state) {
            asked = true;
            ['pointerdown', 'touchend', 'click'].forEach(function (ev) {
              window.removeEventListener(ev, askOnce);
            });
            if (state === 'granted') bindTilt();
          })
          .catch(function () { /* not a user gesture yet: keep listening */ });
      };
      ['pointerdown', 'touchend', 'click'].forEach(function (ev) {
        window.addEventListener(ev, askOnce);
      });
    } else if ('DeviceOrientationEvent' in window) {
      bindTilt();
    }
  }

  /* ---------- loop ---------- */
  var t = 0;
  var running = true;
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
    camera.lookAt(0, -35, -700);

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
