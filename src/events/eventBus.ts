import mitt from 'mitt';

export type ControlViewportEvent =
	| { e: 'bgColorChange'; val: string }
	| { e: 'openAxesHelper'; flag: boolean };

export type AppEvents = {
	'conrol-viewport': ControlViewportEvent;
};

export const emitter = mitt<AppEvents>();
