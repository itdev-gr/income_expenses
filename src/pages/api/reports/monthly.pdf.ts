import type { APIRoute } from 'astro';
import PDFDocument from 'pdfkit';
import { requireAdmin } from '../../../lib/auth';
import { getComputedPeriodSummary, getComputedWeeklyTable, getComputedMonthlyTable } from '../../../lib/firestore/summaries';
import { formatDate, parseDateKey, getMonthRange } from '../../../lib/dates';

export const GET: APIRoute = async ({ request }) => {
	await requireAdmin(request);

	const url = new URL(request.url);
	const month = url.searchParams.get('month');

	if (!month || !/^\d{4}-\d{2}$/.test(month)) {
		return new Response('Missing or invalid month. Use YYYY-MM.', { status: 400 });
	}

	const monthStart = parseDateKey(`${month}-01`);
	const { end: monthEnd } = getMonthRange(monthStart);
	const monthData = await getComputedPeriodSummary(monthStart, monthEnd);
	const weeklyTable = await getComputedWeeklyTable();
	const monthlyTable = await getComputedMonthlyTable();

	const doc = new PDFDocument({ margin: 40 });

	const chunks: Buffer[] = [];
	doc.on('data', chunk => chunks.push(chunk));

	doc.fontSize(18).text(`Monthly Report: ${month}`, { align: 'left' });
	doc.moveDown(0.5);
	doc.fontSize(10).text(`Generated: ${formatDate(new Date(), 'yyyy-MM-dd')}`);
	doc.moveDown();

	doc.fontSize(14).text('Monthly KPIs');
	doc.moveDown(0.5);
	doc.fontSize(11).text(`Income: €${(monthData.incomeCents / 100).toFixed(2)}`);
	doc.fontSize(11).text(`Expense: €${(monthData.expenseCents / 100).toFixed(2)}`);
	doc.fontSize(11).text(`Net: €${(monthData.netCents / 100).toFixed(2)}`);

	doc.moveDown();
	doc.fontSize(14).text('Weekly Summary (Last 8 Weeks)');
	doc.moveDown(0.5);
	weeklyTable.forEach(week => {
		doc.fontSize(10).text(
			`${week.weekKey} | Income: €${((week.incomeCents || 0) / 100).toFixed(2)} | Expense: €${((week.expenseCents || 0) / 100).toFixed(2)} | Net: €${((week.netCents || 0) / 100).toFixed(2)}`
		);
	});

	doc.moveDown();
	doc.fontSize(14).text('Monthly Summary (Last 12 Months)');
	doc.moveDown(0.5);
	monthlyTable.forEach(m => {
		doc.fontSize(10).text(
			`${m.monthKey} | Income: €${((m.incomeCents || 0) / 100).toFixed(2)} | Expense: €${((m.expenseCents || 0) / 100).toFixed(2)} | Net: €${((m.netCents || 0) / 100).toFixed(2)}`
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
