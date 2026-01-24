import { db } from '../firebaseAdmin';
import type { DailySummary, WeeklySummary, MonthlySummary, PaymentTotals } from '../types';
import type { TransactionType } from '../types';
import type { WriteBatch } from 'firebase-admin/firestore';

interface UpdateSummaryParams {
	dateKey: string;
	weekKey: string;
	monthKey: string;
	type: TransactionType;
	amountCents: number;
	operation: 'increment' | 'decrement';
}

async function getPaymentTypeIds(): Promise<{ cashId: string | null; onlineId: string | null }> {
	const snapshot = await db.collection('categories')
		.where('name', 'in', ['Cash', 'Online Payment'])
		.get();

	let cashId: string | null = null;
	let onlineId: string | null = null;

	for (const doc of snapshot.docs) {
		const name = doc.data().name;
		if (name === 'Cash') {
			cashId = doc.id;
		} else if (name === 'Online Payment') {
			onlineId = doc.id;
		}
	}

	return { cashId, onlineId };
}

async function getPaymentTypeTotals(fromDate: Date, toDate: Date): Promise<PaymentTotals> {
	const { cashId, onlineId } = await getPaymentTypeIds();

	if (!cashId && !onlineId) {
		return { cashCents: 0, onlineCents: 0 };
	}

	const snapshot = await db.collection('transactions')
		.where('ts', '>=', fromDate)
		.where('ts', '<=', toDate)
		.get();

	let cashCents = 0;
	let onlineCents = 0;

	for (const doc of snapshot.docs) {
		const data = doc.data();
		if (cashId && data.categoryId === cashId) {
			cashCents += data.amountCents || 0;
		}
		if (onlineId && data.categoryId === onlineId) {
			onlineCents += data.amountCents || 0;
		}
	}

	return { cashCents, onlineCents };
}

/**
 * Update summary documents (daily, weekly, monthly) atomically
 */
export async function updateSummaries(
	batch: WriteBatch,
	params: UpdateSummaryParams
): Promise<void> {
	const { dateKey, weekKey, monthKey, type, amountCents, operation } = params;
	const delta = operation === 'increment' ? amountCents : -amountCents;
	const countDelta = operation === 'increment' ? 1 : -1;

	// Update daily summary
	const dailyRef = db.collection('stats_daily').doc(dateKey);
	const dailyDoc = await dailyRef.get();
	
	if (dailyDoc.exists) {
		const data = dailyDoc.data()!;
		const newIncomeCents = type === 'income' 
			? (data.incomeCents || 0) + delta 
			: (data.incomeCents || 0);
		const newExpenseCents = type === 'expense' 
			? (data.expenseCents || 0) + delta 
			: (data.expenseCents || 0);
		
		batch.update(dailyRef, {
			incomeCents: newIncomeCents,
			expenseCents: newExpenseCents,
			netCents: newIncomeCents - newExpenseCents,
			countIncome: type === 'income' 
				? (data.countIncome || 0) + countDelta 
				: (data.countIncome || 0),
			countExpense: type === 'expense' 
				? (data.countExpense || 0) + countDelta 
				: (data.countExpense || 0),
			updatedAt: new Date(),
		});
	} else {
		batch.set(dailyRef, {
			dateKey,
			incomeCents: type === 'income' ? amountCents : 0,
			expenseCents: type === 'expense' ? amountCents : 0,
			netCents: type === 'income' ? amountCents : -amountCents,
			countIncome: type === 'income' ? 1 : 0,
			countExpense: type === 'expense' ? 1 : 0,
			updatedAt: new Date(),
		});
	}

	// Update weekly summary
	const weeklyRef = db.collection('stats_weekly').doc(weekKey);
	const weeklyDoc = await weeklyRef.get();
	
	if (weeklyDoc.exists) {
		const data = weeklyDoc.data()!;
		const newIncomeCents = type === 'income' 
			? (data.incomeCents || 0) + delta 
			: (data.incomeCents || 0);
		const newExpenseCents = type === 'expense' 
			? (data.expenseCents || 0) + delta 
			: (data.expenseCents || 0);
		
		batch.update(weeklyRef, {
			incomeCents: newIncomeCents,
			expenseCents: newExpenseCents,
			netCents: newIncomeCents - newExpenseCents,
			countIncome: type === 'income' 
				? (data.countIncome || 0) + countDelta 
				: (data.countIncome || 0),
			countExpense: type === 'expense' 
				? (data.countExpense || 0) + countDelta 
				: (data.countExpense || 0),
			updatedAt: new Date(),
		});
	} else {
		batch.set(weeklyRef, {
			weekKey,
			incomeCents: type === 'income' ? amountCents : 0,
			expenseCents: type === 'expense' ? amountCents : 0,
			netCents: type === 'income' ? amountCents : -amountCents,
			countIncome: type === 'income' ? 1 : 0,
			countExpense: type === 'expense' ? 1 : 0,
			updatedAt: new Date(),
		});
	}

	// Update monthly summary
	const monthlyRef = db.collection('stats_monthly').doc(monthKey);
	const monthlyDoc = await monthlyRef.get();
	
	if (monthlyDoc.exists) {
		const data = monthlyDoc.data()!;
		const newIncomeCents = type === 'income' 
			? (data.incomeCents || 0) + delta 
			: (data.incomeCents || 0);
		const newExpenseCents = type === 'expense' 
			? (data.expenseCents || 0) + delta 
			: (data.expenseCents || 0);
		
		batch.update(monthlyRef, {
			incomeCents: newIncomeCents,
			expenseCents: newExpenseCents,
			netCents: newIncomeCents - newExpenseCents,
			countIncome: type === 'income' 
				? (data.countIncome || 0) + countDelta 
				: (data.countIncome || 0),
			countExpense: type === 'expense' 
				? (data.countExpense || 0) + countDelta 
				: (data.countExpense || 0),
			updatedAt: new Date(),
		});
	} else {
		batch.set(monthlyRef, {
			monthKey,
			incomeCents: type === 'income' ? amountCents : 0,
			expenseCents: type === 'expense' ? amountCents : 0,
			netCents: type === 'income' ? amountCents : -amountCents,
			countIncome: type === 'income' ? 1 : 0,
			countExpense: type === 'expense' ? 1 : 0,
			updatedAt: new Date(),
		});
	}
}

