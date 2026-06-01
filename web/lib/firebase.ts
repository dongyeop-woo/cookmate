'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

// 앱 firebase.ts 와 동일한 config.
const firebaseConfig = {
  apiKey: 'AIzaSyBszdCmcg7E8qRxiNlsJAnMDbACDO1ZQvA',
  authDomain: 'cookingbasedyw.firebaseapp.com',
  projectId: 'cookingbasedyw',
  storageBucket: 'cookingbasedyw.firebasestorage.app',
  messagingSenderId: '879574205436',
  appId: '1:879574205436:web:9e6a1069cb3efbe72ae879',
  measurementId: 'G-4REQHHF2YL',
};

export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let _auth: Auth | null = null;
export function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(firebaseApp);
  return _auth;
}
