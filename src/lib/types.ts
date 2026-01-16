export type TransactionType = 'income' | 'expense';

export interface Transaction {
	id: string;
	ts: Date;
	dateKey: string; // YYYY-MM-DD
	weekKey: string; // YYYY-WW
	monthKey: string; // YYYY-MM
	type: TransactionType;
	amountCents: number;
	categoryId: string;
	note: string;
	createdBy: string;
	createdAt: Date;
}

export interface Category {
	id: string;
	name: string;
	active: boolean;
	createdAt: Date;
}

export interface DailySummary {
	dateKey: string;
	incomeCents: number;
	expenseCents: number;
	netCents: number;
	countIncome: number;
	countExpense: number;
	updatedAt: Date;
}

export interface WeeklySummary {
	weekKey: string;
	incomeCents: number;
	expenseCents: number;
	netCents: number;
	countIncome: number;
	countExpense: number;
	updatedAt: Date;
}

export interface MonthlySummary {
	monthKey: string;
	incomeCents: number;
	expenseCents: number;
	netCents: number;
	countIncome: number;
	countExpense: number;
	updatedAt: Date;
}

export interface User {
	uid: string;
	email: string;
	role: 'admin' | 'staff';
	createdAt: Date;
}

export interface DashboardData {
	today: DailySummary | null;
	week: WeeklySummary | null;
	month: MonthlySummary | null;
	dailyChart: DailySummary[];
	weeklyTable: WeeklySummary[];
	monthlyTable: MonthlySummary[];
}
