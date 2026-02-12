import type { Activity, TripMember } from '$lib/types/app';

/** Find a single activity by fuzzy title match on a day's activities.
 *  Returns the matched activity, or null if no match / ambiguous. */
export function findActivityByTitle(
	activities: Activity[],
	title: string
): { match: Activity | null; error?: string } {
	// 1. Exact match
	const exact = activities.find((a) => a.title === title);
	if (exact) return { match: exact };

	// 2. Case-insensitive
	const lower = title.toLowerCase();
	const ci = activities.find((a) => a.title.toLowerCase() === lower);
	if (ci) return { match: ci };

	// 3. Substring match
	const partial = activities.filter((a) => a.title.toLowerCase().includes(lower));
	if (partial.length === 1) return { match: partial[0] };

	// 4. Reverse substring — activity title is contained in search
	const reverse = activities.filter((a) => lower.includes(a.title.toLowerCase()));
	if (reverse.length === 1) return { match: reverse[0] };

	if (partial.length > 1) {
		const titles = partial.map((a) => `"${a.title}"`).join(', ');
		return { match: null, error: `Multiple activities match "${title}": ${titles}. Please be more specific.` };
	}

	return { match: null, error: `No activity found matching "${title}" on this day.` };
}

/** Find a trip member by fuzzy display name match.
 *  Returns the matched member, or null if no match. */
export function findMemberByName(
	members: TripMember[],
	name: string
): TripMember | null {
	const lower = name.toLowerCase();
	// Exact
	const exact = members.find((m) => m.display_name === name);
	if (exact) return exact;
	// Case-insensitive
	const ci = members.find((m) => m.display_name.toLowerCase() === lower);
	if (ci) return ci;
	// Substring
	const partial = members.filter((m) => m.display_name.toLowerCase().includes(lower));
	if (partial.length === 1) return partial[0];
	// Reverse substring
	const reverse = members.filter((m) => lower.includes(m.display_name.toLowerCase()));
	if (reverse.length === 1) return reverse[0];
	return null;
}
