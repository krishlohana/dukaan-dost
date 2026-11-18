import {getApps, initializeApp} from 'firebase/app';
import {getFirestore} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: 'AIzaSyCbLk9Rln81O1lhlZzZtV12bs5YvLSowfI',
  authDomain: 'dukaan-dost-20b43.firebaseapp.com',
  projectId: 'dukaan-dost-20b43',
  storageBucket: 'dukaan-dost-20b43.firebasestorage.app',
  messagingSenderId: '1087080146733',
  appId: '1:1087080146733:web:ed8520b12d947a689155a4',
  measurementId: 'G-N3F4JZVYY3',
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

// Uses the Cloud Firestore (default) database
export const db = getFirestore(app);
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
