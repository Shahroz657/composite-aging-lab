// Three.js stages for the Aging Lab: laminate stacks, aging rigs, and the bending / short-beam test rig. Units: mm.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const PLY = { C: { edge: 0x262a2e, tow: ['#2c3035', '#41474d'], name: 'carbon' }, B: { edge: 0x8a6a2a, tow: ['#8f6d2c', '#b9924a'], name: 'basalt' } };
const texCache = {};
/** Procedural woven-fabric texture: 2/2 twill for carbon, plain weave for basalt. */
export function weaveTexture(kind) {
  if (texCache[kind]) return texCache[kind];
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const tows = PLY[kind].tow; const n = 8, cell = 256 / n;
  g.fillStyle = tows[0]; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const warp = kind === 'C' ? ((i + j) % 4) < 2 : (i + j) % 2 === 0;
    const x = i * cell, y = j * cell;
    const grad = warp ? g.createLinearGradient(x, y, x + cell, y) : g.createLinearGradient(x, y, x, y + cell);
    grad.addColorStop(0, tows[0]); grad.addColorStop(0.5, tows[1]); grad.addColorStop(1, tows[0]);
    g.fillStyle = grad; g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache[kind] = t; return t;
}
export function plyMaterials(kind, repeat = [4, 3]) {
  const top = new THREE.MeshStandardMaterial({ map: weaveTexture(kind).clone(), roughness: 0.55, metalness: 0.05 });
  top.map.repeat.set(repeat[0], repeat[1]); top.map.needsUpdate = true;
  const edge = new THREE.MeshStandardMaterial({ color: PLY[kind].edge, roughness: 0.7, metalness: 0.05 });
  return [edge, edge, top, top, edge, edge];   // +x, -x, +y, -y, +z, -z
}
export function plyMesh(kind, L, t, W, segsX = 1) {
  const geo = new THREE.BoxGeometry(L, t, W, segsX, 1, 1);
  const mesh = new THREE.Mesh(geo, plyMaterials(kind, [Math.max(1, Math.round(L / 15)), Math.max(1, Math.round(W / 15))]));
  mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}

export class Stage {
  constructor(container, opts = {}) {
    this.container = container; this.opts = opts; this.picks = []; this.hoverCb = opts.onHover; this.animations = [];
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; container.appendChild(r.domElement);
    const lr = this.labels = new CSS2DRenderer(); lr.domElement.className = 'labels'; container.appendChild(lr.domElement);
    const s = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(opts.fov || 30, 1, 1, 20000);
    const pm = new THREE.PMREMGenerator(r); s.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); s.environmentIntensity = 0.7;
    s.add(new THREE.HemisphereLight(0xffffff, 0x8a9099, 0.5));
    const key = this.key = new THREE.DirectionalLight(0xffffff, 1.5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005; key.shadow.normalBias = 1; s.add(key); s.add(key.target);
    const c = this.controls = new OrbitControls(this.camera, r.domElement);
    c.enableDamping = true; c.dampingFactor = 0.08; c.enablePan = false; c.autoRotate = !!opts.autoRotate; c.autoRotateSpeed = opts.autoRotateSpeed ?? 0.6;
    c.addEventListener('start', () => { c.autoRotate = false; });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.14, transparent: true })); this.ground.rotation.x = -Math.PI / 2; this.ground.receiveShadow = true; s.add(this.ground);
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2(-9, -9); this.hovered = null;
    r.domElement.addEventListener('pointermove', e => { const b = r.domElement.getBoundingClientRect(); this.pointer.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); this.pointerXY = { x: e.clientX - b.left, y: e.clientY - b.top }; this.dirty = true; });
    r.domElement.addEventListener('pointerleave', () => { this.pointer.set(-9, -9); this.dirty = true; });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); this.resize();
    this.visible = true; this.io = new IntersectionObserver(en => { this.visible = en[0].isIntersecting; }, { threshold: 0.05 }); this.io.observe(container);
    this.last = performance.now(); r.setAnimationLoop(t => this.tick(t));
  }
  resize() { const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1; this.renderer.setSize(w, h); this.labels.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  /** Register an object for hover; meta: { name, desc } */
  pickable(obj, meta) { obj.traverse(o => { if (o.isMesh) { o.userData.meta = meta; this.picks.push(o); } }); return obj; }
  clearPicks() { this.picks = []; this.hovered = null; }
  label(text, pos, cls = 'lbl3d') { const d = document.createElement('div'); d.className = cls; d.textContent = text; const o = new CSS2DObject(d); o.position.copy(pos); return o; }
  fit(center, radius, dir = [1, 0.6, 1.2], groundY) {
    const d = new THREE.Vector3(...dir).normalize(); const dist = (radius * 1.15) / Math.sin((this.camera.fov / 2) * Math.PI / 180);
    this.camera.position.copy(center).addScaledVector(d, dist); this.controls.target.copy(center); this.controls.update();
    this.camera.near = Math.max(0.1, radius * 0.01); this.camera.far = radius * 60; this.camera.updateProjectionMatrix();
    this.controls.minDistance = radius * 0.4; this.controls.maxDistance = radius * 6;
    this.ground.position.set(center.x, groundY ?? center.y - radius * 0.55, center.z); this.ground.scale.set(radius * 10, radius * 10, 1);
    this.key.position.copy(center).add(new THREE.Vector3(0.6, 1.2, 0.5).multiplyScalar(radius * 3)); this.key.target.position.copy(center);
    const sc = this.key.shadow.camera; sc.left = sc.bottom = -radius * 1.6; sc.right = sc.top = radius * 1.6; sc.near = 1; sc.far = radius * 8; sc.updateProjectionMatrix();
  }
  onFrame(fn) { this.animations.push(fn); }
  tick(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (!this.visible) return;
    this.controls.update();
    for (const fn of this.animations) fn(dt, now / 1000);
    if (this.dirty) { this.dirty = false; this.raycaster.setFromCamera(this.pointer, this.camera); const hit = this.raycaster.intersectObjects(this.picks, false)[0]; const obj = hit ? hit.object : null; if (obj !== this.hovered) { this.hovered = obj; this.hoverCb?.(obj ? obj.userData.meta : null, this.pointerXY, obj); } }
    this.renderer.render(this.scene, this.camera); this.labels.render(this.scene, this.camera);
  }
  dispose() { this.renderer.setAnimationLoop(null); this.ro.disconnect(); this.io.disconnect(); this.renderer.dispose(); }
}

