'use strict'
const TokenStore = require('./adstokenstore')
const { fetch } = require('undici')

module.exports = class ADS {
  constructor({
    adsBaseUrl,
    adsTokenUrl,
    adsResource,
    adsClientId,
    adsClientSecret,
    adsSubscriptionKey,
    adsUsername,
    adsPassword
  }) {
    this.baseUrl = adsBaseUrl
    this.subscriptionKey = adsSubscriptionKey

    this.tokenStore = new TokenStore({
      adsTokenUrl,
      adsResource,
      adsClientId,
      adsClientSecret,
      adsUsername,
      adsPassword
    })
  }
  async query(resource, query) {
    const adsUrl = this.baseUrl
    const token = await this.tokenStore.getToken()
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey || '',
        'Content-Type': 'application/json'
      }
    }

    const queryStr = Object.keys(query)
      .map((key) => `${key}=${query[key]}`)
      .join('&')
    const url = `${adsUrl}${resource}?${queryStr}`

    return fetch(url, {
      method: 'GET',
      headers: config.headers
    })
      .then(async (res) => {
        const json = await res.json()
        return json.value
      })
      .catch((err) => {
        console.log(err)
      })
  }
}
