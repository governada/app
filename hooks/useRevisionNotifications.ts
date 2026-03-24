'use client';

/**
 * Revision notification hooks.
 *
 * Fetches unread revision notifications for the current user
 * and provides a mutation to mark them as read.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RevisionNotification } from '@/lib/workspace/revision/types';
import { fetchJson, patchJson } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

interface NotificationsResponse {
  notifications: RevisionNotification[];
  unreadCount: number;
}

/** Fetch unread revision notifications for the current user */
export function useRevisionNotifications(enabled = true) {
  return useQuery<NotificationsResponse>({
    queryKey: ['revision-notifications'],
    queryFn: () => fetchJson<NotificationsResponse>('/api/workspace/revision/notifications'),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000, // Poll every minute for new notifications
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Mark a revision notification as read */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      patchJson<{ notification: RevisionNotification }>('/api/workspace/revision/notifications', {
        notificationId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revision-notifications'] });
    },
  });
}
