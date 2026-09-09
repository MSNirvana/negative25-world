<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const props = defineProps<{
  label: string;
  fallbackSrc: string;
}>();

const container = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const ready = ref(false);
const failed = ref(false);
const interacted = ref(false);

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let controls: OrbitControls | null = null;
let resizeObserver: ResizeObserver | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let frame = 0;
let visible = true;
let product: THREE.Group | null = null;
const initialCameraPosition = new THREE.Vector3(4.9, 2.75, 8.2);
const initialTarget = new THREE.Vector3(0, 0.12, 0.42);

const bodyMaterial = new THREE.MeshPhysicalMaterial({ color: 0x171819, metalness: 0.28, roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.35 });
const rubberMaterial = new THREE.MeshStandardMaterial({ color: 0x090a0a, metalness: 0.08, roughness: 0.88 });
const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x3b3e40, metalness: 0.82, roughness: 0.28 });
const glassMaterial = new THREE.MeshPhysicalMaterial({ color: 0x173344, metalness: 0.12, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0x07121b, emissiveIntensity: 0.85 });
const redMaterial = new THREE.MeshStandardMaterial({ color: 0xb43b32, metalness: 0.25, roughness: 0.42 });

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]): THREE.Mesh {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.rotation.set(...rotation);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function cylinder(radius: number, length: number, z: number, material: THREE.Material, segments = 64): THREE.Mesh {
  return mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material, [0, 0, z], [Math.PI / 2, 0, 0]);
}

