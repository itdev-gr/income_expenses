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
		.get();

	// Filter in memory to avoid needing a composite index
	const dueDocs = snapshot.docs.filter(doc => {
		const nextDueDate = doc.data().nextDueDate?.toDate?.();
		return nextDueDate && nextDueDate <= now;
	});

	let created = 0;
	for (const doc of dueDocs) {
		const data = doc.data();
		if (!data.type || !data.amountCents || !data.categoryId) continue;
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
