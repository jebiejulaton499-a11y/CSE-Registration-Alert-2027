import admin from 'firebase-admin';
export function messaging() {
  if (!admin.apps.length) {
    const projectId=process.env.FIREBASE_PROJECT_ID, clientEmail=process.env.FIREBASE_CLIENT_EMAIL, privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
    if (!projectId||!clientEmail||!privateKey) throw new Error('Missing Firebase Admin configuration');
    admin.initializeApp({credential:admin.credential.cert({projectId,clientEmail,privateKey})});
  }
  return admin.messaging();
}
