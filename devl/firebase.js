import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBszdCmcg7E8qRxiNlsJAnMDbACDO1ZQvA",
  authDomain: "cookingbasedyw.firebaseapp.com",
  projectId: "cookingbasedyw",
  storageBucket: "cookingbasedyw.firebasestorage.app",
  messagingSenderId: "879574205436",
  appId: "1:879574205436:web:9e6a1069cb3efbe72ae879",
  measurementId: "G-4REQHHF2YL"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  authInstance = getAuth(app);
}

export { authInstance };
export const db = getFirestore(app, 'cookmate');
export const storage = getStorage(app);

export default app;