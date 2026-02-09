import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createServiceClient } from '$lib/server/supabase';
import { TRIP_ID } from '$lib/types/app';
import type { ActionMetadata, ActivityType } from '$lib/types/app';
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

You also have the ability to take actions for the user. When a user asks you to add something to their itinerary, add a packing item, or suggests a change, use the provided tools. The user will need to approve any actions before they take effect. Only call tools when the user clearly wants to add or change something — don't call tools just because you're making a recommendation.`;

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
				lines.push(`  - ${a.title}${time}${loc}${status}`);
			}
		}
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
		default:
			return '';
	}
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
		.select('day_number, title, date, activities(title, start_time, location_name, type, status)')
		.eq('trip_id', TRIP_ID)
		.order('day_number')
		.order('sort_order', { referencedTable: 'activities' });

	const itineraryContext = buildItineraryContext(days ?? []);

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
	const systemContent = itineraryContext
		? `${SYSTEM_PROMPT}\n\n${itineraryContext}`
		: SYSTEM_PROMPT;

	const messages: OpenAI.ChatCompletionMessageParam[] = [
		{ role: 'system', content: systemContent },
		...chatHistory,
		{ role: 'user', content: userMessage }
	];

	// Stream the response
	const stream = await openai.chat.completions.create({
		model: 'gpt-4.1-nano',
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
