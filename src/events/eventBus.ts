import mitt from "mitt";

export type ViewInType = "default" | "front" | "top" | "side";

export type ControlViewportEvent =
  | { e: "bgColorChange"; val: string }
  | { e: "openAxesHelper"; val: boolean }
  | { e: "viewMethodChange"; val: ViewInType }
  | { e: "logPosition" };

export type AppEvents = {
  "conrol-viewport": ControlViewportEvent;
};

export const emitter = mitt<AppEvents>();
