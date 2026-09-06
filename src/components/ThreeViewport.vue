<template>
	<div ref="canvasContainer" class="three-viewport"></div>
</template>

<script setup lang="ts">
import { Scene } from '@/core/Scene';
import type { SceneOptions } from '@/core/Scene';
import { Robot } from '@/core/Robot';
import * as THREE from 'three';
import gsap from 'gsap';

import { useSettingStore } from '@/stores/settingStore';
const settingStore = useSettingStore();
import { useLogStore } from '@/stores/logStore';
import { emitter, type ControlViewportEvent } from '@/events/eventBus';
const logStore = useLogStore();

const props = defineProps<{
	sceneOptions?: SceneOptions;
}>();
const emit = defineEmits<{
	(e: 'ready'): void;
	(e: 'error', error: string): void;
}>();

/**
 * canvas容器------------------------------------------------------------------
 */
const canvasRef = useTemplateRef<HTMLElement | null>('canvasContainer');
let scene: Scene | null = null;
let robot: Robot | null = null;
let animationFrameId = 0;
let disposed = false;
const render = () => {
	if (disposed || !scene) return;
	scene.update();
	animationFrameId = requestAnimationFrame(render);
};

/**
 * 生命周期------------------------------------------------
 */
onMounted(async () => {
	if (!canvasRef.value) return console.error('canvasRef is not found');
	scene = new Scene(canvasRef.value, settingStore, props.sceneOptions);
	robot = new Robot(
		scene,
		`${import.meta.env.BASE_URL}robots_asset/ur5_pybullet.urdf`,
	);
	logStore.add('info', '系统初始化开始...');
	try {
		await robot.load();
		logStore.add('success', '机器人加载成功');
		if (disposed) return;
		const { robotBoxCenter } = robot.getEndEffectorPosition();
		scene.setCenter({
			controlsTarget: robotBoxCenter,
			cameraPos: robotBoxCenter
				.clone()
				.add(settingStore.cameraConfig.offsetPos),
		});
		logStore.add('success', '视野重置成功');
		emit('ready');
		animationFrameId = requestAnimationFrame(render);
		emitter.on('conrol-viewport', emitHandler);
	} catch (error) {
		console.error(error);
		emit('error', error instanceof Error ? error.message : String(error));
	}
});

onUnmounted(() => {
	disposed = true;
	cancelAnimationFrame(animationFrameId);
	emitter.off('conrol-viewport', emitHandler);

	robot?.dispose();
	scene?.dispose();
	robot = null;
	scene = null;
});

const emitHandler = (event: ControlViewportEvent): void => {
	switch (event.e) {
		case 'bgColorChange':
			setBgColor(event.val);
			break;
		case 'openAxesHelper':
			scene?.setHelpersVisible(event.flag);
			break;
	}
};
/**
 * 控制方法------------------------------
 */
const moveCamera = (position: THREE.Vector3, target: THREE.Vector3): void => {
	const camera = scene?.getCamera();
	const controls = scene?.getControls();
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
};
const setBgColor = (color: string): void => {
	if (!scene) return;
	const sceneInstance = scene.getScene();
	if (sceneInstance.background instanceof THREE.Color) {
		sceneInstance.background.set(color);
		return;
	}
	sceneInstance.background = new THREE.Color(color);
};

/**
 * 暴露的方法-----------------------------------------------------
 */
defineExpose({});
</script>

<style lang="scss" scoped>
.three-viewport {
	width: 100%;
	height: 100%;
}
</style>
