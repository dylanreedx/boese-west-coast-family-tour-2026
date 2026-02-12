import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createServiceClient } from '$lib/server/supabase';
import { TRIP_ID } from '$lib/types/app';
import type { ActionMetadata, ActivityType, ExpenseCategory } from '$lib/types/app';
import OpenAI from 'openai';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { env } from '$env/dynamic/private';

const SYSTEM_PROMPT = `You are a friendly, knowledgeable local guide for the Boese family's West Coast road trip (May 13–20, 2026). The route is:

- Day 1 (May 13): Detroit → Phoenix (flight)
- Day 2 (May 14): Phoenix area
- Day 3 (May 15): Grand Canyon
- Day 4 (May 16): Grand Canyon → Las Vegas
- Day 5 (May 17): Death Valley
- Day 6 (May 18): San Francisco
- Day 7 (May 19): Santa Monica / LA area
- Day 8 (May 20): Joshua Tree → flight home from Phoenix

You have deep knowledge of all these destinations. Be opinionated—recommend specific restaurants, viewpoints, trails, and hidden gems. Keep responses concise and practical for a family trip. Use specific names and addresses when possible.

When giving recommendations:
- Mention if something needs reservations or advance booking
- Note approximate costs when relevant
- Flag anything that might be closed or seasonal
- Consider that this is a family trip (mix of adults)
- Mention time estimates for activities
- Suggest the best time of day to visit places

Be warm, enthusiastic, and conversational. You're like a friend who's lived everywhere they're visiting. Use short paragraphs and bullet points for readability.

You also have the ability to take actions for the user. When a user asks you to add something to their itinerary, add a packing item, or suggests a change, use the provided tools. The user will need to approve any actions before they take effect. Only call tools when the user clearly wants to add or change something — don't call tools just because you're making a recommendation.

When family feedback is provided below, use it to inform your recommendations. If family members are excited about a suggestion (positive reactions), lean into similar recommendations. If something was dismissed, don't re-suggest it. You can naturally reference what the family thinks, like "Your family seemed excited about that!" but don't be forced about it.

You can also modify the itinerary — replacing, deleting, or updating activities. When the user says something like "cancel the Subway lunch" or "replace Alcatraz with Fisherman's Wharf", use the appropriate tool.

You can log expenses and record payments between family members. When someone says "we spent $45 on lunch" or "Dylan sent Dad $150", use the expense tools. Match family member names to the list provided.

For budget questions like "how much have we spent?", use get_budget_summary to fetch the latest data, then present it in a clear, readable format.`;

