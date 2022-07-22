'use strict'
const ADS = require('./ads')

const adsBaseUrl = process.env.ADS_BASE_URL
const adsTokenUrl = process.env.ADS_TOKEN_URL
const adsResource = process.env.ADS_RESOURCE
const adsClientId = process.env.ADS_CLIENT_ID
const adsClientSecret = process.env.ADS_CLIENT_SECRET
const adsSubscriptionKey = process.env.ADS_SUBSCRIPTION_KEY
const adsUsername = process.env.ADS_USERNAME
const adsPassword = process.env.ADS_PASSWORD

module.exports = {
  async getJobCodes(jobCode, limit = 10) {
    const isNum = /^\d+$/.test(jobCode)
    if (isNum) return await module.exports.getJobCodesByNumber(jobCode, limit)
    else return await module.exports.getJobCodesByName(jobCode, limit)
  },

  async getJobCodesByNumber(jobNumber, limit = 10) {
    const adsApi = new ADS({
      adsBaseUrl,
      adsTokenUrl,
      adsResource,
      adsClientId,
      adsClientSecret,
      adsSubscriptionKey,
      adsUsername,
      adsPassword
    })

    const jobs = await adsApi.query('Jobs', {
      $expand:
        'Project($select=ScopeOfService,ScopeOfWorks,ProjectDirectorName,ProjectDirectorEmail,ProjectManagerName,ProjectManagerEmail,ProjectUrl)',
      $filter: `startswith(JobCode,'${jobNumber}') and Active eq 1 and JobStatusCode eq 10`,
      $select: 'JobCode,JobNameShort,JobNameLong,RegionCode',
      $top: limit
    })

    return jobs
  },

  async getJobCodesByName(jobName, limit = 10) {
    const adsApi = new ADS({
      adsBaseUrl,
      adsTokenUrl,
      adsResource,
      adsClientId,
      adsClientSecret,
      adsSubscriptionKey,
      adsUsername,
      adsPassword
    })

    const jobs = await adsApi.query('Jobs', {
      $expand:
        'Project($select=ScopeOfService,ScopeOfWorks,ProjectDirectorName,ProjectDirectorEmail,ProjectManagerName,ProjectManagerEmail,ProjectUrl)',
      $filter: `(startswith(JobNameLong,'${jobName}') or contains(JobNameLong,'${jobName}')) and Active eq 1 and JobStatusCode eq 10`,
      $select: 'JobCode,JobNameShort,JobNameLong,RegionCode',
      $top: limit
    })

    return jobs
  },

  async validateJobNumber(jobNumber) {
    if (!jobNumber) {
      return false
    }

    const isDigitsOnly = /^\d+$/.test(jobNumber)
    if (!isDigitsOnly) {
      return false
    }
    const junkJobCodes = ['00000000', '12345678', '12345600', '99999999']
    if (!jobNumber || junkJobCodes.includes(jobNumber)) {
      return false
    }
    const job = await module.exports.getJobCodes(jobNumber, 1)
    if (!job || !job.length) {
      return false
    }

    return true
  }
}
