self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('push',event=>{
  let payload={};
  try{payload=event.data?.json()||{};}catch{payload={body:event.data?.text()||'A customer sent a new message.'};}
  event.waitUntil(self.registration.showNotification(payload.title||'Tesla Markets Management', {
    body:payload.body||'A customer sent a new message.',
    icon:'/icons/admin-app-icon.svg',
    badge:'/icons/admin-app-icon.svg',
    tag:payload.tag||'tesla-customer-message',
    renotify:true,
    data:{url:payload.url||'/admin.html?page=admin&app=tesla-markets-admin',conversationId:payload.conversationId||null},
    vibrate:[200,100,200],
    requireInteraction:true
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const url=event.notification.data?.url||'/admin.html?page=admin&app=tesla-markets-admin';
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){if('focus' in client){await client.focus();if('navigate' in client)await client.navigate(url);return;}}
    if(self.clients.openWindow)await self.clients.openWindow(url);
  })());
});