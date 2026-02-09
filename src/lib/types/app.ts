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

export type ActivityType = Enums<'activity_type'>;
export type ActivityStatus = Enums<'activity_status'>;
export type UserRole = Enums<'user_role'>;
export type VoteType = Enums<'vote_type'>;

export type DayWithActivities = Day & { activities: Activity[] };
export type ActivityWithVotes = Activity & { votes: Vote[] };

export const TRIP_ID = '00000000-0000-0000-0000-000000000001';
