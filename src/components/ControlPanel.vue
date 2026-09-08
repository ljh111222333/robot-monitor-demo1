<template>
	<div class="control-panel">
		<!-- 主收缩器 -->
		<el-collapse :model-value="['1']">
			<el-collapse-item title="robot controler" name="1" :disabled>
				<!-- 子收缩器 -->
				<el-collapse v-model="activeNames" @change="handleChange">
					<el-collapse-item title="scene控制" name="1">
						<el-row class="controler-item">
							<el-col class="item-label" :span="8">background</el-col>
							<el-col class="item-value" :span="16">
								<el-color-picker :model-value="sceneConfig.bgColor" @change="bgColorChange" />
							</el-col>
						</el-row>

						<el-row class="controler-item">
							<el-col class="item-label" :span="8">axesHelper</el-col>
							<el-col class="item-value" :span="16">
								<el-checkbox v-model="sceneConfig.axesHelper" size="large" @change="openAxesHelper" />
							</el-col>
						</el-row>
					</el-collapse-item>

					<el-collapse-item title="camera控制" name="2">
						<el-row class="controler-item">
							<el-col class="item-label" :span="8">camera设置</el-col>
							<el-col class="item-value" :span="16">
								<el-select
									v-model="caremaConfig.viewIn"
									placeholder="Select"
									style="width: 240px"
									@change="viewMethodChange"
								>
									<el-option v-for="item in viewInOptions" :key="item.value" :label="item.label" :value="item.value" />
								</el-select>
							</el-col>
						</el-row>
					</el-collapse-item>

					<el-collapse-item title="关节控制" name="3">
						<el-row class="controler-item">
							<el-col class="item-label" :span="8">实时关节模式</el-col>
							<el-col class="item-value" :span="16">
								<!-- <el-button :type="jointConfig.jointState === 'log' ? 'info' : 'primary'" @click="toggleJointState">{{
									jointConfig.jointState === 'log' ? '切换为手动模式' : '切换为实时模式'
								}}</el-button> -->
								<el-switch
									:model-value="jointConfig.jointMode"
									class="ml-2"
									inline-prompt
									style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4949"
									active-text="实时模式"
									inactive-text="手动模式"
									active-value="log"
									inactive-value="set"
									:loading="jointConfig.modeChangeLoading"
									@change="toggleJointState"
								/>
							</el-col>
						</el-row>
						<div class="joint-controls"></div>
					</el-collapse-item>
				</el-collapse>

				<el-row justify="center" class="resetall-row">
					<el-button class="logposition-btn" @click="logPosition">输出camera位置信息</el-button>

					<el-button class="resetall-btn" @click="resetAll">恢复默认设置</el-button>
				</el-row>
			</el-collapse-item>
		</el-collapse>
	</div>
</template>

<script setup lang="ts">
import { emitter } from '@/events/eventBus';
import { useInitObj } from '@/hooks/useInitObj';
import { useSettingStore } from '@/stores/settingStore';
import type { ViewInType } from '@/events/eventBus';
import type { CollapseModelValue, CheckboxValueType } from 'element-plus';
import http from '@/utils/http';
const settingStore = useSettingStore();

const { disabled } = defineProps<{
	disabled: boolean;
}>();

/**
 * 子收缩器
 */
const activeNames = ref(['1', '2', '3']);
const handleChange = (val: CollapseModelValue) => {
	console.log(val);
};

/**
 * scene设置
 */
const { obj: sceneConfig, reset: restSceneConifg } = useInitObj<{
	bgColor: string;
	axesHelper: boolean;
}>({
	bgColor: settingStore.backgroundConfig.color,
	axesHelper: false,
});
// change触发真正的设置行为
const bgColorChange = (val: string | null) => {
	console.log('bg color changed', val);
	if (val) {
		sceneConfig.value.bgColor = val;
		emitter.emit('conrol-viewport', { e: 'bgColorChange', val });
	}
};
// 启用网格
const openAxesHelper = (flag: CheckboxValueType) => {
	emitter.emit('conrol-viewport', {
		e: 'openAxesHelper',
		val: flag === true,
	});
};

