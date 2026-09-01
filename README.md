## 项目基本结构

robot‑monitor‑demo1/
├── public
│ └── robots_asset/ # URDF、stl/glb模型资源放这里
├── src
│ ├── components
│ │ ├── DeviceList.vue
│ │ ├── Robot3DViewer.vue
│ │ └── DataDashboard.vue
│ ├── stores
│ │ └── robotStore.ts
│ ├── services
│ │ └── socketService.ts
│ ├── utils
│ │ └── urdfLoader.ts
│ ├── App.vue
│ └── main.ts
└── backend # FastAPI模拟后端文件夹，后续放main.py
