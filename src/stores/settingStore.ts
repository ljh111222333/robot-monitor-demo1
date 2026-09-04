import type {
	BackgroundConfig,
	CameraConfig,
	ControlsConfig,
} from './types/setting';
import {
	defauleBackground,
	defaultCamera,
	defaultControls,
} from './types/setting';

export const useSettingStore = defineStore(
	'setting',
	() => {
		const backgroundConfig = ref<BackgroundConfig>(defauleBackground());
		const cameraConfig = ref<CameraConfig>(defaultCamera());
		const controlsConfig = ref<ControlsConfig>(defaultControls());

		return {
			backgroundConfig,
			cameraConfig,
			controlsConfig,
		};
	},
	{
		persist: true,
	},
);
