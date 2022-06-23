'use strict'
const knex = require('@/db/knex')
const debug = require('debug')
const { captureUsageSummary } = require('../../../logging/valueTrackHelper')

const RatelimitActions = () => knex('ratelimit_actions')
const prometheusClient = require('prom-client')

const limitsReached = new prometheusClient.Counter({
  name: 'speckle_server_blocked_ratelimit',
  help: 'Number of time the requests were blocked',
  labelNames: ['actionName']
})

const LIMITS = {
  // rate limits:
  USER_CREATE: parseInt(process.env.RATELIMIT_USER_CREATE) || 1000, // per week
  STREAM_CREATE: parseInt(process.env.RATELIMIT_STREAM_CREATE) || 10000, // per week (1 stream / minute average)
  COMMIT_CREATE: parseInt(process.env.RATELIMIT_COMMIT_CREATE) || 86400, // per day (1 commit every second average)
  // unused:
  SUBSCRIPTION: parseInt(process.env.RATELIMIT_SUBSCRIPTION) || 600, // per minute
  REST_API: parseInt(process.env.RATELIMIT_REST_API) || 2400, // per minute
  WEBHOOKS: parseInt(process.env.RATELIMIT_WEBHOOKS) || 1000, // per day
  PREVIEWS: parseInt(process.env.RATELIMIT_PREVIEWS) || 1000, // per day
  FILE_UPLOADS: parseInt(process.env.RATELIMIT_FILE_UPLOADS) || 1000, // per day
  // static limits:
  BRANCHES: parseInt(process.env.LIMIT_BRANCHES) || 1000, // per stream
  TOKENS: parseInt(process.env.LIMIT_TOKENS) || 1000, // per user
  ACTIVE_SUBSCRIPTIONS: parseInt(process.env.LIMIT_ACTIVE_SUBSCRIPTIONS) || 100, // per user
  ACTIVE_CONNECTIONS: parseInt(process.env.LIMIT_ACTIVE_CONNECTIONS) || 100 // per source ip
}

const LIMIT_INTERVAL = {
  // rate limits
  USER_CREATE: 7 * 24 * 3600,
  STREAM_CREATE: 28 * 24 * 3600, //7 * 24 * 3600,
  COMMIT_CREATE: 24 * 3600,
  SUBSCRIPTION: 60,
  REST_API: 60,
  WEBHOOKS: 24 * 3600,
  PREVIEWS: 24 * 3600,
  FILE_UPLOADS: 24 * 3600,
  // static limits:
  BRANCHES: 0,
  TOKENS: 0,
  ACTIVE_SUBSCRIPTIONS: 0,
  ACTIVE_CONNECTIONS: 0
}

const PROJECT_LIMITS = {
  // rate limits:
  STREAM_CREATE: parseInt(process.env.PROJECT_RATELIMIT_STREAM_CREATE) || 0, // per project
  COMMIT_CREATE: parseInt(process.env.PROJECT_RATELIMIT_COMMIT_CREATE) || 1, // per project
  WEBHOOKS: parseInt(process.env.PROJECT_RATELIMIT_WEBHOOK) || 0, // per project
  // static limits:
  TOKENS: parseInt(process.env.PROJECT_LIMIT_TOKENS) || 0 // per project
}

const PROJECT_LIMIT_INTERVAL = {
  // rate limits
  STREAM_CREATE: 28 * 24 * 3600, // per MONTH
  COMMIT_CREATE: 28 * 24 * 3600, // per MONTH
  WEBHOOKS: 28 * 24 * 3600, // per MONTH
  TOKENS: 0 // static
}

const VALUETRACK_LIMITS = {
  // rate limits:
  CREATE_ACTION_VALUETRACK: 0 // per project
  // WEBHOOKS: 0, // per project
  // // static limits:
  // TOKENS: 0 // per project
}

const VALUETRACK_LIMIT_INTERVAL = {
  // rate limits
  CREATE_ACTION_VALUETRACK: 28 * 24 * 3600 // per MONTH
  // WEBHOOKS: 28 * 24 * 3600, // per MONTH
  // TOKENS: 0 // static
}

const rateLimitedCache = {}

async function shouldRateLimitNext({ action, source }) {
  if (!source) return false

  const limit = LIMITS[action]
  const checkInterval = LIMIT_INTERVAL[action]
  if (limit === undefined || checkInterval === undefined) {
    return false
  }

  let startTimeMs
  if (checkInterval === 0) startTimeMs = 0
  else startTimeMs = Date.now() - checkInterval * 1000

  const [res] = await RatelimitActions()
    .count()
    .where({ action, source })
    .andWhere('timestamp', '>', new Date(startTimeMs))
  const count = parseInt(res.count) + 1 // plus this request

  const shouldRateLimit = count >= limit

  if (!shouldRateLimit) {
    await RatelimitActions().insert({ action, source })
  }
  return shouldRateLimit
}

