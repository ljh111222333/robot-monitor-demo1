<template>
  <div ref="canvasContainer" class="three-viewport"></div>
</template>

<script setup lang="ts">
import { Scene } from "@/core/Scene";
import type { SceneOptions } from "@/core/Scene";
import { Robot } from "@/core/Robot";
import * as THREE from "three";
import gsap from "gsap";
import {
  emitter,
  type ControlViewportEvent,
  type ViewInType,
} from "@/events/eventBus";

import { useSettingStore } from "@/stores/settingStore";
const settingStore = useSettingStore();
import { useLogStore } from "@/stores/logStore";
const logStore = useLogStore();

const props = defineProps<{
  sceneOptions?: SceneOptions;
}>();
const emit = defineEmits<{
  (e: "ready"): void;
  (e: "error", error: string): void;
}>();

/**
 * canvas容器------------------------------------------------------------------
 */
const canvasRef = useTemplateRef<HTMLElement | null>("canvasContainer");
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
  if (!canvasRef.value) return console.error("canvasRef is not found");
  scene = new Scene(canvasRef.value, settingStore, props.sceneOptions);
  robot = new Robot(
    scene,
    `${import.meta.env.BASE_URL}robots_asset/ur5_pybullet.urdf`,
  );
  logStore.add("info", "系统初始化开始...");
  try {
    await robot.load();
    logStore.add("success", "机器人加载成功");
    if (disposed) return;
    const { robotBoxCenter } = robot.getEndEffectorPosition();
    settingStore.cameraConfig.defaultPos = robotBoxCenter
      .clone()
      .add(settingStore.cameraConfig.offsetPos);
    settingStore.controlsConfig.defaultTarget = robotBoxCenter;
    scene.setCenter({
      controlsTarget: settingStore.controlsConfig.defaultTarget,
      cameraPos: settingStore.cameraConfig.defaultPos,
    });
    logStore.add("success", "视野重置成功");
    emit("ready");
    animationFrameId = requestAnimationFrame(render);
    emitter.on("conrol-viewport", emitHandler);
  } catch (error) {
    console.error(error);
    emit("error", error instanceof Error ? error.message : String(error));
  }
});

onUnmounted(() => {
  disposed = true;
  cancelAnimationFrame(animationFrameId);
  emitter.off("conrol-viewport", emitHandler);

  robot?.dispose();
  scene?.dispose();
  robot = null;
  scene = null;
});

const emitHandler = (event: ControlViewportEvent): void => {
  switch (event.e) {
    case "bgColorChange":
      setBgColor(event.val);
      break;

    case "openAxesHelper":
      scene?.setHelpersVisible(event.val);
      break;

    case "viewMethodChange":
      doMoveCamera(event.val);
      break;

    case "logPosition":
      logCameraState();
      break;
  }
};
/**
 * 控制方法------------------------------
 */
