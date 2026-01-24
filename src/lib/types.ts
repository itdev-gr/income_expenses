export type TransactionType = 'income' | 'expense';

export interface Transaction {
	id: string;
	ts: Date; // Transaction timestamp - dateKey/weekKey/monthKey calculated on-the-fly
	type: TransactionType;
	amountCents: number;
	categoryId: string;
	note: string;
	clickupId?: string;
	companyName?: string;
	createdBy: string;
	createdAt: Date;
}

export interface Category {
	id: string;
	name: string;
	active: boolean;
	type?: 'income' | 'expense' | 'both'; // Category type: income-only, expense-only, or both
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
	todayPayments: PaymentTotals;
	weekPayments: PaymentTotals;
	monthPayments: PaymentTotals;
}

export interface PaymentTotals {
	cashCents: number;
	onlineCents: number;
}

export interface AuditLog {
	id: string;
	action: string;
	entityType: string;
	entityId?: string;
	amountCents?: number;
	categoryId?: string;
	createdBy: string;
	createdAt: Date;
	meta?: Record<string, unknown>;
}

export interface AuditLog {
	id: string;
	action: string;
	entityType: string;
	entityId?: string;
	amountCents?: number;
	categoryId?: string;
	createdBy: string;
	createdAt: Date;
	meta?: Record<string, unknown>;
}

export interface WebhookError {
	id: string;
	payload: Record<string, unknown>;
	error: string;
	createdAt: Date;
}

export type RepeatFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RepeatablePayment {
	id: string;
	name: string;
	type: TransactionType;
	amountCents: number;
	categoryId: string;
	clickupId?: string;
	companyName?: string;
	note?: string;
	frequency: RepeatFrequency;
	startDate: Date;
	endDate?: Date; // Optional - if not set, repeats indefinitely
	nextDueDate: Date;
	active: boolean;
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
}
