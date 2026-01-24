import { db } from '../firebaseAdmin';
import type { Transaction, TransactionType } from '../types';
import { toDateKey, toMonthKey, toISOWeekKey } from '../dates';
import { updateSummaries } from './summaries';
import { logAudit } from './audit';

/**
 * Create a new transaction and update summaries
 */
export async function createTransaction(
	data: Omit<Transaction, 'id' | 'createdAt'>
): Promise<string> {
	const transactionDate = data.ts;
	const dateKey = toDateKey(transactionDate);
	const weekKey = toISOWeekKey(transactionDate);
	const monthKey = toMonthKey(transactionDate);
	const now = new Date();

	// Build transaction data, excluding undefined optional fields
	const transactionData: any = {
		ts: transactionDate,
		type: data.type,
		amountCents: data.amountCents,
		categoryId: data.categoryId,
		note: data.note || '',
		createdBy: data.createdBy,
		createdAt: now,
	};

	// Only include optional fields if they have values
	if (data.clickupId) {
		transactionData.clickupId = data.clickupId;
	}
	if (data.companyName) {
		transactionData.companyName = data.companyName;
	}

	// Use batch write to ensure atomicity
	const batch = db.batch();
	const transactionRef = db.collection('transactions').doc();
	batch.set(transactionRef, transactionData);

	// Update summaries (calculate keys from ts)
	await updateSummaries(batch, {
		dateKey,
		weekKey,
		monthKey,
		type: data.type,
		amountCents: data.amountCents,
		operation: 'increment',
	});

	await batch.commit();
	await logAudit({
		action: 'transaction.create',
		entityType: 'transaction',
		entityId: transactionRef.id,
		amountCents: data.amountCents,
		categoryId: data.categoryId,
		createdBy: data.createdBy,
		createdAt: new Date(),
		meta: {
			type: data.type,
		},
	});
	return transactionRef.id;
}

/**
 * Delete a transaction and update summaries
 */
export async function deleteTransaction(transactionId: string, actorId?: string): Promise<void> {
	const transactionDoc = await db.collection('transactions').doc(transactionId).get();
	
	if (!transactionDoc.exists) {
		throw new Error('Transaction not found');
	}

	const data = transactionDoc.data()!;
	const transactionDate = data.ts.toDate();
	
	// Calculate keys from ts (since we no longer store them)
	const dateKey = toDateKey(transactionDate);
	const weekKey = toISOWeekKey(transactionDate);
	const monthKey = toMonthKey(transactionDate);
	
	const batch = db.batch();
	batch.delete(db.collection('transactions').doc(transactionId));

	// Reverse the summary updates
	await updateSummaries(batch, {
		dateKey,
		weekKey,
		monthKey,
		type: data.type,
		amountCents: data.amountCents,
		operation: 'decrement',
	});

	await batch.commit();
	if (actorId) {
		await logAudit({
			action: 'transaction.delete',
			entityType: 'transaction',
			entityId: transactionId,
			amountCents: data.amountCents,
			categoryId: data.categoryId,
			createdBy: actorId,
			createdAt: new Date(),
			meta: {
				type: data.type,
				originalCreatedBy: data.createdBy,
			},
		});
	}
}

/**
 * List transactions with filters and pagination
 */
export async function listTransactions(options: {
	fromDate?: Date;
	toDate?: Date;
	type?: TransactionType;
	categoryId?: string;
	createdBy?: string;
	limit?: number;
	offset?: number;
}): Promise<{ transactions: Transaction[]; total: number }> {
	let query: FirebaseFirestore.Query = db.collection('transactions');

	if (options.fromDate) {
		query = query.where('ts', '>=', options.fromDate);
	}
	if (options.toDate) {
		query = query.where('ts', '<=', options.toDate);
	}
	if (options.type) {
		query = query.where('type', '==', options.type);
	}
	if (options.categoryId) {
		query = query.where('categoryId', '==', options.categoryId);
	}
	if (options.createdBy) {
		query = query.where('createdBy', '==', options.createdBy);
	}

	query = query.orderBy('ts', 'desc');

	const totalSnapshot = await query.get();
	const total = totalSnapshot.size;

	if (options.offset) {
		query = query.offset(options.offset);
	}
	if (options.limit) {
		query = query.limit(options.limit);
	}

	const snapshot = await query.get();
	const transactions = snapshot.docs.map(doc => {
		const data = doc.data();
		return {
			id: doc.id,
			...data,
			ts: data.ts.toDate(),
			createdAt: data.createdAt.toDate(),
		} as Transaction;
	});

	return { transactions, total };
}

/**
 * Get a single transaction by ID
 */
export async function getTransaction(id: string): Promise<Transaction | null> {
	const doc = await db.collection('transactions').doc(id).get();
	if (!doc.exists) {
		return null;
	}
	const data = doc.data()!;
	return {
		id: doc.id,
		...data,
		ts: data.ts.toDate(),
		createdAt: data.createdAt.toDate(),
	} as Transaction;
}
