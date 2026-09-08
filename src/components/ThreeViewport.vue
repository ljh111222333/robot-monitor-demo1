<template>
	<div ref="canvasContainer" class="three-viewport"></div>
</template>

<script setup lang="ts">
import { Scene } from '@/core/Scene';
import type { SceneOptions } from '@/core/Scene';
import { Robot } from '@/core/Robot';
import * as THREE from 'three';
import gsap from 'gsap';
import { emitter, type ControlViewportEvent, type ViewInType } from '@/events/eventBus';

import { useSettingStore } from '@/stores/settingStore';
const settingStore = useSettingStore();
import { useLogStore } from '@/stores/logStore';
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

const emitHandler = (event: ControlViewportEvent): void => {
	switch (event.e) {
		case 'bgColorChange':
			setBgColor(event.val);
			break;

		case 'openAxesHelper':
			scene?.setHelpersVisible(event.val);
			break;

		case 'viewMethodChange':
			doMoveCamera(event.val);
			break;

		case 'logPosition':
			logCameraState();
			break;
	}
};
/**
 * 控制方法------------------------------
 */
const doMoveCamera = (type: ViewInType) => {
	switch (type) {
		case 'default':
			moveCamera(settingStore.cameraConfig.defaultPos, settingStore.controlsConfig.defaultTarget);
			break;

		case 'front':
			moveCamera(new THREE.Vector3(0.3405, 0.054589, -1.949387), settingStore.controlsConfig.defaultTarget);
			break;

		case 'top':
			// const epsilon = -0.0001; // 极小偏移量，避免 phi=0 奇点
			moveCamera(new THREE.Vector3(0.391409, 2.006789, -0.04718), settingStore.controlsConfig.defaultTarget);
			break;

		case 'side':
			moveCamera(new THREE.Vector3(2.364312, 0.941525, -0.045386), settingStore.controlsConfig.defaultTarget);
			break;
	}
};
// 这些速度用于估算时长；使用缓动后，并不是严格的匀速运动。
const cameraSpeed = 3;
const targetSpeed = 4;
const angularSpeed = THREE.MathUtils.degToRad(90);

// 位置阈值使用场景单位，角度阈值使用弧度。
const POSITION_EPSILON = 1e-4;
const ANGLE_EPSILON = 1e-4;
const POLE_ANGLE_EPSILON = 1e-3;

