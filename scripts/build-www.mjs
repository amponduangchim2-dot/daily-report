// สร้างโฟลเดอร์ www/ จาก src/daily-report.html
//  - ใช้ไลบรารี + ฟอนต์จากในเครื่อง (ไม่โหลดจากอินเทอร์เน็ต → ใช้งานออฟไลน์ได้ และไม่รันสคริปต์ภายนอกในแอป)
//  - ปรับปุ่มบันทึก PDF / สำรองข้อมูล ให้ใช้งานได้ใน Android WebView
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(root, ...a);
const WWW = P('www');

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(P('www/vendor'), { recursive: true });
fs.mkdirSync(P('www/fonts'), { recursive: true });

function need(f) {
  if (!fs.existsSync(f)) throw new Error('ไม่พบไฟล์ที่ต้องใช้: ' + f + ' (รัน npm install แล้วหรือยัง?)');
  return f;
}
const nm = (...a) => need(P('node_modules', ...a));

/* ---------- 1) ไลบรารี JS ---------- */
const VENDOR = {
  'html2canvas.min.js': nm('html2canvas/dist/html2canvas.min.js'),
  'jspdf.umd.min.js': nm('jspdf/dist/jspdf.umd.min.js'),
  'html-to-image.js': nm('html-to-image/dist/html-to-image.js'),
  'xlsx.full.min.js': nm('xlsx/dist/xlsx.full.min.js'),
  'tesseract.min.js': nm('tesseract.js/dist/tesseract.min.js'),
  'pdf.min.js': nm('pdfjs-dist/build/pdf.min.js'),
  'pdf.worker.min.js': nm('pdfjs-dist/build/pdf.worker.min.js'),
};
for (const [n, f] of Object.entries(VENDOR)) fs.copyFileSync(f, P('www/vendor', n));

/* ---------- 2) ฟอนต์ ---------- */
const plex = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold' };
let plexCss = '';
for (const [w, n] of Object.entries(plex)) {
  fs.copyFileSync(need(P('fonts-src', `IBMPlexSansThai-${n}.ttf`)), P('www/fonts', `plex-${w}.ttf`));
  plexCss += `@font-face{font-family:'IBM Plex Sans Thai';font-style:normal;font-weight:${w};font-display:swap;src:url(@@fonts/plex-${w}.ttf) format('truetype')}\n`;
}
const TH = 'U+0E01-0E5B,U+200C-200D,U+25CC';
const LA = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
let sarCss = '';
for (const w of [300, 400, 500, 600]) {
  for (const [sub, range] of [['thai', TH], ['latin', LA]]) {
    const src = nm(`@fontsource/sarabun/files/sarabun-${sub}-${w}-normal.woff2`);
    fs.copyFileSync(src, P('www/fonts', `sarabun-${sub}-${w}.woff2`));
    sarCss += `@font-face{font-family:'Sarabun';font-style:normal;font-weight:${w};font-display:swap;src:url(@@fonts/sarabun-${sub}-${w}.woff2) format('woff2');unicode-range:${range}}\n`;
  }
}
// fonts.css (ใช้กับหน้าเว็บ: path สัมพันธ์กับไฟล์ css) และไฟล์ฝังฟอนต์ตอนสร้าง PDF (path สัมพันธ์กับหน้าแอป)
fs.writeFileSync(P('www/fonts.css'), (plexCss + sarCss).replaceAll('@@', ''));
fs.writeFileSync(P('www/fonts/plex-embed.css'), plexCss.replaceAll('@@', ''));
fs.writeFileSync(P('www/fonts/sarabun-embed.css'), sarCss.replaceAll('@@', ''));

/* ---------- 3) ปรับ HTML ---------- */
let h = fs.readFileSync(P('src/daily-report.html'), 'utf8');

