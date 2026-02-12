# Guide Chatbot Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the AI guide from 3 tools to 9, making it the primary interface for itinerary CRUD and expense tracking.

**Architecture:** Add 6 new OpenAI function-calling tools to the chat endpoint. Itinerary tools (replace/delete/update) use fuzzy title matching to find activities. Expense tools (log/payment/summary) write to existing expense tables. All write tools produce ActionCards for user approval; the read tool (get_budget_summary) returns data inline. Upgrade model from gpt-4.1-nano to gpt-4.1-mini for reliable tool selection with 9 tools.

**Tech Stack:** SvelteKit, Svelte 5 (runes), OpenAI gpt-4.1-mini, Supabase, TypeScript

---

## Pre-requisite: Commit Sessions 11+12

Before any new work, commit the ~20 uncommitted files from prior sessions.

### Task 0: Commit uncommitted work

**Step 1: Stage Session 11 files (PlaceCard refactor, MiniMap, map fixes)**

```bash
git add src/lib/components/trip/PlaceCard.svelte \
  src/lib/components/trip/MiniMap.svelte \
  src/lib/components/trip/ActionCard.svelte \
  src/lib/components/family/SharedSuggestionCard.svelte \
  src/lib/components/trip/ActivityItem.svelte \
  src/lib/utils/map-colors.ts \
  src/routes/api/day/ \
  src/routes/map/+page.svelte \
  src/app.html
```

**Step 2: Commit Session 11**

```bash
git commit -m "feat: PlaceCard expand/collapse refactor, MiniMap component, map color utility, day activities API endpoint, map page source cleanup fix"
```

**Step 3: Stage Session 12 files (expense system, budget page, cost badges)**

```bash
git add src/lib/types/app.ts \
  src/lib/types/database.ts \
  src/lib/queries/expenses.ts \
  src/lib/utils/currency.ts \
  src/lib/components/trip/ExpenseEditor.svelte \
  src/lib/components/trip/ActivityEditor.svelte \
  src/lib/components/trip/DayCard.svelte \
  src/lib/components/layout/BottomNav.svelte \
  src/lib/stores/realtime.svelte.ts \
  src/routes/budget/ \
  src/routes/+page.svelte \
  src/routes/day/[dayNumber]/+page.svelte
```

**Step 4: Commit Session 12**

```bash
git commit -m "feat: expense tracking system with budget page, cost fields in activities, expense editor, cost badges on day/home pages, BottomNav Lists→Budget"
```

---

## Task 1: Add ActionMetadata type union members

**Files:**
- Modify: `src/lib/types/app.ts:67-98` (ActionMetadata type)

**Step 1: Add 5 new union members after the existing 3**

Add these after the `suggest_itinerary_change` member (line 98), before the closing semicolon:

