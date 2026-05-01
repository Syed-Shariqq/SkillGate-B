import { supabase } from '../config/supabase'

const SESSION_EXPIRED_CODE = 'PGRST301'
const NO_ROWS_CODE = 'PGRST116'

/**
 * Returns whether development-only logging should run.
 *
 * @returns {boolean}
 */
const isDevMode = () => Boolean(import.meta.env.DEV)

/**
 * Converts any Supabase, network, or unknown error into the service error shape.
 *
 * @param {unknown} error
 * @returns {{ message: string, code?: string, details?: unknown, type?: string }}
 */
const normalizeError = (error) => {
  if (error?.code === SESSION_EXPIRED_CODE) {
    return {
      type: 'SESSION_EXPIRED',
      message: 'Session expired',
    }
  }

  return {
    message: error?.message || 'Unexpected request error',
    code: error?.code || 'UNKNOWN_ERROR',
    details: error?.details || error?.hint || null,
  }
}

/**
 * Writes development-only query diagnostics.
 *
 * @param {object | undefined} context
 * @param {unknown} error
 * @param {unknown} result
 * @returns {void}
 */
const logDevError = (context, error, result) => {
  if (!isDevMode()) return

  console.error('[apiClient]', {
    context: context || null,
    error,
    query: {
      count: result?.count ?? null,
      status: result?.status ?? null,
      statusText: result?.statusText ?? null,
    },
  })
}

/**
 * Executes a Supabase query and normalizes all responses into { data, error }.
 *
 * @param {(client: typeof supabase) => Promise<unknown>} queryFn
 * @param {object} [context]
 * @returns {Promise<{ data: unknown, error: null | { message: string, code?: string, details?: unknown, type?: string } }>}
 */
export const apiClient = async (queryFn, context = {}) => {
  if (typeof queryFn !== 'function') {
    return {
      data: null,
      error: {
        message: 'Invalid query function',
        code: 'INVALID_QUERY',
        details: context,
      },
    }
  }

  try {
    const result = await queryFn(supabase)

    if (result?.error) {
      if (result.error.code === NO_ROWS_CODE) {
        return { data: null, error: null }
      }

      const error = normalizeError(result.error)
      logDevError(context, error, result)

      return { data: null, error }
    }

    if (Object.prototype.hasOwnProperty.call(result || {}, 'data')) {
      return { data: result.data ?? null, error: null }
    }

    return { data: result ?? null, error: null }
  } catch (caughtError) {
    const error = normalizeError(caughtError)
    logDevError(context, error, null)

    return { data: null, error }
  }
}
