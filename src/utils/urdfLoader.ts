import URDFLoader, { type URDFRobot } from 'urdf-loader';

// 封装加载函数
export async function loadUrdf(urdfPath: string): Promise<URDFRobot> {
	return new Promise<URDFRobot>((resolve, reject) => {
		const loader = new URDFLoader();

		// 关键：映射 package 包名到 public 静态资源路径
		loader.packages = {
			ur_description: '/robots_asset/ur5/',
		};

		loader.load(
			urdfPath,
			(robotObj) => {
				// UR5 模型经常是倒置，修正朝向
				robotObj.rotation.x = Math.PI / 2;
				resolve(robotObj);
			},
			undefined,
			// 错误捕获
			(err) => {
				reject(err);
			},
		);
	});
}
