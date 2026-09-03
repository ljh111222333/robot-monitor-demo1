import URDFLoader, { type URDFRobot } from 'urdf-loader';
import * as THREE from 'three';

export async function loadUrdf(url: string): Promise<URDFRobot> {
	const manager = new THREE.LoadingManager();
	const resourcesReady = new Promise<void>((resolve, reject) => {
		manager.onLoad = () => {
			resolve();
		};
		manager.onProgress = (url, loaded, total) => {
			// console.log('loading progress', {
			// 	url,
			// 	loaded,
			// 	total,
			// 	progress: loaded / total,
			// });
		};
		manager.onError = (failedUrl) => {
			reject(new Error(`资源加载失败: ${failedUrl}`));
		};
	});

	const loader = new URDFLoader(manager);
	loader.parseVisual = true;
	loader.parseCollision = false;
	const robotPromise = loader.loadAsync(url);

	const [robot] = await Promise.all([robotPromise, resourcesReady]);
	return robot;
}
