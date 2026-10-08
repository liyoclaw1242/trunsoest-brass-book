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
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a3328);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    this.viewHeight = 26;              // 畫面縱向看得到幾格
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x55604a, 2.6));
    const sun = new THREE.DirectionalLight(0xfff2dc, 3.2); sun.position.set(20, 40, 25); this.scene.add(sun);
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
    for (const node of root.children) {
      if (node.name === 'ground') continue;
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
    if (snap) this.camTarget.copy(t); else this.camTarget.lerp(t, 0.15);
    this.camera.position.set(this.camTarget.x, this.camTarget.y + CAM_DIST * Math.sin(PITCH), this.camTarget.z + CAM_DIST * Math.cos(PITCH));
    this.camera.lookAt(this.camTarget);
  }
  render() { this.renderer.render(this.scene, this.camera); }

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
  project(cell) { const v = toWorld(cell, 1).project(this.camera); return [(v.x + 1) / 2 * this.canvas.clientWidth, (1 - v.y) / 2 * this.canvas.clientHeight]; }
}
