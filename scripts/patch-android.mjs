// ปรับแต่งโปรเจกต์ Android ที่ `npx cap add android` สร้างให้: ความปลอดภัย + สิทธิ์กล้อง + เลขเวอร์ชัน
// เวอร์ชันที่แสดงให้ผู้ใช้ = APP_VERSION (1.0) · versionCode = เลขรอบการ build (เพิ่มขึ้นเรื่อย ๆ เพื่อให้ติดตั้งทับเวอร์ชันเก่าได้)
import fs from 'fs';
const mf='android/app/src/main/AndroidManifest.xml';
let m=fs.readFileSync(mf,'utf8');
if(/android:allowBackup="true"/.test(m)) m=m.replace('android:allowBackup="true"','android:allowBackup="false"');
else if(!/android:allowBackup=/.test(m)) m=m.replace('<application','<application android:allowBackup="false"');
if(!/usesCleartextTraffic/.test(m)) m=m.replace('<application','<application android:usesCleartextTraffic="false"');
if(!/permission.CAMERA/.test(m)) m=m.replace('</manifest>','    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>');
fs.writeFileSync(mf,m);
const gf='android/app/build.gradle';
let g=fs.readFileSync(gf,'utf8');
const run=process.env.GITHUB_RUN_NUMBER||'1';
const ver=process.env.APP_VERSION||'1.0';
g=g.replace(/versionCode\s+\d+/,'versionCode '+run).replace(/versionName\s+"[^"]*"/,'versionName "'+ver+'"');
fs.writeFileSync(gf,g);
console.log('patched manifest · versionName', ver, '· versionCode', run);
