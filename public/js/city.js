// The hero scene: a city block at night with the Nightshift studio lit up in the middle.
// Uses the global THREE (three.js r128 from cdnjs). Falls back to the CSS backdrop if WebGL is unavailable.

export function initCity(canvas) {
  const THREE = window.THREE;
  if (!THREE || !canvas) return () => {};
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" }); }
  catch { return () => {}; }

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NIGHT = 0x0f121a;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NIGHT);
  scene.fog = new THREE.FogExp2(NIGHT, 0.028);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
  const camBase = new THREE.Vector3(0, 3.2, 26);
  const look = new THREE.Vector3(3, 6.2, -6);

  // Seeded random so the skyline is the same on every visit.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  scene.add(new THREE.HemisphereLight(0x3a4a7a, 0x0b0d12, 0.55));
  const moonLight = new THREE.DirectionalLight(0x9fb2d9, 0.35);
  moonLight.position.set(-20, 30, 10);
  scene.add(moonLight);

  // Wet street that catches the lamp light.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x0c0e14, roughness: 0.35, metalness: 0.6 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Buildings + one instanced mesh for every window in the city.
  const buildingMat = new THREE.MeshStandardMaterial({ color: 0x161a25, roughness: 0.9 });
  const windows = []; // {x,y,z,ry}
  function building(x, z, w, h, d, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opts.mat || buildingMat);
    m.position.set(x, h / 2, z);
    scene.add(m);
    const cols = Math.floor((w - 0.4) / 0.62), rows = Math.floor((h - 1) / 0.85);
    const x0 = x - ((cols - 1) * 0.62) / 2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      windows.push({ x: x0 + c * 0.62, y: 0.9 + r * 0.85, z: z + d / 2 + 0.01, studio: !!opts.studio });
    }
    return m;
  }
  // Back rows: the skyline in the fog.
  for (let row = 0; row < 3; row++) {
    for (let x = -46; x < 46; ) {
      const w = 2.4 + rand() * 4, h = 4 + rand() * (10 + row * 7), d = 3 + rand() * 3;
      const z = -6 - row * 9 - rand() * 3;
      if (!(row === 0 && Math.abs(x + w / 2 - 5.5) < 4.5)) building(x + w / 2, z, w, h, d);
      x += w + 0.6 + rand() * 1.6;
    }
  }
  // The studio: front and center-right, a little warmer than its neighbours.
  const studioMat = new THREE.MeshStandardMaterial({ color: 0x1c2130, roughness: 0.8 });
  building(5.5, -3, 5.2, 13.5, 4, { studio: true, mat: studioMat });

  const winGeo = new THREE.PlaneGeometry(0.34, 0.5);
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
  const winMesh = new THREE.InstancedMesh(winGeo, winMat, windows.length);
  const dummy = new THREE.Object3D();
  const OFF = new THREE.Color(0x1a1f2b);
  const WARM = [new THREE.Color(0xffb03b), new THREE.Color(0xffc978), new THREE.Color(0xff9a3c)];
  const TV = new THREE.Color(0x8fb4ff);
  const state = windows.map((wd, i) => {
    dummy.position.set(wd.x, wd.y, wd.z);
    dummy.updateMatrix();
    winMesh.setMatrixAt(i, dummy.matrix);
    return rand() < (wd.studio ? 0.75 : 0.22);
  });
  const colorFor = (i) => {
    if (!state[i]) return OFF;
    if (windows[i].studio) return WARM[i % 2];
    return i % 9 === 0 ? TV : WARM[i % 3];
  };
  windows.forEach((_, i) => winMesh.setColorAt(i, colorFor(i)));
  scene.add(winMesh);

  // Neon sign on the studio roof, drawn onto a canvas texture.
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 1024; signCanvas.height = 256;
  const g = signCanvas.getContext("2d");
  function drawSign(on) {
    g.clearRect(0, 0, 1024, 256);
    g.font = "900 150px 'Big Shoulders Display', 'Arial Narrow', sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.shadowColor = "#ff8a2a"; g.shadowBlur = on ? 40 : 0;
    g.fillStyle = on ? "#ffd29a" : "#5a4630";
    g.fillText("NIGHTSHIFT", 512, 132);
    signTex.needsUpdate = true;
  }
  const signTex = new THREE.CanvasTexture(signCanvas);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, fog: false }));
  sign.position.set(5.5, 14.4, -1);
  scene.add(sign);
  drawSign(true);
  document.fonts?.ready.then(() => drawSign(true));
  const signGlow = new THREE.PointLight(0xff9a3c, 2.2, 14, 2);
  signGlow.position.set(5.5, 14, 1);
  scene.add(signGlow);

  // Street lamps casting warm pools on the wet road.
  for (const x of [-9, 1, 11]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6), new THREE.MeshStandardMaterial({ color: 0x0a0b10 }));
    pole.position.set(x, 2.1, 3);
    scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd08a }));
    bulb.position.set(x, 4.2, 3);
    scene.add(bulb);
    const l = new THREE.PointLight(0xffa64a, 1.6, 12, 2);
    l.position.set(x, 4, 3);
    scene.add(l);
  }

  // Moon with a soft halo sprite.
  const halo = document.createElement("canvas");
  halo.width = halo.height = 128;
  const hg = halo.getContext("2d");
  const grad = hg.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, "rgba(220,230,255,0.9)"); grad.addColorStop(0.25, "rgba(200,215,255,0.25)"); grad.addColorStop(1, "rgba(200,215,255,0)");
  hg.fillStyle = grad; hg.fillRect(0, 0, 128, 128);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(halo), fog: false, depthWrite: false }));
  moon.scale.set(16, 16, 1);
  moon.position.set(-22, 26, -60);
  scene.add(moon);
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40), new THREE.MeshBasicMaterial({ color: 0xe6ecf7, fog: false }));
  moonDisc.position.copy(moon.position);
  scene.add(moonDisc);

  // Stars.
  const starPos = [];
  for (let i = 0; i < 700; i++) starPos.push((rand() - 0.5) * 260, 18 + rand() * 70, -80 - rand() * 40);
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfd8ee, size: 0.35, fog: false, transparent: true, opacity: 0.8 })));

  // Interaction: camera follows the pointer a little; windows switch on and off like a real block at night.
  const target = { x: 0, y: 0 };
  const onMove = (e) => {
    const p = e.touches ? e.touches[0] : e;
    target.x = (p.clientX / innerWidth - 0.5) * 2;
    target.y = (p.clientY / innerHeight - 0.5) * 2;
  };
  addEventListener("pointermove", onMove, { passive: true });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // On narrow screens pull back and centre the studio so it isn't cropped.
    const narrow = w < 700;
    camBase.set(narrow ? 5.5 : 0, narrow ? 5 : 3.2, narrow ? 36 : 26);
    look.set(narrow ? 5.5 : 3, narrow ? 9 : 6.2, -6);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(canvas);

  let raf, last = 0, flickerAt = 0, signOffUntil = 0;
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (!visible || t - last < 16) return;
    last = t;
    const cx = camBase.x + target.x * (camera.aspect < 1 ? 0.8 : 2.2) + Math.sin(t / 9000) * 0.6;
    const cy = camBase.y - target.y * 0.9;
    camera.position.x += (cx - camera.position.x) * 0.04;
    camera.position.y += (cy - camera.position.y) * 0.04;
    camera.position.z = camBase.z;
    camera.lookAt(look);

    if (!reduced && t > flickerAt) {
      flickerAt = t + 260 + Math.random() * 500;
      for (let k = 0; k < 3; k++) {
        const i = Math.floor(Math.random() * windows.length);
        state[i] = windows[i].studio ? Math.random() < 0.85 : !state[i];
        winMesh.setColorAt(i, colorFor(i));
      }
      winMesh.instanceColor.needsUpdate = true;
      // Every so often the neon sign stutters, like a real one.
      if (Math.random() < 0.03) { drawSign(false); signGlow.intensity = 0.3; signOffUntil = t + 90 + Math.random() * 120; }
    }
    if (signOffUntil && t > signOffUntil) { drawSign(true); signGlow.intensity = 2.2; signOffUntil = 0; }
    renderer.render(scene, camera);
  }
  camera.position.copy(camBase);
  if (reduced) { camera.lookAt(look); renderer.render(scene, camera); }
  else raf = requestAnimationFrame(frame);
  canvas.classList.add("ready");

  return function dispose() {
    cancelAnimationFrame(raf);
    removeEventListener("pointermove", onMove);
    ro.disconnect(); io.disconnect();
    renderer.dispose();
  };
}
