import type { IncomingMessage, ServerResponse } from 'node:http'

import type { UserSummary } from '@k12/shared'

import type { AuthService } from './authService.js'
import { BusinessError } from './businessStore.js'
import type { BusinessInput, BusinessStore } from './businessTypes.js'
import {
  getBearerToken,
  isJsonRequest,
  readJsonBody,
  sendError,
  sendJson,
} from './http.js'

const parentOverviewPattern = /^\/parent\/students\/(\d+)\/overview$/
const parentFeedbackPattern = /^\/parent\/feedback\/(\d+)$/
const parentNotificationReadPattern =
  /^\/parent\/notifications\/(\d+)\/read$/
const teacherSubmissionPattern = /^\/teacher\/submissions\/(\d+)$/
const adminReviewPattern = /^\/admin\/schedule-changes\/(\d+)\/review$/
const adminSubstitutePattern =
  /^\/admin\/schedule-changes\/(\d+)\/substitute$/
const adminWorkOrderPattern = /^\/admin\/work-orders\/(\d+)$/
const adminLeaveReviewPattern =
  /^\/admin\/leave-requests\/(\d+)\/review$/
const adminSchedulePattern = /^\/admin\/schedules\/(\d+)$/
const adminUserPattern = /^\/admin\/users\/(\d+)$/

const exactBusinessPaths = new Set([
  '/parent/students',
  '/parent/leave-requests',
  '/student/overview',
  '/student/submissions',
  '/teacher/overview',
  '/teacher/attendance',
  '/teacher/assignments',
  '/teacher/feedback',
  '/teacher/schedule-changes',
  '/admin/overview',
  '/admin/schedules',
])

function dynamicPathMatches(path: string): boolean {
  return [
    parentOverviewPattern,
    parentFeedbackPattern,
    parentNotificationReadPattern,
    teacherSubmissionPattern,
    adminReviewPattern,
    adminSubstitutePattern,
    adminWorkOrderPattern,
    adminLeaveReviewPattern,
    adminSchedulePattern,
    adminUserPattern,
  ].some((pattern) => pattern.test(path))
}

export function isBusinessPath(path: string): boolean {
  return exactBusinessPaths.has(path) || dynamicPathMatches(path)
}

function methodNotAllowed(
  response: ServerResponse,
  allowedMethods: readonly string[],
): void {
  response.setHeader('Allow', `${allowedMethods.join(', ')}, OPTIONS`)
  sendError(response, 405, 'METHOD_NOT_ALLOWED', '请求方法不支持')
}

function requireUser(
  request: IncomingMessage,
  response: ServerResponse,
  authService: AuthService,
): UserSummary | null {
  const accessToken = getBearerToken(request)
  if (!accessToken) {
    response.setHeader('WWW-Authenticate', 'Bearer realm="k12-api"')
    sendError(response, 401, 'AUTH_REQUIRED', '请提供 Bearer 登录令牌')
    return null
  }

  const user = authService.getCurrentUser(accessToken)
  if (!user) {
    response.setHeader('WWW-Authenticate', 'Bearer realm="k12-api"')
    sendError(response, 401, 'INVALID_SESSION', '登录已失效，请重新登录')
    return null
  }
  return user
}

