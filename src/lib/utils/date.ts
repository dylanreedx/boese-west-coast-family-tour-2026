const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(dateStr: string): string {
	const date = new Date(dateStr + 'T00:00:00');
	return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

export function formatDayName(dateStr: string): string {
	const date = new Date(dateStr + 'T00:00:00');
	return DAY_NAMES[date.getDay()];
}

export function formatTime(timeStr: string | null): string {
	if (!timeStr) return '';
	const [hours, minutes] = timeStr.split(':').map(Number);
	const period = hours >= 12 ? 'PM' : 'AM';
	const displayHour = hours % 12 || 12;
	return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function daysUntil(dateStr: string): number {
	const target = new Date(dateStr + 'T00:00:00');
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDuration(minutes: number | null): string {
	if (!minutes) return '';
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (hours === 0) return `${mins}min`;
	if (mins === 0) return `${hours}h`;
	return `${hours}h ${mins}min`;
}