// timeline指针
let cameraTimeline: gsap.core.Timeline | null = null;
const moveCamera = (position: THREE.Vector3, target: THREE.Vector3): void => {
	if (!scene || disposed) return;

	// 先取消旧动画，让旧动画恢复控件配置，再记录本次状态。
	cameraTimeline?.kill();
	cameraTimeline = null;

	const camera = scene?.getCamera();
	const controls = scene?.getControls();

	const startPosition = camera.position.clone();
	const startTarget = controls.target.clone();
	const nextTarget = target.clone();
	// 第一步：将相机相对目标的偏移转换为球坐标。
	const orbit = new THREE.Spherical().setFromVector3(startPosition.clone().sub(startTarget));
	const nextOrbit = new THREE.Spherical().setFromVector3(position.clone().sub(nextTarget));

	// 第二步：让动画终点先满足控件限制，避免每帧再被强行修正。
	nextOrbit.radius = THREE.MathUtils.clamp(nextOrbit.radius, controls.minDistance, controls.maxDistance);
	nextOrbit.phi = THREE.MathUtils.clamp(nextOrbit.phi, controls.minPolarAngle, controls.maxPolarAngle);
	nextOrbit.makeSafe();

	// 顶视附近沿用当前水平角，避免极小的水平偏移引起额外旋转。
	if (nextOrbit.phi < POLE_ANGLE_EPSILON) {
		nextOrbit.theta = orbit.theta;
	}

	// 将水平角差归一到 [-π, π]，选择最短旋转路径。
	const thetaDelta = Math.atan2(Math.sin(nextOrbit.theta - orbit.theta), Math.cos(nextOrbit.theta - orbit.theta));
	nextOrbit.theta = orbit.theta + thetaDelta;

	const phiDelta = nextOrbit.phi - orbit.phi;
	const radiusDelta = nextOrbit.radius - orbit.radius;
	// 使用经过角度、距离限制修正后的真实终点计算位移。
	const endPosition = new THREE.Vector3().setFromSpherical(nextOrbit).add(nextTarget);

	const cameraDistance = startPosition.distanceTo(endPosition);
	const targetDistance = startTarget.distanceTo(nextTarget);

	// 阈值拦截
	const hasPositionChange = cameraDistance > POSITION_EPSILON || targetDistance > POSITION_EPSILON;
	const hasAngleChange = Math.abs(thetaDelta) > ANGLE_EPSILON || Math.abs(phiDelta) > ANGLE_EPSILON;

	if (!hasPositionChange && !hasAngleChange) return;
	// 第四步：先计算时长，供下面创建 timeline 使用。
	const rawDuration = Math.max(
		cameraDistance / cameraSpeed,
		targetDistance / targetSpeed,
		Math.abs(radiusDelta) / cameraSpeed,
		Math.abs(thetaDelta) / angularSpeed,
		Math.abs(phiDelta) / angularSpeed,
	);

	// 保留下限，不再用 2 秒上限压缩较大幅度的运动。
	const duration = Math.max(0.3, rawDuration);
	const previousControls = {
		enabled: controls.enabled,
		enableDamping: controls.enableDamping,
		autoRotate: controls.autoRotate,
	};
	controls.enabled = false;
	controls.autoRotate = false;
	controls.enableDamping = false;
	console.log('[camera] 开始', {
		起点极角Deg: Number(THREE.MathUtils.radToDeg(orbit.phi).toFixed(3)),
		终点极角Deg: Number(THREE.MathUtils.radToDeg(nextOrbit.phi).toFixed(3)),
		水平转角Deg: Number(THREE.MathUtils.radToDeg(thetaDelta).toFixed(3)),
		Target需要移动: targetDistance > POSITION_EPSILON,
		时长Sec: Number(duration.toFixed(3)),
	});

	/*
	 * 关闭阻尼后调用 update，会消耗并清空残留的旋转增量。
	 * 它也可能临时改变相机位置，因此随后恢复快照并再次同步。
	 * 两次更新之间不渲染，避免清理残留增量时出现可见跳动。
	 */
	controls.update();
	camera.position.copy(startPosition);
	controls.target.copy(startTarget);
	controls.update();
	const restoreControls = (): void => {
		controls.enabled = previousControls.enabled;
		controls.enableDamping = previousControls.enableDamping;
		controls.autoRotate = previousControls.autoRotate;
		cameraTimeline = null;
	};
	// 重用偏移向量，避免在每次动画更新时创建新对象。
	const offset = new THREE.Vector3();
	// 第三步：将补间后的球坐标还原为相机位置。
	const applyOrbit = (): void => {
		offset.setFromSpherical(orbit);
		camera.position.copy(controls.target).add(offset);
	};

	cameraTimeline = gsap.timeline({
		paused: true,
		defaults: {
			duration,
			ease: 'power2.inOut',
		},
		onUpdate: applyOrbit,
		onComplete: () => {
			// 使用经过修正的球坐标终点，不再复制原始 position。
			applyOrbit();

			const beforeControlsUpdate = camera.position.clone();
			controls.update();

			console.log('[camera] 结束', {
				相机终点误差: camera.position.distanceTo(endPosition),
				Target终点误差: controls.target.distanceTo(nextTarget),
				控件额外修正量: camera.position.distanceTo(beforeControlsUpdate),
			});

			restoreControls();
		},
		onInterrupt: restoreControls,
	});

	cameraTimeline.to(
		orbit,
		{
			radius: nextOrbit.radius,
			phi: nextOrbit.phi,
			theta: nextOrbit.theta,
		},
		0,
	);
	if (targetDistance > POSITION_EPSILON) {
		// 目标位置变化时，才需要动画
		cameraTimeline.to(
			controls.target,
			{
				x: nextTarget.x,
				y: nextTarget.y,
				z: nextTarget.z,
			},
			0,
		);
	}
	cameraTimeline.play();
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
const logCameraState = (): void => {
	const camera = scene?.getCamera();
	const controls = scene?.getControls();

	if (!camera || !controls) {
		console.warn('Scene 尚未初始化，无法读取相机状态');
		return;
	}

	const worldPosition = camera.getWorldPosition(new THREE.Vector3());
	const target = controls.target.clone();

	const caremaPositionInfo = {
		position: worldPosition.toArray(),
		target: target.toArray(),
		distance: worldPosition.distanceTo(target),
		rotation: camera.rotation.toArray(),
		quaternion: camera.quaternion.toArray(),
		fov: camera instanceof THREE.PerspectiveCamera ? camera.fov : undefined,
		zoom: camera.zoom,
	};
	console.log(
		'当前相机状态',
		caremaPositionInfo,
		`camera position: new THREE.Vector3(${worldPosition
			.toArray()
			.map((value) => value.toFixed(6))
			.join(', ')})`,
	);
	logStore.add('info', '当前相机状态' + JSON.stringify(caremaPositionInfo));

	const controlPositionInfo = {
		target: target.toArray(),
		enabled: controls.enabled,
		minDistance: controls.minDistance,
		maxDistance: controls.maxDistance,
		azimuthAngle: controls.getAzimuthalAngle(),
		polarAngle: controls.getPolarAngle(),
	};
	console.log(
		'当前控制器状态',
		controlPositionInfo,
		`controls target: new THREE.Vector3(${target
			.toArray()
			.map((value) => value.toFixed(6))
			.join(', ')})`,
	);
	console.log(
		'控制器默认状态',
		`controls target: new THREE.Vector3(${settingStore.controlsConfig.defaultTarget
			.toArray()
			.map((value) => value.toFixed(6))
			.join(', ')})`,
	);
	//   logStore.add("info", "当前控制器状态" + JSON.stringify(controlPositionInfo));
};

/**
 * 生命周期------------------------------------------------
 */
onMounted(async () => {
	if (!canvasRef.value) return console.error('canvasRef is not found');
	scene = new Scene(canvasRef.value, settingStore, props.sceneOptions);
	robot = new Robot(scene, `${import.meta.env.BASE_URL}robots_asset/ur5_pybullet.urdf`);
	logStore.add('info', '系统初始化开始...');
	try {
		await robot.load();
		logStore.add('success', '机器人加载成功');
		if (disposed) return;
		const { robotBoxCenter } = robot.getEndEffectorPosition();
		settingStore.cameraConfig.defaultPos = robotBoxCenter.clone().add(settingStore.cameraConfig.offsetPos);
		settingStore.controlsConfig.defaultTarget = robotBoxCenter;
		scene.setCenter({
			controlsTarget: settingStore.controlsConfig.defaultTarget,
			cameraPos: settingStore.cameraConfig.defaultPos,
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

	// 先停止动画，避免后续回调继续访问已销毁的相机和控件。
	cameraTimeline?.kill();
	cameraTimeline = null;
	robot?.dispose();
	scene?.dispose();
	robot = null;
	scene = null;
});

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
