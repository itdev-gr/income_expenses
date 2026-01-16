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
		.orderBy('name')
		.get();
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
 * Seed default categories
 */
export async function seedDefaultCategories(): Promise<void> {
	const defaults = [
		'Sales',
		'Services',
		'Salary',
		'Rent',
		'Utilities',
		'Fuel',
		'Supplies',
		'Other',
	];

	const existingSnapshot = await db.collection('categories').get();
	const existingNames = new Set(existingSnapshot.docs.map(doc => doc.data().name));

	const batch = db.batch();
	for (const name of defaults) {
		if (!existingNames.has(name)) {
			const ref = db.collection('categories').doc();
			batch.set(ref, {
				name,
				active: true,
				createdAt: new Date(),
			});
		}
	}
	await batch.commit();
}
