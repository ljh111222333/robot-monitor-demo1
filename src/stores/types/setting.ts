import * as THREE from 'three';

export interface BackgroundConfig {
	color: string;
}
export const defauleBackground = (): BackgroundConfig => ({
	color: '#efefef',
});

export interface CameraConfig {
	defaultPos: THREE.Vector3;
	offsetPos: THREE.Vector3;
}
export const defaultCamera = (): CameraConfig => ({
	defaultPos: new THREE.Vector3(1.82, 2.19, -1.57),
	offsetPos: new THREE.Vector3(1.82, 0.52, -1.57),
});

export interface ControlsConfig {
	defaultTarget: THREE.Vector3;
}
export const defaultControls = (): ControlsConfig => ({
	defaultTarget: new THREE.Vector3(0, 1.67, 0),
});