async function shouldRateLimitNextByProject({ action, source }) {
  if (!source) return false

  const limit = PROJECT_LIMITS[action]
  const checkInterval = PROJECT_LIMIT_INTERVAL[action]
  if (limit === undefined || checkInterval === undefined) {
    return false
  }

  let startTimeMs
  if (checkInterval === 0) startTimeMs = 0
  else startTimeMs = Date.now() - checkInterval * 1000

  const [res] = await RatelimitActions()
    .count()
    .where({ action, source })
    .andWhere('timestamp', '>', new Date(startTimeMs))
  const count = parseInt(res.count) + 1 // plus this request

  const shouldRateLimit = count >= limit

  if (!shouldRateLimit) await RatelimitActions().insert({ action, source })

  return shouldRateLimit
}

async function shouldChargeForValueTrack({ action, source }) {
  if (!source) return false

  const limit = VALUETRACK_LIMITS[action]
  const interval = process.env.VALUETRACK_SUBSCRIPTION_INTERVAL
  let checkInterval
  switch (interval) {
    default:
    case 'month':
      checkInterval = 28 * 24 * 3600
      break
    case 'day':
      checkInterval = 24 * 3600
      break
    case 'minute':
      checkInterval = 60
      break
  }
  if (limit === undefined || checkInterval === undefined) {
    return false
  }

  let startTimeMs
  if (checkInterval === 0) startTimeMs = 0
  else startTimeMs = Date.now() - checkInterval * 1000
  const checkDate = new Date(startTimeMs)

  let currentInterval
  const now = new Date()
  switch (interval) {
    default:
    case 'month':
      currentInterval = now.getMonth() + 1
      break
    case 'day':
      currentInterval = now.getDate()
      break
    case 'minute':
      currentInterval = now.getMinutes() + 1
      break
  }

  if (limit === 0) {
    //check if action has occurred within the specified check interval (a minute, a day's, a month's time) and within the same time interval (past minute, past day, past month) -
    //this should correspond to project having been already charged (charged once per interval, ex. once per calendar month)
    const [res] = await RatelimitActions()
      .count()
      .where({ action, source })
      .andWhere('timestamp', '>', checkDate) //happened within the specified check interval
      .andWhereRaw(`EXTRACT(${interval} FROM timestamp) = ?`, [currentInterval]) //happened within the same time interval (ex same month)

    const count = parseInt(res.count)
    if (count > 0) {
      await RatelimitActions().insert({ action, source })
      return false
    }
  }

  const [res] = await RatelimitActions()
    .count()
    .where({ action, source })
    .andWhere('timestamp', '>', checkDate) //happened within the specified check interval
    .andWhereRaw(`EXTRACT(${interval} FROM timestamp) != ?`, [currentInterval]) //did not happen within the same time interval

  const count = parseInt(res.count)

  const shouldCaptureForValueTrack = count + 1 >= limit

  if (!shouldCaptureForValueTrack || count === 0)
    await RatelimitActions().insert({ action, source })

  return shouldCaptureForValueTrack
}

module.exports = {
  LIMITS,
  LIMIT_INTERVAL,
  PROJECT_LIMITS,
  PROJECT_LIMIT_INTERVAL,
  VALUETRACK_LIMITS,
  VALUETRACK_LIMIT_INTERVAL,
  // returns true if the action is fine, false if it should be blocked because of exceeding limit
  async respectsLimits({ action, source }) {
    const rateLimitKey = `${action} ${source}`
    const promise = shouldRateLimitNext({ action, source }).then((shouldRateLimit) => {
      if (shouldRateLimit) rateLimitedCache[rateLimitKey] = true
      else delete rateLimitedCache[rateLimitKey]
    })
    if (rateLimitedCache[rateLimitKey]) {
      await promise
    }

    if (rateLimitedCache[rateLimitKey]) limitsReached.labels(action).inc()
    return !rateLimitedCache[rateLimitKey]
  },
  // returns true if the action is fine, false if it should be blocked because of exceeding limit
  async respectsLimitsByProject({ action, source }) {
    const rateLimitKey = `${action} ${source}`
    const promise = shouldRateLimitNextByProject({ action, source }).then(
      (shouldRateLimit) => {
        if (shouldRateLimit) {
          rateLimitedCache[rateLimitKey] = true
        } else {
          delete rateLimitedCache[rateLimitKey]
        }
      }
    )
    if (rateLimitedCache[rateLimitKey]) {
      await promise
    }

    if (rateLimitedCache[rateLimitKey]) limitsReached.labels(action).inc()
    return !rateLimitedCache[rateLimitKey]
  },
  async sendProjectInfoToValueTrack({ action, source, userId }) {
    const rateLimitKey = `${action} ${source}`

    const promise = await shouldChargeForValueTrack({ action, source }).then(
      (shouldCharge) => {
        if (shouldCharge) {
          rateLimitedCache[rateLimitKey] = true

          if (source) {
            const vtData = {
              jobNumber: source,
              userId
            }
            debug('speckle:valuetrack')(
              'Project should be charged - will send usage summary (with cost!) to VT'
            )
            captureUsageSummary(vtData) //only track usage with VT if JN is provided (ex. in case mandatory JN is not being enforced)
          }
        } else {
          debug('speckle:valuetrack')(
            'Project should NOT be charged - no usage summary sent to VT'
          )
          delete rateLimitedCache[rateLimitKey]
        }
      }
    )
    if (rateLimitedCache[rateLimitKey]) {
      await promise
    }

    if (rateLimitedCache[rateLimitKey]) limitsReached.labels(action).inc()
    return !rateLimitedCache[rateLimitKey]
  }
}
