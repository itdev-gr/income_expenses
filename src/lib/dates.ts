import { formatInTimeZone, toZonedTime, zonedTimeToUtc } from 'date-fns-tz';

const TIMEZONE = 'Europe/Athens';

/**
 * Convert a date to YYYY-MM-DD in Europe/Athens timezone
 */
export function toDateKey(date: Date): string {
	return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Convert a date to YYYY-MM in Europe/Athens timezone
 */
export function toMonthKey(date: Date): string {
	return formatInTimeZone(date, TIMEZONE, 'yyyy-MM');
}

/**
 * Convert a date to YYYY-WW (ISO week) in Europe/Athens timezone
 */
export function toISOWeekKey(date: Date): string {
	const zonedDate = toZonedTime(date, TIMEZONE);
	const year = zonedDate.getFullYear();
	const week = getISOWeek(zonedDate);
	return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Get ISO week number for a date
 */
function getISOWeek(date: Date): number {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Get today's date in Europe/Athens timezone
 */
export function getToday(): Date {
	return toZonedTime(new Date(), TIMEZONE);
}

/**
 * Format date for display in Europe/Athens timezone
 */
export function formatDate(date: Date, format: string = 'yyyy-MM-dd'): string {
	return formatInTimeZone(date, TIMEZONE, format);
}

/**
 * Parse a date string (YYYY-MM-DD) and return Date in Europe/Athens timezone
 */
export function parseDateKey(dateKey: string): Date {
	const [year, month, day] = dateKey.split('-').map(Number);
	return toZonedTime(new Date(year, month - 1, day), TIMEZONE);
}

/**
 * Get start/end of the day in Europe/Athens timezone
 */
export function getDayRange(date: Date): { start: Date; end: Date } {
	const key = toDateKey(date);
	const zoned = parseDateKey(key);
	const startLocal = new Date(zoned);
	startLocal.setHours(0, 0, 0, 0);
	const endLocal = new Date(zoned);
	endLocal.setHours(23, 59, 59, 999);
	return {
		start: zonedTimeToUtc(startLocal, TIMEZONE),
		end: zonedTimeToUtc(endLocal, TIMEZONE),
	};
}

/**
 * Get start/end of the ISO week (Mon-Sun) in Europe/Athens timezone
 */
export function getWeekRange(date: Date): { start: Date; end: Date } {
	const zoned = toZonedTime(date, TIMEZONE);
	const day = zoned.getDay(); // 0 (Sun) - 6 (Sat)
	const diff = (day + 6) % 7; // days since Monday
	const startLocal = new Date(zoned);
	startLocal.setDate(zoned.getDate() - diff);
	startLocal.setHours(0, 0, 0, 0);
	const endLocal = new Date(startLocal);
	endLocal.setDate(startLocal.getDate() + 6);
	endLocal.setHours(23, 59, 59, 999);
	return {
		start: zonedTimeToUtc(startLocal, TIMEZONE),
		end: zonedTimeToUtc(endLocal, TIMEZONE),
	};
}

/**
 * Get start/end of the month in Europe/Athens timezone
 */
export function getMonthRange(date: Date): { start: Date; end: Date } {
	const zoned = toZonedTime(date, TIMEZONE);
	const startLocal = new Date(zoned.getFullYear(), zoned.getMonth(), 1);
	startLocal.setHours(0, 0, 0, 0);
	const endLocal = new Date(zoned.getFullYear(), zoned.getMonth() + 1, 0);
	endLocal.setHours(23, 59, 59, 999);
	return {
		start: zonedTimeToUtc(startLocal, TIMEZONE),
		end: zonedTimeToUtc(endLocal, TIMEZONE),
	};
}
