import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/auth';
import { deleteTransaction } from '../../../lib/firestore/transactions';

export const POST: APIRoute = async ({ params, request, redirect }) => {
	const user = await requireAdmin(request); // Only admin can delete
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
