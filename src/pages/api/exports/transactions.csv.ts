import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/auth';
import { listTransactions } from '../../../lib/firestore/transactions';
import { listCategories } from '../../../lib/firestore/categories';
import { auth } from '../../../lib/firebaseAdmin';
import { parseDateKey } from '../../../lib/dates';

export const GET: APIRoute = async ({ request }) => {
	await requireAdmin(request);

	const url = new URL(request.url);
	const fromParam = url.searchParams.get('from');
	const toParam = url.searchParams.get('to');
	const typeParam = url.searchParams.get('type');
	const categoryIdParam = url.searchParams.get('categoryId');

	const fromDate = fromParam ? parseDateKey(fromParam) : undefined;
	const toDate = toParam ? parseDateKey(toParam) : undefined;
	const type = typeParam && typeParam !== 'all' ? (typeParam as 'income' | 'expense') : undefined;
	const categoryId = categoryIdParam || undefined;

	const { transactions } = await listTransactions({
		fromDate,
		toDate,
		type,
		categoryId,
		limit: 5000,
		offset: 0,
	});

	const categories = await listCategories();
	const categoryMap = new Map(categories.map(c => [c.id, c.name]));

	const userIds = new Set(transactions.map(t => t.createdBy));
	const userEmails = new Map<string, string>();
	for (const uid of userIds) {
		try {
			const userRecord = await auth.getUser(uid);
			userEmails.set(uid, userRecord.email || uid);
		} catch {
			userEmails.set(uid, uid);
		}
	}

	const header = [
		'date',
		'type',
		'amount',
		'category',
		'note',
		'clickupId',
		'companyName',
		'createdBy',
	];

	const rows = transactions.map(tx => [
		tx.ts.toISOString(),
		tx.type,
		(tx.amountCents / 100).toFixed(2),
		categoryMap.get(tx.categoryId) || tx.categoryId,
		tx.note || '',
		tx.clickupId || '',
		tx.companyName || '',
		userEmails.get(tx.createdBy) || tx.createdBy,
	]);

	const csv = [header, ...rows]
		.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
		.join('\n');

	return new Response(csv, {
		status: 200,
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': 'attachment; filename="transactions.csv"',
		},
	});
};
