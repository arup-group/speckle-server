const axios = require('axios')

module.exports = class TokenStore {
  constructor(config) {
    this.config = config
  }

  async getToken() {
    const token = {
      tokenType: '',
      scope: '',
      expiresIn: 0,
      expiresOn: 0,
      extExpiresIn: 0,
      notBefore: 0,
      resource: '',
      refreshToken: '',
      accessToken: ''
    }
    const body = this.buildTokenRequestBody(this.config)
    const response = await axios.post(`${this.config.adsTokenUrl}`, body)
    try {
      if (response.status === 200) {
        const data = await response.data
        token.tokenType = data.token_type
        token.scope = data.scope
        token.expiresIn = data.expires_in
        token.expiresOn = data.expires_on
        token.extExpiresIn = data.ext_expires_in
        token.notBefore = data.not_before
        token.resource = data.resource
        token.refreshToken = data.refresh_token
        token.accessToken = data.access_token
      } else {
        throw new Error(response.text)
      }
    } catch (error) {
      const errorBody = await error.response.text()
      console.error(error)
      console.error(`Error body: ${errorBody}`)
    }
    return token.accessToken
  }

  buildTokenRequestBody({
    adsClientId,
    adsClientSecret,
    adsUsername,
    adsPassword,
    adsResource
  }) {
    const params = new URLSearchParams()
    params.append('grant_type', 'password')
    params.append('override', 'true')
    params.append('username', adsUsername)
    params.append('password', adsPassword)
    params.append('client_id', adsClientId)
    params.append('client_secret', adsClientSecret)
    params.append('resource', adsResource)
    return params
  }
}