// ---------- laminate stacks ----------
export function buildStacks(stage, materials) {
  const group = new THREE.Group(); stage.scene.add(group);
  const L = 60, W = 42, t = 0.9, gap = 90; const stacks = [];
  materials.forEach((m, i) => {
    const g = new THREE.Group(); g.position.x = (i - (materials.length - 1) / 2) * gap; group.add(g);
    const plies = m.layup.map((k, j) => { const p = plyMesh(k, L, t, W); p.position.y = j * t; g.add(p); stage.pickable(p, { name: `Ply ${j + 1} of 8 · ${PLY[k].name}`, desc: `${m.name}. ${k === 'C' ? 'Woven carbon fabric, twill.' : 'Woven basalt fabric, plain weave.'}`, mat: m.id }); return p; });
    g.add(stage.label(m.name, new THREE.Vector3(0, -8, W / 2 + 6), 'lbl3d caption'));
    stacks.push({ g, plies, explode: 0.55, target: 0.55, mat: m });
  });
  stage.onFrame(dt => { for (const s of stacks) { s.explode += (s.target - s.explode) * Math.min(1, dt * 6); s.plies.forEach((p, j) => { p.position.y = j * t + j * 3.2 * s.explode; }); } });
  stage.fit(new THREE.Vector3(0, 14, 0), 118, [0.6, 0.42, 1], -1);
  return { group, stacks, setExplode(id, v) { for (const s of stacks) s.target = (id === 'all' || s.mat.id === id) ? v : (id === 'all' ? v : 0); } };
}

