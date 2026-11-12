import * as THREE from "three";
import { OrbitControls } from "./vendor/OrbitControls.js";
// A real, procedural 3D sculpture inspired by the supplied outfit and pose.
// Original artwork remains available separately; this is deliberately stylized.
export function createCharacterViewer(host) {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  camera.position.set(0, 1.6, 5.5);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0, 0);
  host.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.15, 0);
  controls.enablePan = false;
  controls.minDistance = 2.8;
  controls.maxDistance = 7;
  controls.minPolarAngle = 0.45;
  controls.maxPolarAngle = 1.7;
  controls.autoRotateSpeed = 1.4;
  controls.enableDamping = false;
  controls.update();
  scene.add(new THREE.HemisphereLight(0xc4dcff, 0x6d5140, 2.6));
  const key = new THREE.DirectionalLight(0xffe0bb, 3.5);
  key.position.set(-3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x479bff, 4);
  rim.position.set(3, 3, -3);
  scene.add(rim);
  const figure = new THREE.Group();
  scene.add(figure);
  const mat = (color, roughness = 0.8, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const skin = mat(0xb57c59),
    skinLight = mat(0xc9906c),
    shirt = mat(0x17181c),
    pants = mat(0x222328),
    seam = mat(0x37383d),
    hair = mat(0x201611),
    hairLight = mat(0x332219),
    white = mat(0xdcdce0),
    sole = mat(0xbfc2c8),
    black = mat(0x101013),
    metal = mat(0x68717d, 0.3, 0.75);
  function mesh(geometry, material, pos, scale, parent = figure) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function ellipsoid(pos, scale, material, parent) {
    return mesh(
      new THREE.SphereGeometry(1, 28, 20),
      material,
      pos,
      scale,
      parent,
    );
  }
  function box(pos, scale, material) {
    return mesh(new THREE.BoxGeometry(...scale), material, pos);
  }
  function limb(a, b, r1, r2, material) {
    const av = new THREE.Vector3(...a),
      bv = new THREE.Vector3(...b),
      delta = bv.clone().sub(av);
    const m = mesh(
      new THREE.CylinderGeometry(r2, r1, delta.length(), 20),
      material,
      av.clone().add(bv).multiplyScalar(0.5).toArray(),
    );
    m.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    );
    ellipsoid(a, [r1, r1, r1], material);
    ellipsoid(b, [r2, r2, r2], material);
    return m;
  }
  // Cargo trousers with separate legs, pockets, hems, and fabric folds.
  ellipsoid([0, 1.05, 0], [0.28, 0.22, 0.16], pants);
  for (const s of [-1, 1]) {
    limb([s * 0.15, 1.04, 0], [s * 0.19, 0.58, 0.015], 0.15, 0.115, pants);
    limb([s * 0.19, 0.58, 0.015], [s * 0.2, 0.17, 0.03], 0.115, 0.09, pants);
    box([s * 0.28, 0.76, 0.075], [0.09, 0.22, 0.16], pants);
    box([s * 0.285, 0.85, 0.085], [0.105, 0.035, 0.17], seam);
    for (let i = 0; i < 3; i++) {
      const fold = ellipsoid(
        [s * 0.19, 0.3 + i * 0.17, 0.105],
        [0.105, 0.012, 0.02],
        seam,
      );
      fold.rotation.z = s * 0.25;
    }
    ellipsoid([s * 0.2, 0.1, 0.1], [0.13, 0.09, 0.25], white);
    ellipsoid([s * 0.2, 0.055, 0.11], [0.135, 0.035, 0.255], sole);
    ellipsoid([s * 0.2, 0.14, 0.01], [0.095, 0.055, 0.1], white);
    for (let i = 0; i < 4; i++)
      limb(
        [s * 0.2 - 0.07, 0.165, 0.1 + i * 0.025],
        [s * 0.2 + 0.07, 0.165, 0.1 + i * 0.025],
        0.006,
        0.006,
        sole,
      );
  }
  // Shirt as a tapered torso, slightly broader across the shoulders.
  const points = [
    [0.255, 1.04],
    [0.27, 1.1],
    [0.245, 1.25],
    [0.27, 1.45],
    [0.31, 1.59],
    [0.28, 1.66],
    [0.13, 1.7],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const torso = mesh(new THREE.LatheGeometry(points, 40), shirt, [0, 0, 0]);
  torso.scale.z = 0.62;
  limb([0, 1.65, 0], [0, 1.81, 0], 0.085, 0.085, skin);
  const collar = mesh(
    new THREE.TorusGeometry(0.098, 0.018, 12, 36),
    black,
    [0, 1.69, 0],
  );
  collar.rotation.x = Math.PI / 2;
  // Relaxed left arm and raised right forearm with thumbs-up hand.
  limb([-0.27, 1.58, 0], [-0.37, 1.38, 0.01], 0.13, 0.105, shirt);
  limb([-0.37, 1.37, 0.01], [-0.4, 1.12, 0.07], 0.086, 0.065, skin);
  limb([-0.4, 1.12, 0.07], [-0.27, 1.0, 0.13], 0.065, 0.055, skin);
  ellipsoid([-0.255, 0.99, 0.14], [0.065, 0.085, 0.042], skin);
  limb([0.28, 1.58, 0], [0.39, 1.39, 0.015], 0.13, 0.105, shirt);
  limb([0.39, 1.38, 0.015], [0.46, 1.19, 0.07], 0.085, 0.07, skin);
  limb([0.46, 1.19, 0.07], [0.49, 1.49, 0.24], 0.07, 0.052, skinLight);
  const watch = limb(
    [0.485, 1.43, 0.21],
    [0.49, 1.48, 0.24],
    0.067,
    0.067,
    black,
  );
  box([0.49, 1.46, 0.295], [0.085, 0.07, 0.024], metal);
  ellipsoid([0.49, 1.56, 0.26], [0.065, 0.09, 0.045], skinLight);
  for (let i = 0; i < 4; i++)
    ellipsoid([0.49, 1.515 + i * 0.026, 0.297], [0.06, 0.017, 0.023], skin);
  limb([0.44, 1.56, 0.26], [0.43, 1.7, 0.26], 0.025, 0.022, skinLight);
  // Head, ears, jaw, nose, eyes, brows, beard and individual hair curls.
  ellipsoid([0, 1.96, 0], [0.155, 0.205, 0.14], skinLight);
  ellipsoid([0, 1.85, 0.055], [0.115, 0.1, 0.095], skin);
  for (const s of [-1, 1])
    ellipsoid([s * 0.155, 1.96, 0], [0.025, 0.05, 0.034], skin);
  ellipsoid([0, 1.94, 0.143], [0.028, 0.05, 0.035], skinLight);
  ellipsoid([0, 1.9, 0.158], [0.035, 0.02, 0.022], skin);
  for (const s of [-1, 1]) {
    ellipsoid([s * 0.062, 1.985, 0.125], [0.039, 0.019, 0.013], white);
    ellipsoid([s * 0.061, 1.985, 0.138], [0.013, 0.015, 0.007], hair);
    ellipsoid([s * 0.061, 1.987, 0.144], [0.006, 0.008, 0.003], black);
    const brow = ellipsoid(
      [s * 0.062, 2.021, 0.13],
      [0.045, 0.011, 0.012],
      hair,
    );
    brow.rotation.z = s * -0.12;
  }
  ellipsoid([0, 1.84, 0.104], [0.085, 0.042, 0.029], hair);
  ellipsoid([0, 1.86, 0.137], [0.055, 0.009, 0.01], skinLight);
  for (const s of [-1, 1]) {
    const b = ellipsoid([s * 0.035, 1.885, 0.145], [0.035, 0.009, 0.007], hair);
    b.rotation.z = s * -0.16;
  }
  ellipsoid([0, 2.095, -0.018], [0.16, 0.1, 0.14], hair);
  ellipsoid([0, 2.01, -0.108], [0.13, 0.12, 0.045], hair);
  for (let i = 0; i < 54; i++) {
    const angle = i * 2.39996,
      r = 0.145 * Math.sqrt((i + 0.5) / 54),
      x = Math.cos(angle) * r,
      z = Math.sin(angle) * r * 0.8;
    const y = 2.11 + 0.045 * (1 - r / 0.15);
    const curl = ellipsoid(
      [x, y, z - 0.005],
      [0.035, 0.04, 0.029],
      i % 4 === 0 ? hairLight : hair,
    );
    curl.rotation.set(i * 0.2, i * 0.3, i * 0.4);
  }
  // Small original character chest mark, rendered as texture on the shirt.
  const label = document.createElement("canvas");
  label.width = 256;
  label.height = 128;
  const ctx = label.getContext("2d");
  ctx.fillStyle = "#e6e6e5";
  ctx.font = "italic bold 52px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("CPM2", 128, 78);
  const texture = new THREE.CanvasTexture(label);
  texture.colorSpace = THREE.SRGBColorSpace;
  mesh(
    new THREE.PlaneGeometry(0.13, 0.065),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
    [0.125, 1.53, 0.164],
  );
  const platform = mesh(
    new THREE.CylinderGeometry(0.72, 0.76, 0.06, 64),
    mat(0x202733, 0.4, 0.45),
    [0, -0.018, 0],
    null,
    scene,
  );
  platform.receiveShadow = true;
  const ring = mesh(
    new THREE.TorusGeometry(0.7, 0.008, 8, 80),
    new THREE.MeshBasicMaterial({ color: 0x479bff }),
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
  const intersection = new IntersectionObserver((entries) => {
    inViewport = entries[0].isIntersecting;
    schedule();
  });
  intersection.observe(host);
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
      "O 3D foi pausado pelo dispositivo. Recarregue a página ou use a arte original.";
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
      figure.rotation.y = 0;
      camera.position.set(0, 1.6, 5.5);
      controls.target.set(0, 1.15, 0);
      controls.update();
      render();
    },
    setVisible(value) {
      visible = value;
      schedule();
    },
  };
}
