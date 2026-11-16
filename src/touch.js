// Phone controls: a joystick on the left thumb, a FIRE button on the right thumb, and an attack
// selector (a button that opens a small menu) so nothing tappable sits near the joystick.
export function initTouch(g) {
  const hud = document.getElementById('hud');
  const wrap = document.createElement('div');
  wrap.id = 'touch';
  wrap.innerHTML = `
    <div id="stickhint" aria-hidden="true"><i>▲</i><i>▼</i><i>◀</i><i>▶</i><div class="pad"></div></div>
    <div id="stick" style="display:none"><div id="knob"></div></div>
    <button id="selbtn" type="button" aria-label="Choose attack"><i id="sel-icon">👊</i><span>▲</span></button>
    <button id="fire" type="button"><b>FIRE</b><span id="fire-name">Hard No</span></button>
    <button id="b-skills" type="button" aria-label="Skills">★<i id="b-pts"></i></button>
    <div id="tbtns">
      <button id="b-pause" type="button" aria-label="Pause">II</button>
    </div>`;
  hud.appendChild(wrap);

  const $ = (id) => document.getElementById(id);
  const stickEl = $('stick'), knob = $('knob'), fire = $('fire'), hint = $('stickhint'), slots = $('h-slots');
  const canvas = g.renderer.domElement;
  const R = 58;
  let sid = null, ox = 0, oy = 0;

  const isTouchy = (e) => e.pointerType === 'touch' || g.forceTouch;
  const closeMenu = () => slots.classList.remove('open');

  function endStick() {
    sid = null;
    g.input.stick.x = g.input.stick.y = 0;
    stickEl.style.display = 'none';
    hint.classList.remove('active');
  }

  function startStick(e) {
    sid = e.pointerId;
    ox = e.clientX;
    oy = e.clientY;
    // Touching the joystick icon anchors the stick on it; touching elsewhere on the left floats it under the thumb.
    const r = hint.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (Math.hypot(ox - cx, oy - cy) < r.width * 0.6) {
      ox = cx;
      oy = cy;
    }
    hint.classList.add('active');
    stickEl.style.display = 'block';
    stickEl.style.left = ox + 'px';
    stickEl.style.top = oy + 'px';
    knob.style.transform = 'translate(0,0)';
    moveStick(e);
  }

  function moveStick(e) {
    let dx = e.clientX - ox, dy = e.clientY - oy;
    const len = Math.hypot(dx, dy);
    if (len > R) {
      // Drag the stick's anchor along so the thumb never runs out of room.
      ox = e.clientX - (dx / len) * R;
      oy = e.clientY - (dy / len) * R;
      dx = e.clientX - ox;
      dy = e.clientY - oy;
      stickEl.style.left = ox + 'px';
      stickEl.style.top = oy + 'px';
    }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    if (Math.hypot(dx, dy) / R < 0.22) g.input.stick.x = g.input.stick.y = 0;
    else {
      g.input.stick.x = dx / R;
      g.input.stick.y = dy / R;
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    closeMenu();
    if (!isTouchy(e) || g.state !== 'play') return;
    if (e.clientX > innerWidth * 0.62) return; // the right side belongs to the right thumb
    // A new touch on the left always takes over, so a stick that missed its lift-off can never stay stuck.
    if (sid !== null) endStick();
    startStick(e);
    e.preventDefault();
  });
  // Listen on the window, not just the canvas, so moving or lifting over any other element still counts.
  addEventListener('pointermove', (e) => e.pointerId === sid && moveStick(e));
  for (const t of ['pointerup', 'pointercancel']) addEventListener(t, (e) => e.pointerId === sid && endStick());
  canvas.addEventListener('lostpointercapture', (e) => e.pointerId === sid && endStick());

  const fireOff = () => {
    g.input.fire = false;
    fire.classList.remove('down');
  };
  fire.addEventListener('pointerdown', (e) => {
    closeMenu();
    g.input.fire = true;
    fire.classList.add('down');
    try {
      fire.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointers cannot be captured; the window listener below still releases FIRE */
    }
    e.preventDefault();
  });
  for (const t of ['pointerup', 'pointercancel']) addEventListener(t, (e) => e.target === fire && fireOff());
  fire.addEventListener('lostpointercapture', fireOff);

  // Backstop: when every finger is off the screen, nothing can be held.
  for (const t of ['touchend', 'touchcancel']) {
    addEventListener(t, (e) => {
      if (!e.touches || e.touches.length === 0) {
        endStick();
        fireOff();
      }
    }, { passive: true });
  }
  document.addEventListener('visibilitychange', () => document.hidden && g.clearInput());

  $('selbtn').addEventListener('click', () => slots.classList.toggle('open'));
  $('b-pause').addEventListener('click', () => g.pause());
  $('b-skills').addEventListener('click', () => g.openTree());

  g.clearInput = () => {
    endStick();
    fireOff();
    closeMenu();
    g.input.keys.clear();
    g.input.mouse[0] = g.input.mouse[2] = false;
  };
}
