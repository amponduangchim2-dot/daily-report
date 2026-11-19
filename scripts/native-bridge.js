/* สะพานเชื่อม Android (Capacitor) — ทำงานเฉพาะเมื่อรันในแอป APK
   - บันทึกไฟล์ (PDF / .json สำรองข้อมูล) ผ่านหน้าต่างแชร์ของ Android
   - ปุ่มย้อนกลับของ Android */
(function(){
  var C=window.Capacitor;
  var active=!!(C&&typeof C.isNativePlatform==='function'&&C.isNativePlatform());
  var P=active?C.Plugins:{};
  function b64(blob){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(String(r.result).split(',')[1]||'')};r.onerror=function(){rej(r.error)};r.readAsDataURL(blob)})}
  function safeName(n){return String(n||'file').replace(/[^\w.\-฀-๿]+/g,'_').slice(0,120)}
  async function save(filename,blob){
    var name=safeName(filename);
    var w=await P.Filesystem.writeFile({path:'export/'+name,data:await b64(blob),directory:'CACHE',recursive:true});
    try{
      await P.Share.share({title:name,dialogTitle:'บันทึก / ส่งไฟล์',url:w.uri});
      return true;
    }catch(e){
      if(e&&/cancel/i.test(String(e.message||e)))return false;
      throw e;
    }
  }
  window.NativeBridge={active:active,save:save};
  if(!active)return;
  document.documentElement.classList.add('native-app');
  if(P.App&&P.App.addListener){
    P.App.addListener('backButton',function(){
      try{
        if(typeof modal!=='undefined'&&modal&&!modal.hidden){closeModal();return}
        if(typeof curView!=='undefined'&&curView!=='home'){showView('home');return}
      }catch(e){}
      P.App.exitApp();
    });
  }
})();