```typescript
| {
		action: 'replace_activity';
		status: ActionStatus;
		payload: {
			day_number: number;
			old_title: string;
			new_title: string;
			new_type: ActivityType;
			start_time?: string;
			location_name?: string;
			description?: string;
			cost_estimate?: number;
		};
		result_id?: string;
  }
| {
		action: 'delete_activity';
		status: ActionStatus;
		payload: {
			day_number: number;
			activity_title: string;
		};
		result_id?: string;
  }
| {
		action: 'update_activity';
		status: ActionStatus;
		payload: {
			day_number: number;
			activity_title: string;
			updates: {
				start_time?: string;
				cost_estimate?: number;
				status?: ActivityStatus;
				description?: string;
				location_name?: string;
				title?: string;
			};
		};
		result_id?: string;
  }
| {
		action: 'log_expense';
		status: ActionStatus;
		payload: {
			title: string;
			amount: number;
			category: ExpenseCategory;
			day_number?: number;
			paid_by_name?: string;
			notes?: string;
		};
		result_id?: string;
  }
| {
		action: 'record_payment';
		status: ActionStatus;
		payload: {
			from_name: string;
			to_name: string;
			amount: number;
			method?: string;
			notes?: string;
		};
		result_id?: string;
  }
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to ActionMetadata

**Step 3: Commit**

```bash
git add src/lib/types/app.ts
git commit -m "feat: add ActionMetadata types for replace/delete/update activity and expense tools"
```

---

## Task 2: Add fuzzy activity matching utility

**Files:**
- Create: `src/lib/utils/fuzzy-match.ts`

**Step 1: Create the fuzzy matching utility**

```typescript
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
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/utils/fuzzy-match.ts
git commit -m "feat: add fuzzy matching utilities for activities and members"
```

---

## Task 3: Add tool definitions + model upgrade + system prompt context

**Files:**
- Modify: `src/routes/api/chat/+server.ts`

This is the largest task — adds 6 tool definitions, upgrades model, enhances system prompt with expense/member context, and updates `buildActionMetadata` + `buildActionDescription` for all new tools.

**Step 1: Add new tool definitions to TOOLS array**

After the existing `suggest_itinerary_change` tool (line 129), add these 6 tools:

```typescript
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
					enum: ['tentative', 'confirmed', 'cancelled'],
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
```

**Step 2: Upgrade model from nano to mini**

Change line 371:
```typescript
// OLD: model: 'gpt-4.1-nano',
model: 'gpt-4.1-mini',
```

**Step 3: Add cost_estimate to buildItineraryContext**

Update the activity select query (line 327) to include `cost_estimate`:
```typescript
.select('day_number, title, date, activities(title, start_time, location_name, type, status, cost_estimate)')
```

Update the `buildItineraryContext` function signature to include `cost_estimate: number | null` in the activity type, and update the line output:
```typescript
const cost = a.cost_estimate ? ` ~$${a.cost_estimate}` : '';
lines.push(`  - ${a.title}${time}${loc}${status}${cost}`);
```

**Step 4: Add buildExpenseContext and buildMemberContext functions**

Add these before the `POST` handler:

```typescript
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
```

**Step 5: Wire new context into system prompt**

In the POST handler, after `buildFamilyFeedbackContext` (around line 332), add:

```typescript
const expenseContext = await buildExpenseContext(supabase);
const memberContext = await buildMemberContext(supabase);
```

Update the contextParts array:
```typescript
const contextParts = [SYSTEM_PROMPT];
if (itineraryContext) contextParts.push(itineraryContext);
if (expenseContext) contextParts.push(expenseContext);
if (memberContext) contextParts.push(memberContext);
if (familyContext) contextParts.push(familyContext);
```

**Step 6: Update SYSTEM_PROMPT**

Add to the end of the system prompt (before the closing backtick):

```
You can also modify the itinerary — replacing, deleting, or updating activities. When the user says something like "cancel the Subway lunch" or "replace Alcatraz with Fisherman's Wharf", use the appropriate tool.

You can log expenses and record payments between family members. When someone says "we spent $45 on lunch" or "Dylan sent Dad $150", use the expense tools. Match family member names to the list provided.

