import admin from 'firebase-admin';

if (!admin.apps.length) {
	// In Astro/Vercel, use import.meta.env for environment variables
	const privateKey = (import.meta.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
	const projectId = import.meta.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
	const clientEmail = import.meta.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
	
	// Better error messages for missing environment variables
	if (!projectId) {
		throw new Error('Missing FIREBASE_PROJECT_ID environment variable. Please set it in Vercel dashboard under Settings → Environment Variables.');
	}
	if (!clientEmail) {
		throw new Error('Missing FIREBASE_CLIENT_EMAIL environment variable. Please set it in Vercel dashboard under Settings → Environment Variables.');
	}
	if (!privateKey) {
		throw new Error('Missing FIREBASE_PRIVATE_KEY environment variable. Please set it in Vercel dashboard under Settings → Environment Variables.');
	}

	try {
		admin.initializeApp({
			credential: admin.credential.cert({
				projectId,
				clientEmail,
				privateKey: privateKey,
			}),
		});
	} catch (error: any) {
		throw new Error(`Failed to initialize Firebase Admin: ${error.message}`);
	}
}

export const db = admin.firestore();
export const auth = admin.auth();