// ---------- aging rigs ----------
function glass(color = 0xcfe3ee, opacity = 0.22) { return new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity, roughness: 0.1, metalness: 0, transmission: 0, side: THREE.DoubleSide, depthWrite: false }); }
function metal(color = 0x9aa3ad, rough = 0.4) { return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.85 }); }
function plastic(color, rough = 0.6) { return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 }); }
function coupon(kind, x, y, z, ry = 0) { const c = plyMesh(kind, 24, 3.6, 18); c.position.set(x, y, z); c.rotation.y = ry; return c; }
export function buildHygroChamber(stage) {
  const g = new THREE.Group(); const S = 400, H = 400;
  const box = new THREE.Mesh(new THREE.BoxGeometry(S, H, S), glass()); box.position.y = H / 2; g.add(stage.pickable(box, { name: 'Acrylic chamber', desc: 'Transparent acrylic box, so the specimens can be watched without opening the door and disturbing the climate.' }));
  const frame = new THREE.Mesh(new THREE.BoxGeometry(S + 6, 6, S + 6), plastic(0x2a2e33)); frame.position.y = 0; g.add(frame);
  const top = frame.clone(); top.position.y = H; g.add(top);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(S - 20, 5, S - 20), plastic(0xd8dde2, 0.5)); shelf.position.y = H * 0.5; g.add(stage.pickable(shelf, { name: 'Perforated shelf', desc: 'Specimens sit on a perforated acrylic shelf so the circulated air reaches both faces.' }));
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { const hole = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 6, 20), plastic(0x6f7780)); hole.position.set(i * 48, H * 0.5, j * 48); g.add(hole); }
  const sensor = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 26), plastic(0xd03b3b)); sensor.position.set(0, H - 30, -120); g.add(stage.pickable(sensor, { name: 'DHT11 temperature & humidity sensor', desc: 'Reads air temperature and relative humidity for the controller. Its ±2 °C / ±5% RH accuracy is the setup’s stated limitation.' }));
  const fans = [];
  [[-S / 2 + 20, H * 0.78, 0, 0], [S / 2 - 20, H * 0.25, 0, Math.PI]].forEach(([x, y, z, ry], i) => {
    const fan = new THREE.Group(); fan.position.set(x, y, z); fan.rotation.y = ry;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(40, 5, 10, 40), plastic(0x2a2e33)); ring.rotation.y = Math.PI / 2; fan.add(ring);
    const hub = new THREE.Group(); for (let b = 0; b < 5; b++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(2, 34, 14), plastic(0x3a4047)); bl.position.y = 20; bl.rotation.z = 0.5; const piv = new THREE.Group(); piv.rotation.x = (b / 5) * Math.PI * 2; piv.add(bl); hub.add(piv); }
    hub.add(new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 10, 20).rotateZ(Math.PI / 2), plastic(0x2a2e33))); fan.add(hub); fans.push(hub);
    g.add(stage.pickable(fan, { name: `Ventilation fan ${i + 1}`, desc: 'Two fans keep the air moving so there are no hot or cold corners: every specimen sees the same temperature and humidity.' }));
  });
  const heater = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 90, 24).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffb070, emissive: 0xff5a10, emissiveIntensity: 1.2, roughness: 0.4 })); heater.position.set(60, H * 0.62, 90); g.add(stage.pickable(heater, { name: 'Heating element', desc: 'A heating bulb switched by a relay: on below the setpoint, off above it. Bang-bang control with a small hysteresis band.' }));
  const hum = new THREE.Group(); hum.position.set(-110, 40, 110);
  hum.add(new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 60, 24), plastic(0x6f7780)));
  const mist = new THREE.Mesh(new THREE.ConeGeometry(34, 120, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xeaf4ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); mist.position.y = 90; mist.rotation.x = Math.PI; hum.add(mist);
  g.add(stage.pickable(hum, { name: 'Ultrasonic mist maker', desc: 'The humidifying element. Switched by the relay when humidity falls below the target.' }));
  const cups = []; ['C', 'B', 'C', 'B', 'C', 'B'].forEach((k, i) => { const c = coupon(k, -90 + i * 36, H * 0.5 + 4.5, -40 + (i % 2) * 40, 0.2); g.add(stage.pickable(c, { name: 'Specimen', desc: 'Flexure and short-beam coupons, cut to ASTM size before aging so the whole cut surface is exposed.' })); cups.push(c); });
  const door = new THREE.Mesh(new THREE.BoxGeometry(S - 40, H - 40, 3), glass(0xcfe3ee, 0.12)); door.position.set(0, H / 2, S / 2 + 2); g.add(stage.pickable(door, { name: 'Door', desc: 'Hinged acrylic door with a rubber seal.' }));
  const lcd = new THREE.Mesh(new THREE.BoxGeometry(80, 36, 8), plastic(0x1d5a8f)); lcd.position.set(120, H + 28, S / 2 - 30); g.add(stage.pickable(lcd, { name: 'Controller: Arduino + ESP8266, LCD, keypad', desc: 'Setpoints are typed on a keypad, shown on the LCD, and the ESP module posts readings to the cloud for remote monitoring.' }));
  const led = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 12), new THREE.MeshStandardMaterial({ color: 0x40ff60, emissive: 0x20c040, emissiveIntensity: 1 })); led.position.set(170, H + 28, S / 2 - 26); g.add(led);
  stage.onFrame(dt => { for (const f of fans) f.rotation.x += dt * 12; mist.material.opacity = 0.25 + 0.12 * Math.sin(performance.now() / 400); });
  g.add(stage.label('Hygro-thermal chamber', new THREE.Vector3(0, H + 70, 0), 'lbl3d caption'));
  stage.scene.add(g); stage.fit(new THREE.Vector3(0, H / 2 + 10, 0), 330, [1, 0.55, 1.1]);
  return { g, heater, led };
}
export function buildHydroTub(stage) {
  const g = new THREE.Group(); const R = 230, H = 210;
  const tub = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.86, H, 48, 1, true), glass(0xd6e8f0, 0.28)); tub.position.y = H / 2; g.add(stage.pickable(tub, { name: 'Plastic tub', desc: 'A polypropylene tub holding the saline bath: corrosion-proof, cheap, and large enough for all the coupons on racks.' }));
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(R * 0.86, 48).rotateX(-Math.PI / 2), plastic(0xbfd0d8)); g.add(bottom);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(R - 3, R * 0.87, H * 0.78, 48), new THREE.MeshPhysicalMaterial({ color: 0x3aa0c8, transparent: true, opacity: 0.4, roughness: 0.05, metalness: 0, depthWrite: false })); water.position.y = H * 0.39; g.add(stage.pickable(water, { name: 'Heated saline water', desc: 'Salt water at a controlled temperature, standing in for seawater exposure. Heat speeds up moisture diffusion into the epoxy.' }));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(R + 8, R + 8, 6, 48), plastic(0xe6ebef, 0.5)); lid.position.y = H + 3; g.add(stage.pickable(lid, { name: 'Lid with ventilation holes', desc: 'Keeps the heat and vapour in; small vents stop pressure building up.' }));
  [[-70, -60], [50, -70], [0, 0], [-60, 60], [60, 55]].forEach(([x, z]) => { const v = new THREE.Mesh(new THREE.BoxGeometry(40, 8, 40), plastic(0x2a2e33)); v.position.set(x, H + 3, z); g.add(v); });
  const rod = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.TorusGeometry(60, 6, 12, 40, Math.PI), new THREE.MeshStandardMaterial({ color: 0xffb070, emissive: 0xff6a20, emissiveIntensity: 1.1, roughness: 0.4 })); tube.rotation.z = Math.PI; tube.position.y = 60; rod.add(tube);
  [-60, 60].forEach(x => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, H + 10, 16), metal(0xd5d9dd, 0.3)); leg.position.set(x, 60 + (H + 10) / 2, 0); rod.add(leg); });
  rod.position.set(90, 0, 0); g.add(stage.pickable(rod, { name: '1 kW resistance heater', desc: 'An immersion heater switched by a relay from the temperature reading, so the bath cycles a degree or so around the setpoint.' }));
  const probe = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 140, 16), metal(0xc9ced4, 0.25)); probe.position.set(-120, H - 40, -40); g.add(stage.pickable(probe, { name: 'DS18B20 temperature probe', desc: 'A sealed digital probe in the water, read by the Arduino every few seconds. Readings are logged to an SD card with a real-time clock.' }));
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 120, 8), plastic(0x2a2e33)); cable.position.set(-120, H + 60, -40); g.add(cable);
  const rack = new THREE.Group(); ['C', 'B', 'C', 'B', 'C', 'B', 'C'].forEach((k, i) => { const c = coupon(k, -105 + i * 32, 60 + (i % 2) * 20, 70, Math.PI / 2 + 0.15 * (i % 3)); c.rotation.z = Math.PI / 2; rack.add(c); });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 240, 12).rotateZ(Math.PI / 2), metal()); bar.position.set(0, 120, 70); rack.add(bar);
  g.add(stage.pickable(rack, { name: 'Specimen rack', desc: 'Coupons hang edge-on from a rod so water reaches every face and they never touch the heater.' }));
  const ctl = new THREE.Mesh(new THREE.BoxGeometry(90, 40, 60), plastic(0x1d5a8f)); ctl.position.set(R + 80, 20, 0); g.add(stage.pickable(ctl, { name: 'Controller: Arduino, relay, LCD, SD logger', desc: 'Reads the probe, switches the heater, shows the temperature on an LCD and writes a time-stamped log to the SD card.' }));
  stage.onFrame((dt, t) => { water.position.y = H * 0.39 + Math.sin(t * 1.3) * 0.6; });
  g.add(stage.label('Hydro-thermal bath', new THREE.Vector3(0, H + 60, 0), 'lbl3d caption'));
  stage.scene.add(g); stage.fit(new THREE.Vector3(30, H / 2, 0), 330, [1, 0.6, 1.1]);
  return { g, heater: rod };
}

