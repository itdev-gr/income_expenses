import { db } from '../firebaseAdmin';

export interface AuditLogEntry {
	action: string;
	entityType: string;
	entityId?: string;
	amountCents?: number;
	categoryId?: string;
	createdBy: string;
	createdAt: Date;
	meta?: Record<string, unknown>;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
	await db.collection('audit_logs').add({
		...entry,
		createdAt: entry.createdAt || new Date(),
	});
}