/**
 * carema设置
 */
const viewInOptions = [
	{
		value: 'default',
		label: 'default',
	},
	{
		value: 'front',
		label: 'front',
	},
	{
		value: 'top',
		label: 'top',
	},
	{
		value: 'side',
		label: 'side',
	},
];

const { obj: caremaConfig, reset: restCaremaConifg } = useInitObj<{
	viewIn: ViewInType;
}>({
	viewIn: 'default',
});
const viewMethodChange = (val: ViewInType) => {
	emitter.emit('conrol-viewport', {
		e: 'viewMethodChange',
		val,
	});
};

/**
 * 关节控制
 */
const { obj: jointConfig, reset: restJointConfig } = useInitObj<{
	jointMode: 'log' | 'set';
	modeChangeLoading: boolean;
}>({
	jointMode: 'log',
	modeChangeLoading: false,
});
const toggleJointState = async () => {
	console.log('toggleJointState', jointConfig.value.jointMode);
	jointConfig.value.modeChangeLoading = true;
	if (jointConfig.value.jointMode === 'log') {
		ElMessageBox.confirm('切换为手动模式需要先关闭实时模式，是否继续？', '提示', {
			confirmButtonText: '确定',
			cancelButtonText: '取消',
			type: 'warning',
		})
			.then(async () => {
				try {
					const res = await http.post('/api/joint/mode', {
						jointState: 'set',
					});
					if (res.status !== 1000) throw new Error('mode change error');
					ElMessage({
						type: 'success',
						message: '切换为手动模式成功',
					});
					jointConfig.value.jointMode = 'set';
				} catch (error) {
					console.error('mode change error', error);
				} finally {
					jointConfig.value.modeChangeLoading = false;
				}
			})
			.catch(() => {
				jointConfig.value.modeChangeLoading = false;
			});
	} else {
		try {
			const res = await http.post('/api/joint/mode', {
				jointState: 'log',
			});
			if (res.status !== 1000) throw new Error('mode change error');

			jointConfig.value.jointMode = 'log';
			ElMessage({
				type: 'success',
				message: '切换为实时模式成功',
			});
		} catch (error) {
			console.error('mode change error', error);
		} finally {
			jointConfig.value.modeChangeLoading = false;
		}
	}
};
/**
 * 独立按钮方法
 */
const logPosition = () => {
	emitter.emit('conrol-viewport', {
		e: 'logPosition',
	});
};
const resetAll = () => {
	restSceneConifg();
	restCaremaConifg();
};
</script>

<style lang="scss" scoped>
.control-panel {
	--el-collapse-border-color: #363637;
	--el-collapse-header-bg-color: #141414;
	--el-collapse-header-text-color: #e5eaf3;
	--el-collapse-content-bg-color: #141414;
	--el-collapse-content-text-color: #cfd3dc;
}

.control-panel {
	position: fixed;
	top: 10px;
	right: 10px;
	// background: rgba(11, 15, 24, 0.9);

	width: 300px;
	// min-height: 100px;
	border-radius: 12px;
	box-shadow:
		0 8px 32px rgba(0, 0, 0, 0.4),
		inset 0 1px 0 rgba(255, 255, 255, 0.1);
	display: flex;
	flex-direction: column;
	overflow: hidden;

	.controler-item {
		padding: 0 8px;

		.item-value,
		.item-label {
			display: flex;
			align-items: center;
		}
	}

	.resetall-row {
		display: flex;
		align-items: center;
		margin: 24px 0 16px;
	}
}

:deep(.el-collapse-item__content) {
	padding-bottom: 6px;
}

:deep(.el-collapse-item__header),
:deep(.el-collapse-item__wrap) {
	border: none;
}

:deep(.el-collapse-item__title) {
	text-align: center;
}
</style>
