import type { StudentOverview, UserSummary } from '@k12/shared'
import { reactive } from 'vue'

import {
  mobileStudentClient,
  MobileClientError,
  type MobileStudentClient,
} from './mobileClient'

export interface MobileSessionState {
  user: UserSummary | null
  overview: StudentOverview | null
  initializing: boolean
  loading: boolean
  error: string
}

export function createMobileSession(
  client: MobileStudentClient = mobileStudentClient,
) {
  const state = reactive<MobileSessionState>({
    user: null,
    overview: null,
    initializing: true,
    loading: false,
    error: '',
  })

  async function handle<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof MobileClientError && error.status === 401) {
        state.user = null
        state.overview = null
      }
      state.error = error instanceof Error ? error.message : '操作失败，请稍后重试'
      throw error
    }
  }

  async function loadOverview(force = false): Promise<StudentOverview | null> {
    if (!state.user) return null
    if (state.overview && !force) return state.overview
    state.loading = true
    state.error = ''
    try {
      state.overview = await handle(() => client.getOverview())
      return state.overview
    } finally {
      state.loading = false
    }
  }

  return {
    state,
    async restore() {
      state.initializing = true
      state.error = ''
      try {
        state.user = await handle(() => client.restoreCurrentUser())
        if (state.user) await loadOverview(true)
      } finally {
        state.initializing = false
      }
    },
    async login(username: string, password: string) {
      state.error = ''
      state.user = await handle(() => client.login(username, password))
      await loadOverview(true)
      return state.user
    },
    loadOverview,
    async logout() {
      try {
        await client.logout()
      } finally {
        state.user = null
        state.overview = null
        state.error = ''
      }
    },
    clearError() {
      state.error = ''
    },
  }
}

export const mobileSession = createMobileSession()
