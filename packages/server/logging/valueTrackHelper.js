const axios = require('axios')
const debug = require('debug')
const { captureValueTrackUsage } = require('./posthogHelper')
const { getServerInfo } = require('@/modules/core/services/generic')

const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
  'Ocp-Apim-Subscription-Key': process.env.VALUETRACK_API_KEY
}

const applicationName = 'Speckle'
const cost = parseFloat(process.env.VALUETRACK_SUBSCRIPTION_FEE)
const interval = process.env.VALUETRACK_SUBSCRIPTION_INTERVAL

const eventDateTime = () => {
  const date = new Date()
  const utcDate = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes()
    )
  )
  const formattedUtcDate = utcDate.toISOString().replace(/.\d+Z$/g, 'Z')
  return formattedUtcDate
}

const startOfCurrentInterval = () => {
  const now = new Date()
  let utcDate
  switch (interval) {
    default:
    case 'month':
      utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 1, 0))
      break
    case 'day':
      utcDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          now.getUTCHours(),
          0
        )
      )
      break
    case 'minute':
      utcDate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          now.getUTCHours(),
          now.getUTCMinutes(),
          0
        )
      )
      break
  }
  const formattedUtcDate = utcDate.toISOString().replace(/.\d+Z$/g, 'Z')
  return formattedUtcDate
}

const endOfCurrentInterval = () => {
  const date = new Date()
  let utcDate
  switch (interval) {
    default:
    case 'month':
      utcDate = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 1, 0)
      )
      break
    case 'day':
      utcDate = new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate() + 1,
          date.getUTCHours(),
          0
        )
      )
      break
    case 'minute':
      utcDate = new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
          date.getUTCHours(),
          date.getUTCMinutes() + 1,
          0
        )
      )
      break
  }
  const formattedUtcDate = utcDate.toISOString().replace(/.\d+Z$/g, 'Z')
  return formattedUtcDate
}

module.exports = {
  currentTimeInterval() {
    return {
      usageStartDateTime: startOfCurrentInterval(),
      usageEndDateTime: endOfCurrentInterval()
    }
  },
  captureUsageEvent(event) {
    const data = JSON.stringify({
      eventDateTime: eventDateTime(),
      applicationName,
      processName: applicationName,
      ticks: 1,
      jobNumber: event.jobNumber,
      userName: event.userName
    })
    axios
      .post(`${process.env.VALUETRACK_API_URL}/UsageEvent`, data, { headers })
      .then(function (response) {
        if (response.status === 201)
          debug('speckle:valuetrack')('Sent usage event to ValueTrack')
        else console.log(response.data)
      })
      .catch(function (error) {
        if (error.response) {
          if (error.response.status === 409)
            debug('speckle:valuetrack')('Duplicate usage event refused')
          else {
            debug('speckle:valuetrack')(error.response.data)
          }
        } else console.log(error)
      })
  },
  async captureUsageSummary(summary) {
    const dateTime = startOfCurrentInterval()
    const data = {
      usageStartDateTime: dateTime, //start of current interval
      usageEndDateTime: endOfCurrentInterval(), //end of current interval
      applicationName,
      cost,
      jobNumber: summary.jobNumber,
      userName: summary.userName,
      narrative: `Speckle ${dateTime.split('-').slice(0, -1).join('-')}` //Speckle-YYYY-MM
    }
    const serverInfo = await getServerInfo()
    axios
      .post(`${process.env.VALUETRACK_API_URL}/UsageSummary`, JSON.stringify(data), {
        headers
      })
      .then(function (response) {
        if (response.status === 201) {
          data['server'] = serverInfo.canonicalUrl
          debug('speckle:valuetrack')('Sent usage summary (with cost!) to ValueTrack')
          captureValueTrackUsage('valuetrack_capture', summary.userId, data)
        } else console.log(response.data)
      })
      .catch(function (error) {
        if (error.response) {
          if (error.response.status === 409) {
            debug('speckle:valuetrack')('Duplicate usage summary refused')
            captureValueTrackUsage('valuetrack_capture_refused', summary.userId, data)
          } else debug('speckle:valuetrack')(error.response)
        } else console.log(error)
      })
  }
}
