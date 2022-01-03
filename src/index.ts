import { config } from 'dotenv'
import got from 'got'
import publicIp from 'public-ip'
import { CreateNewSubdomainRecordsArgs, VercelDomainRecordsResponse } from './types'

config()

async function createRecord(data: { name: string; type: 'A' | 'AAAA'; value: string }) {
  return got.post({
    url: `https://api.vercel.com/v2/domains/${process.env.VERCEL_DOMAIN}/records`,
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
    json: data,
  })
}
async function deleteRecord(recordId: string) {
  return got.delete(`https://api.vercel.com/v2/domains/${process.env.VERCEL_DOMAIN}/records/${recordId}`, {
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
    },
  })
}

async function createNewSubdomainRecords({ A, AAAA, subdomain }: CreateNewSubdomainRecordsArgs) {
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
    if (AAAA) {
      requests.push(
        createRecord({
          name: subdomain,
          type: 'AAAA',
          value: AAAA,
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
    console.error('getCurrentDNSRecords error')
    return { data: null, error }
  }
}
async function updateSubdomainIp() {
  const v4 = await publicIp.v4()
  const v6 = await publicIp.v6()
  const subdomain = process.env.SUBDOMAIN as string
  const { data } = await getCurrentDNSRecords()
  if (!data || typeof data === 'string') {
    console.error('no data')
    return
  }
  const ARecords = data.records.filter(record => record.type === 'A' && record.name === subdomain)
  const AAAARecords = data.records.filter(record => record.type === 'AAAA' && record.name === subdomain)
  const deleteOldRecords = [
    ...ARecords.map(record => {
      if (record && record.value.toLowerCase() !== v4) {
        return deleteRecord(record.id)
      }
      return Promise.resolve(null)
    }),
    ...AAAARecords.map(record => {
      if (record && record.value.toLowerCase() !== v6) {
        return deleteRecord(record.id)
      }
      return Promise.resolve(null)
    }),
  ]

  await Promise.all(deleteOldRecords)

  const hasCorrectARecord = ARecords.find(record => record.value.toLowerCase() === v4)
  const hasCorrectAAAARecord = AAAARecords.find(record => record.value.toLowerCase() === v6)

  const records = {} as CreateNewSubdomainRecordsArgs
  if (!hasCorrectARecord) {
    records.A = v4
  }

  if (!hasCorrectAAAARecord) {
    records.AAAA = v6
  }

  if (Object.keys(records).length) {
    console.log(`updating out of date ${Object.keys(records).join(' ')} records`)
    await createNewSubdomainRecords({ ...records, subdomain })
  }
}

function main() {
  return new Promise((_resolve, reject) => {
    const missingEnvVars = [
      process.env.REFRESH_INTERVAL_SECONDS,
      process.env.SUBDOMAIN,
      process.env.VERCEL_TOKEN,
      process.env.VERCEL_DOMAIN,
    ].filter(envVar => !envVar)
    if (missingEnvVars.length) {
      reject(new Error(`missing env vars: ${missingEnvVars}`))
    }
    const REFRESH_INTERVAL_SECONDS = parseInt(process.env.REFRESH_INTERVAL_SECONDS || '30', 10)
    setInterval(updateSubdomainIp, REFRESH_INTERVAL_SECONDS * 1000)
  })
}

main()
  .then(console.log)
  .catch(console.error)
