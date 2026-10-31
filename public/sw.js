const SHELL='cse-shell-v1';
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(['/','/icon.svg','/manifest.webmanifest']))));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin||new URL(request.url).pathname.startsWith('/api/')) return;
  if(request.mode==='navigate') event.respondWith(fetch(request).catch(()=>caches.match('/')));
  else event.respondWith(caches.match(request).then(async cached=>{
    if(cached) return cached;
    const response=await fetch(request);
    if(response.ok && new URL(request.url).pathname.startsWith('/assets/')) {
      const cache=await caches.open(SHELL); await cache.put(request,response.clone());
    }
    return response;
  }));
});
self.addEventListener('push',event=>{
  let data={}; try { data=event.data?.json()?.data||{}; } catch {}
  if(!data.title) return;
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body||'',icon:'/icon.svg',data:{url:data.url||'/'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const raw=event.notification.data?.url||'/'; let url='/';
  try { const parsed=new URL(raw,self.location.origin); if(parsed.origin===self.location.origin||['csc.gov.ph','www.csc.gov.ph','services.csc.gov.ph','ro5.csc.gov.ph'].includes(parsed.hostname)) url=parsed.href; } catch {}
  event.waitUntil(self.clients.openWindow(url));
});
