import { Tray, Menu } from "electron";
import path from "path";
import { isDev, getBaseDir } from "ee-core/ps";
import { logger } from "ee-core/log";
import { app as electronApp } from "electron";
import { getMainWindow, getCloseAndQuit, setCloseAndQuit } from "ee-core/electron";
import { pub } from "../../class/public";

/**
 * 托盘
 * @class
 */
class TrayService {
  tray: Tray | null;
  config: {
    title: string;
    icon: string;
  };

  constructor() {
    this.tray = null;
    this.config = {
      title: "AiChat",
      icon: "/public/images/tray.png",
    };
  }

  /**
   * Create the tray icon
   */
  create() {
    logger.info("[tray] load");

    const cfg = this.config;
    const mainWindow = getMainWindow();

    // tray icon
    const iconPath = path.join(getBaseDir(), cfg.icon);

    // Tray menu items
    const trayMenuTemplate = [
      {
        label: pub.lang("显示"),
        click: function () {
          mainWindow.show();
        },
      },
      {
        label: pub.lang("退出"),
        click: function () {
          electronApp.quit();
        },
      },
    ];

    // 设置关闭行为
    // setCloseAndQuit(true);
    mainWindow.on("close", (event: any) => {
      // if (getCloseAndQuit()) {
      //   return;
      // }
      // mainWindow.hide();
      // event.preventDefault();
      electronApp.quit();
    });

    // Initialize the tray
    this.tray = new Tray(iconPath);
    this.tray.setToolTip(cfg.title);
    const contextMenu = Menu.buildFromTemplate(trayMenuTemplate);
    this.tray.setContextMenu(contextMenu);
    // Show the main window when the tray icon is clicked
    this.tray.on("click", () => {
      mainWindow.show();
    });
  }
}
TrayService.toString = () => "[class TrayService]";
const trayService = new TrayService();

export { trayService };
