// Phone controls: floating joystick on the left thumb, FIRE button on the right thumb,
// and (via the HUD attack bar) a tap-to-select quick menu.
export function initTouch(g) {
  const hud = document.getElementById('hud');
  const wrap = document.createElement('div');
  wrap.id = 'touch';
  wrap.innerHTML = `
    <div id="stickhint" aria-hidden="true"><i>▲</i><i>▼</i><i>◀</i><i>▶</i><div class="pad"></div></div>
    <div id="stick" style="display:none"><div id="knob"></div></div>
    <button id="fire" type="button"><b>FIRE</b><span id="fire-name">Hard No</span></button>
    <div id="tbtns">
      <button id="b-pause" type="button" aria-label="Pause">II</button>
      <button id="b-skills" type="button" aria-label="Skills">★<i id="b-pts"></i></button>
    </div>`;
  hud.appendChild(wrap);

  const $ = (id) => document.getElementById(id);
  const stickEl = $('stick'), knob = $('knob'), fire = $('fire'), hint = $('stickhint');
  const canvas = g.renderer.domElement;
  const R = 58;
  let sid = null, ox = 0, oy = 0;

  const capture = (el, id) => {
    try {
      el.setPointerCapture(id);
    } catch {
      /* synthetic or already-released pointers cannot be captured; the listeners still work */
    }
  };
  const isTouchy = (e) => e.pointerType === 'touch' || g.forceTouch;

  function endStick() {
    sid = null;
    g.input.stick.x = g.input.stick.y = 0;
    stickEl.style.display = 'none';
    hint.classList.remove('active');
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!isTouchy(e) || g.state !== 'play' || sid !== null) return;
    if (e.clientX > innerWidth * 0.62) return; // the right side belongs to the right thumb
    sid = e.pointerId;
    ox = e.clientX;
    oy = e.clientY;
    // Touching the joystick icon anchors the stick on it; touching elsewhere on the left floats it under the thumb.
    const r = hint.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (Math.hypot(ox - cx, oy - cy) < r.width * 0.85) {
      ox = cx;
      oy = cy;
    }
    hint.classList.add('active');
    capture(canvas, sid);
    stickEl.style.display = 'block';
    stickEl.style.left = ox + 'px';
    stickEl.style.top = oy + 'px';
    knob.style.transform = 'translate(0,0)';
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sid) return;
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
    const m = Math.hypot(dx, dy) / R;
    if (m < 0.22) g.input.stick.x = g.input.stick.y = 0;
    else {
      g.input.stick.x = dx / R;
      g.input.stick.y = dy / R;
    }
  });
  for (const t of ['pointerup', 'pointercancel']) canvas.addEventListener(t, (e) => e.pointerId === sid && endStick());

  const fireOff = () => {
    g.input.fire = false;
    fire.classList.remove('down');
  };
  fire.addEventListener('pointerdown', (e) => {
    g.input.fire = true;
    fire.classList.add('down');
    capture(fire, e.pointerId);
    e.preventDefault();
  });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) fire.addEventListener(t, fireOff);

  $('b-pause').addEventListener('click', () => g.pause());
  $('b-skills').addEventListener('click', () => g.openTree());

  g.clearInput = () => {
    endStick();
    fireOff();
    g.input.keys.clear();
    g.input.mouse[0] = g.input.mouse[2] = false;
  };
}