For budget questions like "how much have we spent?", use get_budget_summary to fetch the latest data, then present it in a clear, readable format.
```

**Step 7: Update buildActionMetadata for new tools**

Add new cases to the switch in `buildActionMetadata`:

```typescript
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
				status: args.status as 'tentative' | 'confirmed' | 'cancelled' | undefined,
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
```

**Step 8: Update buildActionDescription for new tools**

Add new cases:

```typescript
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
```

**Step 9: Handle get_budget_summary as inline response (no ActionCard)**

The `get_budget_summary` tool is special — it's a read tool. When the AI calls it, we need to execute it immediately and feed the result back to OpenAI so it can format a response. This requires a different flow: after the stream finishes with a `get_budget_summary` tool call, make a second OpenAI call with the tool result.

In the streaming handler, after `if (choice.finish_reason === 'tool_calls')`, add special handling:

```typescript
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
}
```

Add the `fetchBudgetSummary` helper (before the POST handler):

```typescript
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

	// Per-category totals
	const byCategory: Record<string, number> = {};
	for (const e of expenseList) {
		byCategory[e.category] = (byCategory[e.category] ?? 0) + e.total_amount;
	}

	// Per-member spending
	const byMember: Record<string, number> = {};
	for (const e of expenseList) {
		const name = memberMap.get(e.paid_by_member_id) ?? 'Unknown';
		byMember[name] = (byMember[name] ?? 0) + e.total_amount;
	}

	// Estimated costs from activities
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
```

**Step 10: Add import for ExpenseCategory**

At the top of the file, update the import:
```typescript
import type { ActionMetadata, ActivityType, ExpenseCategory } from '$lib/types/app';
```

**Step 11: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 12: Commit**

```bash
git add src/routes/api/chat/+server.ts
git commit -m "feat: add 6 new AI guide tools, upgrade to gpt-4.1-mini, add expense/member context to system prompt"
```

---

## Task 4: Add action approve handlers

**Files:**
- Modify: `src/routes/api/chat/action/+server.ts`

**Step 1: Add import for fuzzy matching**

```typescript
import { findActivityByTitle, findMemberByName } from '$lib/utils/fuzzy-match';
```

**Step 2: Add helper to look up day's activities**

Add after the `parseTime` function:

```typescript
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
```

**Step 3: Add replace_activity handler**

After the `add_packing_item` handler block (around line 157), before the `suggest_itinerary_change` check, add:

```typescript
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
```

**Step 4: Add delete_activity handler**

```typescript
} else if (metadata.action === 'delete_activity') {
	const { payload } = metadata;
	const dayData = await getDayActivities(supabase, payload.day_number);
	if (!dayData) return json({ error: `Day ${payload.day_number} not found` }, { status: 404 });

	const { match, error: matchError } = findActivityByTitle(dayData.activities as any, payload.activity_title);
	if (!match) return json({ error: matchError ?? 'Activity not found' }, { status: 404 });

	const { error: deleteError } = await supabase.from('activities').delete().eq('id', match.id);
	if (deleteError) return json({ error: 'Failed to delete activity' }, { status: 500 });
	resultId = match.id;
```

**Step 5: Add update_activity handler**

```typescript
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
```

**Step 6: Add log_expense handler**

```typescript
} else if (metadata.action === 'log_expense') {
	const { payload } = metadata;

	// Resolve paid_by to member_id
	let paidByMemberId: string;
	const members = await getTripMembers(supabase);
	if (payload.paid_by_name) {
		const member = findMemberByName(members, payload.paid_by_name);
		if (!member) return json({ error: `Member "${payload.paid_by_name}" not found` }, { status: 404 });
		paidByMemberId = member.id;
	} else {
		// Default to current user's member record
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
```

**Step 7: Add record_payment handler**

```typescript
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
```

**Step 8: Update the approved status footer to handle new action types**

The existing code at line 163 sets `updated.result_id`. This works for all new types since they all have `result_id?: string` in the union. No change needed.

**Step 9: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 10: Commit**

```bash
git add src/routes/api/chat/action/+server.ts
git commit -m "feat: add approve handlers for replace/delete/update activity, log expense, record payment"
```

---

## Task 5: Update ActionCard UI with new visual variants

**Files:**
- Modify: `src/lib/components/trip/ActionCard.svelte`

**Step 1: Add imports for expense icons**

Add to the script section:
```typescript
import { EXPENSE_CATEGORY_ICONS, EXPENSE_CATEGORY_LABELS } from '$lib/types/app';
```

**Step 2: Add UI blocks for new action types**

After the `suggest_itinerary_change` block (line 129), add new `{:else if}` blocks. All inside the `<div class="p-3">` container:

**Replace activity:**
```svelte
{:else if metadata.action === 'replace_activity'}
	<div class="flex items-start gap-2.5">
		<div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg {status === 'dismissed' ? 'bg-slate-100' : 'bg-white'} text-base shadow-sm">
			🔄
		</div>
		<div class="min-w-0 flex-1">
			<p class="text-xs font-medium text-slate-500">Replace on Day {metadata.payload.day_number}</p>
			<div class="mt-1 space-y-1">
				<div class="flex items-center gap-1.5 text-sm">
					<span class="text-red-400 line-through">{metadata.payload.old_title}</span>
					<svg class="h-3 w-3 flex-shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
					</svg>
					<span class="font-semibold {status === 'dismissed' ? 'text-slate-400' : 'text-slate-800'}">{metadata.payload.new_title}</span>
				</div>
			</div>
			<div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
				{#if metadata.payload.start_time}<span>{metadata.payload.start_time}</span>{/if}
				{#if metadata.payload.location_name}<span>{metadata.payload.location_name}</span>{/if}
				{#if metadata.payload.cost_estimate}<span>${metadata.payload.cost_estimate}</span>{/if}
			</div>
		</div>
	</div>
```

**Delete activity:**
```svelte
{:else if metadata.action === 'delete_activity'}
	<div class="flex items-start gap-2.5">
		<div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg {status === 'dismissed' ? 'bg-slate-100' : 'bg-red-50'} text-base shadow-sm">
			🗑️
		</div>
		<div class="min-w-0 flex-1">
			<p class="text-xs font-medium text-slate-500">Remove from Day {metadata.payload.day_number}</p>
			<p class="mt-0.5 text-sm font-semibold {status === 'approved' ? 'text-red-400 line-through' : status === 'dismissed' ? 'text-slate-400' : 'text-slate-800'}">
				{metadata.payload.activity_title}
			</p>
		</div>
	</div>
```

**Update activity:**
```svelte
{:else if metadata.action === 'update_activity'}
	<div class="flex items-start gap-2.5">
		<div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg {status === 'dismissed' ? 'bg-slate-100' : 'bg-white'} text-base shadow-sm">
			✏️
		</div>
		<div class="min-w-0 flex-1">
			<p class="text-sm font-semibold {status === 'dismissed' ? 'text-slate-400' : 'text-slate-800'}">
				{metadata.payload.activity_title}
			</p>
			<p class="text-xs text-slate-500">Day {metadata.payload.day_number}</p>
			<div class="mt-1 flex flex-wrap gap-1.5">
				{#if metadata.payload.updates.start_time}
					<span class="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200/60">
						Time → {metadata.payload.updates.start_time}
					</span>
				{/if}
				{#if metadata.payload.updates.cost_estimate !== undefined}
					<span class="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200/60">
						Cost → ${metadata.payload.updates.cost_estimate}
					</span>
				{/if}
				{#if metadata.payload.updates.status}
					<span class="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200/60">
						Status → {metadata.payload.updates.status}
					</span>
				{/if}
				{#if metadata.payload.updates.location_name}
					<span class="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200/60">
						Location → {metadata.payload.updates.location_name}
					</span>
				{/if}
				{#if metadata.payload.updates.description}
					<span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
						Description updated
					</span>
				{/if}
			</div>
		</div>
	</div>
```

**Log expense:**
```svelte
{:else if metadata.action === 'log_expense'}
	{@const catIcon = EXPENSE_CATEGORY_ICONS[metadata.payload.category] ?? '📦'}
	<div class="flex items-start gap-2.5">
		<div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg {status === 'dismissed' ? 'bg-slate-100' : 'bg-emerald-50'} text-base shadow-sm">
			{catIcon}
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<p class="text-sm font-semibold {status === 'dismissed' ? 'text-slate-400 line-through' : 'text-slate-800'}">
					{metadata.payload.title}
				</p>
				<span class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
					${metadata.payload.amount.toFixed(2)}
				</span>
			</div>
			<div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
				<span class="capitalize">{metadata.payload.category}</span>
				{#if metadata.payload.day_number}<span>Day {metadata.payload.day_number}</span>{/if}
				{#if metadata.payload.paid_by_name}<span>Paid by {metadata.payload.paid_by_name}</span>{/if}
			</div>
			{#if metadata.payload.notes}
				<p class="mt-0.5 text-xs text-slate-400">{metadata.payload.notes}</p>
			{/if}
		</div>
	</div>
```

**Record payment:**
```svelte
{:else if metadata.action === 'record_payment'}
	<div class="flex items-start gap-2.5">
		<div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg {status === 'dismissed' ? 'bg-slate-100' : 'bg-blue-50'} text-base shadow-sm">
			💸
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-1.5 text-sm font-semibold {status === 'dismissed' ? 'text-slate-400' : 'text-slate-800'}">
				<span>{metadata.payload.from_name}</span>
				<svg class="h-3 w-3 flex-shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
				</svg>
				<span>{metadata.payload.to_name}</span>
				<span class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
					${metadata.payload.amount.toFixed(2)}
				</span>
			</div>
			<div class="mt-0.5 flex items-center gap-x-2 text-xs text-slate-500">
				{#if metadata.payload.method}<span class="capitalize">{metadata.payload.method}</span>{/if}
				{#if metadata.payload.notes}<span>{metadata.payload.notes}</span>{/if}
			</div>
		</div>
	</div>
```

**Step 3: Update the approve button labels**

The existing approve button says "Add to itinerary". Update it to be context-aware. Replace the approve button text (line 206) with:

```svelte
{#if metadata.action === 'create_activity'}
	Add to itinerary
{:else if metadata.action === 'replace_activity'}
	Replace activity
{:else if metadata.action === 'delete_activity'}
	Remove activity
{:else if metadata.action === 'update_activity'}
	Update activity
{:else if metadata.action === 'log_expense'}
	Log expense
{:else if metadata.action === 'record_payment'}
	Record payment
{:else}
	Approve
{/if}
```

**Step 4: Update the approved status footer**

Replace the static "Added to Day X as tentative" block with context-aware text:

```svelte
{#if metadata.action === 'create_activity'}
	Added to Day {metadata.payload.day_number} as tentative
{:else if metadata.action === 'replace_activity'}
	Replaced on Day {metadata.payload.day_number}
{:else if metadata.action === 'delete_activity'}
	Removed from Day {metadata.payload.day_number}
{:else if metadata.action === 'update_activity'}
	Updated on Day {metadata.payload.day_number}
{:else if metadata.action === 'add_packing_item'}
	Added to {metadata.payload.checklist_type} list
{:else if metadata.action === 'log_expense'}
	Expense logged
{:else if metadata.action === 'record_payment'}
	Payment recorded
{:else}
	Noted
{/if}
```

**Step 5: Update pending check to include new action types**

Line 175 currently checks `metadata.action !== 'suggest_itinerary_change'`. This already works correctly — the suggest action is the only one without approve/dismiss. No change needed.

**Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 7: Commit**

```bash
git add src/lib/components/trip/ActionCard.svelte
git commit -m "feat: add ActionCard UI variants for replace, delete, update, expense, and payment actions"
```

---

## Task 6: Update SharedSuggestionCard for new action types

**Files:**
- Modify: `src/lib/components/family/SharedSuggestionCard.svelte`

**Step 1: Add imports**

```typescript
import { EXPENSE_CATEGORY_ICONS } from '$lib/types/app';
```

**Step 2: Add content blocks for new action types**

After the `suggest_itinerary_change` block (line 83), before the closing `{/if}` of the content section, add:

```svelte
{:else if metadata.action === 'replace_activity'}
	<div class="flex items-start gap-2.5">
		<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm shadow-sm ring-1 ring-indigo-100/50">
			🔄
		</div>
		<div class="min-w-0 flex-1">
			<p class="text-[11px] font-medium text-slate-500">Replace on Day {metadata.payload.day_number}</p>
			<div class="mt-0.5 flex items-center gap-1.5 text-[13px]">
				<span class="text-red-400 line-through">{metadata.payload.old_title}</span>
				<span class="text-slate-400">→</span>
				<span class="font-semibold text-slate-800">{metadata.payload.new_title}</span>
			</div>
		</div>
	</div>
{:else if metadata.action === 'delete_activity'}
	<div class="flex items-start gap-2.5">
		<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm shadow-sm ring-1 ring-indigo-100/50">
			🗑️
		</div>
		<div>
			<p class="text-[11px] font-medium text-slate-500">Remove from Day {metadata.payload.day_number}</p>
			<p class="mt-0.5 text-[13px] font-semibold text-slate-800">{metadata.payload.activity_title}</p>
		</div>
	</div>
{:else if metadata.action === 'update_activity'}
	<div class="flex items-start gap-2.5">
		<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm shadow-sm ring-1 ring-indigo-100/50">
			✏️
		</div>
		<div>
			<p class="text-[13px] font-semibold text-slate-800">{metadata.payload.activity_title}</p>
			<p class="text-[11px] text-slate-500">Update on Day {metadata.payload.day_number}</p>
		</div>
	</div>
{:else if metadata.action === 'log_expense'}
	{@const catIcon = EXPENSE_CATEGORY_ICONS[metadata.payload.category] ?? '📦'}
	<div class="flex items-start gap-2.5">
		<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm shadow-sm ring-1 ring-indigo-100/50">
			{catIcon}
		</div>
		<div>
			<div class="flex items-center gap-1.5">
				<p class="text-[13px] font-semibold text-slate-800">{metadata.payload.title}</p>
				<span class="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">${metadata.payload.amount.toFixed(2)}</span>
			</div>
			<p class="text-[11px] capitalize text-slate-500">{metadata.payload.category}</p>
		</div>
	</div>
{:else if metadata.action === 'record_payment'}
	<div class="flex items-start gap-2.5">
		<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm shadow-sm ring-1 ring-indigo-100/50">
			💸
		</div>
		<div>
			<div class="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
				<span>{metadata.payload.from_name}</span>
				<span class="text-slate-400">→</span>
				<span>{metadata.payload.to_name}</span>
				<span class="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">${metadata.payload.amount.toFixed(2)}</span>
			</div>
			{#if metadata.payload.method}
				<p class="text-[11px] capitalize text-slate-500">{metadata.payload.method}</p>
			{/if}
		</div>
	</div>
```

**Step 3: Update approved status footer**

Replace the static "Added to itinerary" text with context-aware versions matching Task 5's approach:

```svelte
{#if metadata.action === 'create_activity'}
	Added to itinerary
{:else if metadata.action === 'replace_activity'}
	Activity replaced
{:else if metadata.action === 'delete_activity'}
	Activity removed
{:else if metadata.action === 'update_activity'}
	Activity updated
{:else if metadata.action === 'add_packing_item'}
	Added to list
{:else if metadata.action === 'log_expense'}
	Expense logged
{:else if metadata.action === 'record_payment'}
	Payment recorded
{:else}
	Approved
{/if}
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/lib/components/family/SharedSuggestionCard.svelte
git commit -m "feat: add SharedSuggestionCard variants for new action types"
```

---

## Task 7: Manual testing in dev

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test itinerary tools via guide chat**

Navigate to `/guide` and test these prompts:
- "Cancel the Subway lunch on Day 4" → should show delete ActionCard
- "Replace the Grand Canyon hike with Bright Angel Trail" → should show replace ActionCard
- "Move the hotel check-in to 3pm on Day 2" → should show update ActionCard
- Approve each and verify the change appears on the day page

**Step 3: Test expense tools**

- "We spent $45 on lunch at In-N-Out" → should show expense ActionCard
- "Dylan sent Dad $150 via e-transfer" → should show payment ActionCard
- "How much have we spent so far?" → should return formatted budget summary (no ActionCard)

**Step 4: Test edge cases**

- Ambiguous activity name → should see error in AI response asking for clarification
- Unknown member name → should see friendly error
- Dismiss an action → verify it shows dismissed state

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 0 | 20+ files | Commit sessions 11+12 |
| 1 | `app.ts` | Add 5 ActionMetadata union members |
| 2 | `fuzzy-match.ts` (new) | Fuzzy activity + member matching |
| 3 | `api/chat/+server.ts` | 6 tool definitions, model upgrade, context builders |
| 4 | `api/chat/action/+server.ts` | 5 approve handlers with fuzzy matching |
| 5 | `ActionCard.svelte` | 5 new UI variants |
| 6 | `SharedSuggestionCard.svelte` | 5 new UI variants for family chat |
| 7 | Manual | E2E testing in dev |
