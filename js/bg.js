(() => {
  "use strict";

  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;

  // Initialize Three.js scene
  const scene = new THREE.Scene();

  // Set up camera
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    40,
  );
  camera.position.set(0, 1.3, 3.6);
  camera.lookAt(0, -0.4, 0);

  // Set up renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Generate Geometry
  const gridSize = 140; // Optimized grid size
  const count = gridSize * gridSize;
  const positions = new Float32Array(count * 3);
  const randoms = new Float32Array(count);

  let o = 0;
  for (let e = 0; e < gridSize; e++) {
    for (let i = 0; i < gridSize; i++) {
      positions[o] = (i / (gridSize - 1) - 0.5) * 9.9;
      positions[o + 1] = (e / (gridSize - 1) - 0.5) * 9.9;
      positions[o + 2] = 0;
      randoms[o / 3] = Math.random();
      o += 3;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));

  // Uniforms
  const uniforms = {
    uTime: { value: 0 },
    uScroll: { value: 0 },
    uMouse: { value: new THREE.Vector3(999, 999, 0) },
    uScan: { value: 0 },
    uSize: { value: 2.4 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uAmp: { value: 0.55 },
    uColorDim: { value: new THREE.Color() },
    uColorBright: { value: new THREE.Color() },
    uColorAccent: { value: new THREE.Color() },
  };

  // Shader Material
  const material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: `
uniform float uTime;
uniform float uScroll;     // 0 = assembled · 1 = dispersed/faded
uniform vec3  uMouse;      // pointer in plane-local coords
uniform float uScan;       // 0..1 sweep progress
uniform float uSize;
uniform float uPixelRatio;
uniform float uAmp;
uniform vec3  uColorDim;
uniform vec3  uColorBright;
uniform vec3  uColorAccent;

attribute float aRandom;

varying vec3 vColor;
varying float vAlpha;

// simplex noise 2D — Ian McEwan / Ashima Arts (MIT)
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec3 pos = position;

  // rolling terrain — two octaves drifting with time
  float n = snoise(pos.xy * 0.35 + vec2(uTime * 0.06, uTime * 0.04));
  n += 0.5 * snoise(pos.xy * 0.8 - vec2(uTime * 0.03, uTime * 0.05));
  float amp = uAmp * (1.0 + uScroll * 2.0);
  float height = n * amp;

  // pointer dome — gaussian lift around the cursor
  float d = distance(pos.xy, uMouse.xy);
  float dome = exp(-(d * d) / 1.4) * 0.9;
  height += dome;

  // LiDAR sweep along x
  float scanX = mix(-5.5, 5.5, uScan);
  float scan = smoothstep(0.6, 0.0, abs(pos.x - scanX));
  height += scan * 0.18;

  pos.z += height;

  // dispersion as the hero scrolls away
  pos.z += uScroll * aRandom * 4.0;
  pos.xy += uScroll * (vec2(aRandom, fract(aRandom * 7.31)) - 0.5) * 3.0;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float sizeScale = clamp(2.6 / -mvPosition.z, 0.3, 2.2);
  gl_PointSize = uSize * uPixelRatio * sizeScale;

  float hMix = smoothstep(-0.6, 0.9, height);
  vec3 col = mix(uColorDim, uColorBright, hMix * 0.85);
  float accentMix = clamp(scan + dome * 1.2, 0.0, 1.0);
  col = mix(col, uColorAccent, accentMix);

  vColor = col;
  vAlpha = (1.0 - uScroll) * (0.45 + 0.55 * hMix);
}
    `,
    fragmentShader: `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float alpha = smoothstep(0.5, 0.12, d) * vAlpha;
  if (alpha < 0.012) discard;
  gl_FragColor = vec4(vColor, alpha);
}
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  function updateTheme() {
    const isLight = document.documentElement.dataset.theme === "light";
    if (isLight) {
      uniforms.uColorDim.value.setRGB(0.75, 0.78, 0.80); // Light silver valleys (fades nicely into white)
      uniforms.uColorBright.value.setRGB(0.25, 0.28, 0.32); // Deep steel grey peaks (sharp and structural)
      uniforms.uColorAccent.value.setRGB(0.0, 0.36, 0.71); // Electric blue interaction (matches Option A --accent)
      uniforms.uSize.value = 4.4; // Larger particles so they don't look like faint dust
      material.blending = THREE.NormalBlending;
    } else {
      uniforms.uColorDim.value.setRGB(0.12, 0.16, 0.22); // Brighter base so far away particles are visible
      uniforms.uColorBright.value.setRGB(0.25, 0.4, 0.55); // Richer cool blue peaks
      uniforms.uColorAccent.value.setRGB(0.0, 1.0, 0.85); // Blazing bright cyan
      uniforms.uSize.value = 5.0; // Default for dark mode
      material.blending = THREE.AdditiveBlending;
    }
    material.needsUpdate = true;
  }

  updateTheme();

  const mo = new MutationObserver(updateTheme);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  const points = new THREE.Points(geometry, material);

  // Create a parent group to apply the base rotation and position
  const group = new THREE.Group();
  group.rotation.set(-1.18, 0, 0);
  group.position.set(0, -0.7, 0);
  group.add(points);

  // Invisible plane for raycasting
  const planeGeo = new THREE.PlaneGeometry(16.5, 16.5);
  const planeMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const hitPlane = new THREE.Mesh(planeGeo, planeMat);
  group.add(hitPlane);

  scene.add(group);

  // Raycaster for mouse interaction
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let targetMousePos = new THREE.Vector3(999, 999, 0);

  window.addEventListener("mousemove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(hitPlane);
    if (intersects.length > 0) {
      targetMousePos.copy(intersects[0].point);
      hitPlane.worldToLocal(targetMousePos);
    } else {
      targetMousePos.set(999, 999, 0);
    }
  });

  window.addEventListener("mouseleave", () => {
    targetMousePos.set(999, 999, 0);
  });

  // Handle Resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.uPixelRatio.value = renderer.getPixelRatio();
  });

  // Handle scrolling (dispersion effect)
  window.addEventListener("scroll", () => {
    // The original site disperses particles based on scroll
    // Let's cap the dispersion so it reaches 1.0 when scrolled down by 1000px
    const scrollMax = 1000;
    const scrollProgress = Math.min(1.0, window.scrollY / scrollMax);
    uniforms.uScroll.value = scrollProgress;
  });

  // Animation Loop
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    uniforms.uTime.value += Math.min(delta, 0.05);
    uniforms.uScan.value = (uniforms.uTime.value % 6) / 6;

    // Smoothly interpolate the mouse position for a fluid dome effect
    uniforms.uMouse.value.lerp(targetMousePos, 0.08);

    renderer.render(scene, camera);
  }

  animate();
})();
