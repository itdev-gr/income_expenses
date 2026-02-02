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

/** Transaction-like shape for aggregation (ts may be Firestore Timestamp or Date) */
interface TransactionRow {
	ts: Date | { toDate(): Date };
	type: TransactionType;
	amountCents: number;
	categoryId?: string;
}

function tsToDate(ts: Date | { toDate(): Date }): Date {
	return typeof (ts as { toDate?: () => Date }).toDate === 'function'
		? (ts as { toDate(): Date }).toDate()
		: (ts as Date);
}

/**
 * Pure aggregation: Income/Expense/Net from Cash+Online only; Cash/Online = income only.
 */
function computeIncomeExpenseCashOnline(
	transactions: TransactionRow[],
	cashId: string | null,
	onlineId: string | null
): {
	incomeCents: number;
	expenseCents: number;
	netCents: number;
	cashCents: number;
	onlineCents: number;
} {
	let incomeCents = 0;
	let expenseCents = 0;
	let cashCents = 0;
	let onlineCents = 0;
	const cashOrOnline = (id: string | undefined) =>
		id === cashId || id === onlineId;
	for (const t of transactions) {
		const cat = t.categoryId;
		if (!cashOrOnline(cat)) continue;
		const amount = t.amountCents || 0;
		if (t.type === 'income') {
			incomeCents += amount;
			if (cat === cashId) cashCents += amount;
			if (cat === onlineId) onlineCents += amount;
		} else if (t.type === 'expense') {
			expenseCents += amount;
		}
	}
	return {
		incomeCents,
		expenseCents,
		netCents: incomeCents - expenseCents,
		cashCents,
		onlineCents,
	};
}

const TRANSACTIONS_QUERY_LIMIT = 5000;

async function getTransactionsInRange(
	fromDate: Date,
	toDate: Date
): Promise<TransactionRow[]> {
	const snapshot = await db
		.collection('transactions')
		.where('ts', '>=', fromDate)
		.where('ts', '<=', toDate)
		.orderBy('ts')
		.limit(TRANSACTIONS_QUERY_LIMIT)
		.get();
	return snapshot.docs.map((doc) => {
		const d = doc.data();
		return {
			ts: d.ts,
			type: d.type as TransactionType,
			amountCents: d.amountCents ?? 0,
			categoryId: d.categoryId,
		};
	});
}

async function getPaymentTypeTotals(fromDate: Date, toDate: Date): Promise<PaymentTotals> {
	const { cashId, onlineId } = await getPaymentTypeIds();
	if (!cashId && !onlineId) return { cashCents: 0, onlineCents: 0 };
	const rows = await getTransactionsInRange(fromDate, toDate);
	const filtered = rows.filter(
		(t) => t.categoryId === cashId || t.categoryId === onlineId
	);
	const { cashCents, onlineCents } = computeIncomeExpenseCashOnline(
		filtered,
		cashId,
		onlineId
	);
	return { cashCents, onlineCents };
}

export interface ComputedPeriodSummary {
	incomeCents: number;
	expenseCents: number;
	netCents: number;
	cashCents: number;
	onlineCents: number;
}