function labelTexture(value: string, width: number, height: number, color = '#f3f3f0'): THREE.CanvasTexture {
  const label = document.createElement('canvas');
  label.width = width;
  label.height = height;
  const context = label.getContext('2d');
  if (context) {
    context.clearRect(0, 0, width, height);
    context.fillStyle = color;
    context.font = `700 ${Math.round(height * 0.58)}px Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(value, width / 2, height / 2);
  }
  const texture = new THREE.CanvasTexture(label);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function labelPlane(value: string, width: number, height: number, position: [number, number, number], fontColor = '#f3f3f0'): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({ map: labelTexture(value, 512, 128, fontColor), transparent: true, depthWrite: false });
  const plane = mesh(new THREE.PlaneGeometry(width, height), material, position);
  plane.renderOrder = 2;
  return plane;
}

function knurledRing(radius: number, z: number, width: number): THREE.Group {
  const ring = new THREE.Group();
  ring.add(cylinder(radius, width, z, rubberMaterial, 72));
  for (let index = 0; index < 36; index += 1) {
    const angle = (index / 36) * Math.PI * 2;
    const ridge = mesh(new THREE.BoxGeometry(0.035, 0.1, width + 0.025), metalMaterial, [Math.cos(angle) * radius, Math.sin(angle) * radius, z], [0, 0, angle]);
    ring.add(ridge);
  }
  return ring;
}

function createCameraModel(): THREE.Group {
  const model = new THREE.Group();
  model.name = 'Nikon Z6 III with lens';

  const body = mesh(new RoundedBoxGeometry(4.6, 2.55, 1.38, 6, 0.18), bodyMaterial, [0, 0, 0]);
  model.add(body);
  model.add(mesh(new RoundedBoxGeometry(1.18, 2.55, 1.72, 6, 0.22), rubberMaterial, [-2.05, -0.08, 0.13]));
  model.add(mesh(new RoundedBoxGeometry(0.22, 1.52, 1.54, 4, 0.09), bodyMaterial, [2.32, -0.18, 0.03]));

  const prismShape = new THREE.Shape();
  prismShape.moveTo(-0.94, 0);
  prismShape.lineTo(-0.57, 0.94);
  prismShape.lineTo(0.57, 0.94);
  prismShape.lineTo(0.94, 0);
  prismShape.closePath();
  const prismGeometry = new THREE.ExtrudeGeometry(prismShape, { depth: 0.92, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.07, bevelThickness: 0.07 });
  prismGeometry.translate(0, 0, -0.46);
  model.add(mesh(prismGeometry, bodyMaterial, [0.05, 1.06, 0.03]));
  model.add(mesh(new RoundedBoxGeometry(0.82, 0.1, 0.42, 3, 0.035), metalMaterial, [0.06, 2.06, -0.02]));
  model.add(mesh(new RoundedBoxGeometry(0.55, 0.055, 0.28, 2, 0.025), rubberMaterial, [0.06, 2.12, -0.02]));

  model.add(labelPlane('Nikon', 1.3, 0.32, [0.05, 1.48, 0.525]));
  model.add(labelPlane('Z6 III', 0.62, 0.17, [1.73, 0.35, 0.705], '#d5d7d6'));

  model.add(cylinder(1.1, 0.22, 0.8, metalMaterial));
  model.add(cylinder(1.04, 0.32, 1.02, bodyMaterial));
  model.add(cylinder(1.0, 1.28, 1.75, rubberMaterial));
  model.add(knurledRing(1.035, 1.35, 0.32));
  model.add(knurledRing(1.025, 2.08, 0.42));
  model.add(cylinder(0.94, 0.58, 2.5, bodyMaterial));
  model.add(cylinder(1.01, 0.18, 2.82, metalMaterial));
  model.add(cylinder(0.89, 0.075, 2.925, glassMaterial, 80));
  model.add(cylinder(0.7, 0.02, 2.97, new THREE.MeshBasicMaterial({ color: 0x08131d, transparent: true, opacity: 0.7 }), 80));

  const topDial = (x: number, z: number): THREE.Group => {
    const dial = new THREE.Group();
    const base = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.17, 32), rubberMaterial, [x, 1.4, z]);
    dial.add(base);
    for (let index = 0; index < 24; index += 1) {
      const angle = (index / 24) * Math.PI * 2;
      dial.add(mesh(new THREE.BoxGeometry(0.055, 0.19, 0.06), metalMaterial, [x + Math.cos(angle) * 0.36, 1.4, z + Math.sin(angle) * 0.36], [0, angle, 0]));
    }
    return dial;
  };
  model.add(topDial(1.55, 0.03));
  model.add(topDial(-1.32, 0.05));
  model.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 24), redMaterial, [-1.76, 1.43, 0.48]));
  model.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 24), metalMaterial, [-2.08, 1.42, 0.08]));

  model.add(mesh(new RoundedBoxGeometry(2.35, 1.45, 0.055, 3, 0.06), new THREE.MeshStandardMaterial({ color: 0x111517, metalness: 0.12, roughness: 0.32 }), [0, 0.04, -0.72]));
  model.add(mesh(new RoundedBoxGeometry(2.05, 1.18, 0.025, 3, 0.04), new THREE.MeshBasicMaterial({ color: 0x1f2b30 }), [0, 0.04, -0.76]));
  model.add(mesh(new RoundedBoxGeometry(0.52, 0.38, 0.08, 3, 0.06), rubberMaterial, [1.6, 0.52, -0.75]));

  model.rotation.y = -0.08;
  model.rotation.x = -0.03;
  return model;
}

function resize(): void {
  if (!renderer || !camera || !container.value) return;
  const width = Math.max(container.value.clientWidth, 1);
  const height = Math.max(container.value.clientHeight, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function render(): void {
  if (!renderer || !scene || !camera || !controls) return;
  controls.update();
  renderer.render(scene, camera);
  if (!ready.value) {
    const gl = renderer.getContext();
    const pixels = new Uint8Array(4 * renderer.domElement.width * renderer.domElement.height);
    gl.readPixels(0, 0, renderer.domElement.width, renderer.domElement.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let visibleSamples = 0;
    for (let index = 3; index < pixels.length; index += 160) {
      if (pixels[index] > 8) visibleSamples += 1;
    }
    ready.value = visibleSamples > 100;
  }
}

function animate(): void {
  if (visible) render();
  frame = window.requestAnimationFrame(animate);
}

function resetView(): void {
  if (!camera || !controls) return;
  camera.position.copy(initialCameraPosition);
  controls.target.copy(initialTarget);
  controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.update();
  interacted.value = false;
}

function onKeydown(event: KeyboardEvent): void {
  if (!product || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  interacted.value = true;
  if (controls) controls.autoRotate = false;
  const movement = event.shiftKey ? 0.16 : 0.08;
  if (event.key === 'ArrowLeft') product.rotation.y -= movement;
  if (event.key === 'ArrowRight') product.rotation.y += movement;
  if (event.key === 'ArrowUp') product.rotation.x = Math.max(product.rotation.x - movement, -0.65);
  if (event.key === 'ArrowDown') product.rotation.x = Math.min(product.rotation.x + movement, 0.65);
}

onMounted(() => {
  if (!container.value || !canvas.value) return;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.copy(initialCameraPosition);
    product = createCameraModel();
    scene.add(product);

    scene.add(new THREE.HemisphereLight(0xf2f4f5, 0x17191a, 2.6));
    const key = new THREE.DirectionalLight(0xffffff, 5.2);
    key.position.set(-4, 7, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xa9c6d8, 2.9);
    fill.position.set(5, 2, 4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xf5e7d0, 3.6);
    rim.position.set(2, 4, -6);
    scene.add(rim);

    const floor = mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.25 }), [0, -1.39, 0], [-Math.PI / 2, 0, 0]);
    floor.castShadow = false;
    floor.receiveShadow = true;
    scene.add(floor);

    controls = new OrbitControls(camera, canvas.value);
    controls.target.copy(initialTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.72;
    controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    controls.autoRotateSpeed = 0.48;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = Math.PI - 0.12;
    controls.addEventListener('start', () => {
      interacted.value = true;
      if (controls) controls.autoRotate = false;
    });

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container.value);
    intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? true; }, { rootMargin: '120px' });
    intersectionObserver.observe(container.value);
    resize();
    controls.update();
    animate();
  } catch {
    failed.value = true;
  }
});

onBeforeUnmount(() => {
  window.cancelAnimationFrame(frame);
  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
  controls?.dispose();
  scene?.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      const map = (material as THREE.MeshBasicMaterial).map;
      map?.dispose();
      material.dispose();
    });
  });
  renderer?.dispose();
});
</script>

<template>
  <div
    ref="container"
    class="camera-model-viewer"
    data-testid="camera-360"
    :data-rendered="ready"
    :data-interacted="interacted"
    @dblclick="resetView"
  >
    <canvas
      v-show="!failed"
      ref="canvas"
      tabindex="0"
      role="img"
      :aria-label="props.label"
      @keydown="onKeydown"
    />
    <img v-if="failed" class="camera-fallback" :src="props.fallbackSrc" :alt="props.label" />
  </div>
</template>

<style scoped>
.camera-model-viewer { cursor: grab; height: 100%; min-height: 370px; position: relative; width: 100%; }
.camera-model-viewer:active { cursor: grabbing; }
canvas { display: block; height: 100%; outline: none; touch-action: none; width: 100%; }
canvas:focus-visible { outline: 1px solid var(--accent-deep); outline-offset: -3px; }
.camera-fallback { display: block; height: 100%; object-fit: contain; width: 100%; }
@media (max-width: 640px) {
  .camera-model-viewer { min-height: 250px; }
}
</style>
