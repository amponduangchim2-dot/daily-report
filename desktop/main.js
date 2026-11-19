// Daily Report — โปรแกรม Windows (.exe) ห่อด้วย Electron
// ใช้หน้าแอปชุดเดียวกับ APK (โฟลเดอร์ www: ไลบรารี + ฟอนต์ในตัว ใช้ออฟไลน์ได้)
const { app, BrowserWindow, protocol, net, shell, Menu, session } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const WWW = path.join(__dirname, 'www');
const ORIGIN = 'app://daily-report';

// สคีม app:// = ต้นทางปลอดภัย (secure) → IndexedDB เก็บถาวร, fetch/worker ทำงานเหมือนเว็บจริง
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 380, minHeight: 560,
    title: 'Daily Report ' + app.getVersion().replace(/\.0$/, ''),
    backgroundColor: '#070b0c',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !app.isPackaged, spellcheck: false }
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL(ORIGIN + '/index.html');

  // ลิงก์ภายนอก → เปิดในเบราว์เซอร์ปกติ, ห้ามเปลี่ยนหน้าออกนอกแอป
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ORIGIN + '/')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  win.webContents.on('page-title-updated', e => e.preventDefault());
}

app.whenReady().then(() => {
  protocol.handle('app', req => {
    const u = new URL(req.url);
    let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(WWW, rel));
    if (u.host !== 'daily-report' || !file.startsWith(WWW + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });

  // บันทึก PDF / ไฟล์สำรอง .json → หน้าต่าง Save ของ Windows (เริ่มที่โฟลเดอร์ Documents)
  session.defaultSession.on('will-download', (e, item) => {
    item.setSaveDialogOptions({ title: 'บันทึกไฟล์', defaultPath: path.join(app.getPath('documents'), item.getFilename()) });
  });
  // ไม่ขอสิทธิ์อื่นนอกจากกล้อง (สแกนเอกสาร) และคลิปบอร์ด
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'clipboard-sanitized-write', 'fullscreen'].includes(perm)));

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'ไฟล์', submenu: [{ role: 'reload', label: 'โหลดหน้าใหม่' }, { type: 'separator' }, { role: 'quit', label: 'ออกจากโปรแกรม' }] },
    { label: 'มุมมอง', submenu: [{ role: 'zoomIn', label: 'ขยาย' }, { role: 'zoomOut', label: 'ย่อ' }, { role: 'resetZoom', label: 'ขนาดปกติ' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'เต็มจอ' }] }
  ]));
  createWindow();
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
