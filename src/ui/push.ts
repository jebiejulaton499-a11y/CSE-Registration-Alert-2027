import { initializeApp,getApps } from 'firebase/app';
import { getMessaging,getToken,isSupported,onMessage } from 'firebase/messaging';
const config={apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID,messagingSenderId:import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID};
export async function subscribePush(onForeground:(title:string,body:string)=>void) {
  if(!window.isSecureContext||!await isSupported()) throw new Error('Push is unavailable in this browser or insecure context');
  const permission=await Notification.requestPermission();
  if(permission!=='granted') throw new Error('Notification permission was not granted');
  const registration=await navigator.serviceWorker.register('/sw.js');
  const app=getApps()[0]||initializeApp(config),messaging=getMessaging(app);
  const token=await getToken(messaging,{vapidKey:import.meta.env.VITE_FIREBASE_VAPID_KEY,serviceWorkerRegistration:registration});
  if(!token) throw new Error('Firebase did not return a device token');
  onMessage(messaging,payload=>onForeground(payload.data?.title||'CSE Alert',payload.data?.body||''));
  return token;
}
