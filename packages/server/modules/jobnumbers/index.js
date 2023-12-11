'use strict'
const debug = require('debug')
const sentry = require(`@/logging/sentryHelper`)
const { throwForNotHavingServerRole } = require('@/modules/shared/authz')
const { Roles } = require('@speckle/shared')
const { getServerInfo } = require('@/modules/core/services/generic')
const { getJobCodes } = require('@/modules/jobnumbers/services/jobnumbers')
const { moduleLogger } = require('@/logging/logging')

exports.init = async (app) => {
  const serverInfo = await getServerInfo()
  if (
    serverInfo.showJobNumberInput ||
    serverInfo.requireJobNumberToCreateStreams ||
    serverInfo.requireJobNumberToCreateCommits
  ) {
    moduleLogger.info('📄 Init ADS integration module')
  } else {
    moduleLogger.info(
      '📄 Job numbers not required - ADS integration module is DISABLED'
    )
    return
  }

  app.get('/api/jobnumber/:jobNumber', async (req, res) => {
    await throwForNotHavingServerRole(req.context, Roles.Server.User)
    try {
      if (!req.params.jobNumber)
        return res.status(400).send('No job number or job name parameter specified.')

      const jobNumber = req.params.jobNumber
      const jobs = await getJobCodes(jobNumber)

      res.setHeader('Content-Type', 'application/json')
      res.status(200)
      res.json({
        jobs
      })
    } catch (err) {
      sentry({ err })
      debug('speckle:errors')(err)
      return res.status(400).send(err.message)
    }
  })
}

exports.finalize = () => {}
