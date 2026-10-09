// view.js —— three.js 畫面：載入 village.glb、節點對應 scene.json 的 id、狀態子物件切換、正交斜俯視鏡頭跟隨。
// 座標：格子 [x, y] → three (x, 0, -y)（Blender Z-up 匯出成 glTF Y-up 的結果）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const toWorld = ([x, y], h = 0) => new THREE.Vector3(x, h, -y);

const PITCH = THREE.MathUtils.degToRad(55);
const CAM_DIST = 60;

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb6c6c2);
    this.scene.fog = new THREE.Fog(0xb6c6c2, 58, 128);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    this.viewHeight = 26;              // 畫面縱向看得到幾格
    this.hemi = new THREE.HemisphereLight(0xcfe0ff, 0x6b6250, 1.4); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d6, 2.6);
    this.sun.position.set(-28, 46, 20); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.5;
    const c = this.sun.shadow.camera; c.near = 1; c.far = 160; c.left = -48; c.right = 48; c.top = 48; c.bottom = -48;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.fill = new THREE.DirectionalLight(0xbcd0e8, 0.5); this.fill.position.set(30, 20, -24); this.scene.add(this.fill);
    this.daylight = 1;
    this.nodes = new Map();           // id -> 父節點
    this.states = new Map();          // id -> { state: Object3D }
    this.roofs = new Map();           // houseId -> [Object3D]
    this.markers = new THREE.Group(); this.scene.add(this.markers);
    this.follow = null;               // THREE.Vector3 目標
    this.camTarget = new THREE.Vector3();
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    const vh = this.viewHeight, vw = vh * w / h;
    this.camera.left = -vw / 2; this.camera.right = vw / 2; this.camera.top = vh / 2; this.camera.bottom = -vh / 2;
    this.camera.updateProjectionMatrix();
  }
  async load(url) {
    const gltf = await new GLTFLoader().loadAsync(url);
    const root = gltf.scene; this.scene.add(root);
    root.traverse(o => { if (o.isMesh) { const flat = o.name === 'ground' || o.name.includes('_slab'); o.castShadow = !flat; o.receiveShadow = true; if (o.material) { o.material.roughness = o.material.roughness ?? 1; } } });
    for (const node of root.children) {
      if (node.name === 'ground' || node.name.startsWith('decor')) continue;   // 裝飾（樹／花／草／鋪石）只渲染、不追蹤狀態
      const id = node.name;
      this.nodes.set(id, node);
      const st = {};
      for (const ch of [...node.children]) {
        if (ch.name.includes('__col')) { ch.visible = false; continue; }
        const m = ch.name.match(/^(.+?)__([a-z]+)$/);
        if (m && m[1] === id) st[m[2]] = ch;
      }
      this.states.set(id, st);
      node.traverse(o => { if (/__intact_roof/.test(o.name)) (this.roofs.get(id) || this.roofs.set(id, []).get(id)).push(o); });
    }
    return this;
  }
  /** 顯示 <id>__<state>，其餘狀態隱藏。 */
  setState(id, state) {
    const st = this.states.get(id); if (!st) return false;
    for (const [k, o] of Object.entries(st)) o.visible = k === state;
    return !!st[state];
  }
  setPos(id, cell, h = 0) { const n = this.nodes.get(id); if (n) n.position.copy(toWorld(cell, h)); }
  setVisible(id, v) { const n = this.nodes.get(id); if (n) n.visible = v; }
  setRoof(houseId, visible) { for (const o of this.roofs.get(houseId) || []) o.visible = visible; }
  /** 鏡頭目標（格子座標，可為小數）。 */
  lookAtCell(cell, snap = false) {
    const t = toWorld(cell);
    if (this.sun) { this.sun.target.position.copy(t); this.sun.position.set(t.x - 28, 46, t.z + 20); }
    if (snap) this.camTarget.copy(t); else this.camTarget.lerp(t, 0.15);
    this.camera.position.set(this.camTarget.x, this.camTarget.y + CAM_DIST * Math.sin(PITCH), this.camTarget.z + CAM_DIST * Math.cos(PITCH));
    this.camera.lookAt(this.camTarget);
  }
  render() { this.renderer.render(this.scene, this.camera); }
  /** 晝夜光照：target 1 白天、0 夜晚，慢慢過渡。 */
  setDaylight(target, dt) {
    this.daylight += (target - this.daylight) * Math.min(1, dt * 1.5);
    const d = this.daylight;
    this.hemi.intensity = 0.4 + 1.1 * d; this.sun.intensity = 0.25 + 2.6 * d; this.fill.intensity = 0.15 + 0.45 * d;
    this.hemi.color.setRGB(0.55 + 0.33 * d, 0.57 + 0.34 * d, 0.60 + 0.25 * d);   // 偏暖的天光
    const bg = this.scene.background; bg.setRGB(0.12 + 0.56 * d, 0.16 + 0.60 * d, 0.20 + 0.56 * d);   // 柔和暖藍天
    if (this.scene.fog) this.scene.fog.color.copy(bg);
    this.renderer.toneMappingExposure = 0.9 + 0.28 * d;
  }
  /** 村道：淡色平面，從 meta.roads 的矩形畫。 */
  roads(rects) {
    for (const [x0, y0, x1, y1] of rects) {
      const g = new THREE.PlaneGeometry(x1 - x0 + 1, y1 - y0 + 1); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xbf9d64, roughness: 1 }));
      m.position.set((x0 + x1) / 2, 0.015, -(y0 + y1) / 2); this.scene.add(m);
    }
  }

  // ---- 標記（範圍圈、保護外框等，M3 會用）----
  clearMarkers() { while (this.markers.children.length) { const c = this.markers.children.pop(); c.geometry?.dispose(); } }
  circle(center, radius, color, opacity = 0.9, y = 0.05, dashed = false) {
    const pts = []; const n = 72;
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; pts.push(new THREE.Vector3(center[0] + Math.cos(a) * radius, y, -(center[1] + Math.sin(a) * radius))); }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.6, gapSize: 0.4, transparent: true, opacity }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const line = new THREE.Line(g, m); if (dashed) line.computeLineDistances();
    this.markers.add(line); return line;
  }
  disc(center, radius, color, opacity = 0.12, y = 0.03) {
    const g = new THREE.CircleGeometry(radius, 48); g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    mesh.position.set(center[0], y, -center[1]); this.markers.add(mesh); return mesh;
  }
  /** 物件外框（受規則保護）。 */
  outline(id, color, size = 1.2, h = 2.2) {
    const n = this.nodes.get(id); if (!n) return null;
    const house = id.startsWith('house_');
    if (house) { size = 4.3; h = 2.6; }
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(size, h, size));
    const box = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    box.position.set(n.position.x - (house ? 0.5 : 0), h / 2, n.position.z + (house ? 0.5 : 0)); this.markers.add(box); return box;
  }
  /** 角色頭頂的小標記（顏色方塊／箭頭）。 */
  tag(cell, color, h = 2.4, size = 0.35) {
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(size), new THREE.MeshBasicMaterial({ color }));
    mesh.position.copy(toWorld(cell, h)); this.markers.add(mesh); return mesh;
  }
  cellBox(cell, color, opacity = 0.35, y = 0.04) {
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    mesh.position.set(cell[0], y, -cell[1]); this.markers.add(mesh); return mesh;
  }
  /** 把畫面座標轉成格子（給 debug 用）。 */
  project(cell, h = 1) { const v = toWorld(cell, h).project(this.camera); return [(v.x + 1) / 2 * this.canvas.clientWidth, (1 - v.y) / 2 * this.canvas.clientHeight]; }
}
