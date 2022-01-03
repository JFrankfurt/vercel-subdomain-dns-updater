import { RequireAtLeastOne } from './utils'

interface Pagination {
  /** Amount of items in the current page. */
  count: number
  /** Timestamp that must be used to request the next page. */
  next: number | null
  /** Timestamp that must be used to request the previous page. */
  prev: number | null
}

export type VercelDomainRecordsResponse =
  | string
  | {
      records: {
        id: string
        slug: string
        name: string
        type: 'A' | 'AAAA' | 'ALIAS' | 'CAA' | 'CNAME' | 'MX' | 'SRV' | 'TXT'
        value: string
        mxPriority?: number
        priority?: number
        creator: string
        created: number | null
        updated: number | null
        createdAt: number | null
        updatedAt: number | null
      }[]
    }
  | {
      records: {
        id: string
        slug: string
        name: string
        type: 'A' | 'AAAA' | 'ALIAS' | 'CAA' | 'CNAME' | 'MX' | 'SRV' | 'TXT'
        value: string
        mxPriority?: number
        priority?: number
        creator: string
        created: number | null
        updated: number | null
        createdAt: number | null
        updatedAt: number | null
      }[]
      pagination: Pagination
    }

export type CreateNewSubdomainRecordsArgs = RequireAtLeastOne<
  { A?: string; AAAA?: string; subdomain: string },
  'A' | 'AAAA'
>
