'use strict'
const debug = require('debug')
const sentry = require(`@/logging/sentryHelper`)
const { contextMiddleware } = require('@/modules/shared')
const { validateServerRole } = require('@/modules/shared')
const { getServerInfo } = require('@/modules/core/services/generic')
const { getJobCode } = require('./services/jobNumbers')

exports.init = async (app) => {
  const serverInfo = await getServerInfo()
  if (
    serverInfo.requireJobNumberToCreateStreams ||
    serverInfo.requireJobNumberToCreateCommits
  ) {
    debug('speckle:modules')('📄 Init ADS integration module')
    return
  } else {
    debug('speckle:modules')(
      '📄 Job numbers not required - ADS integration module is DISABLED'
    )
  }

  // sweet and simple
  app.get('/api/jobNumber', (req, res) => {
    res.sendFile(require.resolve('@/modules/apiexplorer/explorer.html'))
  })

  app.get('/api/jobNumber/:jobNumber', contextMiddleware, async (req, res) => {
    await validateServerRole(req.context, 'server:user')
    try {
      if (!req.params.jobNumber)
        return res.status(400).send('No job number or job name parameter specified.')

      const jobNumber = req.params.jobNumber
      const jobs = await getJobCode(jobNumber)

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
