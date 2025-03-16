import { logger } from "ee-core/log";
import { getConfig } from "ee-core/config";
import { getMainWindow } from "ee-core/electron";
import { pub } from "../class/public";
import { ContextMenu } from "../class/menu";
import { app, dialog } from "electron";
import path from "node:path";
import fs from "node:fs";

let WindowSize = { size: 0, position: 0 };

class Lifecycle {
  /**
   * Core app has been loaded
   */
  async ready(): Promise<void> {
    logger.info("[lifecycle] ready");
  }

  /**
   * Electron app is ready
   */
  async electronAppReady(): Promise<void> {
    logger.info("[lifecycle] electron-app-ready");
  }

  /**
   * Main window has been loaded
   */
  async windowReady(): Promise<void> {
    logger.info("[lifecycle] window-ready");
    // Delay loading, no white screen

    const win = getMainWindow();
    win.setMenu(null);
    let window = pub.C("window");
    if (window && window.size) {
      win.setSize(window.size[0], window.size[1]);
    }
    if (window && window.position) {
      win.setPosition(window.position[0], window.position[1]);
    }

    const config = getConfig();
    const { windowsOption } = config;
    if (windowsOption?.show === false) {
      win.once("ready-to-show", () => {
        win.show();
        win.focus();
      });
    }

    // 当调整窗口大小时，记录窗口大小
    win.on("resize", () => {
      // 全屏和最大化、最小化时不记录窗口大小
      if (win.isFullScreen() || win.isMaximized() || win.isMinimized()) return;

      WindowSize.size = win.getSize();
      WindowSize.position = win.getPosition();
    });

    // 加载菜单
    win.webContents.on("context-menu", (event: any, params: any) => {
      let menu_obj = new ContextMenu(event, params);
      let contextMenu = menu_obj.get_context_menu();
      if (contextMenu) contextMenu.popup({ window: win });
    });

    // 处理打开连接
    win.webContents.on("new-window", (event, url) => {
      event.preventDefault();
      require("electron").shell.openExternal(url);
    });

    // 处理连接跳转
    win.webContents.on("will-navigate", (event, url) => {
      event.preventDefault();
      require("electron").shell.openExternal(url);
    });

    // 拦截window.open
    win.webContents.setWindowOpenHandler((Details) => {
      const { url } = Details;
      if (url.startsWith("http")) {
        require("electron").shell.openExternal(url);
      } else {
        // 直接打开文件
        pub.openFile(decodeURIComponent(url.replace("file:///", "")));
      }
      return { action: "deny" };
    });

    {
      //温馨提示
      const keyFile = path.join(app.getPath("userData"), ".key");
      let allow = false;
      if (fs.existsSync(keyFile)) {
        const keyMd5 = fs.readFileSync(keyFile, "utf8");
        allow = keyMd5.indexOf("7fa26a803fe419c85b91eb7afbe52e9c") != -1;
      }
      if (!allow) {
        dialog.showErrorBox("温馨提示", "本软件是免费开源软件，不收取任何费用，如有人倒卖，请立即举报。\r\n便携版不是从闲鱼号：程序员个人接单 获得的均为盗版！\r\n便携版deepseek上闲鱼搜索用户：程序员个人接单。");

        // const s = '便携版请在闲鱼搜索用户：程序员个人接单' + '1.0.1'
        // if (!fs.existsSync(defaultUserData)) {
        //   fs.mkdirSync(defaultUserData, { recursive: true })
        // }
        // const s1 = path.join(defaultUserData, '.key')
        // const s2 = crypto.createHash('md5').update(s).digest('hex')
        // fs.writeFileSync(s1, s2, 'utf8')
      }
    }
  }

  /**
   * Before app close
   */
  async beforeClose(): Promise<void> {
    logger.info("[lifecycle] before-close");

    // 保存窗口大小
    pub.C("window", WindowSize);
  }
}
Lifecycle.toString = () => "[class Lifecycle]";

export { Lifecycle };
