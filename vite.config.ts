import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');

	return {
		base: env.VITE_BASE_URL,
		plugins: [vue()],
		server: {
			// 明确绑定 IPv4，避免 Windows 将 localhost 优先解析到不可用的 IPv6 ::1。
			host: '127.0.0.1',
			port: 6600,
			open: true,
		},
		resolve: {
			// 路径别名
			alias: {
				'@': resolve(import.meta.dirname, './src'),
			},
		},
		build: {
			// 启用代码分割
			rolldownOptions: {
				output: {
					codeSplitting: {
						groups: [
							{
								// Three.js 相关库
								name: 'three',
								test: /node_modules[\\/]three[\\/]/,
							},
							{
								// 常用库单独打包
								name: 'libs',
								test: /node_modules[\\/]gsap[\\/]/,
							},
						],
					},
					// 把非入口chunk打包到js/目录下
					chunkFileNames: (chunkInfo) => {
						const facadeModuleId = chunkInfo.facadeModuleId;
						if (facadeModuleId) {
							const fileName = facadeModuleId
								.split('/')
								.pop()
								?.replace('.ts', '');
							return `js/${fileName}-[hash].js`;
						}
						return 'js/[name]-[hash].js';
					},
					// 资源文件夹分类
					assetFileNames: (assetInfo) => {
						const info = assetInfo.names || [];
						const ext = info[info.length - 1];
						if ((assetInfo.names || []).some((name) => name.endsWith('.css'))) {
							return `css/[name]-[hash].${ext}`;
						}
						if (
							(assetInfo.names || []).some(
								(name) =>
									name.endsWith('.png') ||
									name.endsWith('.jpg') ||
									name.endsWith('.svg') ||
									name.endsWith('.gif') ||
									name.endsWith('.tiff') ||
									name.endsWith('.bmp') ||
									name.endsWith('.ico'),
							)
						) {
							return `images/[name]-[hash].${ext}`;
						}
						return `assets/[name]-[hash].${ext}`;
					},
				},
			},
		},
		css: {
			preprocessorOptions: {
				scss: {
					charset: false,
				},
			},
		},
	};
});
