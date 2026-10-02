import type { GitHubRepository, GitHubUser } from '../types/github'

const GITHUB_API_BASE_URL = 'https://api.github.com'
const SEARCH_CACHE_TTL_MS = 30_000
const SEARCH_CACHE_MAX_ENTRIES = 50

export interface GitHubRateLimitHeaders {
  'x-ratelimit-remaining': string | null
  'x-ratelimit-reset': string | null
  'retry-after': string | null
}

export class GitHubApiError extends Error {
  readonly status: number
  readonly githubMessage: string
  readonly rateLimitHeaders: GitHubRateLimitHeaders
  readonly isRateLimit: boolean

  constructor(response: Response, githubMessage: string) {
    super(`GitHub API request failed (${response.status}): ${githubMessage}`)
    this.name = 'GitHubApiError'
    this.status = response.status
    this.githubMessage = githubMessage
    this.rateLimitHeaders = {
      'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining'),
      'x-ratelimit-reset': response.headers.get('x-ratelimit-reset'),
      'retry-after': response.headers.get('retry-after'),
    }
    this.isRateLimit =
      response.status === 429 ||
      (response.status === 403 &&
        (this.rateLimitHeaders['x-ratelimit-remaining'] === '0' ||
          this.rateLimitHeaders['retry-after'] !== null ||
          /rate.?limit/i.test(githubMessage)))
  }
}

interface SearchCacheEntry {
  users: GitHubUser[]
  expiresAt: number
}

const searchCache = new Map<string, SearchCacheEntry>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return

  if (typeof DOMException !== 'undefined') {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }

  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  throw error
}

function cloneUsers(users: GitHubUser[]): GitHubUser[] {
  return users.map((user) => ({ ...user }))
}

function getCachedUsers(query: string): GitHubUser[] | undefined {
  const entry = searchCache.get(query)
  if (!entry) return undefined

  if (entry.expiresAt <= Date.now()) {
    searchCache.delete(query)
    return undefined
  }

  // Move hits to the end so the map behaves as a small LRU cache.
  searchCache.delete(query)
  searchCache.set(query, entry)
  return cloneUsers(entry.users)
}

function cacheUsers(query: string, users: GitHubUser[]): void {
  searchCache.delete(query)
  searchCache.set(query, {
    users: cloneUsers(users),
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
  })

  while (searchCache.size > SEARCH_CACHE_MAX_ENTRIES) {
    const oldestQuery = searchCache.keys().next().value
    if (oldestQuery === undefined) break
    searchCache.delete(oldestQuery)
  }
}

async function throwForHttpError(response: Response): Promise<never> {
  let githubMessage = response.statusText || 'Unknown error'

  try {
    const body: unknown = await response.json()
    if (isRecord(body) && typeof body.message === 'string') {
      githubMessage = body.message
    }
  } catch (error) {
    if (isAbortError(error) || !(error instanceof SyntaxError)) {
      throw error
    }
    // Use the HTTP status text if GitHub returned a non-JSON error body.
  }

  throw new GitHubApiError(response, githubMessage)
}

function mapUser(value: unknown): GitHubUser {
  if (
    !isRecord(value) ||
    typeof value.id !== 'number' ||
    typeof value.login !== 'string' ||
    typeof value.avatar_url !== 'string' ||
    typeof value.html_url !== 'string'
  ) {
    throw new Error('GitHub user search returned an unexpected user entry.')
  }

  return {
    id: value.id,
    login: value.login,
    avatarUrl: value.avatar_url,
    htmlUrl: value.html_url,
  }
}

function mapRepository(value: unknown): GitHubRepository {
  if (
    !isRecord(value) ||
    typeof value.id !== 'number' ||
    typeof value.name !== 'string' ||
    typeof value.full_name !== 'string' ||
    typeof value.html_url !== 'string' ||
    (typeof value.description !== 'string' && value.description !== null) ||
    typeof value.open_issues_count !== 'number'
  ) {
    throw new Error('GitHub repository response contained an unexpected entry.')
  }

  return {
    id: value.id,
    name: value.name,
    fullName: value.full_name,
    htmlUrl: value.html_url,
    description: value.description,
    openIssuesCount: value.open_issues_count,
  }
}

export async function searchUsers(
  query: string,
  signal?: AbortSignal,
): Promise<GitHubUser[]> {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []

  throwIfAborted(signal)
  const cachedUsers = getCachedUsers(normalizedQuery)
  if (cachedUsers) return cachedUsers

  const params = new URLSearchParams({ q: query.trim() })
  const response = await fetch(
    `${GITHUB_API_BASE_URL}/search/users?${params}`,
    { signal },
  )

  if (!response.ok) {
    await throwForHttpError(response)
  }

  const body: unknown = await response.json()
  throwIfAborted(signal)
  if (!isRecord(body) || !Array.isArray(body.items)) {
    throw new Error('GitHub user search returned an unexpected response.')
  }

  const users = body.items.map(mapUser)
  cacheUsers(normalizedQuery, users)
  return cloneUsers(users)
}

export async function getUserRepositories(
  username: string,
  signal?: AbortSignal,
): Promise<GitHubRepository[]> {
  const encodedUsername = encodeURIComponent(username)
  const response = await fetch(
    `${GITHUB_API_BASE_URL}/users/${encodedUsername}/repos`,
    { signal },
  )

  if (!response.ok) {
    await throwForHttpError(response)
  }

  const body: unknown = await response.json()
  if (!Array.isArray(body)) {
    throw new Error('GitHub repository request returned an unexpected response.')
  }

  return body.map(mapRepository)
}
