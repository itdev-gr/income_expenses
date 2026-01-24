import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/auth';
import { db } from '../../../lib/firebaseAdmin';
import { createTransaction } from '../../../lib/firestore/transactions';
import { calculateNextDueDate } from '../../../lib/firestore/repeatablePayments';
import { logAudit } from '../../../lib/firestore/audit';

export const POST: APIRoute = async ({ request }) => {
	const user = await requireAdmin(request);
	const now = new Date();

	const snapshot = await db.collection('repeatable_payments')
		.where('active', '==', true)
		.where('nextDueDate', '<=', now)
		.get();

	let created = 0;
	for (const doc of snapshot.docs) {
		const data = doc.data();
		const nextDueDate = data.nextDueDate.toDate();

		await createTransaction({
			ts: nextDueDate,
			type: data.type,
			amountCents: data.amountCents,
			categoryId: data.categoryId,
			note: data.note || '',
			clickupId: data.clickupId,
			companyName: data.companyName,
			createdBy: user.uid,
		});

		const updatedNextDue = calculateNextDueDate(nextDueDate, data.frequency);
		await db.collection('repeatable_payments').doc(doc.id).update({
			nextDueDate: updatedNextDue,
			updatedAt: new Date(),
		});

		await logAudit({
			action: 'repeatable.run_due',
			entityType: 'repeatable_payment',
			entityId: doc.id,
			amountCents: data.amountCents,
			categoryId: data.categoryId,
			createdBy: user.uid,
			createdAt: new Date(),
		});

		created += 1;
	}

	return new Response(JSON.stringify({ created }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
};
