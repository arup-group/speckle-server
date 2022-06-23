const PostHog = require('posthog-node')

const client = new PostHog(process.env.POSTHOG_API_KEY, {
  host: 'https://posthog.insights.arup.com'
})

module.exports = {
  identify(user) {
    client.identify({
      distinctId: user.id,
      properties: {
        email: user.email,
        name: user.name
      }
    })
  },
  capture(event, eventPayload) {
    const cloneEventPayload = {
      user: { ...eventPayload.user },
      stream: { ...eventPayload.stream },
      server: { ...eventPayload.server },
      event: { ...eventPayload.event }
    }
    client.capture({
      distinctId: cloneEventPayload.user.id,
      event,
      properties: cloneEventPayload
    })
  },
  captureValueTrackUsage(event, id, eventPayload) {
    client.capture({
      distinctId: id,
      event,
      properties: eventPayload
    })
  }
}