async function readBusinessInput(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<BusinessInput | null> {
  if (!isJsonRequest(request)) {
    sendError(
      response,
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      '业务写接口只接受 application/json',
    )
    return null
  }

  const body = await readJsonBody(request)
  if (!body.ok) {
    sendJson(response, body.status, body.error)
    return null
  }
  if (!body.value || typeof body.value !== 'object' || Array.isArray(body.value)) {
    throw new BusinessError(
      422,
      'VALIDATION_ERROR',
      '请求体必须是 JSON 对象',
    )
  }
  return body.value as BusinessInput
}

function pathId(match: RegExpMatchArray): number {
  return Number(match[1])
}

export async function handleBusinessRequest(
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
  method: string,
  authService: AuthService,
  store: BusinessStore,
): Promise<boolean> {
  if (!isBusinessPath(path)) return false

  const user = requireUser(request, response, authService)
  if (!user) return true

  if (path === '/parent/students') {
    if (method !== 'GET') methodNotAllowed(response, ['GET'])
    else sendJson(response, 200, store.listParentStudents(user))
    return true
  }

  const parentOverviewMatch = path.match(parentOverviewPattern)
  if (parentOverviewMatch) {
    if (method !== 'GET') methodNotAllowed(response, ['GET'])
    else {
      sendJson(
        response,
        200,
        store.getParentOverview(user, pathId(parentOverviewMatch)),
      )
    }
    return true
  }

  if (path === '/parent/leave-requests') {
    if (method !== 'POST') methodNotAllowed(response, ['POST'])
    else {
      const input = await readBusinessInput(request, response)
      if (input) sendJson(response, 201, store.submitLeaveRequest(user, input))
    }
    return true
  }

  const parentFeedbackMatch = path.match(parentFeedbackPattern)
  if (parentFeedbackMatch) {
    if (method !== 'PATCH') methodNotAllowed(response, ['PATCH'])
    else {
      const input = await readBusinessInput(request, response)
      if (input) {
        sendJson(
          response,
          200,
          store.respondToFeedback(user, pathId(parentFeedbackMatch), input),
        )
      }
    }
    return true
  }

  const parentNotificationReadMatch = path.match(parentNotificationReadPattern)
  if (parentNotificationReadMatch) {
    if (method !== 'PATCH') methodNotAllowed(response, ['PATCH'])
    else {
      const input = await readBusinessInput(request, response)
      if (input) {
        sendJson(
          response,
          200,
          store.markNotificationRead(
            user,
            pathId(parentNotificationReadMatch),
            input,
          ),
        )
      }
    }
    return true
  }

  if (path === '/student/overview') {
    if (method !== 'GET') methodNotAllowed(response, ['GET'])
    else sendJson(response, 200, store.getStudentOverview(user))
    return true
  }

  if (path === '/student/submissions') {
    if (method !== 'POST') methodNotAllowed(response, ['POST'])
    else {
      const input = await readBusinessInput(request, response)
      if (input) sendJson(response, 201, store.submitStudentWork(user, input))
    }
    return true
  }

  if (path === '/teacher/overview') {
    if (method !== 'GET') methodNotAllowed(response, ['GET'])
    else sendJson(response, 200, store.getTeacherOverview(user))
    return true
  }

  if (path === '/teacher/attendance') {
    if (method !== 'PUT') methodNotAllowed(response, ['PUT'])
    else {
      const input = await readBusinessInput(request, response)
      if (input) sendJson(response, 200, store.saveAttendance(user, input))
    }
    return true
  }

  if (path === '/teacher/assignments') {
    if (method !== 'POST') methodNotAllowed(response, ['POST'])
    else {
      const input = await readBusinessInput(request, response)
      if (input) sendJson(response, 201, store.publishAssignment(user, input))
    }
    return true
  }

  const teacherSubmissionMatch = path.match(teacherSubmissionPattern)
  if (teacherSubmissionMatch) {
    if (method !== 'PATCH') methodNotAllowed(response, ['PATCH'])
    else {
      const input = await readBusinessInput(request, response)
      if (input) {
        sendJson(
          response,
          200,
          store.gradeSubmission(user, pathId(teacherSubmissionMatch), input),
        )
      }
    }
    return true
  }

  if (path === '/teacher/feedback') {
    if (method !== 'POST') methodNotAllowed(response, ['POST'])
    else {
      const input = await readBusinessInput(request, response)
      if (input) sendJson(response, 201, store.sendFeedback(user, input))
    }
    return true
  }

  if (path === '/teacher/schedule-changes') {
    if (method !== 'POST') methodNotAllowed(response, ['POST'])
    else {
      const input = await readBusinessInput(request, response)
      if (input) sendJson(response, 201, store.requestScheduleChange(user, input))
    }
    return true
  }

  if (path === '/admin/overview') {
    if (method !== 'GET') methodNotAllowed(response, ['GET'])
    else sendJson(response, 200, store.getAdminOverview(user))
    return true
  }

  if (path === '/admin/schedules') {
    if (method !== 'POST') methodNotAllowed(response, ['POST'])
    else {
      const input = await readBusinessInput(request, response)
      if (input) sendJson(response, 201, store.createSchedule(user, input))
    }
    return true
  }

  const adminScheduleMatch = path.match(adminSchedulePattern)
  if (adminScheduleMatch) {
    if (method !== 'PATCH') methodNotAllowed(response, ['PATCH'])
    else {
      const input = await readBusinessInput(request, response)
      if (input) {
        sendJson(
          response,
          200,
          store.updateSchedule(user, pathId(adminScheduleMatch), input),
        )
      }
    }
    return true
  }

  const adminLeaveReviewMatch = path.match(adminLeaveReviewPattern)
  if (adminLeaveReviewMatch) {
    if (method !== 'PATCH') methodNotAllowed(response, ['PATCH'])
    else {
      const input = await readBusinessInput(request, response)
      if (input) {
        sendJson(
          response,
          200,
          store.reviewLeaveRequest(
            user,
            pathId(adminLeaveReviewMatch),
            input,
          ),
        )
      }
    }
    return true
  }

  const adminUserMatch = path.match(adminUserPattern)
  if (adminUserMatch) {
    if (method !== 'PATCH') methodNotAllowed(response, ['PATCH'])
    else {
      const input = await readBusinessInput(request, response)
      if (input) {
        const updated = store.updateUserAccount(
          user,
          pathId(adminUserMatch),
          input,
        )
        authService.setAccountActive(updated.id, updated.active)
        sendJson(response, 200, updated)
      }
    }
    return true
  }

  const adminReviewMatch = path.match(adminReviewPattern)
  if (adminReviewMatch) {
    if (method !== 'PATCH') methodNotAllowed(response, ['PATCH'])
    else {
      const input = await readBusinessInput(request, response)
      if (input) {
        sendJson(
          response,
          200,
          store.reviewScheduleChange(user, pathId(adminReviewMatch), input),
        )
      }
    }
    return true
  }

  const adminSubstituteMatch = path.match(adminSubstitutePattern)
  if (adminSubstituteMatch) {
    if (method !== 'PATCH') methodNotAllowed(response, ['PATCH'])
    else {
      const input = await readBusinessInput(request, response)
      if (input) {
        sendJson(
          response,
          200,
          store.assignSubstitute(user, pathId(adminSubstituteMatch), input),
        )
      }
    }
    return true
  }

  const adminWorkOrderMatch = path.match(adminWorkOrderPattern)
  if (adminWorkOrderMatch) {
    if (method !== 'PATCH') methodNotAllowed(response, ['PATCH'])
    else {
      const input = await readBusinessInput(request, response)
      if (input) {
        sendJson(
          response,
          200,
          store.updateWorkOrder(user, pathId(adminWorkOrderMatch), input),
        )
      }
    }
    return true
  }

  return false
}
