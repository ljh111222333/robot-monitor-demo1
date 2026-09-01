import * as THREE from "three";
import Stats from "stats-gl";
import { SceneConfig } from "@/config/Scene";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class Scene {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private sceneContainer: HTMLElement;
  private stats: Stats;
  private controls: OrbitControls;

  constructor(sceneContainer: HTMLElement = window.document.body) {
    this.sceneContainer = sceneContainer;

    // 创建场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SceneConfig.background.color);

    // 创建相机
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.5,
      500,
    );
    this.camera.position.copy(SceneConfig.camera.defaultPos);

    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 添加到容器
    this.sceneContainer.appendChild(this.renderer.domElement);

    // 创建camera控制器
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(SceneConfig.controls.defaultTarget);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2;

    // 创建性能监控
    this.stats = new Stats({ trackGPU: true });
    this.stats.init(this.renderer);
    this.stats.addTexturePanel("RT");
    this.stats.dom.style.position = "absolute";
    this.stats.dom.style.top = "0px";
    this.stats.dom.style.left = "0px";
    // 添加到容器
    this.sceneContainer.appendChild(this.stats.dom);
  }

  update(_deltaTime?: number): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.stats.update();
  }

  add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  remove(object: THREE.Object3D): void {
    this.scene.remove(object);
  }
}
