import * as THREE from "three";
import { OrbitControls } from "./vendor/OrbitControls.js";

// Sculpted, continuous 3D surfaces. The reference is used as a facial texture,
// not as a billboard or a sequence of flat views.
export function createCharacterViewer(host) {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
  camera.position.set(0.15, 1.32, 5.05);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0, 0);
  host.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.12, 0);
  controls.enablePan = false;
  controls.minDistance = 2.3;
  controls.maxDistance = 6;
  controls.minPolarAngle = 0.5;
  controls.maxPolarAngle = 1.7;
  controls.autoRotateSpeed = 1;
  controls.update();
  scene.add(new THREE.HemisphereLight(0xe1eaff, 0x3e342e, 2));
  const key = new THREE.DirectionalLight(0xffead8, 3.2);
  key.position.set(-2.5, 4, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -2;
  key.shadow.camera.right = 2;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -1;
  key.shadow.normalBias = 0.015;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8ab6ff, 2.2);
  rim.position.set(3, 3, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.8);
  fill.position.set(3, 1, 4);
  scene.add(fill);
  const figure = new THREE.Group();
  figure.rotation.y = -0.12;
  scene.add(figure);
  const material = (color, roughness = 0.8, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const skin = material(0xb98462, 0.8),
    skinShade = material(0xab7154, 0.82),
    nails = material(0xd8ad94, 0.6),
    shirt = material(0x18191d, 0.96),
    pants = material(0x202125, 0.96),
    seam = material(0x303137, 0.95),
    black = material(0x101114),
    hair = material(0x211813, 0.92),
    hairHighlight = material(0x35261c, 0.9),
    shoe = material(0xdddfe0, 0.6),
    sole = material(0xbfc3c7, 0.9),
    metal = material(0x878e96, 0.28, 0.85);
  function mesh(g, m, p = [0, 0, 0], s = null, parent = figure) {
    const o = new THREE.Mesh(g, m);
    o.position.set(...p);
    if (s) o.scale.set(...s);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function oval(p, s, m) {
    return mesh(new THREE.SphereGeometry(1, 40, 28), m, p, s);
  }
  function curve(points, r, m) {
    const c = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
    );
    return mesh(
      new THREE.TubeGeometry(c, Math.max(12, points.length * 6), r, 7, false),
      m,
    );
  }
  function roundedBox(p, s, m, r = 0.012) {
    const shape = new THREE.Shape(),
      w = s[0],
      h = s[1];
    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: s[2],
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.003,
      bevelThickness: 0.003,
    });
    g.translate(0, 0, -s[2] / 2);
    return mesh(g, m, p);
  }
  // Continuous elliptical garment surface, with sculpted fold displacement.
  function garment(rings, m, fold = 0) {
    const positions = [],
      uvs = [],
      indices = [],
      segments = 64;
    for (let j = 0; j < rings.length; j++) {
      const [y, rx, rz, cx = 0, cz = 0] = rings[j];
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const ripple =
          fold * Math.sin(a * 7 + j * 0.95) * Math.sin(j * 0.75) +
          fold * 0.5 * Math.sin(a * 11 - j * 1.5);
        positions.push(
          cx + Math.cos(a) * (rx + ripple),
          y,
          cz + Math.sin(a) * (rz + ripple * 0.65),
        );
        uvs.push(i / segments, j / (rings.length - 1));
        if (j < rings.length - 1 && i < segments) {
          const n = j * (segments + 1) + i;
          indices.push(
            n,
            n + segments + 1,
            n + 1,
            n + 1,
            n + segments + 1,
            n + segments + 2,
          );
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return mesh(g, m);
  }
  function limb(points, radii, m) {
    const c = new THREE.CatmullRomCurve3(
        points.map((p) => new THREE.Vector3(...p)),
      ),
      frames = c.computeFrenetFrames(32, false),
      verts = [],
      idx = [];
    for (let j = 0; j <= 32; j++) {
      const t = j / 32,
        p = c.getPoint(t),
        k = t * (radii.length - 1),
        lo = Math.floor(k),
        radius = THREE.MathUtils.lerp(
          radii[lo],
          radii[Math.min(lo + 1, radii.length - 1)],
          k - lo,
        );
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2,
          v = p
            .clone()
            .addScaledVector(frames.normals[j], Math.cos(a) * radius)
            .addScaledVector(frames.binormals[j], Math.sin(a) * radius * 0.9);
        verts.push(v.x, v.y, v.z);
        if (j < 32 && i < 24) {
          const n = j * 25 + i;
          idx.push(n, n + 1, n + 25, n + 1, n + 26, n + 25);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    mesh(g, m);
    oval(points[0], [radii[0], radii[0], radii[0] * 0.9], m);
    const r = radii.at(-1);
    oval(points.at(-1), [r, r, r * 0.9], m);
  }
  // Cargo trousers: no separated knee joints; wrinkles follow the entire leg.
  oval([0, 1.07, 0], [0.245, 0.19, 0.145], pants);
  for (const s of [-1, 1]) {
    const rings = [];
    for (let j = 0; j <= 26; j++) {
      const t = j / 26,
        y = 0.16 + t * 0.96,
        rx = 0.079 + 0.057 * Math.sin(t * Math.PI * 0.65),
        rz = 0.085 + 0.04 * t,
        cx = s * (0.17 - 0.035 * t);
      rings.push([y, rx, rz, cx, 0.01]);
    }
    garment(rings, pants, 0.006);
    roundedBox([s * 0.255, 0.79, 0.065], [0.1, 0.18, 0.065], pants);
    roundedBox([s * 0.255, 0.87, 0.105], [0.105, 0.032, 0.018], seam, 0.005);
    curve(
      [
        [s * 0.265, 0.85, 0.118],
        [s * 0.265, 0.73, 0.118],
        [s * 0.225, 0.71, 0.12],
      ],
      0.0015,
      seam,
    );
    curve(
      [
        [s * 0.23, 1.12, 0.08],
        [s * 0.22, 1.03, 0.11],
        [s * 0.19, 0.98, 0.13],
      ],
      0.002,
      seam,
    );
    for (const y of [0.2, 0.41, 0.58])
      curve(
        [
          [s * 0.25, y + 0.015, 0.04],
          [s * 0.19, y, 0.1],
          [s * 0.105, y + 0.02, 0.075],
        ],
        0.0023,
        seam,
      );
    // Layered leather sneakers, sole seam, toe perforations and crossed laces.
    oval([s * 0.17, 0.083, 0.075], [0.112, 0.074, 0.205], shoe);
    oval([s * 0.17, 0.035, 0.085], [0.116, 0.024, 0.212], sole);
    oval([s * 0.17, 0.13, -0.015], [0.085, 0.056, 0.092], shoe);
    curve(
      [
        [s * 0.27, 0.064, 0.08],
        [s * 0.25, 0.067, 0.22],
        [s * 0.17, 0.07, 0.275],
        [s * 0.09, 0.067, 0.22],
        [s * 0.065, 0.064, 0.08],
      ],
      0.0035,
      sole,
    );
    for (let i = 0; i < 5; i++) {
      const z = 0.055 + i * 0.027;
      curve(
        [
          [s * 0.17 - 0.055, 0.15 - i * 0.003, z],
          [s * 0.17, 0.165 - i * 0.003, z + 0.012],
          [s * 0.17 + 0.055, 0.15 - i * 0.003, z + 0.023],
        ],
        0.0035,
        sole,
      );
      curve(
        [
          [s * 0.17 + 0.055, 0.15 - i * 0.003, z],
          [s * 0.17, 0.162 - i * 0.003, z + 0.012],
          [s * 0.17 - 0.055, 0.15 - i * 0.003, z + 0.023],
        ],
        0.0028,
        shoe,
      );
    }
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        oval(
          [s * 0.17 + (i - 1) * 0.025, 0.132 - j * 0.003, 0.19 + j * 0.02],
          [0.002, 0.0015, 0.002],
          sole,
        );
  }
  // A single tailored torso with soft folds and a fitted collar.
  const torso = [];
  for (let j = 0; j <= 30; j++) {
    const t = j / 30,
      y = 1.08 + t * 0.63;
    let rx = 0.23 + 0.025 * Math.sin(t * Math.PI) + 0.025 * t,
      rz = 0.135 + 0.025 * Math.sin(t * Math.PI);
    if (t > 0.86) {
      const q = (t - 0.86) / 0.14;
      rx = THREE.MathUtils.lerp(0.27, 0.085, q);
      rz = THREE.MathUtils.lerp(0.14, 0.075, q);
    }
    torso.push([y, rx, rz]);
  }
  garment(torso, shirt, 0.0035);
  curve(
    [
      [-0.22, 1.09, 0.08],
      [0, 1.085, 0.139],
      [0.22, 1.09, 0.08],
    ],
    0.002,
    seam,
  );
  limb(
    [
      [0, 1.67, 0],
      [0, 1.79, 0],
    ],
    [0.072, 0.068],
    skin,
  );
  const collar = mesh(
    new THREE.TorusGeometry(0.08, 0.008, 12, 64),
    black,
    [0, 1.711, 0],
  );
  collar.rotation.x = Math.PI / 2;
  collar.scale.y = 0.87;
  limb(
    [
      [-0.245, 1.62, 0],
      [-0.29, 1.53, 0],
      [-0.325, 1.43, 0.005],
    ],
    [0.105, 0.108, 0.088],
    shirt,
  );
  limb(
    [
      [0.245, 1.62, 0],
      [0.295, 1.53, 0],
      [0.33, 1.43, 0.005],
    ],
    [0.105, 0.108, 0.088],
    shirt,
  );
  limb(
    [
      [-0.326, 1.43, 0.005],
      [-0.36, 1.25, 0.018],
      [-0.355, 1.15, 0.025],
      [-0.28, 1.04, 0.12],
    ],
    [0.074, 0.064, 0.052, 0.043],
    skin,
  );
  oval([-0.261, 1.027, 0.125], [0.052, 0.071, 0.032], skin);
  for (let i = 0; i < 4; i++)
    curve(
      [
        [-0.29 + i * 0.019, 1.025, 0.15],
        [-0.292 + i * 0.019, 0.99, 0.152],
        [-0.282 + i * 0.019, 0.974, 0.14],
      ],
      0.008,
      skin,
    );
  limb(
    [
      [0.33, 1.43, 0.005],
      [0.385, 1.26, 0.045],
      [0.39, 1.21, 0.065],
      [0.4, 1.36, 0.14],
      [0.405, 1.51, 0.205],
    ],
    [0.074, 0.066, 0.058, 0.053, 0.041],
    skin,
  );
  // Watch face, strap and restrained metallic rim.
  limb(
    [
      [0.403, 1.445, 0.176],
      [0.405, 1.49, 0.196],
    ],
    [0.049, 0.048],
    black,
  );
  roundedBox([0.405, 1.47, 0.235], [0.062, 0.069, 0.015], metal, 0.012);
  roundedBox([0.405, 1.47, 0.246], [0.051, 0.056, 0.006], black, 0.009);
  curve(
    [
      [0.405, 1.47, 0.251],
      [0.415, 1.487, 0.251],
    ],
    0.0015,
    shoe,
  );
  curve(
    [
      [0.405, 1.47, 0.251],
      [0.39, 1.47, 0.251],
    ],
    0.0015,
    shoe,
  );
  // Closed fingers wrap around the palm; the thumb rises from its side.
  oval([0.407, 1.56, 0.222], [0.052, 0.071, 0.033], skin);
  for (let i = 0; i < 4; i++) {
    const y = 1.525 + i * 0.024;
    curve(
      [
        [0.444, y, 0.214],
        [0.454, y, 0.239],
        [0.433, y, 0.259],
        [0.399, y, 0.26],
        [0.385, y, 0.247],
      ],
      0.0105,
      skin,
    );
    curve(
      [
        [0.43, y - 0.007, 0.267],
        [0.407, y - 0.007, 0.267],
      ],
      0.0008,
      skinShade,
    );
  }
  limb(
    [
      [0.376, 1.565, 0.23],
      [0.36, 1.61, 0.239],
      [0.362, 1.67, 0.235],
    ],
    [0.021, 0.02, 0.016],
    skin,
  );
  oval([0.361, 1.675, 0.236], [0.016, 0.019, 0.016], skin);
  oval([0.36, 1.678, 0.25], [0.01, 0.014, 0.002], nails);
  // Sculpted adult head. Front UVs project the face from the supplied character art.
  const headG = new THREE.SphereGeometry(1, 96, 64),
    p = headG.attributes.position,
    uv = headG.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    let xx = x * 0.113 * (y < -0.35 ? 1 + (y + 0.35) * 0.13 : 1),
      yy = 1.926 + y * 0.153,
      zz = z * 0.105;
    if (z > 0) {
      const gauss = (cx, cy, sx, sy) =>
        Math.exp(-((x - cx) ** 2 / sx + (y - cy) ** 2 / sy));
      zz +=
        0.036 * gauss(0, -0.05, 0.018, 0.11) +
        0.018 * gauss(0, -0.22, 0.035, 0.025) +
        0.009 * gauss(0, -0.57, 0.12, 0.03) -
        0.006 *
          (gauss(-0.4, 0.17, 0.05, 0.015) + gauss(0.4, 0.17, 0.05, 0.015));
    }
    p.setXYZ(i, xx, yy, zz);
    const front = z >= 0;
    const sx = 551 + x * 44,
      sy = 111 - y * 54;
    uv.setXY(i, sx / 1448, 1 - sy / 1086);
  }
  headG.computeVertexNormals();
  const faceMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.82,
  });
  const faceTexture = new THREE.TextureLoader().load(
    new URL("./images/character-sheet.png", import.meta.url).href,
    () => render(),
  );
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  faceTexture.anisotropy = Math.min(
    8,
    renderer.capabilities.getMaxAnisotropy(),
  );
  faceMat.map = faceTexture;
  headG.clearGroups();
  for (let k = 0; k < headG.index.count; k += 3) {
    const a = headG.index.getX(k),
      b = headG.index.getX(k + 1),
      c = headG.index.getX(k + 2);
    const front = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3 > 0;
    headG.addGroup(k, 3, front ? 0 : 1);
  }
  mesh(headG, [faceMat, skin]);
  for (const s of [-1, 1]) {
    oval([s * 0.115, 1.93, -0.005], [0.018, 0.037, 0.022], skin);
    oval([s * 0.124, 1.931, 0.009], [0.007, 0.024, 0.009], skinShade);
    curve(
      [
        [s * 0.12, 1.955, 0.01],
        [s * 0.13, 1.94, 0.017],
        [s * 0.12, 1.912, 0.01],
      ],
      0.003,
      skin,
    );
  }
  // Hair cap with a lower back and taper, then dozens of curved locks.
  const cap = new THREE.SphereGeometry(
    1,
    64,
    32,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.52,
  );
  mesh(cap, hair, [0, 2.04, -0.008], [0.123, 0.085, 0.115]);
  oval([0, 1.988, -0.087], [0.098, 0.073, 0.035], hair);
  for (let i = 0; i < 90; i++) {
    const a = i * 2.39996,
      r = 0.108 * Math.sqrt((i + 0.5) / 90),
      x = Math.cos(a) * r,
      z = Math.sin(a) * r * 0.9 - 0.008,
      y = 2.065 + 0.045 * (1 - r / 0.12);
    const sway = 0.012 + Math.sin(i) * 0.004;
    oval(
      [x, y + 0.002, z],
      [0.019, 0.017, 0.018],
      i % 5 === 0 ? hairHighlight : hair,
    );
    curve(
      [
        [x - 0.015, y - 0.01, z],
        [x - 0.006, y + 0.014, z + sway],
        [x + 0.012, y + 0.013, z + 0.009],
        [x + 0.018, y, z - 0.005],
      ],
      0.0065,
      i % 5 === 0 ? hairHighlight : hair,
    );
  }
  // Subtle stubble at the sideburns, keeping the illustrated face recognizable.
  for (const s of [-1, 1])
    for (let i = 0; i < 18; i++) {
      const t = i / 18;
      oval(
        [s * (0.102 - 0.018 * t), 1.95 - 0.09 * t, 0.041 + 0.025 * t],
        [0.0015, 0.003, 0.0015],
        hair,
      );
    }
  const label = document.createElement("canvas");
  label.width = 512;
  label.height = 256;
  const ctx = label.getContext("2d");
  ctx.fillStyle = "#dedfe1";
  ctx.font = "italic 800 92px Arial";
  ctx.textAlign = "center";
  ctx.fillText("CPM2", 256, 154);
  const labelTexture = new THREE.CanvasTexture(label);
  labelTexture.colorSpace = THREE.SRGBColorSpace;
  mesh(
    new THREE.PlaneGeometry(0.1, 0.05),
    new THREE.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
      depthWrite: false,
    }),
    [0.105, 1.53, 0.153],
  );
  const platform = mesh(
    new THREE.CylinderGeometry(0.63, 0.65, 0.035, 96),
    material(0x20242b, 0.45, 0.45),
    [0, 0.0, 0],
    null,
    scene,
  );
  platform.receiveShadow = true;
  const ring = mesh(
    new THREE.TorusGeometry(0.63, 0.003, 8, 100),
    new THREE.MeshBasicMaterial({ color: 0x79a8de }),
    [0, 0.018, 0],
    null,
    scene,
  );
  ring.rotation.x = Math.PI / 2;
  let visible = true,
    inViewport = true,
    frame = 0,
    last = 0;
  function render() {
    if (visible && inViewport && !document.hidden)
      renderer.render(scene, camera);
  }
  function loop(time) {
    frame = 0;
    if (visible && inViewport && !document.hidden && controls.autoRotate) {
      controls.update(Math.min((time - last) / 1000, 0.05));
      last = time;
      render();
      frame = requestAnimationFrame(loop);
    }
  }
  function schedule() {
    if (
      !frame &&
      controls.autoRotate &&
      visible &&
      inViewport &&
      !document.hidden
    ) {
      last = performance.now();
      frame = requestAnimationFrame(loop);
    }
    render();
  }
  controls.addEventListener("change", render);
  const resize = new ResizeObserver(() => {
    if (!host.clientWidth || !host.clientHeight) return;
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    render();
  });
  resize.observe(host);
  const observer = new IntersectionObserver((entries) => {
    inViewport = entries[0].isIntersecting;
    schedule();
  });
  observer.observe(host);
  document.addEventListener("visibilitychange", schedule);
  function rotate(amount) {
    figure.rotation.y += amount;
    render();
  }
  host.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      rotate(e.key === "ArrowLeft" ? -0.2 : 0.2);
    }
  });
  renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    document.getElementById("model-status").hidden = false;
    document.getElementById("model-status").textContent =
      "O dispositivo pausou o 3D. Recarregue a página para tentar novamente.";
  });
  render();
  return {
    rotate,
    auto(value) {
      controls.autoRotate = value;
      schedule();
    },
    reset() {
      controls.autoRotate = false;
      figure.rotation.y = -0.12;
      camera.position.set(0.15, 1.32, 5.05);
      controls.target.set(0, 1.12, 0);
      controls.update();
      render();
    },
    setVisible(value) {
      visible = value;
      schedule();
    },
  };
}
