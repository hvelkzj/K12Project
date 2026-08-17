import type { IncomingMessage, ServerResponse } from 'node:http'

import type {
  CurrentUserResponse,
  LoginRequest,
} from '@k12/shared'

import { createAuthService } from './authService.js'
import type { AuthService } from './authService.js'
import {
  handleBusinessRequest,
  isBusinessPath,
} from './businessRoutes.js'
import {
  BusinessError,
  createBusinessStore,
} from './businessStore.js'
import type { BusinessStore } from './businessTypes.js'
import {
  getBearerToken,
  isJsonRequest,
  readJsonBody,
  sendError,
  sendJson,
  sendNoContent,
  setCorsHeaders,
} from './http.js'

type RequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>

function requestPath(request: IncomingMessage): string {
  return new URL(request.url ?? '/', 'http://127.0.0.1').pathname
}

function isLoginRequest(value: unknown): value is LoginRequest {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.username === 'string' &&
    candidate.username.trim().length > 0 &&
    typeof candidate.password === 'string' &&
    candidate.password.length > 0
  )
}

function requireBearerToken(
  request: IncomingMessage,
  response: ServerResponse,
): string | null {
  const accessToken = getBearerToken(request)

  if (!accessToken) {
    response.setHeader('WWW-Authenticate', 'Bearer realm="k12-api"')
    sendError(response, 401, 'AUTH_REQUIRED', '请提供 Bearer 登录令牌')
    return null
  }

  return accessToken
}

function methodNotAllowed(
  response: ServerResponse,
  allowedMethod: 'GET' | 'POST',
): void {
  response.setHeader('Allow', `${allowedMethod}, OPTIONS`)
  sendError(response, 405, 'METHOD_NOT_ALLOWED', '请求方法不支持')
}

function invalidSession(response: ServerResponse): void {
  response.setHeader('WWW-Authenticate', 'Bearer realm="k12-api"')
  sendError(response, 401, 'INVALID_SESSION', '登录已失效，请重新登录')
}

export function createRequestHandler(
  authService: AuthService,
  businessStore: BusinessStore = createBusinessStore(),
): RequestHandler {
  return async (request, response) => {
    setCorsHeaders(response)

    try {
      const method = request.method ?? 'GET'
      const path = requestPath(request)
      const knownPath =
        path === '/health' ||
        path === '/auth/login' ||
        path === '/auth/me' ||
        path === '/auth/logout' ||
        isBusinessPath(path)

      if (path.startsWith('/auth/') || isBusinessPath(path)) {
        response.setHeader('Cache-Control', 'no-store')
      }

      if (method === 'OPTIONS' && knownPath) {
        sendNoContent(response)
        return
      }

      if (path === '/health') {
        if (method !== 'GET') {
          methodNotAllowed(response, 'GET')
          return
        }

        sendJson(response, 200, {
          service: 'k12-api',
          status: 'ok',
        })
        return
      }

      if (path === '/auth/login') {
        if (method !== 'POST') {
          methodNotAllowed(response, 'POST')
          return
        }

        if (!isJsonRequest(request)) {
          sendError(
            response,
            415,
            'UNSUPPORTED_MEDIA_TYPE',
            '登录接口只接受 application/json',
          )
          return
        }

        const body = await readJsonBody(request)
        if (!body.ok) {
          sendJson(response, body.status, body.error)
          return
        }

        if (!isLoginRequest(body.value)) {
          sendError(
            response,
            400,
            'VALIDATION_ERROR',
            'username 和 password 必须是非空字符串',
          )
          return
        }

        const login = authService.login(
          body.value.username.trim(),
          body.value.password,
        )
        if (!login) {
          sendError(
            response,
            401,
            'INVALID_CREDENTIALS',
            '账号或密码错误',
          )
          return
        }

        sendJson(response, 200, login)
        return
      }

      if (path === '/auth/me') {
        if (method !== 'GET') {
          methodNotAllowed(response, 'GET')
          return
        }

        const accessToken = requireBearerToken(request, response)
        if (!accessToken) return

        const user = authService.getCurrentUser(accessToken)
        if (!user) {
          invalidSession(response)
          return
        }

        sendJson(response, 200, { user } satisfies CurrentUserResponse)
        return
      }

      if (path === '/auth/logout') {
        if (method !== 'POST') {
          methodNotAllowed(response, 'POST')
          return
        }

        const accessToken = requireBearerToken(request, response)
        if (!accessToken) return

        if (!authService.logout(accessToken)) {
          invalidSession(response)
          return
        }

        sendNoContent(response)
        return
      }

      if (
        await handleBusinessRequest(
          request,
          response,
          path,
          method,
          authService,
          businessStore,
        )
      ) {
        return
      }

      sendError(response, 404, 'NOT_FOUND', '接口不存在')
    } catch (error) {
      if (error instanceof BusinessError) {
        sendError(response, error.status, error.code, error.message)
        return
      }
      sendError(response, 500, 'INTERNAL_ERROR', '服务暂时不可用')
    }
  }
}

export const authService = createAuthService()
export const businessStore = createBusinessStore()
export const requestHandler = createRequestHandler(authService, businessStore)
