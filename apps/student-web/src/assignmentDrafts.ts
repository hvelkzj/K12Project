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
      return parsed as Record<string, AssignmentDraft>
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
