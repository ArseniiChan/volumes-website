/* Volumes contact flow — vanilla JS, no dependencies. */
(function () {
  'use strict';

  /* The 55-modality taxonomy from the founders' brief.
     "Not sure yet" (#55) is rendered as a pinned chip, not a category. */
  var DATA = {
    'Vision / Optical': ['RGB', 'RGB-D', 'Thermal', 'Telescopic data', 'Photon reader', 'Visual', 'Event camera', 'Hyperspectral'],
    'Depth / Ranging': ['LiDAR', 'Sonar', 'Ultra-wideband (UWB)', 'Radar', 'Structured light'],
    'RF / Wireless': ['RF', 'mmWave', 'WiFi-CSI'],
    'Motion / Inertial': ['IMU', 'Joint position', 'GPS / GNSS', 'Wheel odometry'],
    'Contact / Force': ['Tactile', 'Force tile data', 'Friction data', 'Force / torque'],
    'Geometry / 3D': ['CAD / .obj', '3D', '4D', 'Point cloud'],
    'Capture method': ['Tele-op', 'Dash cam', 'Satellite data', 'CNC data', '360° panorama', 'Egocentric video', 'Multi-view rig', 'Photogrammetry', 'Motion capture', 'Aerial / Drone'],
    'Medical / Bio': ['Molecular', 'MRI', 'CT', 'Orthopedic data', 'Medical imaging'],
    'Synthetic / Derived': ['Pop sim', 'Multi-modal', 'Physics data', 'Simulation / Synthetic'],
    'Environmental': ['Olfactory data', 'Weather', 'Temperature'],
    'Acoustic': ['Sound / audio'],
    'Material': ['Texture / cloth data'],
    'Source / Content': ['UGC'],
    'Other': ['Vertical']
  };

  var dialog = document.getElementById('contactDialog');
  var contactBtn = document.getElementById('contactBtn');
  var steps = {
    role: document.getElementById('stepRole'),
    data: document.getElementById('stepData'),
    investor: document.getElementById('stepInvestor')
  };

  var role = null;
  var selected = new Set();
  var catListBuilt = false;

  /* ---------- dialog open / close ---------- */
  contactBtn.addEventListener('click', function (e) {
    e.preventDefault(); /* href stays as no-JS mailto fallback */
    resetFlow();
    showStep('role');
    dialog.showModal();
  });

  /* Explicit close path: some engines never fire the dialog 'close' event,
     so the cleanup runs here AND in the 'close' listener (it is idempotent). */
  function closeDialog() {
    if (dialog.open) dialog.close();
    resetFlow();
    contactBtn.focus();
  }

  document.getElementById('closeBtn').addEventListener('click', closeDialog);

  /* click on the backdrop closes */
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) closeDialog();
  });

  /* native Esc / cancel path */
  dialog.addEventListener('close', function () {
    resetFlow();
    contactBtn.focus();
  });

  function resetFlow() {
    role = null;
    selected.clear();
    document.querySelectorAll('.chip[aria-pressed="true"]').forEach(function (c) {
      c.setAttribute('aria-pressed', 'false');
    });
    document.querySelectorAll('.cat-toggle[aria-expanded="true"]').forEach(function (t) {
      collapseCat(t);
    });
    document.getElementById('mailGuard').hidden = true;
    document.getElementById('invMailGuard').hidden = true;
    document.getElementById('loginNote').textContent = '';
    syncCount();
    syncCatBadges();
  }

  function showStep(name) {
    Object.keys(steps).forEach(function (k) { steps[k].hidden = (k !== name); });
    var heading = { role: 'roleHeading', data: 'dataHeading', investor: 'investorHeading' }[name];
    var h = document.getElementById(heading);
    if (h && dialog.open) h.focus();
  }

  /* ---------- step 1: role ---------- */
  document.querySelectorAll('.role[data-role]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      role = btn.getAttribute('data-role');
      document.getElementById('dataEyebrow').textContent = role.toUpperCase();
      document.getElementById('dataHeading').textContent =
        'What data are you interested in ' + (role === 'Buyer' ? 'buying' : 'selling') + '?';
      if (!catListBuilt) { buildCats(); catListBuilt = true; }
      document.getElementById('mailGuard').hidden = true;
      showStep('data');
    });
  });

  document.getElementById('investorBtn').addEventListener('click', function () {
    showStep('investor');
  });

  document.querySelectorAll('[data-back]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      selected.clear();
      document.querySelectorAll('.chip[aria-pressed="true"]').forEach(function (c) {
        c.setAttribute('aria-pressed', 'false');
      });
      syncCount();
      syncCatBadges();
      showStep('role');
    });
  });

  /* ---------- step 2a: collapsed categories + chips ---------- */
  function buildCats() {
    var host = document.getElementById('catList');
    Object.keys(DATA).forEach(function (cat, i) {
      var items = DATA[cat];
      var section = document.createElement('div');
      section.className = 'cat';

      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'cat-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', 'chips-' + i);
      toggle.innerHTML =
        '<span>' + cat + '</span>' +
        '<span class="cat-meta">' +
          '<span class="cat-picked" data-picked hidden></span>' +
          '<span class="cat-count">' + items.length + '</span>' +
          '<svg class="cat-caret" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true" fill="none">' +
            '<path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.2"/></svg>' +
        '</span>';

      var chips = document.createElement('div');
      chips.className = 'chips';
      chips.id = 'chips-' + i;
      chips.hidden = true;

      items.forEach(function (item) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = item;
        b.setAttribute('aria-pressed', 'false');
        b.setAttribute('data-item', item);
        chips.appendChild(b);
      });

      toggle.addEventListener('click', function () {
        var open = toggle.getAttribute('aria-expanded') === 'true';
        if (open) { collapseCat(toggle); } else {
          toggle.setAttribute('aria-expanded', 'true');
          chips.hidden = false;
        }
      });

      section.appendChild(toggle);
      section.appendChild(chips);
      host.appendChild(section);
    });
  }

  function collapseCat(toggle) {
    toggle.setAttribute('aria-expanded', 'false');
    var chips = document.getElementById(toggle.getAttribute('aria-controls'));
    if (chips) chips.hidden = true;
  }

  /* one delegated handler covers every chip, incl. "Not sure yet" */
  document.getElementById('stepData').addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    var item = chip.getAttribute('data-item');
    var on = chip.getAttribute('aria-pressed') === 'true';
    chip.setAttribute('aria-pressed', on ? 'false' : 'true');
    if (on) selected.delete(item); else selected.add(item);
    syncCount();
    syncCatBadges();
  });

  function syncCount() {
    var n = selected.size;
    document.getElementById('composeBtn').disabled = (n === 0);
    document.getElementById('count').textContent =
      n === 0 ? 'Select one or more' : n + ' selected';
  }

  function syncCatBadges() {
    document.querySelectorAll('.cat').forEach(function (section) {
      var picked = 0;
      section.querySelectorAll('.chip[aria-pressed="true"]').forEach(function () { picked++; });
      var badge = section.querySelector('[data-picked]');
      if (badge) {
        badge.hidden = (picked === 0);
        badge.textContent = picked === 0 ? '' : picked + ' selected';
      }
    });
  }

  /* ---------- compose (mailto + copy fallback) ---------- */
  function buildEmail(subject, bodyLines) {
    var body = bodyLines.join('\r\n');
    return {
      href: 'mailto:hello@volumes.cloud?subject=' + encodeURIComponent(subject) +
            '&body=' + encodeURIComponent(body),
      text: 'To: hello@volumes.cloud\r\nSubject: ' + subject + '\r\n\r\n' + body
    };
  }

  document.getElementById('composeBtn').addEventListener('click', function () {
    var list = Array.from(selected);
    var subject = role + ' inquiry — ' + list.slice(0, 3).join(', ') +
      (list.length > 3 ? ' +' + (list.length - 3) + ' more' : '');
    var mail = buildEmail(subject, [
      'Hello Volumes,',
      '',
      'I am a ' + role.toLowerCase() + ' interested in the following data:',
      ''
    ].concat(list.map(function (x) { return '• ' + x; }), ['', '']));

    document.getElementById('mailText').value = mail.text;
    document.getElementById('mailGuard').hidden = false;
    window.location.href = mail.href;
  });

  /* ---------- investor ---------- */
  document.getElementById('loginBtn').addEventListener('click', function () {
    document.getElementById('loginNote').textContent =
      'Access is provisioned directly by Volumes.';
  });

  document.getElementById('notifyBtn').addEventListener('click', function () {
    var email = document.getElementById('invEmail').value.trim();
    var mail = buildEmail('Investor notification request', [
      'Please notify me when Volumes accepts new investors.',
      '',
      email
    ]);
    document.getElementById('invMailText').value = mail.text;
    document.getElementById('invMailGuard').hidden = false;
    window.location.href = mail.href;
  });

  /* ---------- copy buttons ---------- */
  function wireCopy(btnId, srcId) {
    var btn = document.getElementById(btnId);
    btn.addEventListener('click', function () {
      var text = document.getElementById(srcId).value;
      function done() {
        var prev = btn.textContent;
        btn.textContent = 'COPIED';
        setTimeout(function () { btn.textContent = prev; }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallback(); });
      } else { fallback(); }
      function fallback() {
        var src = document.getElementById(srcId);
        src.select();
        try { document.execCommand('copy'); done(); } catch (err) { /* text stays selectable */ }
      }
    });
  }
  wireCopy('copyBtn', 'mailText');
  wireCopy('invCopyBtn', 'invMailText');
})();
