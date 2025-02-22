import { ElectronEgg } from 'ee-core';
import { Lifecycle } from './preload/lifecycle';
import { preload } from './preload';
import { totalService } from './service/total';

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
    const { shareService } = require('./service/share');
    const shareIdPrefix = shareService.generateUniquePrefix();
    let socket = shareService.connectToCloudServer(shareIdPrefix);
    shareService.startReconnect(socket,shareIdPrefix);
}, 1000);

// 启动统计服务
totalService.start();


// Run
app.run();