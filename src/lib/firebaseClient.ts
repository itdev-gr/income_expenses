import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;

export function getFirebaseClient() {
	if (typeof window === 'undefined') {
		return { app: undefined, auth: undefined };
	}

	if (!app) {
		const firebaseConfig = {
			apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
			authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
			projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
			appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
		};

		if (getApps().length === 0) {
			app = initializeApp(firebaseConfig);
		} else {
			app = getApps()[0];
		}
	}

	if (!authInstance && app) {
		authInstance = getAuth(app);
	}

	return { app, auth: authInstance };
}
