// ตรวจตัวอ่าน OCR ในแอปที่สร้างแล้ว (www/) ด้วย Chrome แบบไม่มีหน้าจอ บน GitHub Actions
//  - เปิด www/index.html ผ่านเซิร์ฟเวอร์ในเครื่อง → อ่านภาพตัวอย่าง scripts/ocr-test.png (ตาราง ปร.4)
//  - ผ่าน = ใช้ตัวอ่าน OpenThai จากไฟล์ในแอป (ไม่โหลดจากเว็บ) และจัดเป็นรายการ ปร.4 ได้ ≥ 4 รายการ
//  - ไม่ผ่าน = ขึ้นคำเตือนสีเหลืองใน Actions (ไม่หยุดการสร้างแอป)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WWW = path.join(root, 'www');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = u === '/__ocr-test.png' ? path.join(root, 'scripts/ocr-test.png') : path.normalize(path.join(WWW, u === '/' ? 'index.html' : u));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const exe = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/usr/bin/chromium'].find(f => fs.existsSync(f));
let ok = false;
try {
  if (!exe) throw new Error('ไม่พบ Chrome บนเครื่องสร้างแอป');
  const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const net = [];
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1')) net.push(r.url()) });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof ocrFiles === 'function' && typeof app !== 'undefined' && !!app, { timeout: 30000 });
  const t0 = Date.now();
  const r = await page.evaluate(async () => {
    const b = await (await fetch('/__ocr-test.png')).blob();
    const pages = await ocrFiles([new File([b], 'ocr-test.png', { type: 'image/png' })], 0, () => {});
    const grid = ocrGrid(pages), map = detectMap(grid), items = parseTable(grid, map, { wrap: true });
    return { kind: OCRE.kind, src: OCRE.src, err: OCRE.err, worker: !!OCRE.w, text: ocrText(pages), items: items.filter(x => x.inc).map(x => [x.no, x.name, x.amount]) };
  });
  console.log('ตัวอ่าน:', r.kind, '·', r.src, '· Worker:', r.worker, '·', ((Date.now() - t0) / 1000).toFixed(1), 'วินาที');
  console.log('--- ข้อความที่อ่านได้ ---\n' + r.text + '\n--- รายการ ปร.4 ---');
  r.items.forEach(x => console.log(x.join(' | ')));
  const outside = net.filter(u => !/fonts\.googleapis|fonts\.gstatic/.test(u));
  if (outside.length) console.log('โหลดจากภายนอก:', outside.join(', '));
  ok = r.kind === 'thai' && r.src === 'local' && r.items.length >= 4;
  if (!ok) console.log('::warning::ตรวจ OCR ไม่ผ่าน — ตัวอ่าน=' + r.kind + ' (' + (r.src || '-') + ') รายการ=' + r.items.length + (r.err ? ' · ' + r.err : ''));
  await browser.close();
} catch (e) {
  console.log('::warning::ตรวจ OCR ไม่สำเร็จ: ' + (e && e.message || e));
}
srv.close();
console.log(ok ? 'ตรวจ OCR ผ่าน ✓' : 'ตรวจ OCR ไม่ผ่าน');
process.exit(ok ? 0 : 1);
