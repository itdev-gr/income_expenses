import type { APIRoute } from 'astro';
import { requireUser } from '../../../lib/auth';
import { deleteTransaction } from '../../../lib/firestore/transactions';

export const POST: APIRoute = async ({ params, request, redirect }) => {
	const user = await requireUser(request);
	const id = params.id;

	if (!id) {
		return new Response('Transaction ID required', { status: 400 });
	}

	try {
		await deleteTransaction(id);
		return redirect('/transactions', 302);
	} catch (error: any) {
		return new Response(error.message || 'Failed to delete transaction', { status: 500 });
	}
};
