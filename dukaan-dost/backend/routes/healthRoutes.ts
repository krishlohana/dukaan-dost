import {doc, getDoc} from 'firebase/firestore';
import {Router} from 'express';
import {db, FIREBASE_PROJECT_ID} from '../services/firebaseClient.ts';
import {testFirebaseConnection} from '../services/firestoreService.ts';

export const healthRouter = Router();

function formatFirestoreError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.toLowerCase().includes('permission') || raw.includes('PERMISSION_DENIED')) {
    return `Firestore PERMISSION_DENIED on project "${FIREBASE_PROJECT_ID}". Update your Firestore Rules in Firebase Console to allow read/write on Dukaan Dost collections.`;
  }
  return raw || 'Firebase connection test failed.';
}

healthRouter.get('/', async (_req, res) => {
  let firebaseConnected = false;
  try {
    await getDoc(doc(db, 'shops', '_connection_test'));
    firebaseConnected = true;
  } catch {
    firebaseConnected = false;
  }

  res.json({
    status: 'ok',
    server: 'connected',
    firebaseConnected,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

healthRouter.post('/test-firebase', async (_req, res) => {
  try {
    const result = await testFirebaseConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: formatFirestoreError(err),
      projectId: FIREBASE_PROJECT_ID,
      testedAt: new Date().toISOString(),
    });
  }
});
