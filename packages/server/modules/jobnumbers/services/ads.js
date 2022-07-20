'use strict'
const TokenStore = require('./adsTokenStore')
const { o } = require('odata')

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
    const response = await o(adsUrl, config).get(resource).query(query)
    // .then((data) => console.log(data))

    return response
  }
}
