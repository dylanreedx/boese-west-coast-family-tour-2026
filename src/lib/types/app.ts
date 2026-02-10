import type { Tables, TablesInsert, TablesUpdate, Enums } from './database';

export type Trip = Tables<'trips'>;
export type Day = Tables<'days'>;
export type Activity = Tables<'activities'>;
export type Vote = Tables<'votes'>;
export type Comment = Tables<'comments'>;
export type TripMember = Tables<'trip_members'>;
export type Profile = Tables<'profiles'>;
export type Checklist = Tables<'checklists'>;
export type ChecklistItem = Tables<'checklist_items'>;
export type Suggestion = Tables<'suggestions'>;

export type ActivityInsert = TablesInsert<'activities'>;
export type ActivityUpdate = TablesUpdate<'activities'>;
export type CommentInsert = TablesInsert<'comments'>;
export type VoteInsert = TablesInsert<'votes'>;
export type ChecklistItemInsert = TablesInsert<'checklist_items'>;
export type ChatMessage = Tables<'chat_messages'>;
export type ChatMessageInsert = TablesInsert<'chat_messages'>;
export type GroupMessage = Tables<'group_messages'>;
export type GroupMessageInsert = TablesInsert<'group_messages'>;
export type MessageReaction = Tables<'message_reactions'>;
export type MessageReactionInsert = TablesInsert<'message_reactions'>;

export type ActivityType = Enums<'activity_type'>;
export type ActivityStatus = Enums<'activity_status'>;
export type UserRole = Enums<'user_role'>;
export type VoteType = Enums<'vote_type'>;

export type DayWithActivities = Day & { activities: Activity[] };
export type ActivityWithVotes = Activity & { votes: Vote[] };

export const TRIP_ID = '00000000-0000-0000-0000-000000000001';

export type ActionStatus = 'pending' | 'approved' | 'dismissed';
export type ActionMetadata =
	| {
			action: 'create_activity';
			status: ActionStatus;
			payload: {
				day_number: number;
				title: string;
				type: ActivityType;
				start_time?: string;
				location_name?: string;
				description?: string;
				cost_estimate?: number;
			};
			result_id?: string;
	  }
	| {
			action: 'add_packing_item';
			status: ActionStatus;
			payload: {
				checklist_type: 'packing' | 'todo' | 'shopping';
				label: string;
			};
			result_id?: string;
	  }
	| {
			action: 'suggest_itinerary_change';
			status: ActionStatus;
			payload: {
				day_number: number;
				suggestion_text: string;
			};
	  };

export type FamilyFeedback = {
	reactions: { emoji: string; memberName: string }[];
	reactionSummary: { emoji: string; count: number }[];
};

export type PlaceDetails = {
	name: string;
	rating?: number;
	userRatingCount?: number;
	priceLevel?: string;
	formattedAddress?: string;
	openNow?: boolean;
	weekdayHours?: string[];
	location?: { lat: number; lng: number };
	photos: string[];
	websiteUri?: string;
	googleMapsUri?: string;
	editorialSummary?: string;
	mapsEmbedUrl?: string;
};
