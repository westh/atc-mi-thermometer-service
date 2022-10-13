require('dotenv').config()
const noble = require('@abandonware/noble')
const axios = require('axios')
const atcMiThermometerParser = require('@westh/atc-mi-thermometer-parser')

const MI_THERMOMETER_MAC_ADDRESS_PREFIX = 'a4:c1:38'
const INTERVAL_BETWEEN_SENDING_IN_MILLISECONDS = 10 * 1000 // 10 seconds

let metricsBuffer = []

function formatToGraphite ({ mac, temperature, humidity, batteryVoltage, batteryLevel }) {
  const formattedMetrics = []

  const time = Math.floor(Date.now() / 1000)
  const tags = [`mac=${mac.toString('hex')}`]

  formattedMetrics.push({
    name: 'temperature',
    value: temperature
  })
  formattedMetrics.push({
    name: 'humidity',
    value: humidity
  })
  formattedMetrics.push({
    name: 'batteryVoltage',
    value: batteryVoltage
  })
  formattedMetrics.push({
    name: 'batteryLevel',
    value: batteryLevel
  })

  return formattedMetrics.map(metric => {
    return {
      ...metric,
      interval: INTERVAL_BETWEEN_SENDING_IN_MILLISECONDS,
      time,
      tags
    }
  })
}

async function publishMetrics (metrics) {
  try {
    await axios.post(process.env.GRAPHITE_ENDPOINT_URL, metrics, {
      timeout: 30 * 1000,
      headers: { Authorization: `Bearer ${process.env.GRAPHITE_USER}:${process.env.GRAPHITE_PASSWORD}` }
    })
  } catch (err) {
    console.error(err)
  }
}

noble.on('stateChange', async (state) => {
  const isPoweredOne = state === 'poweredOn'
  if (isPoweredOne) await noble.startScanningAsync([], true) // scan for all UUIDs and allow duplicates
})

noble.on('discover', async (peripheral) => {
  try {
    const isMiThermometer = peripheral.address.includes(MI_THERMOMETER_MAC_ADDRESS_PREFIX)
    const isServiceDataPresent = !!peripheral.advertisement.serviceData[0].data
    const shouldParse = isMiThermometer && isServiceDataPresent
    if (!shouldParse) return

    const miThermometerData = atcMiThermometerParser.parse(peripheral.advertisement.serviceData[0].data)
    metricsBuffer = [...metricsBuffer, ...formatToGraphite(miThermometerData)]
  } catch (error) {
    const shouldIgnoreError = error instanceof TypeError
    if (shouldIgnoreError) return

    console.error(error)
  }
})

function log (message) {
  console.log(`[${new Date().toISOString()}] ${message}`)
}

async function scheduledSendDataAndClearBuffer () {
  const areThereAnyMetricsToSend = metricsBuffer.length > 0
  if (!areThereAnyMetricsToSend) {
    log('no metrics to send, rescheduling a check in 30 seconds...')
    return setTimeout(scheduledSendDataAndClearBuffer, INTERVAL_BETWEEN_SENDING_IN_MILLISECONDS)
  }

  log('metrics are available, trying to publish them to graphite now...')
  await publishMetrics(metricsBuffer)
  log('done publishing')
  metricsBuffer = []
  setTimeout(scheduledSendDataAndClearBuffer, INTERVAL_BETWEEN_SENDING_IN_MILLISECONDS)
}

setTimeout(scheduledSendDataAndClearBuffer, INTERVAL_BETWEEN_SENDING_IN_MILLISECONDS)
