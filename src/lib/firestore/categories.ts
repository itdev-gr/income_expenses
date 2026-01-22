import { db } from '../firebaseAdmin';
import type { Category } from '../types';

/**
 * List all categories (active and inactive)
 */
export async function listCategories(): Promise<Category[]> {
	const snapshot = await db.collection('categories').orderBy('name').get();
	return snapshot.docs.map(doc => {
		const data = doc.data();
		return {
			id: doc.id,
			...data,
			createdAt: data.createdAt?.toDate() || new Date(),
		} as Category;
	});
}

/**
 * List only active categories
 */
export async function listActiveCategories(): Promise<Category[]> {
	const snapshot = await db.collection('categories')
		.where('active', '==', true)
		.get();
	const categories = snapshot.docs.map(doc => {
		const data = doc.data();
		return {
			id: doc.id,
			...data,
			createdAt: data.createdAt?.toDate() || new Date(),
		} as Category;
	});
	// Sort by name in memory to avoid composite index requirement
	return categories.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * List active categories by transaction type
 */
export async function listActiveCategoriesByType(transactionType: 'income' | 'expense'): Promise<Category[]> {
	const snapshot = await db.collection('categories')
		.where('active', '==', true)
		.get();
	const categories = snapshot.docs.map(doc => {
		const data = doc.data();
		return {
			id: doc.id,
			...data,
			createdAt: data.createdAt?.toDate() || new Date(),
		} as Category;
	});

	// Filter categories: include if type is 'both', matches transaction type, or undefined (legacy categories)
	const filtered = categories.filter(cat => {
		if (!cat.type) return true; // Legacy categories without type field
		return cat.type === 'both' || cat.type === transactionType;
	});

	return filtered.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Create a new category
 */
export async function createCategory(name: string): Promise<string> {
	const categoryRef = db.collection('categories').doc();
	await categoryRef.set({
		name,
		active: true,
		createdAt: new Date(),
	});
	return categoryRef.id;
}

/**
 * Get or create a payment type category (Cash or Online Payment)
 */
export async function getOrCreatePaymentTypeCategory(name: 'Cash' | 'Online Payment'): Promise<string> {
	// Check if category already exists
	const snapshot = await db.collection('categories')
		.where('name', '==', name)
		.limit(1)
		.get();

	if (!snapshot.empty) {
		return snapshot.docs[0].id;
	}

	// Create the category if it doesn't exist
	const categoryRef = db.collection('categories').doc();
	await categoryRef.set({
		name,
		type: 'income',
		active: true,
		createdAt: new Date(),
	});
	return categoryRef.id;
}

/**
 * Toggle category active status
 */
export async function toggleCategory(categoryId: string): Promise<void> {
	const categoryDoc = await db.collection('categories').doc(categoryId).get();
	if (!categoryDoc.exists) {
		throw new Error('Category not found');
	}
	const currentActive = categoryDoc.data()?.active ?? true;
	await db.collection('categories').doc(categoryId).update({
		active: !currentActive,
	});
}

/**
 * Delete a category
 */
export async function deleteCategory(categoryId: string): Promise<void> {
	const categoryDoc = await db.collection('categories').doc(categoryId).get();
	if (!categoryDoc.exists) {
		throw new Error('Category not found');
	}
	
	// Check if category is used in any transactions
	const transactionsSnapshot = await db.collection('transactions')
		.where('categoryId', '==', categoryId)
		.limit(1)
		.get();
	
	if (!transactionsSnapshot.empty) {
		throw new Error('Cannot delete category that is used in transactions');
	}
	
	await db.collection('categories').doc(categoryId).delete();
}

/**
 * Seed default categories
 */
export async function seedDefaultCategories(): Promise<void> {
	const defaults = [
		// Income categories
		{ name: 'Cash', type: 'income' },
		{ name: 'Online Payment', type: 'income' },
		// Expense categories
		{ name: 'Rent', type: 'expense' },
		{ name: 'Utilities', type: 'expense' },
		{ name: 'Fuel', type: 'expense' },
		{ name: 'Supplies', type: 'expense' },
		{ name: 'Salary', type: 'expense' },
		{ name: 'Other', type: 'both' },
	];

	const existingSnapshot = await db.collection('categories').get();
	const existingNames = new Set(existingSnapshot.docs.map(doc => doc.data().name));

	const batch = db.batch();
	for (const cat of defaults) {
		if (!existingNames.has(cat.name)) {
			const ref = db.collection('categories').doc();
			batch.set(ref, {
				name: cat.name,
				type: cat.type,
				active: true,
				createdAt: new Date(),
			});
		}
	}
	await batch.commit();
}
