import posthog from 'posthog-js'
import { AppLocalStorage } from '@/utils/localStorage'
import { posthogApiKey } from '@/config/posthogConfig'

export default {
  install(Vue) {
    console.log('helllllllllllllllooooooooooooooo')
    console.log(posthogApiKey)
    Vue.prototype.$posthog = posthog.init(posthogApiKey, {
      // eslint-disable-next-line camelcase
      api_host: 'https://posthog.insights.arup.com',
      autocapture: false,
      // eslint-disable-next-line camelcase
      capture_pageview: false,
      loaded(posthog) {
        posthog.identify(AppLocalStorage.get('uuid') || undefined)
        posthog.debug()
      }
    })
  }
}
