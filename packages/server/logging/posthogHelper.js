const PostHog = require('posthog-node')

const client = new PostHog(
    process.env.POSTHOG_API_KEY,
    { host: 'https://posthog.insights.arup.com' }
)

const { machineIdSync } = require( 'node-machine-id' );

const id = machineIdSync( )

module.exports = {
  identify(user) {
    client.identify({
      distinctId: user.email,
      properties: user
    })
  },
  startup() {
    if ( process.env.DISABLE_TRACKING !== 'true' ) {
      client.capture({
        distinctId: id,
        event: 'startup',
      })
    }
  },
  apolloHelper( actionName, email) {
    if ( process.env.DISABLE_TRACKING !== 'true' ) {
      client.capture({
        distinctId: email,
        event: actionName || 'gql api call',
      })
    }
  },
  matomoMiddleware( req, res, next ) {
    if ( process.env.DISABLE_TRACKING !== 'true' ) {
      let distinctId = id
      
      if(req.context && req.context.email) {
        distinctId = req.context.email
      }
    
      client.capture({
        distinctId: distinctId,
        event: req.url,
      })
    }
    next()
  }
}