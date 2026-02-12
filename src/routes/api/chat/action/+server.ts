import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createServiceClient } from '$lib/server/supabase';
import { TRIP_ID } from '$lib/types/app';
import type { ActionMetadata } from '$lib/types/app';
import { findActivityByTitle, findMemberByName } from '$lib/utils/fuzzy-match';

/** Extract HH:MM time from various formats the AI might return */
function parseTime(value: string | undefined | null): string | null {
	if (!value) return null;
	// Match HH:MM anywhere in the string (covers "19:30", "2026-05-16T19:30:00", etc.)
	const match = value.match(/(\d{1,2}:\d{2})/);
	return match ? match[1] : null;
}

async function getDayActivities(
	supabase: ReturnType<typeof createServiceClient>,
	dayNumber: number
): Promise<{ dayId: string; activities: { id: string; title: string; sort_order: number }[] } | null> {
	const { data: day } = await supabase
		.from('days')
		.select('id')
		.eq('trip_id', TRIP_ID)
		.eq('day_number', dayNumber)
		.single();

	if (!day) return null;

	const { data: activities } = await supabase
		.from('activities')
		.select('id, title, sort_order')
		.eq('day_id', day.id)
		.order('sort_order');

	return { dayId: day.id, activities: activities ?? [] };
}

