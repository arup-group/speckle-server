import Vue from 'vue'
import '@/vueBootstrapper'

import App from './EmbedApp.vue'
import vuetify from './embedVuetify'
import router from './embedRouter'

import VueMatomo from 'vue-matomo'
Vue.use(VueMatomo, {
  host: 'https://arupdt.matomo.cloud',
  siteId: 1,
  router
})

// process.env.NODE_ENV is injected by Webpack
// eslint-disable-next-line no-undef
Vue.config.productionTip = process.env.NODE_ENV === 'development'

import VueMixpanel from 'vue-mixpanel'
Vue.use(VueMixpanel, {
  token: 'acd87c5a50b56df91a795e999812a3a4',
  config: {
    // eslint-disable-next-line camelcase
    api_host: 'https://analytics.speckle.systems',
    // eslint-disable-next-line camelcase
    opt_out_tracking_by_default: true
  }
})

import '@/plugins/helpers'
import store from '@/main/store'

import { formatNumber } from '@/plugins/formatNumber'
// Filter to turn any number into a nice string like '10k', '5.5m'
// Accepts 'max' parameter to set it's formatting while being animated
Vue.filter('prettynum', formatNumber)

Vue.component('HistogramSlider', async () => {
  await import(
    /* webpackChunkName: "vue-histogram-slider" */ 'vue-histogram-slider/dist/histogram-slider.css'
  )
  const component = await import(
    /* webpackChunkName: "vue-histogram-slider" */ 'vue-histogram-slider'
  )
  return component
})

new Vue({
  router,
  vuetify,
  store,
  render: (h) => h(App)
}).$mount('#app')
