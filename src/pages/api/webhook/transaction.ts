import type { APIRoute } from 'astro';
import { createTransaction } from '../../../lib/firestore/transactions';
import { getOrCreatePaymentTypeCategory } from '../../../lib/firestore/categories';
import { db } from '../../../lib/firebaseAdmin';

async function logWebhookError(payload: unknown, error: string) {
	await db.collection('webhook_errors').add({
		payload,
		error,
		createdAt: new Date(),
	});
}

export const POST: APIRoute = async ({ request }) => {
	try {
		// Parse request body
		const body = await request.json();
		
		// Extract and validate required fields
		const { 
			date,           // ISO date string (e.g., "2026-01-22T13:18:08Z") or YYYY-MM-DD
			type,           // "income" | "expense"
			amount,         // Number (will be converted to cents)
			categoryId,     // Category ID or "cash"/"online"
			createdBy,      // User UID
			note,           // Optional
			clickupId,      // Optional
			companyName     // Optional
		} = body;

		// Validate required fields
		if (!date || !type || amount === undefined || !categoryId || !createdBy) {
			await logWebhookError(body, 'Missing required fields. Required: date, type, amount, categoryId, createdBy');
			return new Response(JSON.stringify({ 
				success: false,
				error: 'Missing required fields. Required: date, type, amount, categoryId, createdBy' 
			}), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Validate type
		if (type !== 'income' && type !== 'expense') {
			await logWebhookError(body, 'Invalid type. Must be "income" or "expense"');
			return new Response(JSON.stringify({ 
				success: false,
				error: 'Invalid type. Must be "income" or "expense"' 
			}), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Parse date - handle both ISO strings and YYYY-MM-DD format
		let transactionDate: Date;
		if (typeof date === 'string') {
			// If it's just YYYY-MM-DD, add time
			if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
				transactionDate = new Date(date + 'T00:00:00');
			} else {
				transactionDate = new Date(date);
			}
		} else {
			await logWebhookError(body, 'Invalid date format. Use ISO date string or YYYY-MM-DD');
			return new Response(JSON.stringify({ 
				success: false,
				error: 'Invalid date format. Use ISO date string or YYYY-MM-DD' 
			}), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (isNaN(transactionDate.getTime())) {
			await logWebhookError(body, 'Invalid date format. Use ISO date string or YYYY-MM-DD');
			return new Response(JSON.stringify({ 
				success: false,
				error: 'Invalid date format. Use ISO date string (e.g., "2026-01-22T13:18:08Z") or YYYY-MM-DD' 
			}), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Convert amount to cents
		const amountCents = Math.round(parseFloat(amount) * 100);
		if (amountCents <= 0 || isNaN(amountCents)) {
			await logWebhookError(body, 'Amount must be a positive number');
			return new Response(JSON.stringify({ 
				success: false,
				error: 'Amount must be a positive number' 
			}), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Handle payment type categories (cash/online)
		let finalCategoryId = categoryId;
		if (categoryId === 'cash' || categoryId === 'online') {
			const categoryName = categoryId === 'cash' ? 'Cash' : 'Online Payment';
			finalCategoryId = await getOrCreatePaymentTypeCategory(categoryName);
		}

		// Verify category exists
		const categoryDoc = await db.collection('categories').doc(finalCategoryId).get();
		if (!categoryDoc.exists) {
			await logWebhookError(body, `Category ID "${finalCategoryId}" does not exist`);
			return new Response(JSON.stringify({ 
				success: false,
				error: `Category ID "${finalCategoryId}" does not exist. Please use a valid category ID or "cash"/"online"` 
			}), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Create transaction (this handles dateKey/weekKey/monthKey automatically and updates summaries)
		const transactionId = await createTransaction({
			ts: transactionDate,
			type: type as 'income' | 'expense',
			amountCents,
			categoryId: finalCategoryId,
			note: note || '',
			clickupId: clickupId || undefined,
			companyName: companyName || undefined,
			createdBy,
		});

		return new Response(JSON.stringify({ 
			success: true, 
			transactionId,
			message: 'Transaction created successfully'
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});

	} catch (error: any) {
		console.error('Webhook error:', error);
		try {
			await logWebhookError(null, error.message || 'Internal server error');
		} catch {
			// Avoid throwing from error logger
		}
		return new Response(JSON.stringify({ 
			success: false,
			error: error.message || 'Internal server error' 
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