async function getTripMembers(supabase: ReturnType<typeof createServiceClient>) {
	const { data } = await supabase
		.from('trip_members')
		.select('*')
		.eq('trip_id', TRIP_ID);
	return data ?? [];
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

	// Fetch the message (scoped to current user)
	const { data: message, error: fetchError } = await supabase
		.from('chat_messages')
		.select('*')
		.eq('id', messageId)
		.eq('user_id', user.id)
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

		// Sync status to any shared group_messages
		await syncStatusToGroupMessages(supabase, messageId, updated);

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
	} else if (metadata.action === 'replace_activity') {
		const { payload } = metadata;
		const dayData = await getDayActivities(supabase, payload.day_number);
		if (!dayData) return json({ error: `Day ${payload.day_number} not found` }, { status: 404 });

		const { match, error: matchError } = findActivityByTitle(dayData.activities as any, payload.old_title);
		if (!match) return json({ error: matchError ?? 'Activity not found' }, { status: 404 });

		// Delete old activity
		await supabase.from('activities').delete().eq('id', match.id);

		// Insert new at same sort_order
		const { data: activity, error: insertError } = await supabase
			.from('activities')
			.insert({
				trip_id: TRIP_ID,
				day_id: dayData.dayId,
				title: payload.new_title,
				type: payload.new_type,
				status: 'tentative',
				start_time: parseTime(payload.start_time),
				location_name: payload.location_name ?? null,
				description: payload.description ?? null,
				cost_estimate: payload.cost_estimate ?? null,
				sort_order: match.sort_order,
				source: 'ai-guide',
				created_by: user.id
			})
			.select('id')
			.single();

		if (insertError || !activity) return json({ error: 'Failed to create replacement activity' }, { status: 500 });
		resultId = activity.id;

	} else if (metadata.action === 'delete_activity') {
		const { payload } = metadata;
		const dayData = await getDayActivities(supabase, payload.day_number);
		if (!dayData) return json({ error: `Day ${payload.day_number} not found` }, { status: 404 });

		const { match, error: matchError } = findActivityByTitle(dayData.activities as any, payload.activity_title);
		if (!match) return json({ error: matchError ?? 'Activity not found' }, { status: 404 });

		const { error: deleteError } = await supabase.from('activities').delete().eq('id', match.id);
		if (deleteError) return json({ error: 'Failed to delete activity' }, { status: 500 });
		resultId = match.id;

	} else if (metadata.action === 'update_activity') {
		const { payload } = metadata;
		const dayData = await getDayActivities(supabase, payload.day_number);
		if (!dayData) return json({ error: `Day ${payload.day_number} not found` }, { status: 404 });

		const { match, error: matchError } = findActivityByTitle(dayData.activities as any, payload.activity_title);
		if (!match) return json({ error: matchError ?? 'Activity not found' }, { status: 404 });

		const updateFields: Record<string, unknown> = {};
		if (payload.updates.start_time !== undefined) updateFields.start_time = parseTime(payload.updates.start_time);
		if (payload.updates.cost_estimate !== undefined) updateFields.cost_estimate = payload.updates.cost_estimate;
		if (payload.updates.status !== undefined) updateFields.status = payload.updates.status;
		if (payload.updates.description !== undefined) updateFields.description = payload.updates.description;
		if (payload.updates.location_name !== undefined) updateFields.location_name = payload.updates.location_name;
		if (payload.updates.title !== undefined) updateFields.title = payload.updates.title;

		const { error: updateError } = await supabase
			.from('activities')
			.update(updateFields)
			.eq('id', match.id);

		if (updateError) return json({ error: 'Failed to update activity' }, { status: 500 });
		resultId = match.id;

	} else if (metadata.action === 'log_expense') {
		const { payload } = metadata;

		let paidByMemberId: string;
		const members = await getTripMembers(supabase);
		if (payload.paid_by_name) {
			const member = findMemberByName(members, payload.paid_by_name);
			if (!member) return json({ error: `Member "${payload.paid_by_name}" not found` }, { status: 404 });
			paidByMemberId = member.id;
		} else {
			const self = members.find((m) => m.user_id === user.id);
			if (!self) return json({ error: 'Could not find your member record' }, { status: 404 });
			paidByMemberId = self.id;
		}

		const { data: expense, error: insertError } = await supabase
			.from('expenses')
			.insert({
				trip_id: TRIP_ID,
				title: payload.title,
				total_amount: payload.amount,
				category: payload.category,
				day_number: payload.day_number ?? null,
				paid_by_member_id: paidByMemberId,
				notes: payload.notes ?? null,
				expense_date: new Date().toISOString().split('T')[0]
			})
			.select('id')
			.single();

		if (insertError || !expense) return json({ error: 'Failed to log expense' }, { status: 500 });
		resultId = expense.id;

	} else if (metadata.action === 'record_payment') {
		const { payload } = metadata;
		const members = await getTripMembers(supabase);

		const fromMember = findMemberByName(members, payload.from_name);
		if (!fromMember) return json({ error: `Member "${payload.from_name}" not found` }, { status: 404 });

		const toMember = findMemberByName(members, payload.to_name);
		if (!toMember) return json({ error: `Member "${payload.to_name}" not found` }, { status: 404 });

		const { data: payment, error: insertError } = await supabase
			.from('expense_payments')
			.insert({
				trip_id: TRIP_ID,
				from_member_id: fromMember.id,
				to_member_id: toMember.id,
				amount: payload.amount,
				method: payload.method ?? 'cash',
				notes: payload.notes ?? null
			})
			.select('id')
			.single();

		if (insertError || !payment) return json({ error: 'Failed to record payment' }, { status: 500 });
		resultId = payment.id;

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

	// Sync status to any shared group_messages
	await syncStatusToGroupMessages(supabase, messageId, updated);

	return json({ ok: true, status: 'approved', resultId });
};

/** Update shared_action_metadata in group_messages that reference this chat message */
async function syncStatusToGroupMessages(
	supabase: ReturnType<typeof createServiceClient>,
	chatMessageId: string,
	updatedMetadata: ActionMetadata
) {
	const { data: sharedMessages } = await supabase
		.from('group_messages')
		.select('id')
		.eq('shared_from_message_id', chatMessageId);

	if (sharedMessages && sharedMessages.length > 0) {
		for (const msg of sharedMessages) {
			await supabase
				.from('group_messages')
				.update({
					shared_action_metadata: updatedMetadata as unknown as Record<string, unknown>
				})
				.eq('id', msg.id);
		}
	}
}
