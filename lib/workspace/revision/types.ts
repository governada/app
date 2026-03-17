/**
 * Contract E: Revision System Types
 *
 * Types for the proposal revision workflow — change justifications,
 * revision notifications, and reviewer revision review state.
 */

/** A proposer's justification for a change in a specific section */
export interface ChangeJustification {
  /** Which section was changed */
  field: 'title' | 'abstract' | 'motivation' | 'rationale';
  /** Why the proposer made this change */
  justification: string;
  /** ID of the feedback theme that prompted this change (if any) */
  linkedThemeId?: string;
}

/** A notification sent to a reviewer when a proposal is revised */
export interface RevisionNotification {
  id: string;
  proposalId: string;
  versionNumber: number;
  recipientUserId: string;
  /** How this reviewer previously interacted with the proposal */
  recipientType: 'commenter' | 'voter' | 'endorser';
  /** Which sections changed in this revision */
  sectionsChanged: string[];
  /** Which feedback themes were addressed */
  themesAddressed: string[];
  /** When the reviewer opened the revision (null = unread) */
  readAt: string | null;
  createdAt: string;
}

/** Reviewer's progress through reviewing a revision */
export interface RevisionReviewState {
  /** Total number of changed sections */
  totalChanges: number;
  /** Number of sections the reviewer has reviewed */
  reviewedChanges: number;
  /** Per-field review status */
  perField: Record<string, 'pending' | 'approved' | 'flagged'>;
}

/** A section of the proposal that changed between two versions */
export interface ChangedSection {
  /** Which field changed */
  field: string;
  /** The text from the previous version */
  oldText: string;
  /** The text from the new version */
  newText: string;
  /** Human-readable summary of changes (e.g., "12 words added, 3 removed") */
  diffSummary: string;
  /** Total number of word-level changes (additions + removals) */
  wordChangeCount: number;
}

/** Full revision state returned by the GET endpoint */
export interface RevisionState {
  /** The latest version of the draft */
  latestVersion: {
    id: string;
    versionNumber: number;
    versionName: string;
    editSummary: string | null;
    createdAt: string;
  };
  /** The previous version (for comparison), if available */
  previousVersion: {
    id: string;
    versionNumber: number;
    versionName: string;
    createdAt: string;
  } | null;
  /** Sections that changed between the last two versions */
  changedSections: ChangedSection[];
  /** Change justifications from the proposer */
  justifications: ChangeJustification[];
  /** Whether there are pending (unread) notifications for this revision */
  hasUnreadNotifications: boolean;
}
