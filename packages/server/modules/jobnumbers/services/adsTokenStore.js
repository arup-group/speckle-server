const axios = require('axios')

module.exports = class TokenStore {
  constructor(config) {
    this.config = config
  }

  async getToken() {
    let token = {
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
        token = await response.data
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
