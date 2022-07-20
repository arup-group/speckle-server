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
  async getJobCode(jobCode) {
    const jc = jobCode.replace('-', '')
    const isNum = /^\d+$/.test(jc)
    if (isNum) return await module.exports.getJobCodeByNumber(jobCode)
    else return await module.exports.getJobCodeByName(jobCode)
  },

  async getJobCodeByNumber(jobNumber) {
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
      $top: 10
    })

    return jobs
  },

  async getJobCodeByName(jobName) {
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
      $top: 10
    })

    return jobs
  }
}
