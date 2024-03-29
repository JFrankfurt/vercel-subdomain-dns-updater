import { config } from 'dotenv'
import got from 'got'
import publicIp from 'public-ip'
import { CreateNewSubdomainRecordsArgs, VercelDomainRecordsResponse } from './types'

config()

function logError({ message, error }: { message?: string; error: unknown }) {
  console.error(message || 'oops: ', error)
}

async function createRecord(data: { name: string; type: 'A'; value: string }) {
  return got.post({
    url: `https://api.vercel.com/v2/domains/${process.env.VERCEL_DOMAIN}/records`,
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
    json: data,
  })
}

async function deleteRecord(recordId: string) {
  return got.delete(`https://api.vercel.com/v2/domains/${process.env.VERCEL_DOMAIN}/records/${recordId}`, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
  })
}

async function createNewSubdomainRecords({ A, subdomain }: CreateNewSubdomainRecordsArgs) {
  try {
    const requests = []
    if (A) {
      requests.push(
        createRecord({
          name: subdomain,
          type: 'A',
          value: A,
        })
      )
    }
    await Promise.all(requests)
    return { data: 'success', err: null }
  } catch (error) {
    return { data: null, error }
  }
}
async function getCurrentDNSRecords() {
  console.log('getCurrentDNSRecords')
  try {
    const token = process.env.VERCEL_TOKEN
    const domain = process.env.VERCEL_DOMAIN
    const response = got({
      url: `https://api.vercel.com/v4/domains/${domain}/records`,
      headers: { Authorization: `Bearer ${token}` },
    })
    return {
      data: (await response.json()) as VercelDomainRecordsResponse,
      err: null,
    }
  } catch (error) {
    logError({ error })
    return { data: null, error }
  }
}
async function updateSubdomainIp() {
  let v4 = ''
  try {
    v4 = await publicIp.v4({
      fallbackUrls: ['https://ifconfig.me/ip', 'http://ipinfo.io/ip', 'https://ipecho.net/plain'],
    })

    if (!v4) {
      return logError({ error: 'No v4 IP found' })
    }

    const subdomain = process.env.SUBDOMAIN as string
    const { data } = await getCurrentDNSRecords()

    if (!data || typeof data === 'string') {
      return logError({ error: 'failed to fetch dns records from vercel' })
    }
    const ARecords = data.records.filter((record) => record.type === 'A' && record.name === subdomain)
    const deleteOldRecords = ARecords.map((record) => {
      if (v4 && record && record.value.toLowerCase() !== v4) {
        return deleteRecord(record.id)
      }
      return Promise.resolve(null)
    })
    try {
      await Promise.all(deleteOldRecords)
    } catch (error) {
      logError({ message: 'deleteOldRecords error', error })
    }
    const hasCorrectARecord = ARecords.find((record) => record.value.toLowerCase() === v4)

    const records = {} as CreateNewSubdomainRecordsArgs
    if (!hasCorrectARecord) {
      records.A = v4
    }

    if (Object.keys(records).length) {
      console.log('new records', records)
      console.log(`updating out of date ${Object.keys(records).join(' ')} records`)
      await createNewSubdomainRecords({ ...records, subdomain })
    }
  } catch (error) {
    logError({ message: 'v4 error', error })
  }

  return Promise.resolve()
}

function main() {
  return new Promise((_resolve, reject) => {
    const requiredEnvVars = {
      REFRESH_INTERVAL_SECONDS: process.env.REFRESH_INTERVAL_SECONDS,
      SUBDOMAIN: process.env.SUBDOMAIN,
      VERCEL_TOKEN: process.env.VERCEL_TOKEN,
      VERCEL_DOMAIN: process.env.VERCEL_DOMAIN,
    }
    const missingEnvVars = Object.entries(requiredEnvVars)
      .map(([key, value]) => (!value ? key : null))
      .filter(Boolean)
    if (missingEnvVars.length) {
      reject(new Error(`missing a required env var: ${missingEnvVars.join(', ')}`))
    }
    const REFRESH_INTERVAL_SECONDS = parseInt(process.env.REFRESH_INTERVAL_SECONDS || '30', 10)
    setInterval(updateSubdomainIp, REFRESH_INTERVAL_SECONDS * 1000)
  })
}

console.log('starting dns updater')
main().then(console.log).catch(console.error)
