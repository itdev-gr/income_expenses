import type { Request } from 'astro';
import { auth, db } from './firebaseAdmin';
import type { User } from './types';

const SESSION_COOKIE_NAME = 'session';

/**
 * Get user from request session cookie
 */
export async function getUserFromRequest(request: Request): Promise<User | null> {
	const sessionCookie = request.headers.get('cookie')
		?.split(';')
		.find(c => c.trim().startsWith(`${SESSION_COOKIE_NAME}=`))
		?.split('=')[1];

	if (!sessionCookie) {
		return null;
	}

	try {
		const decodedToken = await auth.verifySessionCookie(sessionCookie, true);
		const uid = decodedToken.uid;

		// Get user role from Firestore
		const userDoc = await db.collection('users').doc(uid).get();
		
		if (!userDoc.exists) {
			// First login - create user doc with default role 'staff'
			await db.collection('users').doc(uid).set({
				role: 'staff',
				createdAt: new Date(),
			});
			return {
				uid,
				email: decodedToken.email || '',
				role: 'staff',
				createdAt: new Date(),
			};
		}

		const userData = userDoc.data();
		return {
			uid,
			email: decodedToken.email || '',
			role: (userData?.role || 'staff') as 'admin' | 'staff',
			createdAt: userData?.createdAt?.toDate() || new Date(),
		};
	} catch (error) {
		console.error('Error verifying session:', error);
		return null;
	}
}

/**
 * Require user to be authenticated, throws redirect if not
 */
export async function requireUser(request: Request): Promise<User> {
	const user = await getUserFromRequest(request);
	if (!user) {
		throw new Response(null, {
			status: 302,
			headers: {
				Location: '/login',
			},
		});
	}
	return user;
}

/**
 * Require user to be admin, throws redirect if not
 */
export async function requireAdmin(request: Request): Promise<User> {
	const user = await requireUser(request);
	if (user.role !== 'admin') {
		throw new Response(null, {
			status: 403,
			statusText: 'Forbidden',
		});
	}
	return user;
}

/**
 * Create session cookie from ID token
 */
export async function createSessionCookie(idToken: string): Promise<string> {
	const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
	return await auth.createSessionCookie(idToken, { expiresIn });
}
