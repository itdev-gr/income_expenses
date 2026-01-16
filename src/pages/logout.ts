import type { APIRoute } from 'astro';

const SESSION_COOKIE_NAME = 'session';

export const POST: APIRoute = async ({ request, redirect, url }) => {
	const isSecure = url.protocol === 'https:';
	return new Response(null, {
		status: 302,
		headers: {
			Location: '/login',
			'Set-Cookie': `${SESSION_COOKIE_NAME}=; HttpOnly; ${isSecure ? 'Secure;' : ''} SameSite=Strict; Path=/; Max-Age=0`,
		},
	});
};

export const GET: APIRoute = async ({ request, redirect, url }) => {
	const isSecure = url.protocol === 'https:';
	return new Response(null, {
		status: 302,
		headers: {
			Location: '/login',
			'Set-Cookie': `${SESSION_COOKIE_NAME}=; HttpOnly; ${isSecure ? 'Secure;' : ''} SameSite=Strict; Path=/; Max-Age=0`,
		},
	});
};