const TOOLS: ChatCompletionTool[] = [
	{
		type: 'function',
		function: {
			name: 'create_activity',
			description:
				'Add an activity to a specific day of the trip. Use when the user asks to add a restaurant, attraction, activity, hotel, or any stop to their itinerary.',
			parameters: {
				type: 'object',
				properties: {
					day_number: {
						type: 'number',
						description: 'The day number (1-8) to add the activity to'
					},
					title: { type: 'string', description: 'Name of the activity or place' },
					type: {
						type: 'string',
						enum: [
							'flight',
							'drive',
							'hotel',
							'restaurant',
							'activity',
							'sightseeing',
							'shopping',
							'rest',
							'other'
						],
						description: 'Type of activity'
					},
					start_time: {
						type: 'string',
						description: 'Suggested start time in HH:MM format (24h), optional'
					},
					location_name: {
						type: 'string',
						description: 'Name or address of the location, optional'
					},
					description: {
						type: 'string',
						description: 'Brief description of the activity, optional'
					},
					cost_estimate: {
						type: 'number',
						description: 'Estimated cost in USD, optional'
					}
				},
				required: ['day_number', 'title', 'type']
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'add_packing_item',
			description:
				'Add an item to a packing list, to-do list, or shopping list. Use when the user asks to add something to pack, buy, or remember.',
			parameters: {
				type: 'object',
				properties: {
					checklist_type: {
						type: 'string',
						enum: ['packing', 'todo', 'shopping'],
						description: 'Which list to add the item to'
					},
					label: { type: 'string', description: 'The item to add' }
				},
				required: ['checklist_type', 'label']
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'suggest_itinerary_change',
			description:
				'Suggest a change to the existing itinerary, like reordering activities or swapping days. Use when the user asks about rearranging their plan.',
			parameters: {
				type: 'object',
				properties: {
					day_number: {
						type: 'number',
						description: 'The day number (1-8) this suggestion applies to'
					},
					suggestion_text: {
						type: 'string',
						description: 'A clear description of the suggested change'
					}
				},
				required: ['day_number', 'suggestion_text']
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'replace_activity',
			description:
				'Replace an existing activity with a new one. Use when the user wants to swap one activity for another on a specific day.',
			parameters: {
				type: 'object',
				properties: {
					day_number: { type: 'number', description: 'The day number (1-8)' },
					old_activity_title: { type: 'string', description: 'Title of the activity to replace (fuzzy match)' },
					new_title: { type: 'string', description: 'Title of the replacement activity' },
					new_type: {
						type: 'string',
						enum: ['flight', 'drive', 'hotel', 'restaurant', 'activity', 'sightseeing', 'shopping', 'rest', 'other'],
						description: 'Type of the new activity'
					},
					start_time: { type: 'string', description: 'Start time in HH:MM format (24h), optional' },
					location_name: { type: 'string', description: 'Location name or address, optional' },
					description: { type: 'string', description: 'Brief description, optional' },
					cost_estimate: { type: 'number', description: 'Estimated cost in USD, optional' }
				},
				required: ['day_number', 'old_activity_title', 'new_title', 'new_type']
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'delete_activity',
			description:
				'Remove an activity from the itinerary. Use when the user wants to cancel or remove a specific activity.',
			parameters: {
				type: 'object',
				properties: {
					day_number: { type: 'number', description: 'The day number (1-8)' },
					activity_title: { type: 'string', description: 'Title of the activity to remove (fuzzy match)' }
				},
				required: ['day_number', 'activity_title']
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'update_activity',
			description:
				'Update details of an existing activity (time, cost, description, location, status). Use when the user wants to modify but not replace an activity.',
			parameters: {
				type: 'object',
				properties: {
					day_number: { type: 'number', description: 'The day number (1-8)' },
					activity_title: { type: 'string', description: 'Title of the activity to update (fuzzy match)' },
					start_time: { type: 'string', description: 'New start time in HH:MM format, optional' },
					cost_estimate: { type: 'number', description: 'Updated cost estimate in USD, optional' },
					status: {
						type: 'string',
						enum: ['tentative', 'confirmed', 'tbd'],
						description: 'New status, optional'
					},
					description: { type: 'string', description: 'Updated description, optional' },
					location_name: { type: 'string', description: 'Updated location, optional' }
				},
				required: ['day_number', 'activity_title']
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'log_expense',
			description:
				'Log an actual expense. Use when the user reports spending money, e.g. "We spent $45 on lunch" or "The hotel was $452".',
			parameters: {
				type: 'object',
				properties: {
					title: { type: 'string', description: 'What the expense was for' },
					amount: { type: 'number', description: 'Amount in USD' },
					category: {
						type: 'string',
						enum: ['accommodation', 'food', 'transport', 'activities', 'fuel', 'parking', 'shopping', 'tips', 'other'],
						description: 'Expense category'
					},
					day_number: { type: 'number', description: 'Day number (1-8), optional' },
					paid_by_name: { type: 'string', description: 'Name of the person who paid (fuzzy match to family member), optional' },
					notes: { type: 'string', description: 'Additional notes, optional' }
				},
				required: ['title', 'amount', 'category']
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'record_payment',
			description:
				'Record a payment or transfer between family members. Use when someone sends money to another, e.g. "Dylan sent Dad $150".',
			parameters: {
				type: 'object',
				properties: {
					from_name: { type: 'string', description: 'Name of the person sending money (fuzzy match)' },
					to_name: { type: 'string', description: 'Name of the person receiving money (fuzzy match)' },
					amount: { type: 'number', description: 'Amount in USD' },
					method: { type: 'string', description: 'Payment method (e.g. e-transfer, cash, Venmo), optional' },
					notes: { type: 'string', description: 'Notes about the payment, optional' }
				},
				required: ['from_name', 'to_name', 'amount']
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'get_budget_summary',
			description:
				'Get a summary of trip spending so far. Use when the user asks about budget, expenses, or how much has been spent. This returns data that you should format into a readable response.',
			parameters: {
				type: 'object',
				properties: {},
				required: []
			}
		}
	}
];

function buildItineraryContext(
	days: {
		day_number: number;
		title: string | null;
		date: string;
		activities: {
			title: string;
			start_time: string | null;
			location_name: string | null;
			type: string | null;
			status: string | null;
			cost_estimate: number | null;
		}[];
	}[]
): string {
	if (!days.length) return '';

	const lines = ['Here is their current itinerary:'];
	for (const day of days) {
		lines.push(`\nDay ${day.day_number} (${day.date})${day.title ? ` - ${day.title}` : ''}:`);
		if (day.activities.length === 0) {
			lines.push('  (no activities planned yet)');
		} else {
			for (const a of day.activities) {
				const time = a.start_time ? ` at ${a.start_time}` : '';
				const loc = a.location_name ? ` @ ${a.location_name}` : '';
				const status = a.status && a.status !== 'confirmed' ? ` [${a.status}]` : '';
				const cost = a.cost_estimate ? ` ~$${a.cost_estimate}` : '';
				lines.push(`  - ${a.title}${time}${loc}${status}${cost}`);
			}
		}
	}
	return lines.join('\n');
}

async function buildFamilyFeedbackContext(
	supabase: ReturnType<typeof createServiceClient>,
	userId: string
): Promise<string> {
	// Find this user's chat messages that have been shared to family
	const { data: sharedGroupMessages } = await supabase
		.from('group_messages')
		.select('id, shared_from_message_id, shared_action_metadata')
		.eq('trip_id', TRIP_ID)
		.eq('user_id', userId)
		.not('shared_from_message_id', 'is', null);

	if (!sharedGroupMessages || sharedGroupMessages.length === 0) return '';

	// Get reactions for these shared messages
	const groupMsgIds = sharedGroupMessages.map((m) => m.id);
	const { data: reactions } = await supabase
		.from('message_reactions')
		.select('message_id, emoji, user_id')
		.in('message_id', groupMsgIds);

	// Get member names for reaction authors
	const reactionUserIds = [...new Set((reactions ?? []).map((r) => r.user_id))];
	let memberNameMap = new Map<string, string>();
	if (reactionUserIds.length > 0) {
		const { data: members } = await supabase
			.from('trip_members')
			.select('user_id, display_name')
			.eq('trip_id', TRIP_ID)
			.in('user_id', reactionUserIds);
		memberNameMap = new Map((members ?? []).map((m) => [m.user_id, m.display_name]));
	}

	// Build context lines
	const lines = ['Family feedback on your shared suggestions:'];

	for (const msg of sharedGroupMessages) {
		const meta = msg.shared_action_metadata as unknown as ActionMetadata | null;
		if (!meta) continue;

		let title = '';
		if (meta.action === 'create_activity') {
			title = `"${meta.payload.title}" (Day ${meta.payload.day_number})`;
		} else if (meta.action === 'add_packing_item') {
			title = `"${meta.payload.label}" (${meta.payload.checklist_type} list)`;
		} else if (meta.action === 'suggest_itinerary_change') {
			title = `Day ${meta.payload.day_number} suggestion`;
		}

		const statusLabel =
			meta.status === 'approved'
				? 'Added to itinerary'
				: meta.status === 'dismissed'
					? 'Dismissed'
					: 'Pending';

		const msgReactions = (reactions ?? []).filter((r) => r.message_id === msg.id);
		let reactionStr = 'No reactions yet';
		if (msgReactions.length > 0) {
			const emojiGroups = new Map<string, string[]>();
			for (const r of msgReactions) {
				const name = memberNameMap.get(r.user_id) ?? 'Someone';
				const group = emojiGroups.get(r.emoji) ?? [];
				group.push(name);
				emojiGroups.set(r.emoji, group);
			}
			reactionStr = [...emojiGroups.entries()]
				.map(([emoji, names]) => `${emoji} from ${names.join(', ')}`)
				.join('; ');
		}

		lines.push(`- ${title}: ${statusLabel}. ${reactionStr}`);
	}

	return lines.join('\n');
}

function buildActionMetadata(
	toolName: string,
	args: Record<string, unknown>
): ActionMetadata | null {
	switch (toolName) {
		case 'create_activity':
			return {
				action: 'create_activity',
				status: 'pending',
				payload: {
					day_number: args.day_number as number,
					title: args.title as string,
					type: (args.type as ActivityType) ?? 'activity',
					start_time: args.start_time as string | undefined,
					location_name: args.location_name as string | undefined,
					description: args.description as string | undefined,
					cost_estimate: args.cost_estimate as number | undefined
				}
			};
		case 'add_packing_item':
			return {
				action: 'add_packing_item',
				status: 'pending',
				payload: {
					checklist_type: (args.checklist_type as 'packing' | 'todo' | 'shopping') ?? 'packing',
					label: args.label as string
				}
			};
		case 'suggest_itinerary_change':
			return {
				action: 'suggest_itinerary_change',
				status: 'pending',
				payload: {
					day_number: args.day_number as number,
					suggestion_text: args.suggestion_text as string
				}
			};
		case 'replace_activity':
			return {
				action: 'replace_activity',
				status: 'pending',
				payload: {
					day_number: args.day_number as number,
					old_title: args.old_activity_title as string,
					new_title: args.new_title as string,
					new_type: (args.new_type as ActivityType) ?? 'activity',
					start_time: args.start_time as string | undefined,
					location_name: args.location_name as string | undefined,
					description: args.description as string | undefined,
					cost_estimate: args.cost_estimate as number | undefined
				}
			};
		case 'delete_activity':
			return {
				action: 'delete_activity',
				status: 'pending',
				payload: {
					day_number: args.day_number as number,
					activity_title: args.activity_title as string
				}
			};
		case 'update_activity':
			return {
				action: 'update_activity',
				status: 'pending',
				payload: {
					day_number: args.day_number as number,
					activity_title: args.activity_title as string,
					updates: {
						start_time: args.start_time as string | undefined,
						cost_estimate: args.cost_estimate as number | undefined,
						status: args.status as 'tentative' | 'confirmed' | 'tbd' | undefined,
						description: args.description as string | undefined,
						location_name: args.location_name as string | undefined
					}
				}
			};
		case 'log_expense':
			return {
				action: 'log_expense',
				status: 'pending',
				payload: {
					title: args.title as string,
					amount: args.amount as number,
					category: (args.category as ExpenseCategory) ?? 'other',
					day_number: args.day_number as number | undefined,
					paid_by_name: args.paid_by_name as string | undefined,
					notes: args.notes as string | undefined
				}
			};
		case 'record_payment':
			return {
				action: 'record_payment',
				status: 'pending',
				payload: {
					from_name: args.from_name as string,
					to_name: args.to_name as string,
					amount: args.amount as number,
					method: args.method as string | undefined,
					notes: args.notes as string | undefined
				}
			};
		default:
			return null;
	}
}

function buildActionDescription(toolName: string, args: Record<string, unknown>): string {
	switch (toolName) {
		case 'create_activity': {
			const time = args.start_time ? ` at ${args.start_time}` : '';
			return `I'd like to add **${args.title}** to Day ${args.day_number}${time}. Would you like me to go ahead?`;
		}
		case 'add_packing_item':
			return `I'd like to add **${args.label}** to your ${args.checklist_type} list. Sound good?`;
		case 'suggest_itinerary_change':
			return `Here's a suggestion for Day ${args.day_number}: ${args.suggestion_text}`;
		case 'replace_activity': {
			return `I'd like to replace **${args.old_activity_title}** with **${args.new_title}** on Day ${args.day_number}. Shall I go ahead?`;
		}
		case 'delete_activity':
			return `I'd like to remove **${args.activity_title}** from Day ${args.day_number}. Is that okay?`;
		case 'update_activity': {
			const changes: string[] = [];
			if (args.start_time) changes.push(`time to ${args.start_time}`);
			if (args.cost_estimate) changes.push(`cost to $${args.cost_estimate}`);
			if (args.status) changes.push(`status to ${args.status}`);
			if (args.description) changes.push('description');
			if (args.location_name) changes.push(`location to ${args.location_name}`);
			return `I'd like to update **${args.activity_title}** on Day ${args.day_number}: ${changes.join(', ')}. Sound good?`;
		}
		case 'log_expense': {
			const payer = args.paid_by_name ? ` (paid by ${args.paid_by_name})` : '';
			return `I'd like to log **$${Number(args.amount).toFixed(2)}** for **${args.title}** [${args.category}]${payer}. Shall I record this?`;
		}
		case 'record_payment':
			return `I'd like to record that **${args.from_name}** sent **$${Number(args.amount).toFixed(2)}** to **${args.to_name}**${args.method ? ` via ${args.method}` : ''}. Record this?`;
		default:
			return '';
	}
}

async function buildExpenseContext(
	supabase: ReturnType<typeof createServiceClient>
): Promise<string> {
	const { data: expenses } = await supabase
		.from('expenses')
		.select('title, total_amount, category, day_number, paid_by_member_id')
		.eq('trip_id', TRIP_ID)
		.order('created_at', { ascending: false })
		.limit(20);

	if (!expenses || expenses.length === 0) return '';

	const total = expenses.reduce((sum, e) => sum + e.total_amount, 0);
	const lines = [`\nExpense summary: $${total.toFixed(2)} spent so far across ${expenses.length} expenses.`];
	const recent = expenses.slice(0, 5);
	if (recent.length > 0) {
		lines.push('Recent expenses:');
		for (const e of recent) {
			const day = e.day_number ? ` (Day ${e.day_number})` : '';
			lines.push(`  - ${e.title}: $${e.total_amount.toFixed(2)} [${e.category}]${day}`);
		}
	}
	return lines.join('\n');
}

async function buildMemberContext(
	supabase: ReturnType<typeof createServiceClient>
): Promise<string> {
	const { data: members } = await supabase
		.from('trip_members')
		.select('display_name, role')
		.eq('trip_id', TRIP_ID)
		.order('display_name');

	if (!members || members.length === 0) return '';

	const names = members.map((m) => m.display_name).join(', ');
	return `\nFamily members: ${names}. When someone mentions a name (like "Dad" or "Dylan"), match it to one of these members.`;
}

async function fetchBudgetSummary(
	supabase: ReturnType<typeof createServiceClient>
): Promise<Record<string, unknown>> {
	const { data: expenses } = await supabase
		.from('expenses')
		.select('title, total_amount, category, day_number, paid_by_member_id')
		.eq('trip_id', TRIP_ID);

	const { data: payments } = await supabase
		.from('expense_payments')
		.select('amount, from_member_id, to_member_id, method')
		.eq('trip_id', TRIP_ID);

	const { data: members } = await supabase
		.from('trip_members')
		.select('id, display_name')
		.eq('trip_id', TRIP_ID);

	const { data: days } = await supabase
		.from('days')
		.select('day_number, activities(cost_estimate)')
		.eq('trip_id', TRIP_ID)
		.order('day_number');

	const memberMap = new Map((members ?? []).map((m) => [m.id, m.display_name]));
	const expenseList = expenses ?? [];
	const totalSpent = expenseList.reduce((s, e) => s + e.total_amount, 0);

	const byCategory: Record<string, number> = {};
	for (const e of expenseList) {
		byCategory[e.category] = (byCategory[e.category] ?? 0) + e.total_amount;
	}

	const byMember: Record<string, number> = {};
	for (const e of expenseList) {
		const name = memberMap.get(e.paid_by_member_id) ?? 'Unknown';
		byMember[name] = (byMember[name] ?? 0) + e.total_amount;
	}

	const estimatedTotal = (days ?? []).reduce((sum, d) => {
		const dayCost = (d.activities ?? []).reduce((s: number, a: { cost_estimate: number | null }) => s + (a.cost_estimate ?? 0), 0);
		return sum + dayCost;
	}, 0);

	return {
		total_spent: totalSpent,
		total_estimated: estimatedTotal,
		expense_count: expenseList.length,
		by_category: byCategory,
		by_member: byMember,
		payment_count: (payments ?? []).length,
		total_payments: (payments ?? []).reduce((s, p) => s + p.amount, 0)
	};
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	if (!env.OPENAI_API_KEY) {
		return json({ error: 'OpenAI API key not configured' }, { status: 500 });
	}

	const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
	const supabase = createServiceClient(cookies);

	// Authenticate user
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser();
	if (authError || !user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { message } = await request.json();
	if (!message || typeof message !== 'string' || message.trim().length === 0) {
		return json({ error: 'Message is required' }, { status: 400 });
	}

	const userMessage = message.trim().slice(0, 2000);

	// Fetch itinerary context
	const { data: days } = await supabase
		.from('days')
		.select('day_number, title, date, activities(title, start_time, location_name, type, status, cost_estimate)')
		.eq('trip_id', TRIP_ID)
		.order('day_number')
		.order('sort_order', { referencedTable: 'activities' });

	const itineraryContext = buildItineraryContext(days ?? []);
	const familyContext = await buildFamilyFeedbackContext(supabase, user.id);
	const expenseContext = await buildExpenseContext(supabase);
	const memberContext = await buildMemberContext(supabase);

	// Fetch recent chat history for this user (last 30 messages)
	const { data: history } = await supabase
		.from('chat_messages')
		.select('role, content')
		.eq('trip_id', TRIP_ID)
		.eq('user_id', user.id)
		.order('created_at', { ascending: false })
		.limit(30);

	const chatHistory = (history ?? []).reverse().map((m) => ({
		role: m.role as 'user' | 'assistant',
		content: m.content
	}));

	// Save user message to DB
	const { error: insertError } = await supabase
		.from('chat_messages')
		.insert({ trip_id: TRIP_ID, user_id: user.id, role: 'user', content: userMessage });

	if (insertError) {
		return json({ error: 'Failed to save message' }, { status: 500 });
	}

	// Build messages for OpenAI
	const contextParts = [SYSTEM_PROMPT];
	if (itineraryContext) contextParts.push(itineraryContext);
	if (expenseContext) contextParts.push(expenseContext);
	if (memberContext) contextParts.push(memberContext);
	if (familyContext) contextParts.push(familyContext);
	const systemContent = contextParts.join('\n\n');

	const messages: OpenAI.ChatCompletionMessageParam[] = [
		{ role: 'system', content: systemContent },
		...chatHistory,
		{ role: 'user', content: userMessage }
	];

	// Stream the response
	const stream = await openai.chat.completions.create({
		model: 'gpt-4.1-mini',
		messages,
		tools: TOOLS,
		stream: true,
		max_tokens: 1000,
		temperature: 0.8
	});

	let fullResponse = '';
	// Track tool calls accumulated across chunks
	const toolCallArgs: Record<number, { id: string; name: string; args: string }> = {};

	const readableStream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			try {
				for await (const chunk of stream) {
					const choice = chunk.choices[0];
					if (!choice) continue;

					const delta = choice.delta;

					// Accumulate text content
					if (delta?.content) {
						fullResponse += delta.content;
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify({ delta: delta.content })}\n\n`)
						);
					}

					// Accumulate tool call arguments
					if (delta?.tool_calls) {
						for (const tc of delta.tool_calls) {
							const idx = tc.index;
							if (!toolCallArgs[idx]) {
								toolCallArgs[idx] = {
									id: tc.id ?? '',
									name: tc.function?.name ?? '',
									args: ''
								};
							}
							if (tc.id) toolCallArgs[idx].id = tc.id;
							if (tc.function?.name) toolCallArgs[idx].name = tc.function.name;
							if (tc.function?.arguments) toolCallArgs[idx].args += tc.function.arguments;
						}
					}

					// When stream finishes with tool_calls, process them
					if (choice.finish_reason === 'tool_calls') {
						const toolCall = Object.values(toolCallArgs)[0];
						if (toolCall) {
							let parsedArgs: Record<string, unknown>;
							try {
								parsedArgs = JSON.parse(toolCall.args);
							} catch {
								parsedArgs = {};
							}

							if (toolCall.name === 'get_budget_summary') {
								// Read tool: fetch data and make a follow-up call
								const budgetData = await fetchBudgetSummary(supabase);
								const followUpMessages: OpenAI.ChatCompletionMessageParam[] = [
									...messages,
									{ role: 'assistant', content: null, tool_calls: [{ id: toolCall.id, type: 'function', function: { name: 'get_budget_summary', arguments: '{}' } }] },
									{ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(budgetData) }
								];
								const followUp = await openai.chat.completions.create({
									model: 'gpt-4.1-mini',
									messages: followUpMessages,
									stream: true,
									max_tokens: 1000,
									temperature: 0.8
								});
								for await (const chunk of followUp) {
									const c = chunk.choices[0];
									if (c?.delta?.content) {
										fullResponse += c.delta.content;
										controller.enqueue(
											encoder.encode(`data: ${JSON.stringify({ delta: c.delta.content })}\n\n`)
										);
									}
								}
							} else {
								// Write tools: show ActionCard for user approval
								const actionMeta = buildActionMetadata(toolCall.name, parsedArgs);
								if (actionMeta) {
									const description = buildActionDescription(toolCall.name, parsedArgs);
									// Add the description as text content
									fullResponse += description;
									controller.enqueue(
										encoder.encode(
											`data: ${JSON.stringify({ delta: description, action: actionMeta })}\n\n`
										)
									);
								}
							}
						}
					}
				}

				// Save completed assistant response with metadata
				const firstToolCall = Object.values(toolCallArgs)[0];
				let metadata: ActionMetadata | null = null;

				if (firstToolCall) {
					let parsedArgs: Record<string, unknown>;
					try {
						parsedArgs = JSON.parse(firstToolCall.args);
					} catch {
						parsedArgs = {};
					}
					metadata = buildActionMetadata(firstToolCall.name, parsedArgs);
				}

				await supabase.from('chat_messages').insert({
					trip_id: TRIP_ID,
					user_id: user.id,
					role: 'assistant',
					content: fullResponse,
					...(metadata ? { metadata: metadata as unknown as Record<string, unknown> } : {})
				});

				controller.enqueue(encoder.encode('data: [DONE]\n\n'));
				controller.close();
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : 'Stream error';
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
				);
				controller.close();
			}
		}
	});

	return new Response(readableStream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
