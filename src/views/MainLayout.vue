<script setup lang="ts">
/**
 * 组件--------------------------------------------------------------------------
 */
import ThreeViewport from '@/components/ThreeViewport.vue';
import ControlPanel from '@/components/ControlPanel.vue';
import LogPanel from '@/components/LogPanel.vue';

const sceneReady = ref(false);
const initializationError = ref('');
</script>

<template>
	<ThreeViewport
		ref="viewportRef"
		@ready="sceneReady = true"
		@error="initializationError = $event"
	/>

	<ControlPanel ref="controlPanelRef" :disabled="!sceneReady" />

	<LogPanel />

	<div v-if="initializationError" class="error-overlay">
		{{ initializationError }}
	</div>
</template>

<style lang="scss" scoped></style>
