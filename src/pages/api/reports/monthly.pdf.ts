import type { APIRoute } from 'astro';
import PDFDocument from 'pdfkit';
import { requireAdmin } from '../../../lib/auth';
import { db } from '../../../lib/firebaseAdmin';
import { formatDate, parseDateKey } from '../../../lib/dates';

export const GET: APIRoute = async ({ request }) => {
	await requireAdmin(request);

	const url = new URL(request.url);
	const month = url.searchParams.get('month');

	if (!month || !/^\d{4}-\d{2}$/.test(month)) {
		return new Response('Missing or invalid month. Use YYYY-MM.', { status: 400 });
	}

	const monthStart = parseDateKey(`${month}-01`);
	const monthDoc = await db.collection('stats_monthly').doc(month).get();
	const monthData = monthDoc.exists ? monthDoc.data() : null;

	const weeklySnapshot = await db.collection('stats_weekly')
		.orderBy('weekKey', 'desc')
		.limit(8)
		.get();

	const monthlySnapshot = await db.collection('stats_monthly')
		.orderBy('monthKey', 'desc')
		.limit(12)
		.get();

	const doc = new PDFDocument({ margin: 40 });

	const chunks: Buffer[] = [];
	doc.on('data', chunk => chunks.push(chunk));

	doc.fontSize(18).text(`Monthly Report: ${month}`, { align: 'left' });
	doc.moveDown(0.5);
	doc.fontSize(10).text(`Generated: ${formatDate(new Date(), 'yyyy-MM-dd')}`);
	doc.moveDown();

	doc.fontSize(14).text('Monthly KPIs');
	doc.moveDown(0.5);
	if (monthData) {
		doc.fontSize(11).text(`Income: €${((monthData.incomeCents || 0) / 100).toFixed(2)}`);
		doc.fontSize(11).text(`Expense: €${((monthData.expenseCents || 0) / 100).toFixed(2)}`);
		doc.fontSize(11).text(`Net: €${((monthData.netCents || 0) / 100).toFixed(2)}`);
	} else {
		doc.fontSize(11).text('No data available for this month.');
	}

	doc.moveDown();
	doc.fontSize(14).text('Weekly Summary (Last 8 Weeks)');
	doc.moveDown(0.5);
	weeklySnapshot.docs.forEach(weekDoc => {
		const data = weekDoc.data();
		doc.fontSize(10).text(
			`${weekDoc.id} | Income: €${((data.incomeCents || 0) / 100).toFixed(2)} | Expense: €${((data.expenseCents || 0) / 100).toFixed(2)} | Net: €${((data.netCents || 0) / 100).toFixed(2)}`
		);
	});

	doc.moveDown();
	doc.fontSize(14).text('Monthly Summary (Last 12 Months)');
	doc.moveDown(0.5);
	monthlySnapshot.docs.forEach(mDoc => {
		const data = mDoc.data();
		doc.fontSize(10).text(
			`${mDoc.id} | Income: €${((data.incomeCents || 0) / 100).toFixed(2)} | Expense: €${((data.expenseCents || 0) / 100).toFixed(2)} | Net: €${((data.netCents || 0) / 100).toFixed(2)}`
		);
	});

	doc.end();

	const pdfBuffer = await new Promise<Buffer>((resolve) => {
		doc.on('end', () => resolve(Buffer.concat(chunks)));
	});

	return new Response(pdfBuffer, {
		status: 200,
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename=\"monthly-report-${month}.pdf\"`,
		},
	});
};