/**
 * Get dashboard data (today, week, month, charts, tables)
 */
export async function getDashboardData(fromDate?: Date, toDate?: Date): Promise<{
	today: DailySummary | null;
	week: WeeklySummary | null;
	month: MonthlySummary | null;
	dailyChart: DailySummary[];
	weeklyTable: WeeklySummary[];
	monthlyTable: MonthlySummary[];
	todayPayments: PaymentTotals;
	weekPayments: PaymentTotals;
	monthPayments: PaymentTotals;
}> {
	const now = new Date();
	const { toDateKey, toMonthKey, toISOWeekKey, getDayRange, getWeekRange, getMonthRange } = await import('../dates');
	
	const todayKey = toDateKey(now);
	const weekKey = toISOWeekKey(now);
	const monthKey = toMonthKey(now);

	// Get today's summary
	const todayDoc = await db.collection('stats_daily').doc(todayKey).get();
	const today = todayDoc.exists ? {
		dateKey: todayDoc.id,
		...todayDoc.data(),
		updatedAt: todayDoc.data()!.updatedAt.toDate(),
	} as DailySummary : null;

	// Get current week summary
	const weekDoc = await db.collection('stats_weekly').doc(weekKey).get();
	const week = weekDoc.exists ? {
		weekKey: weekDoc.id,
		...weekDoc.data(),
		updatedAt: weekDoc.data()!.updatedAt.toDate(),
	} as WeeklySummary : null;

	// Get current month summary
	const monthDoc = await db.collection('stats_monthly').doc(monthKey).get();
	const month = monthDoc.exists ? {
		monthKey: monthDoc.id,
		...monthDoc.data(),
		updatedAt: monthDoc.data()!.updatedAt.toDate(),
	} as MonthlySummary : null;

	// Payment type totals (Cash/Online) for day/week/month
	const { start: dayStart, end: dayEnd } = getDayRange(now);
	const { start: weekStart, end: weekEnd } = getWeekRange(now);
	const { start: monthStart, end: monthEnd } = getMonthRange(now);

	const [todayPayments, weekPayments, monthPayments] = await Promise.all([
		getPaymentTypeTotals(dayStart, dayEnd),
		getPaymentTypeTotals(weekStart, weekEnd),
		getPaymentTypeTotals(monthStart, monthEnd),
	]);

	// Get daily chart data based on date range
	const chartFromDate = fromDate || (() => {
		const defaultStart = new Date(now);
		defaultStart.setDate(defaultStart.getDate() - 30);
		return defaultStart;
	})();
	const chartToDate = toDate || now;
	const startKey = toDateKey(chartFromDate);
	const endKey = toDateKey(chartToDate);
	
	// Fetch all daily summaries and filter by date range in memory
	// This avoids Firestore index requirements
	const dailySnapshot = await db.collection('stats_daily').get();
	
	const dailyChart = dailySnapshot.docs
		.map(doc => ({
			dateKey: doc.id,
			...doc.data(),
			updatedAt: doc.data().updatedAt.toDate(),
		} as DailySummary))
		.filter(summary => summary.dateKey >= startKey && summary.dateKey <= endKey)
		.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

	// Get weekly table (last 8 weeks)
	const weeklySnapshot = await db.collection('stats_weekly')
		.orderBy('weekKey', 'desc')
		.limit(8)
		.get();
	
	const weeklyTable = weeklySnapshot.docs.map(doc => ({
		weekKey: doc.id,
		...doc.data(),
		updatedAt: doc.data().updatedAt.toDate(),
	} as WeeklySummary));

	// Get monthly table (last 12 months)
	const monthlySnapshot = await db.collection('stats_monthly')
		.orderBy('monthKey', 'desc')
		.limit(12)
		.get();
	
	const monthlyTable = monthlySnapshot.docs.map(doc => ({
		monthKey: doc.id,
		...doc.data(),
		updatedAt: doc.data().updatedAt.toDate(),
	} as MonthlySummary));

	return {
		today,
		week,
		month,
		dailyChart,
		weeklyTable,
		monthlyTable,
		todayPayments,
		weekPayments,
		monthPayments,
	};
}
