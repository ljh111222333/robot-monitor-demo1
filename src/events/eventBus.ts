import mitt from 'mitt';

export type ViewInType = 'default' | 'front' | 'top' | 'side';

// 控制器emitter
export type ControlViewportEvent =
	| { e: 'bgColorChange'; val: string }
	| { e: 'openAxesHelper'; val: boolean }
	| { e: 'viewMethodChange'; val: ViewInType }
	| { e: 'logPosition' }
	| { e: 'robot-joint-state'; val: any };

export type AppEvents = {
	'conrol-viewport': ControlViewportEvent;
};

export const emitter = mitt<AppEvents>();
