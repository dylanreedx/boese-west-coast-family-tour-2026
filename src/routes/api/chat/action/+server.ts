import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createServiceClient } from '$lib/server/supabase';
import { TRIP_ID } from '$lib/types/app';
import type { ActionMetadata } from '$lib/types/app';

/** Extract HH:MM time from various formats the AI might return */
function parseTime(value: string | undefined | null): string | null {
	if (!value) return null;
	// Match HH:MM anywhere in the string (covers "19:30", "2026-05-16T19:30:00", etc.)
	const match = value.match(/(\d{1,2}:\d{2})/);
	return match ? match[1] : null;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const supabase = createServiceClient(cookies);

	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser();
	if (authError || !user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { messageId, action } = await request.json();
	if (!messageId || !action || !['approve', 'dismiss'].includes(action)) {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	// Fetch the message
	const { data: message, error: fetchError } = await supabase
		.from('chat_messages')
		.select('*')
		.eq('id', messageId)
		.single();

	if (fetchError || !message) {
		return json({ error: 'Message not found' }, { status: 404 });
	}

	const metadata = message.metadata as unknown as ActionMetadata | null;
	if (!metadata || metadata.status !== 'pending') {
		return json({ error: 'Action is not pending' }, { status: 400 });
	}

	// Dismiss
	if (action === 'dismiss') {
		const updated = { ...metadata, status: 'dismissed' as const };
		await supabase
			.from('chat_messages')
			.update({ metadata: updated as unknown as Record<string, unknown> })
			.eq('id', messageId);
		return json({ ok: true, status: 'dismissed' });
	}

	// Approve
	let resultId: string | undefined;

	if (metadata.action === 'create_activity') {
		const { payload } = metadata;

		// Look up day_id from day_number
		const { data: day } = await supabase
			.from('days')
			.select('id')
			.eq('trip_id', TRIP_ID)
			.eq('day_number', payload.day_number)
			.single();

		if (!day) {
			return json({ error: `Day ${payload.day_number} not found` }, { status: 404 });
		}

		// Get next sort_order
		const { data: existing } = await supabase
			.from('activities')
			.select('sort_order')
			.eq('day_id', day.id)
			.order('sort_order', { ascending: false })
			.limit(1);

		const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

		const { data: activity, error: insertError } = await supabase
			.from('activities')
			.insert({
				trip_id: TRIP_ID,
				day_id: day.id,
				title: payload.title,
				type: payload.type,
				status: 'tentative',
				start_time: parseTime(payload.start_time),
				location_name: payload.location_name ?? null,
				description: payload.description ?? null,
				cost_estimate: payload.cost_estimate ?? null,
				sort_order: nextOrder,
				source: 'ai-guide',
				created_by: user.id
			})
			.select('id')
			.single();

		if (insertError || !activity) {
			return json({ error: 'Failed to create activity' }, { status: 500 });
		}
		resultId = activity.id;
	} else if (metadata.action === 'add_packing_item') {
		const { payload } = metadata;

		// Find or create checklist of matching type
		let { data: checklist } = await supabase
			.from('checklists')
			.select('id')
			.eq('trip_id', TRIP_ID)
			.eq('type', payload.checklist_type)
			.limit(1)
			.single();

		if (!checklist) {
			const typeLabels = { packing: 'Packing List', todo: 'To-Do List', shopping: 'Shopping List' };
			const { data: newChecklist, error: createError } = await supabase
				.from('checklists')
				.insert({
					trip_id: TRIP_ID,
					title: typeLabels[payload.checklist_type],
					type: payload.checklist_type,
					created_by: user.id
				})
				.select('id')
				.single();

			if (createError || !newChecklist) {
				return json({ error: 'Failed to create checklist' }, { status: 500 });
			}
			checklist = newChecklist;
		}

		const { data: item, error: insertError } = await supabase
			.from('checklist_items')
			.insert({
				checklist_id: checklist.id,
				label: payload.label,
				source: 'ai-guide'
			})
			.select('id')
			.single();

		if (insertError || !item) {
			return json({ error: 'Failed to add item' }, { status: 500 });
		}
		resultId = item.id;
	} else if (metadata.action === 'suggest_itinerary_change') {
		// Suggestions are informational — just mark approved
	}

	// Update message metadata with approved status
	const updated: ActionMetadata = { ...metadata, status: 'approved' as const };
	if (resultId && 'result_id' in updated) {
		(updated as { result_id?: string }).result_id = resultId;
	} else if (resultId) {
		(updated as Record<string, unknown>).result_id = resultId;
	}

	await supabase
		.from('chat_messages')
		.update({ metadata: updated as unknown as Record<string, unknown> })
		.eq('id', messageId);

	return json({ ok: true, status: 'approved', resultId });
};
