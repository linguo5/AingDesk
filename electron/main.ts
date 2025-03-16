import { ElectronEgg } from "ee-core";
import { Lifecycle } from "./preload/lifecycle";
import { preload } from "./preload";

// New app
const app = new ElectronEgg();

// Register lifecycle
const life = new Lifecycle();
app.register("ready", life.ready);
app.register("electron-app-ready", life.electronAppReady);
app.register("window-ready", life.windowReady);
app.register("before-close", life.beforeClose);
// Register preload
app.register("preload", preload);

// Register service
setTimeout(() => {
  // RAG后台任务
  const { RagTask } = require("./rag/rag_task");
  let ragTaskObj = new RagTask();
  ragTaskObj.parseTask();

  // 创建索引
  ragTaskObj.switchToCosineIndex();
}, 1000);

// Run
app.run();
