import type { FileSummary } from '@k12/shared'

export interface AssignmentDraft {
  content: string
  attachments: FileSummary[]
}

export const assignmentDraftsStorageKey = 'k12StudentAssignmentDrafts'

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface AssignmentDraftStore {
  save(assignmentId: number, draft: AssignmentDraft): void
  load(assignmentId: number): AssignmentDraft | null
  clear(assignmentId: number): void
}

function createMemoryStorage(): DraftStorage {
  const values = new Map<string, string>()

  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

function getDefaultStorage(): DraftStorage {
  return typeof localStorage === 'undefined'
    ? createMemoryStorage()
    : localStorage
}

function cloneDraft(draft: AssignmentDraft): AssignmentDraft {
  return {
    content: draft.content,
    attachments: draft.attachments.map((attachment) => ({ ...attachment })),
  }
}

function isFileSummary(value: unknown): value is FileSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'number' &&
    Number.isFinite(candidate.id) &&
    typeof candidate.originalName === 'string' &&
    typeof candidate.mimeType === 'string' &&
    typeof candidate.byteSize === 'number' &&
    Number.isFinite(candidate.byteSize) &&
    typeof candidate.createdAt === 'string'
  )
}

function normalizeDraft(value: unknown): AssignmentDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.content !== 'string' ||
    !Array.isArray(candidate.attachments) ||
    !candidate.attachments.every(isFileSummary)
  ) {
    return null
  }

  return cloneDraft({
    content: candidate.content,
    attachments: candidate.attachments,
  })
}

export function createAssignmentDraftStore(
  storage: DraftStorage = getDefaultStorage(),
): AssignmentDraftStore {
  function readAll(): Record<string, AssignmentDraft> {
    const raw = storage.getItem(assignmentDraftsStorageKey)
    if (!raw) return {}

    try {
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {}
      }
      return Object.fromEntries(
        Object.entries(parsed)
          .map(([key, value]) => [key, normalizeDraft(value)] as const)
          .filter((entry): entry is readonly [string, AssignmentDraft] =>
            entry[1] !== null,
          ),
      )
    } catch {
      return {}
    }
  }

  function writeAll(drafts: Record<string, AssignmentDraft>): void {
    storage.setItem(assignmentDraftsStorageKey, JSON.stringify(drafts))
  }

  return {
    save(assignmentId, draft) {
      const all = readAll()
      all[String(assignmentId)] = cloneDraft(draft)
      writeAll(all)
    },

    load(assignmentId) {
      const draft = readAll()[String(assignmentId)]
      return draft ? cloneDraft(draft) : null
    },

    clear(assignmentId) {
      const all = readAll()
      if (!Object.prototype.hasOwnProperty.call(all, String(assignmentId))) {
        return
      }
      delete all[String(assignmentId)]
      writeAll(all)
    },
  }
}

export const assignmentDrafts = createAssignmentDraftStore()
