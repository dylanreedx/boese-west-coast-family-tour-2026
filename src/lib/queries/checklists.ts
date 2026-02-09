import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';
import { TRIP_ID } from '$lib/types/app';

export function checklistsQuery(supabase: SupabaseClient<Database>) {
	return createQuery(() => ({
		queryKey: ['checklists', TRIP_ID],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('checklists')
				.select('*, checklist_items(*)')
				.eq('trip_id', TRIP_ID)
				.order('sort_order')
				.order('sort_order', { referencedTable: 'checklist_items' });
			if (error) throw error;
			return data;
		}
	}));
}

export function useCreateChecklist(supabase: SupabaseClient<Database>) {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: async ({ title, type, userId }: { title: string; type: string; userId: string }) => {
			const { data, error } = await supabase
				.from('checklists')
				.insert({ trip_id: TRIP_ID, title, type, created_by: userId })
				.select()
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['checklists', TRIP_ID] });
		}
	}));
}

export function useCreateChecklistItem(supabase: SupabaseClient<Database>) {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: async ({ checklistId, label }: { checklistId: string; label: string }) => {
			const { data, error } = await supabase
				.from('checklist_items')
				.insert({ checklist_id: checklistId, label })
				.select()
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['checklists', TRIP_ID] });
		}
	}));
}

export function useToggleChecklistItem(supabase: SupabaseClient<Database>) {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: async ({ id, isChecked, userId }: { id: string; isChecked: boolean; userId: string }) => {
			const { data, error } = await supabase
				.from('checklist_items')
				.update({ is_checked: isChecked, checked_by: isChecked ? userId : null })
				.eq('id', id)
				.select()
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['checklists', TRIP_ID] });
		}
	}));
}

export function useDeleteChecklistItem(supabase: SupabaseClient<Database>) {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: async ({ id }: { id: string }) => {
			const { error } = await supabase.from('checklist_items').delete().eq('id', id);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['checklists', TRIP_ID] });
		}
	}));
}
