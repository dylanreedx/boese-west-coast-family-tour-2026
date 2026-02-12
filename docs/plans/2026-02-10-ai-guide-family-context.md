# AI Guide Family Context Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give the AI Local Guide awareness of family reactions and chat sentiment about shared suggestions, so it can reference what the family is excited about and tailor future recommendations accordingly.

**Architecture:** Add a `buildFamilyFeedbackContext()` function to the chat API endpoint that queries shared suggestions, their statuses, and family emoji reactions. Inject the resulting context string into the AI system prompt alongside the existing itinerary context. Also clean up the `FamilyFeedback` type location (move from component export to `types/app.ts`).

**Tech Stack:** SvelteKit server endpoint, Supabase queries (group_messages, message_reactions, trip_members, chat_messages), OpenAI chat completions system message.

---

### Task 1: Move FamilyFeedback type to types/app.ts

**Files:**
- Modify: `src/lib/types/app.ts` (add type at end)
- Modify: `src/lib/components/trip/ChatInterface.svelte` (remove type export, import from app.ts)
- Modify: `src/lib/components/trip/ActionCard.svelte` (update import path)

**Step 1: Add FamilyFeedback type to app.ts**

Add to the end of `src/lib/types/app.ts`:

```typescript
export type FamilyFeedback = {
	reactions: { emoji: string; memberName: string }[];
	reactionSummary: { emoji: string; count: number }[];
};
```

**Step 2: Update ChatInterface.svelte**

Remove the `FamilyFeedback` type definition (lines 11-14) and the `export` keyword from it. Replace with an import:

```typescript
import type { FamilyFeedback } from '$lib/types/app';
```

Remove these lines from the `<script>` block:
```typescript
export type FamilyFeedback = {
	reactions: { emoji: string; memberName: string }[];
	reactionSummary: { emoji: string; count: number }[];
};
```

**Step 3: Update ActionCard.svelte import**

Change:
```typescript
import type { FamilyFeedback } from './ChatInterface.svelte';
```
To:
```typescript
import type { FamilyFeedback } from '$lib/types/app';
```

**Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds with no new errors.

**Step 5: Commit**

```bash
git add src/lib/types/app.ts src/lib/components/trip/ChatInterface.svelte src/lib/components/trip/ActionCard.svelte
git commit -m "refactor: move FamilyFeedback type to types/app.ts"
```

---

### Task 2: Create buildFamilyFeedbackContext() function

**Files:**
- Modify: `src/routes/api/chat/+server.ts` (add function after `buildItineraryContext`)

**Step 1: Add the function**

Add this function after `buildItineraryContext()` (after line 161) in `src/routes/api/chat/+server.ts`:

```typescript
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
	const lines = ['\nFamily feedback on your shared suggestions:'];

	for (const msg of sharedGroupMessages) {
		const meta = msg.shared_action_metadata as unknown as ActionMetadata | null;
		if (!meta) continue;

		// Build title based on action type
		let title = '';
		if (meta.action === 'create_activity') {
			title = `"${meta.payload.title}" (Day ${meta.payload.day_number})`;
		} else if (meta.action === 'add_packing_item') {
			title = `"${meta.payload.label}" (${meta.payload.checklist_type} list)`;
		} else if (meta.action === 'suggest_itinerary_change') {
			title = `Day ${meta.payload.day_number} suggestion`;
		}

		// Status label
		const statusLabel =
			meta.status === 'approved'
				? 'Added to itinerary'
				: meta.status === 'dismissed'
					? 'Dismissed'
					: 'Pending';

		// Reactions for this message
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
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds. The function exists but isn't called yet — no behavior change.

**Step 3: Commit**

```bash
git add src/routes/api/chat/+server.ts
git commit -m "feat: add buildFamilyFeedbackContext function for AI guide"
```

---

### Task 3: Inject family feedback context into the AI system message

**Files:**
- Modify: `src/routes/api/chat/+server.ts` (call the function and add to system message)

**Step 1: Call buildFamilyFeedbackContext in the POST handler**

In the `POST` handler, after the itinerary context is built (after line 252: `const itineraryContext = buildItineraryContext(days ?? []);`), add:

```typescript
	const familyContext = await buildFamilyFeedbackContext(supabase, user.id);
```

**Step 2: Add family context to system message**

Change the system content construction (lines 278-280) from:

```typescript
	const systemContent = itineraryContext
		? `${SYSTEM_PROMPT}\n\n${itineraryContext}`
		: SYSTEM_PROMPT;
```

To:

```typescript
	const contextParts = [SYSTEM_PROMPT];
	if (itineraryContext) contextParts.push(itineraryContext);
	if (familyContext) contextParts.push(familyContext);
	const systemContent = contextParts.join('\n\n');
```

**Step 3: Add a sentence to SYSTEM_PROMPT about family feedback**

Add this paragraph to the end of `SYSTEM_PROMPT` (before the closing backtick on line 33):

```
When family feedback is provided below, use it to inform your recommendations. If family members are excited about a suggestion (positive reactions), lean into similar recommendations. If something was dismissed, don't re-suggest it. You can naturally reference what the family thinks, like "Your family seemed excited about that!" but don't be forced about it.
```

**Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/routes/api/chat/+server.ts
git commit -m "feat: inject family reaction context into AI guide system prompt"
```

---

### Task 4: Final verification

**Step 1: Full build check**

Run: `npm run build`
Expected: Clean build, no new errors.

**Step 2: Review the complete system prompt flow**

Read `src/routes/api/chat/+server.ts` and verify:
1. `SYSTEM_PROMPT` includes the family feedback instruction paragraph
2. `buildFamilyFeedbackContext()` is called with `(supabase, user.id)`
3. `systemContent` is built from `[SYSTEM_PROMPT, itineraryContext, familyContext]`
4. The function handles the empty case (no shared messages → returns empty string → not included)

**Step 3: Commit if any adjustments needed**

Only if fixes were needed in step 2. Otherwise, done.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/lib/types/app.ts` | Add `FamilyFeedback` type |
| `src/lib/components/trip/ChatInterface.svelte` | Import `FamilyFeedback` from `types/app.ts` instead of defining locally |
| `src/lib/components/trip/ActionCard.svelte` | Import `FamilyFeedback` from `types/app.ts` instead of `ChatInterface.svelte` |
| `src/routes/api/chat/+server.ts` | Add `buildFamilyFeedbackContext()`, call it in POST handler, add family feedback instruction to system prompt, build system content from parts array |

## What This Enables

After this change, the AI guide will know:
- Which suggestions the user shared with the family
- How each suggestion was received (emoji reactions + who reacted)
- Whether suggestions were approved, dismissed, or still pending

This lets the AI say things like:
- "Your family loved the Grand Canyon hike idea! Want me to also add a sunset viewpoint for that day?"
- "Since the family was excited about In-N-Out, there's also a great taco spot nearby..."
- "I see the dinner suggestion was dismissed — want me to find a different restaurant?"