const doMoveCamera = (type: ViewInType) => {
  switch (type) {
    case "default":
      moveCamera(
        settingStore.cameraConfig.defaultPos,
        settingStore.controlsConfig.defaultTarget,
      );
      break;

    case "front":
      moveCamera(
        new THREE.Vector3(0.352016, 0.054589, -1.519072),
        settingStore.controlsConfig.defaultTarget,
      );
      break;

    case "top":
      const epsilon = 0.0001; // 极小偏移量，避免 phi=0 奇点
      moveCamera(
        new THREE.Vector3(0.391405, 1.67135, epsilon),
        settingStore.controlsConfig.defaultTarget,
      );
      break;

    case "side":
      moveCamera(
        new THREE.Vector3(1.503648, 0.961253, -0.062626),
        settingStore.controlsConfig.defaultTarget,
      );
      break;
  }
};
const cameraSpeed = 3;
const targetSpeed = 4;
const POSITION_EPSILON = 1e-4;
const moveCamera = (position: THREE.Vector3, target: THREE.Vector3): void => {
  const camera = scene?.getCamera();
  const controls = scene?.getControls();

  if (camera && controls) {
    const nextPosition = position.clone();
    const nextTarget = target.clone();

    const cameraDistance = camera.position.distanceTo(nextPosition);
    const targetDistance = controls.target.distanceTo(nextTarget);

    const shouldMoveCamera = cameraDistance > POSITION_EPSILON;
    const shouldMoveTarget = targetDistance > POSITION_EPSILON;

    const cameraDuration = shouldMoveCamera ? cameraDistance / cameraSpeed : 0;
    const targetDuration = shouldMoveTarget ? targetDistance / targetSpeed : 0;
    const rawDuration = Math.max(cameraDuration, targetDuration);
    const duration =
      rawDuration === 0 ? 0 : THREE.MathUtils.clamp(rawDuration, 0.3, 2);
    console.log("camera transition", {
      cameraDistance,
      targetDistance,
      shouldMoveCamera,
      shouldMoveTarget,
      cameraDuration,
      targetDuration,
      duration,
    });

    console.log("gsap camera move use duration====", {
      cameraDistance,
      targetDistance,
      cameraDuration,
      targetDuration,
      rawDuration,
      duration,
    });

    const currentOffset = camera.position.clone().sub(controls.target);
    const nextOffset = nextPosition.clone().sub(nextTarget);
    const currentSpherical = new THREE.Spherical().setFromVector3(
      currentOffset,
    );
    const nextSpherical = new THREE.Spherical().setFromVector3(nextOffset);
    console.log("orbit transition", {
      current: {
        theta: THREE.MathUtils.radToDeg(currentSpherical.theta),
        phi: THREE.MathUtils.radToDeg(currentSpherical.phi),
        radius: currentSpherical.radius,
      },
      next: {
        theta: THREE.MathUtils.radToDeg(nextSpherical.theta),
        phi: THREE.MathUtils.radToDeg(nextSpherical.phi),
        radius: nextSpherical.radius,
      },
    });

    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);
    const finishTransition = (): void => {
      camera.position.copy(nextPosition);
      controls.target.copy(nextTarget);
      controls.enabled = true;
      controls.update();
    };
    if (!shouldMoveCamera && !shouldMoveTarget) {
      finishTransition();
      return;
    }

    const timeline = gsap.timeline({
      onComplete: finishTransition,
    });
    if (shouldMoveCamera) {
      timeline.to(
        camera.position,
        {
          x: nextPosition.x,
          y: nextPosition.y,
          z: nextPosition.z,
          duration,
          ease: "power2.inOut",
        },
        0,
      );
    } else {
      camera.position.copy(nextPosition);
    }

    if (shouldMoveTarget) {
      timeline.to(
        controls.target,
        {
          x: nextTarget.x,
          y: nextTarget.y,
          z: nextTarget.z,
          duration,
          ease: "power2.inOut",
        },
        0,
      );
    } else {
      // 目标没有实际移动，不创建 GSAP tween，只消除微小浮点误差。
      controls.target.copy(nextTarget);
    }
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
const logCameraState = (): void => {
  const camera = scene?.getCamera();
  const controls = scene?.getControls();

  if (!camera || !controls) {
    console.warn("Scene 尚未初始化，无法读取相机状态");
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
    "当前相机状态",
    caremaPositionInfo,
    `camera position: new THREE.Vector3(${worldPosition
      .toArray()
      .map((value) => value.toFixed(6))
      .join(", ")})`,
  );
  logStore.add("info", "当前相机状态" + JSON.stringify(caremaPositionInfo));

  const controlPositionInfo = {
    target: target.toArray(),
    enabled: controls.enabled,
    minDistance: controls.minDistance,
    maxDistance: controls.maxDistance,
    azimuthAngle: controls.getAzimuthalAngle(),
    polarAngle: controls.getPolarAngle(),
  };
  console.log(
    "当前控制器状态",
    controlPositionInfo,
    `controls target: new THREE.Vector3(${target
      .toArray()
      .map((value) => value.toFixed(6))
      .join(", ")})`,
  );
  console.log(
    "控制器默认状态",
    `controls target: new THREE.Vector3(${settingStore.controlsConfig.defaultTarget
      .toArray()
      .map((value) => value.toFixed(6))
      .join(", ")})`,
  );
  //   logStore.add("info", "当前控制器状态" + JSON.stringify(controlPositionInfo));
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
