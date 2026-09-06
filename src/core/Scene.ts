import * as THREE from 'three';
import Stats from 'stats-gl';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useSettingStore } from '@/stores/settingStore';
import { debounce } from 'lodash-es';

export interface SceneOptions {
	canvasClassName?: string;
}
export class Scene {
	private readonly scene: THREE.Scene;
	private readonly camera: THREE.PerspectiveCamera;
	private readonly renderer: THREE.WebGLRenderer;
	private readonly sceneContainer: HTMLElement;
	private readonly stats: Stats;
	public readonly controls: OrbitControls;
	private resizeObserver: ResizeObserver | undefined;
	private settingStore: ReturnType<typeof useSettingStore>;
	private readonly helperGroup = new THREE.Group();

	constructor(
		sceneContainer: HTMLElement,
		settingStore: ReturnType<typeof useSettingStore>,
		options: SceneOptions = {},
	) {
		this.sceneContainer = sceneContainer;
		this.settingStore = settingStore;

		// 创建场景
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(
			this.settingStore.backgroundConfig.color,
		);

		const containerWidth = sceneContainer.clientWidth;
		const containerHeight = sceneContainer.clientHeight;
		// 创建相机
		this.camera = new THREE.PerspectiveCamera(
			55,
			containerWidth / containerHeight,
			0.5,
			500,
		);
		this.camera.position.copy(this.settingStore.cameraConfig.defaultPos);

		// 创建渲染器
		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setSize(containerWidth, containerHeight);
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;
		this.renderer.domElement.classList.add(
			options.canvasClassName || 'sceneCanvans',
		);
		// 添加到容器
		this.sceneContainer.appendChild(this.renderer.domElement);

		// 创建camera控制器
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.target.copy(this.settingStore.controlsConfig.defaultTarget);
		this.controls.enablePan = false;
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.05;
		this.controls.maxPolarAngle = Math.PI / 2;

		// 创建性能监控
		this.stats = new Stats({ trackGPU: true });
		this.stats.init(this.renderer);
		this.stats.addTexturePanel('RT');
		this.stats.dom.style.position = 'absolute';
		this.stats.dom.style.top = '0px';
		this.stats.dom.style.left = '0px';
		// 添加到容器
		this.sceneContainer.appendChild(this.stats.dom);

		// 设置光照
		this.setupLighting();

		// 设置阴影
		this.setupShadow();

		// 设置网格
		this.setupGrid();

		// 绑定事件
		this.bindEvents();
	}

	// 环境光
	private setupLighting(): void {
		const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
		this.scene.add(ambientLight);

		// 方向光
		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
		directionalLight.position.set(10, 10, 5);
		directionalLight.castShadow = true;
		directionalLight.shadow.camera.near = 1;
		directionalLight.shadow.camera.far = 50;
		directionalLight.shadow.mapSize.width = 1024;
		directionalLight.shadow.mapSize.height = 1024;
		this.scene.add(directionalLight);

		// 点光源
		const pointLight = new THREE.PointLight(0xffffff, 0.5);
		pointLight.position.set(-10, 10, -10);
		this.scene.add(pointLight);
	}

	private setupShadow(): void {
		const plane = new THREE.Mesh(
			new THREE.PlaneGeometry(10, 10),
			new THREE.ShadowMaterial({
				opacity: 0.2,
			}),
		);
		plane.rotation.x = -Math.PI / 2;
		plane.position.y = 0.001;
		plane.receiveShadow = true;
		this.scene.add(plane);
	}

	private setupGrid(): void {
		const grid = new THREE.Group();
		this.scene.add(grid);
		const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x888888);
		const axesHelper = new THREE.AxesHelper(5);
		axesHelper.position.set(0, 0.001, 0);

		this.helperGroup.add(gridHelper, axesHelper);
		this.helperGroup.visible = false;
		this.scene.add(this.helperGroup);
	}
	setHelpersVisible(visible: boolean): void {
		this.helperGroup.visible = visible;
	}

	// 尺寸更新
	private bindEvents(): void {
		if (!this.sceneContainer) return console.warn('sceneContainer is gone');

		if (this.resizeObserver) return console.warn('resizeObserver is observed');

		this.resizeObserver = new ResizeObserver(([entry]) => {
			const { width, height } = entry.contentRect;
			this.debounceResize(width, height);
		});

		this.resizeObserver.observe(this.sceneContainer);
	}
	private debounceResize = debounce((width: number, height: number) => {
		console.log('debounceResize is trigger', { width, height });
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);
	}, 300);

	// 设置视觉中心
	setCenter({
		cameraPos,
		controlsTarget,
	}: {
		cameraPos: THREE.Vector3;
		controlsTarget: THREE.Vector3;
	}) {
		this.controls.target.copy(controlsTarget);
		this.camera.position.copy(cameraPos);

		this.update();
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

	getScene(): THREE.Scene {
		return this.scene;
	}

	getCamera(): THREE.PerspectiveCamera {
		return this.camera;
	}

	getControls(): OrbitControls {
		return this.controls;
	}

	getRenderer(): THREE.WebGLRenderer {
		return this.renderer;
	}

	getStats(): Stats {
		return this.stats;
	}

	private disposeSceneResources(): void {
		const disposedGeometries = new Set<THREE.BufferGeometry>();
		const disposedMaterials = new Set<THREE.Material>();
		const disposedTextures = new Set<THREE.Texture>();

		this.scene.traverse((object) => {
			const renderable = object as THREE.Object3D & {
				geometry?: THREE.BufferGeometry;
				material?: THREE.Material | THREE.Material[];
			};

			if (renderable.geometry && !disposedGeometries.has(renderable.geometry)) {
				disposedGeometries.add(renderable.geometry);
				renderable.geometry.dispose();
			}

			const materials = Array.isArray(renderable.material)
				? renderable.material
				: renderable.material
					? [renderable.material]
					: [];
			for (const material of materials) {
				if (disposedMaterials.has(material)) continue;
				disposedMaterials.add(material);

				for (const value of Object.values(material)) {
					if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
						disposedTextures.add(value);
						value.dispose();
					}
				}
				material.dispose();
			}
		});

		for (const texture of [this.scene.background, this.scene.environment]) {
			if (texture instanceof THREE.Texture && !disposedTextures.has(texture)) {
				disposedTextures.add(texture);
				texture.dispose();
			}
		}
	}

	dispose(): void {
		this.resizeObserver?.disconnect();
		this.resizeObserver = undefined;
		this.debounceResize.cancel();

		this.disposeSceneResources();
		this.scene.background = null;
		this.scene.environment = null;
		this.scene.clear();
		this.camera.removeFromParent();
		this.camera.clear();

		this.controls.dispose();
		this.stats.dispose();
		this.renderer.renderLists.dispose();
		this.renderer.dispose();

		this.stats.dom.remove();
		this.renderer.domElement.remove();
	}
}
