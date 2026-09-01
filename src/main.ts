import "./styles/main.scss";
import { Scene } from "./core/Scene";
import { log } from "./ui/Log";
import { Robot } from "./core/Robot";

// 更新函数
const update = (scene: Scene): void => {
  requestAnimationFrame(() => update(scene));
  scene.update();
};

// 报错函数
const showError = (message: string): void => {
  const errorDiv = document.createElement("div");
  errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff4444;
      color: white;
      padding: 20px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      z-index: 10000;
    `;
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
};

const initialize = async () => {
  try {
    // 获取容器
    const container = document.getElementById("app");
    if (!container) {
      throw new Error("找不到应用容器");
    }

    log.info("系统初始化开始...");

    // 创建场景
    const scene = new Scene(container);
    log.success("3D场景创建完成");

    // 创建机器人
    const robot = new Robot(
      scene,
      `${import.meta.env.BASE_URL}robots_asset/ur5_pybullet.urdf`,
    );
    await robot.load();
    log.success("robot加载完成");

    // 开始渲染循环
    update(scene);
    console.log("robot初始化完成");
    log.success("robot初始化完成");
  } catch (error) {
    console.error("初始化失败:", error);
    log.error(`初始化失败: ${error}`);
    showError("初始化失败，请检查控制台获取详细信息");
  }
};

initialize();
