import { logger } from "ee-core/log";
import { app, dialog } from "electron";
import path from "node:path";
import { exec } from "child_process";
import fs from "node:fs";
import { pub } from "../../class/public";

/**
 * OllamaService class for handling ollama serve operations
 */
class OllamaService {
  /**
   * start ollama serve
   */
  create(): void {
    logger.info("[ollama] starting...");

    //先判断下是否已安装ollama
    try {
      const ollamaFile = path.join(app.getPath("home"), "AppData", "Local", "Programs", "Ollama", "unins000.exe");
      if (fs.existsSync(ollamaFile)) {
        dialog.showErrorBox("温馨提示", `为保证便携版正常使用，请先卸载本地已安装的Ollama软件！`);
      }
    } catch (error) {}

    //启动ollama
    try {
      const cwd = path.join(pub.get_root_path(), "ollama");
      exec("startup.cmd", { cwd }, () => {});
      logger.info("ollama start success");
    } catch (error) {
      logger.error("ollama start error", error);
    }
  }
}
OllamaService.toString = () => "[class OllamaService]";
const ollamaService = new OllamaService();

export { OllamaService, ollamaService };
