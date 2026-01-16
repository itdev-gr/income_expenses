import admin from 'firebase-admin';

if (!admin.apps.length) {
	// In Astro, use import.meta.env for environment variables
	const privateKey = (import.meta.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
	const projectId = import.meta.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
	const clientEmail = import.meta.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
	
	if (!projectId || !clientEmail || !privateKey) {
		throw new Error('Missing Firebase Admin environment variables');
	}

	admin.initializeApp({
		credential: admin.credential.cert({
			projectId,
			clientEmail,
			privateKey: privateKey,
		}),
	});
}

export const db = admin.firestore();
export const auth = admin.auth();
