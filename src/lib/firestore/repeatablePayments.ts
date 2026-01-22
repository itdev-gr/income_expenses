import { db } from '../firebaseAdmin';
import type { RepeatablePayment, RepeatFrequency } from '../types';

/**
 * Calculate next due date based on frequency
 */
function calculateNextDueDate(lastDate: Date, frequency: RepeatFrequency): Date {
	const next = new Date(lastDate);
	switch (frequency) {
		case 'daily':
			next.setDate(next.getDate() + 1);
			break;
		case 'weekly':
			next.setDate(next.getDate() + 7);
			break;
		case 'monthly':
			next.setMonth(next.getMonth() + 1);
			break;
		case 'yearly':
			next.setFullYear(next.getFullYear() + 1);
			break;
	}
	return next;
}

/**
 * Create a new repeatable payment
 */
export async function createRepeatablePayment(
	data: Omit<RepeatablePayment, 'id' | 'nextDueDate' | 'createdAt' | 'updatedAt'>
): Promise<string> {
	const now = new Date();
	const nextDueDate = calculateNextDueDate(data.startDate, data.frequency);

	// Build payment data, excluding undefined optional fields
	const paymentData: any = {
		name: data.name,
		type: data.type,
		amountCents: data.amountCents,
		categoryId: data.categoryId,
		frequency: data.frequency,
		startDate: data.startDate,
		nextDueDate,
		active: data.active,
		createdBy: data.createdBy,
		createdAt: now,
		updatedAt: now,
	};

	// Only include optional fields if they have values
	if (data.note) {
		paymentData.note = data.note;
	}
	if (data.clickupId) {
		paymentData.clickupId = data.clickupId;
	}
	if (data.companyName) {
		paymentData.companyName = data.companyName;
	}
	if (data.endDate) {
		paymentData.endDate = data.endDate;
	}

	const paymentRef = db.collection('repeatable_payments').doc();
	await paymentRef.set(paymentData);
	return paymentRef.id;
}

/**
 * List all repeatable payments
 */
export async function listRepeatablePayments(activeOnly: boolean = false): Promise<RepeatablePayment[]> {
	let query: FirebaseFirestore.Query = db.collection('repeatable_payments').orderBy('nextDueDate', 'asc');

	if (activeOnly) {
		query = query.where('active', '==', true);
	}

	const snapshot = await query.get();
	return snapshot.docs.map(doc => {
		const data = doc.data();
		return {
			id: doc.id,
			...data,
			startDate: data.startDate.toDate(),
			endDate: data.endDate?.toDate(),
			nextDueDate: data.nextDueDate.toDate(),
			createdAt: data.createdAt.toDate(),
			updatedAt: data.updatedAt.toDate(),
		} as RepeatablePayment;
	});
}

/**
 * Get a single repeatable payment by ID
 */
export async function getRepeatablePayment(id: string): Promise<RepeatablePayment | null> {
	const doc = await db.collection('repeatable_payments').doc(id).get();
	if (!doc.exists) {
		return null;
	}
	const data = doc.data()!;
	return {
		id: doc.id,
		...data,
		startDate: data.startDate.toDate(),
		endDate: data.endDate?.toDate(),
		nextDueDate: data.nextDueDate.toDate(),
		createdAt: data.createdAt.toDate(),
		updatedAt: data.updatedAt.toDate(),
	} as RepeatablePayment;
}

/**
 * Update a repeatable payment
 */
export async function updateRepeatablePayment(
	id: string,
	data: Partial<Omit<RepeatablePayment, 'id' | 'createdAt' | 'createdBy'>> & { nextDueDate?: Date }
): Promise<void> {
	const doc = await db.collection('repeatable_payments').doc(id).get();
	if (!doc.exists) {
		throw new Error('Repeatable payment not found');
	}

	const updateData: any = {
		updatedAt: new Date(),
	};

	// Include only provided fields
	if (data.name !== undefined) updateData.name = data.name;
	if (data.type !== undefined) updateData.type = data.type;
	if (data.amountCents !== undefined) updateData.amountCents = data.amountCents;
	if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
	if (data.frequency !== undefined) updateData.frequency = data.frequency;
	if (data.startDate !== undefined) updateData.startDate = data.startDate;
	if (data.active !== undefined) updateData.active = data.active;
	
	// Optional fields - only update if provided
	if (data.note !== undefined) {
		updateData.note = data.note || null;
	}
	if (data.clickupId !== undefined) {
		updateData.clickupId = data.clickupId || null;
	}
	if (data.companyName !== undefined) {
		updateData.companyName = data.companyName || null;
	}
	if (data.endDate !== undefined) {
		updateData.endDate = data.endDate || null;
	}

	// Recalculate next due date if frequency or start date changed
	if (data.frequency || data.startDate) {
		const current = doc.data()!;
		const startDate = data.startDate || current.startDate.toDate();
		const frequency = data.frequency || current.frequency;
		updateData.nextDueDate = calculateNextDueDate(startDate, frequency);
	} else if (data.nextDueDate) {
		updateData.nextDueDate = data.nextDueDate;
	}

	await db.collection('repeatable_payments').doc(id).update(updateData);
}

/**
 * Delete a repeatable payment
 */
export async function deleteRepeatablePayment(id: string): Promise<void> {
	const doc = await db.collection('repeatable_payments').doc(id).get();
	if (!doc.exists) {
		throw new Error('Repeatable payment not found');
	}
	await db.collection('repeatable_payments').doc(id).delete();
}

/**
 * Toggle active status of a repeatable payment
 */
export async function toggleRepeatablePayment(id: string): Promise<void> {
	const doc = await db.collection('repeatable_payments').doc(id).get();
	if (!doc.exists) {
		throw new Error('Repeatable payment not found');
	}
	const currentActive = doc.data()?.active ?? true;
	await db.collection('repeatable_payments').doc(id).update({
		active: !currentActive,
		updatedAt: new Date(),
	});
}