export async function getComputedPeriodSummary(
	fromDate: Date,
	toDate: Date
): Promise<ComputedPeriodSummary> {
	const { cashId, onlineId } = await getPaymentTypeIds();
	const rows = await getTransactionsInRange(fromDate, toDate);
	const filtered = rows.filter(
		(t) => t.categoryId === cashId || t.categoryId === onlineId
	);
	return computeIncomeExpenseCashOnline(filtered, cashId, onlineId);
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
 * Get dashboard data (today, week, month, charts, tables) computed from transactions
 * (Cash+Online only: Income/Expense/Net; Cash/Online = income only).
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
	const { cashId, onlineId } = await getPaymentTypeIds();

	const todayKey = toDateKey(now);
	const weekKey = toISOWeekKey(now);
	const monthKey = toMonthKey(now);
	const { start: dayStart, end: dayEnd } = getDayRange(now);
	const { start: weekStart, end: weekEnd } = getWeekRange(now);
	const { start: monthStart, end: monthEnd } = getMonthRange(now);

	const [daySummary, weekSummary, monthSummary] = await Promise.all([
		getComputedPeriodSummary(dayStart, dayEnd),
		getComputedPeriodSummary(weekStart, weekEnd),
		getComputedPeriodSummary(monthStart, monthEnd),
	]);

	const today: DailySummary | null = {
		dateKey: todayKey,
		incomeCents: daySummary.incomeCents,
		expenseCents: daySummary.expenseCents,
		netCents: daySummary.netCents,
		countIncome: 0,
		countExpense: 0,
		updatedAt: now,
	};
	const week: WeeklySummary | null = {
		weekKey,
		incomeCents: weekSummary.incomeCents,
		expenseCents: weekSummary.expenseCents,
		netCents: weekSummary.netCents,
		countIncome: 0,
		countExpense: 0,
		updatedAt: now,
	};
	const month: MonthlySummary | null = {
		monthKey,
		incomeCents: monthSummary.incomeCents,
		expenseCents: monthSummary.expenseCents,
		netCents: monthSummary.netCents,
		countIncome: 0,
		countExpense: 0,
		updatedAt: now,
	};
	const todayPayments: PaymentTotals = { cashCents: daySummary.cashCents, onlineCents: daySummary.onlineCents };
	const weekPayments: PaymentTotals = { cashCents: weekSummary.cashCents, onlineCents: weekSummary.onlineCents };
	const monthPayments: PaymentTotals = { cashCents: monthSummary.cashCents, onlineCents: monthSummary.onlineCents };

	const chartFromDate = fromDate ?? (() => {
		const d = new Date(now);
		d.setDate(d.getDate() - 30);
		return d;
	})();
	const chartToDate = toDate ?? now;
	const chartRows = await getTransactionsInRange(chartFromDate, chartToDate);
	const byDay = new Map<string, TransactionRow[]>();
	for (const t of chartRows) {
		const key = toDateKey(tsToDate(t.ts));
		if (!byDay.has(key)) byDay.set(key, []);
		byDay.get(key)!.push(t);
	}
	const dailyChart: DailySummary[] = Array.from(byDay.entries())
		.map(([dateKey, rows]) => {
			const s = computeIncomeExpenseCashOnline(rows, cashId, onlineId);
			return {
				dateKey,
				incomeCents: s.incomeCents,
				expenseCents: s.expenseCents,
				netCents: s.netCents,
				countIncome: 0,
				countExpense: 0,
				updatedAt: now,
			};
		})
		.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

	const eightWeeksAgo = new Date(now);
	eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 8 * 7);
	const { start: weeklyRangeStart } = getWeekRange(eightWeeksAgo);
	const weeklyRows = await getTransactionsInRange(weeklyRangeStart, weekEnd);
	const byWeek = new Map<string, TransactionRow[]>();
	for (const t of weeklyRows) {
		const key = toISOWeekKey(tsToDate(t.ts));
		if (!byWeek.has(key)) byWeek.set(key, []);
		byWeek.get(key)!.push(t);
	}
	const weeklyTable: WeeklySummary[] = Array.from(byWeek.entries())
		.map(([weekKey, rows]) => {
			const s = computeIncomeExpenseCashOnline(rows, cashId, onlineId);
			return {
				weekKey,
				incomeCents: s.incomeCents,
				expenseCents: s.expenseCents,
				netCents: s.netCents,
				countIncome: 0,
				countExpense: 0,
				updatedAt: now,
			};
		})
		.sort((a, b) => b.weekKey.localeCompare(a.weekKey))
		.slice(0, 8);

	const twelveMonthsAgo = new Date(now);
	twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
	const { start: monthlyRangeStart } = getMonthRange(twelveMonthsAgo);
	const monthlyRows = await getTransactionsInRange(monthlyRangeStart, monthEnd);
	const byMonth = new Map<string, TransactionRow[]>();
	for (const t of monthlyRows) {
		const key = toMonthKey(tsToDate(t.ts));
		if (!byMonth.has(key)) byMonth.set(key, []);
		byMonth.get(key)!.push(t);
	}
	const monthlyTable: MonthlySummary[] = Array.from(byMonth.entries())
		.map(([monthKey, rows]) => {
			const s = computeIncomeExpenseCashOnline(rows, cashId, onlineId);
			return {
				monthKey,
				incomeCents: s.incomeCents,
				expenseCents: s.expenseCents,
				netCents: s.netCents,
				countIncome: 0,
				countExpense: 0,
				updatedAt: now,
			};
		})
		.sort((a, b) => b.monthKey.localeCompare(a.monthKey))
		.slice(0, 12);

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

export async function getComputedWeeklyTable(): Promise<WeeklySummary[]> {
	const now = new Date();
	const { toISOWeekKey, getWeekRange } = await import('../dates');
	const { start: weekStart, end: weekEnd } = getWeekRange(now);
	const eightWeeksAgo = new Date(now);
	eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 8 * 7);
	const { start: rangeStart } = getWeekRange(eightWeeksAgo);
	const rows = await getTransactionsInRange(rangeStart, weekEnd);
	const { cashId, onlineId } = await getPaymentTypeIds();
	const byWeek = new Map<string, TransactionRow[]>();
	for (const t of rows) {
		const key = toISOWeekKey(tsToDate(t.ts));
		if (!byWeek.has(key)) byWeek.set(key, []);
		byWeek.get(key)!.push(t);
	}
	return Array.from(byWeek.entries())
		.map(([weekKey, list]) => {
			const s = computeIncomeExpenseCashOnline(list, cashId, onlineId);
			return {
				weekKey,
				incomeCents: s.incomeCents,
				expenseCents: s.expenseCents,
				netCents: s.netCents,
				countIncome: 0,
				countExpense: 0,
				updatedAt: now,
			};
		})
		.sort((a, b) => b.weekKey.localeCompare(a.weekKey))
		.slice(0, 8);
}

export async function getComputedMonthlyTable(): Promise<MonthlySummary[]> {
	const now = new Date();
	const { toMonthKey, getMonthRange } = await import('../dates');
	const { end: monthEnd } = getMonthRange(now);
	const twelveMonthsAgo = new Date(now);
	twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
	const { start: rangeStart } = getMonthRange(twelveMonthsAgo);
	const rows = await getTransactionsInRange(rangeStart, monthEnd);
	const { cashId, onlineId } = await getPaymentTypeIds();
	const byMonth = new Map<string, TransactionRow[]>();
	for (const t of rows) {
		const key = toMonthKey(tsToDate(t.ts));
		if (!byMonth.has(key)) byMonth.set(key, []);
		byMonth.get(key)!.push(t);
	}
	return Array.from(byMonth.entries())
		.map(([monthKey, list]) => {
			const s = computeIncomeExpenseCashOnline(list, cashId, onlineId);
			return {
				monthKey,
				incomeCents: s.incomeCents,
				expenseCents: s.expenseCents,
				netCents: s.netCents,
				countIncome: 0,
				countExpense: 0,
				updatedAt: now,
			};
		})
		.sort((a, b) => b.monthKey.localeCompare(a.monthKey))
		.slice(0, 12);
}
