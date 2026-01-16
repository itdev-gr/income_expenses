import { db } from '../firebaseAdmin';
import type { Transaction, TransactionType } from '../types';
import { toDateKey, toMonthKey, toISOWeekKey } from '../dates';
import { updateSummaries } from './summaries';

/**
 * Create a new transaction and update summaries
 */
export async function createTransaction(
	data: Omit<Transaction, 'id' | 'dateKey' | 'weekKey' | 'monthKey' | 'createdAt'>
): Promise<string> {
	const transactionDate = data.ts;
	const dateKey = toDateKey(transactionDate);
	const weekKey = toISOWeekKey(transactionDate);
	const monthKey = toMonthKey(transactionDate);
	const now = new Date();

	const transactionData = {
		ts: transactionDate,
		dateKey,
		weekKey,
		monthKey,
		...data,
		createdAt: now,
	};

	// Use batch write to ensure atomicity
	const batch = db.batch();
	const transactionRef = db.collection('transactions').doc();
	batch.set(transactionRef, transactionData);

	// Update summaries
	await updateSummaries(batch, {
		dateKey,
		weekKey,
		monthKey,
		type: data.type,
		amountCents: data.amountCents,
		operation: 'increment',
	});

	await batch.commit();
	return transactionRef.id;
}

/**
 * Delete a transaction and update summaries
 */
export async function deleteTransaction(transactionId: string): Promise<void> {
	const transactionDoc = await db.collection('transactions').doc(transactionId).get();
	
	if (!transactionDoc.exists) {
		throw new Error('Transaction not found');
	}

	const transaction = transactionDoc.data() as Transaction;
	
	const batch = db.batch();
	batch.delete(db.collection('transactions').doc(transactionId));

	// Reverse the summary updates
	await updateSummaries(batch, {
		dateKey: transaction.dateKey,
		weekKey: transaction.weekKey,
		monthKey: transaction.monthKey,
		type: transaction.type,
		amountCents: transaction.amountCents,
		operation: 'decrement',
	});

	await batch.commit();
}

/**
 * List transactions with filters and pagination
 */
export async function listTransactions(options: {
	fromDate?: Date;
	toDate?: Date;
	type?: TransactionType;
	categoryId?: string;
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
