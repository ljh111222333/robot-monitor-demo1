<script setup lang="ts">
/**
 * 组件--------------------------------------------------------------------------
 */
import ThreeViewport from '@/components/ThreeViewport.vue';
import ControlPanel from '@/components/ControlPanel.vue';
import LogPanel from '@/components/LogPanel.vue';

const viewportRef = useTemplateRef<InstanceType<typeof ThreeViewport> | null>(
	'viewportRef',
);

const sceneReady = ref(false);
const initializationError = ref('');
</script>

<template>
	<ThreeViewport
		ref="viewportRef"
		@ready="sceneReady = true"
		@error="initializationError = $event"
	/>

	<ControlPanel :disabled="!sceneReady" />

	<LogPanel />

	<div v-if="initializationError" class="error-overlay">
		{{ initializationError }}
	</div>
</template>

<style lang="scss" scoped></style>
