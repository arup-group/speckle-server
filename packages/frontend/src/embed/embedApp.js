import '@/bootstrapper'
import Vue from 'vue'

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

import '@/plugins/helpers'
import store from '@/main/store'
import * as MixpanelManager from '@/mixpanelManager'

// Init mixpanel
MixpanelManager.initialize({
  hostApp: 'web-embed',
  hostAppDisplayName: 'Embed App'
})

new Vue({
  router,
  vuetify,
  store,
  render: (h) => h(App)
}).$mount('#app')
