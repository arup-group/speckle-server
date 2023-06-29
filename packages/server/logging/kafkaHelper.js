const debug = require('debug')
const { Kafka, logLevel } = require('kafkajs')
const knex = require('../db/knex')
const ServerConfig = () => knex('server_config')

const topic = process.env.KAFKA_TOPIC

const kafkaInit = async () => {
  const { name: serverName } = await ServerConfig().select('name').first()
  const client = new Kafka({
    clientId: serverName,
    brokers: process.env.KAFKA_BROKERS.split(',').map((s) => s.trim()),
    authenticationTimeout: 30000,
    reauthenticationThreshold: 10000,
    connectionTimeout: 30000,
    requestTimeout: 30000,
    retry: {
      initialRetryTime: 100,
      maxRetryTime: 30000,
      retries: 200
    },
    logLevel: logLevel.ERROR,
    ssl: true,
    sasl: {
      mechanism: 'plain', // scram-sha-256 or scram-sha-512
      username: process.env.KAFKA_API_KEY,
      password: process.env.KAFKA_API_SECRET
    }
  })
  return { serverName, client }
}

const newMessage = (event, eventPayload, serverName) => {
  const time = Date.now()
  const sourceTimestamp = new Date(time).toISOString()
  console.log(JSON.stringify(eventPayload))
  const message = {
    key: `${serverName}-${event}`,
    value: JSON.stringify(eventPayload),
    headers: {
      id: `${time}`,
      speckleTime: `${sourceTimestamp}`
    }
  }

  const messages = {
    topic,
    messages: [message]
  }

  return messages
}

module.exports = {
  async produceMsg(event, eventPayload) {
    const kafka = await kafkaInit()
    const messages = newMessage(event, eventPayload, kafka.serverName)
    try {
      const client = kafka.client
      const producer = client.producer()
      await producer.connect()
      await producer.send(messages)
      await producer.disconnect()
      debug('speckle:kafka')(`${messages.messages.length} message(s) sent to Kafka...`)
    } catch (err) {
      debug('speckle:kafka')(err)
    }
  }
}