// ค่าเซิร์ฟเวอร์ซิงค์ (Firebase) — จาก GitHub Variables/Secrets หรือไฟล์ firebase-config.json
let fb = { apiKey: process.env.FIREBASE_API_KEY || '', projectId: process.env.FIREBASE_PROJECT_ID || '' };
if ((!fb.apiKey || !fb.projectId) && fs.existsSync(P('firebase-config.json'))) {
  try { const j = JSON.parse(fs.readFileSync(P('firebase-config.json'), 'utf8')); fb = { apiKey: fb.apiKey || j.apiKey || '', projectId: fb.projectId || j.projectId || '' }; }
  catch (e) { throw new Error('อ่าน firebase-config.json ไม่ได้: ' + e.message); }
}
fb.apiKey = String(fb.apiKey).trim(); fb.projectId = String(fb.projectId).trim();
if (fb.apiKey && !/^[A-Za-z0-9_-]{20,60}$/.test(fb.apiKey)) throw new Error('FIREBASE_API_KEY รูปแบบไม่ถูกต้อง');
if (fb.projectId && !/^[a-z0-9-]{4,40}$/.test(fb.projectId)) throw new Error('FIREBASE_PROJECT_ID รูปแบบไม่ถูกต้อง');
const SYNC_LINE = "const SYNC_DEFAULT={apiKey:'',projectId:''};";
if (!h.includes(SYNC_LINE)) throw new Error('ไม่พบจุดตั้งค่าซิงค์ใน HTML');
h = h.replace(SYNC_LINE, 'const SYNC_DEFAULT=' + JSON.stringify(fb) + ';');
console.log(fb.apiKey ? 'ฝังค่า Firebase แล้ว: ' + fb.projectId : 'ยังไม่ได้ตั้งค่า Firebase — ผู้ใช้ต้องกรอกค่าเซิร์ฟเวอร์ในแอปเอง (ดู README-TH.md)');

// ไฟล์เว็บเวอร์ชันสำหรับคอมพิวเตอร์ (ไฟล์เดียว เปิดด้วย Chrome) ที่ฝังค่าเซิร์ฟเวอร์แล้ว
fs.mkdirSync(P('dist'), { recursive: true });
fs.writeFileSync(P('dist/daily-report.html'), h);
function rep(a, b, all = false) {
  const hit = typeof a === 'string' ? h.includes(a) : a.test(h);
  if (!hit) throw new Error('ไม่พบข้อความที่จะแทนที่: ' + String(a).slice(0, 90));
  h = all ? h.replaceAll(a, b) : h.replace(a, b);
}

// ฟอนต์: ตัด Google Fonts → ใช้ไฟล์ในเครื่อง
rep(/<link rel="preconnect"[^>]*>\s*/g, '', true);
rep(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]*>/, '<link rel="stylesheet" href="fonts.css">');
rep("plex:'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600&display=swap'", "plex:'fonts/plex-embed.css'");
rep("sarabun:'https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600&display=swap'", "sarabun:'fonts/sarabun-embed.css'");

// ไลบรารี: ชี้ไปไฟล์ในเครื่อง
rep('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'vendor/html2canvas.min.js');
rep('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'vendor/jspdf.umd.min.js');
rep('https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js', 'vendor/html-to-image.js');
rep('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'vendor/xlsx.full.min.js');
rep('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', 'vendor/tesseract.min.js');
rep('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'vendor/pdf.min.js');
rep(/pdfjsLib\.GlobalWorkerOptions\.workerSrc=URL\.createObjectURL\(new Blob\(\[[^\]]*\],\{type:'text\/javascript'\}\)\);/, "pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js';");

// บันทึกไฟล์ผ่านหน้าต่างแชร์ของ Android
rep('async function saveFile(filename,blob){', 'async function saveFile(filename,blob){\n  if(window.NativeBridge&&NativeBridge.active){try{return await NativeBridge.save(filename,blob)}catch(e){console.error(e);alert(\'บันทึกไฟล์ไม่สำเร็จ: \'+(e&&e.message||e));return false}}');
// โหมดพิมพ์ (window.print) ใช้ไม่ได้ใน WebView → บังคับใช้การสร้าง PDF ในแอป
rep("if((PF().pdfMode||'auto')==='print'||!window.jspdf){", "if(((PF().pdfMode||'auto')==='print'&&!(window.NativeBridge&&NativeBridge.active))||!window.jspdf){");

// นโยบายความปลอดภัยของหน้า (CSP) + สะพาน Android
const SYNC_HOSTS = 'https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com';
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' data: blob: https://cdn.jsdelivr.net https://tessdata.projectnaptha.com " + SYNC_HOSTS + "; object-src 'none'; base-uri 'none'; form-action 'none'";
rep(/<meta http-equiv="Content-Security-Policy"[^>]*>/, `<meta http-equiv="Content-Security-Policy" content="${CSP}">\n<script src="native-bridge.js"></script>`);

fs.writeFileSync(P('www/index.html'), h);
fs.copyFileSync(P('scripts/native-bridge.js'), P('www/native-bridge.js'));
const sz = f => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
console.log('สร้าง www/ สำเร็จ — index.html', sz(P('www/index.html')));