// ---------- test rig ----------
/** spec: { test: 'flex'|'ilss', L, b, h, span, layup, E (MPa), P (N) }; returns handle with setLoad(fraction) */
export function buildTestRig(stage, spec) {
  const g = new THREE.Group(); stage.scene.add(g);
  const { L, b, h, span, layup } = spec; const flex = spec.test === 'flex';
  const rSup = flex ? 5 : 1.5, rNose = flex ? 5 : 3; const segs = 64;
  const plies = layup.map((k, j) => { const p = plyMesh(k, L, h / 8, b, segs); p.position.y = rSup * 2 + h / 8 * (j + 0.5); p.userData.base = p.geometry.attributes.position.array.slice(); g.add(p); return p; });
  plies.forEach((p, j) => stage.pickable(p, { name: `Ply ${j + 1} · ${PLY[layup[j]].name}`, desc: j === 0 ? 'Bottom face: in three-point bending this ply is in tension and fails first.' : j === 7 ? 'Top face: under the loading nose, in compression.' : 'Interior ply. Interlaminar shear peaks at the mid-plane, between plies 4 and 5.' }));
  const supMat = metal(0xb8bec4, 0.3);
  [-span / 2, span / 2].forEach(x => { const s = new THREE.Mesh(new THREE.CylinderGeometry(rSup, rSup, b + 16, 32).rotateX(Math.PI / 2), supMat); s.position.set(x, rSup, 0); g.add(stage.pickable(s, { name: `Support roller, r = ${rSup} mm`, desc: flex ? 'ASTM D7264 supports: the specimen rests on two rollers 88 mm apart.' : 'ASTM D2344 supports: span is only four times the thickness, so shear, not bending, breaks the beam.' })); const post = new THREE.Mesh(new THREE.BoxGeometry(rSup * 2 + 4, 14, b + 16), metal(0x6f7780, 0.5)); post.position.set(x, -7, 0); g.add(post); });
  const base = new THREE.Mesh(new THREE.BoxGeometry(L + 60, 10, b + 60), metal(0x6f7780, 0.5)); base.position.y = -19; g.add(base);
  const noseY0 = rSup * 2 + h + rNose;
  const nose = new THREE.Group(); nose.add(new THREE.Mesh(new THREE.CylinderGeometry(rNose, rNose, b + 16, 32).rotateX(Math.PI / 2), supMat)); const ram = new THREE.Mesh(new THREE.BoxGeometry(rNose * 2 + 4, 60, b + 16), metal(0x9aa3ad, 0.4)); ram.position.y = 30 + rNose; nose.add(ram); nose.position.y = noseY0; g.add(stage.pickable(nose, { name: `Loading nose, r = ${rNose} mm`, desc: 'Driven down at 5 mm/min by the universal testing machine; the load cell above it records the force.' }));
  const crack = new THREE.Mesh(new THREE.BoxGeometry(flex ? 1.2 : span * 0.9, flex ? h * 0.55 : 0.8, b + 0.4), new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 1 })); crack.visible = false; crack.position.set(flex ? 0 : 0, flex ? rSup * 2 + h * 0.28 : rSup * 2 + h / 2, 0); g.add(crack);
  const I = b * h * h * h / 12; const deltaMax = (spec.P * span ** 3) / (48 * spec.E * I);
  const scale = flex ? 3 : 4;                        // deflection exaggeration for visibility
  // simply supported beam, centre load: normalised deflection a(3L²−4a²)/L³ inside the span; the overhang lifts with the end slope 3/L
  const f = x => { const a = span / 2 - Math.abs(x); return a >= 0 ? a * (3 * span * span - 4 * a * a) / (span ** 3) : -3 * Math.abs(a) / span; };
  let load = 0;
  function apply() {
    const d = deltaMax * scale * load;
    for (const p of plies) { const pos = p.geometry.attributes.position; const base = p.userData.base; for (let i = 0; i < pos.count; i++) { const x = base[i * 3]; pos.array[i * 3 + 1] = base[i * 3 + 1] - d * f(x); } pos.needsUpdate = true; p.geometry.computeVertexNormals(); }
    nose.position.y = noseY0 - d * f(0);
    crack.visible = load >= 0.999; if (crack.visible) crack.position.y = (flex ? rSup * 2 + h * 0.28 : rSup * 2 + h / 2) - d;
  }
  apply();
  stage.fit(new THREE.Vector3(0, rSup + h / 2, 0), flex ? span * 0.62 : span * 1.9, [0.9, 0.45, 1.2]);
  return { g, plies, setLoad(v) { load = Math.max(0, Math.min(1.02, v)); apply(); }, deltaMax, I, dispose() { stage.scene.remove(g); stage.clearPicks(); g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } }); } };
}
