import { Pane } from 'tweakpane';
import { Scene } from '../core/Scene';
import * as THREE from 'three';
import { useSettingStore } from '@/stores/settingStore';
import gsap from 'gsap';

export class ControlPanel {
	private readonly pane: Pane;
	private scene: Scene | null = null;
	private static instance: ControlPanel | null = null;
	private settingStore: ReturnType<typeof useSettingStore>;

	constructor(settingStore: ReturnType<typeof useSettingStore>) {
		this.pane = new Pane({
			title: 'Robot Arm Simulator',
		});
		this.settingStore = settingStore;
	}

	public static getInstance(
		settingStore: ReturnType<typeof useSettingStore>,
	): ControlPanel {
		if (!ControlPanel.instance) {
			ControlPanel.instance = new ControlPanel(settingStore);
		}
		return ControlPanel.instance;
	}

	// 销毁实例，清理资源
	public static destroyInstance(): void {
		if (ControlPanel.instance) {
			ControlPanel.instance.pane.dispose();

			ControlPanel.instance = null;
		}
	}

	getPane(): Pane {
		return this.pane;
	}

	// 绑定 Scene
	public bindScene(scene: Scene): void {
		this.scene = scene;
		// 添加相机控制
		const cameraFolder = this.pane.addFolder({
			title: 'Camera Control',
		});

		const cameraConfig = { view: 'DEFAULT' };
		const cameraBinding = cameraFolder.addBinding(cameraConfig, 'view', {
			view: 'list',
			label: '视角',
			options: [
				{ text: 'default', value: 'DEFAULT' },
				{ text: 'front', value: 'FRONT' },
				{ text: 'top', value: 'TOP' },
				{ text: 'side', value: 'SIDE' },
			],
		});

		cameraBinding.on('change', (ev) => {
			this.handleCameraViewChange(ev.value);
		});
	}

	// 处理相机视角变化
	private handleCameraViewChange(view: string): void {
		if (!this.scene) return;

		switch (view) {
			case 'DEFAULT':
				this.setMainView();
				break;
			case 'FRONT':
				this.setFrontView();
				break;
			case 'TOP':
				this.setTopView();
				break;
			case 'SIDE':
				this.setSideView();
				break;
		}
	}

	private setFrontView(): void {
		this.moveCamera(
			new THREE.Vector3(0, 1.5, 5),
			this.settingStore.controlsConfig.defaultTarget,
		);
	}

	private setMainView(): void {
		this.moveCamera(
			this.settingStore.cameraConfig.defaultPos,
			this.settingStore.controlsConfig.defaultTarget,
		);
	}

	private setTopView(): void {
		const epsilon = 0.0001; // 极小偏移量，避免 phi=0 奇点
		this.moveCamera(
			new THREE.Vector3(0, 10, epsilon),
			this.settingStore.controlsConfig.defaultTarget,
		);
	}

	private setSideView(): void {
		this.moveCamera(
			new THREE.Vector3(5, 1.5, 0),
			this.settingStore.controlsConfig.defaultTarget,
		);
	}

	private moveCamera(position: THREE.Vector3, target: THREE.Vector3): void {
		const camera = this.scene?.getCamera();
		const controls = this.scene?.getControls();
		if (camera && controls) {
			gsap.killTweensOf(camera);
			gsap.killTweensOf(controls);
			controls.enabled = false;
			gsap.to(camera.position, {
				x: position.x,
				y: position.y,
				z: position.z,
				duration: 1,
				ease: 'power2.inOut',
			});
			gsap.to(controls.target, {
				x: target.x,
				y: target.y,
				z: target.z,
				duration: 1,
				ease: 'power2.inOut',
				onComplete: () => {
					controls.enabled = true;
				},
			});
		}
	}
}
