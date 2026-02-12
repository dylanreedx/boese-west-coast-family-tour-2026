import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';
import type { ExpenseInsert } from '$lib/types/app';
import { TRIP_ID } from '$lib/types/app';

export function expensesQuery(supabase: SupabaseClient<Database>) {
	return createQuery(() => ({
		queryKey: ['expenses'],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('expenses')
				.select('*, expense_splits(*)')
				.eq('trip_id', TRIP_ID)
				.order('created_at', { ascending: false });
			if (error) throw error;
			return data;
		}
	}));
}

export function tripMembersQuery(supabase: SupabaseClient<Database>) {
	return createQuery(() => ({
		queryKey: ['trip-members'],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('trip_members')
				.select('*')
				.eq('trip_id', TRIP_ID)
				.order('display_name');
			if (error) throw error;
			return data;
		},
		staleTime: 5 * 60 * 1000
	}));
}

export function useCreateExpense(supabase: SupabaseClient<Database>) {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: async (expense: ExpenseInsert) => {
			const { data, error } = await supabase
				.from('expenses')
				.insert({ ...expense, trip_id: TRIP_ID })
				.select()
				.single();
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['expenses'] });
		}
	}));
}

export function useDeleteExpense(supabase: SupabaseClient<Database>) {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: async (id: string) => {
			const { error } = await supabase.from('expenses').delete().eq('id', id);
			if (error) throw error;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['expenses'] });
		}
	}));
}
