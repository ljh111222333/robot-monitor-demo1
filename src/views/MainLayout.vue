<script setup lang="ts">
import http from '@/utils/http';
/**
 * 组件--------------------------------------------------------------------------
 */
import ThreeViewport from '@/components/ThreeViewport.vue';
import ControlPanel from '@/components/ControlPanel.vue';
import LogPanel from '@/components/LogPanel.vue';
import type { RobotInfo } from '@/types/robot.d.ts';

const sceneReady = ref(false);
const initializationError = ref('');

const robotList = ref<RobotInfo[]>([]);
const currentRobotId = ref<number | null>(null);
const currentRobot = computed<RobotInfo | null>(
	() => robotList.value.find((robot) => robot.id === currentRobotId.value) || null,
);
provide<ComputedRef<RobotInfo | null>>('currentRobot', currentRobot);

onMounted(() => {
	http.get('/api/robot/list').then((res) => {
		if (res.status !== 1000) {
			initializationError.value = res.data.message;
			return;
		}
		console.log('robotList', res.data);
		robotList.value = res.data.robots;
		currentRobotId.value = robotList.value[0].id;
	});
});
</script>

<template>
	<ThreeViewport ref="viewportRef" @ready="sceneReady = true" @error="initializationError = $event" />

	<ControlPanel ref="controlPanelRef" :disabled="!sceneReady" />

	<LogPanel />

	<div v-if="initializationError" class="error-overlay">
		{{ initializationError }}
	</div>
</template>

<style lang="scss" scoped></style>
