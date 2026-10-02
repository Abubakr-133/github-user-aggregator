export interface GitHubUser {
  id: number
  login: string
  avatarUrl: string
  htmlUrl: string
}

export interface GitHubRepository {
  id: number
  name: string
  fullName: string
  htmlUrl: string
  description: string | null
  stargazersCount: number
  language: string | null
  openIssuesCount: number
}

export type RepositoryStatus = 'loading' | 'success' | 'error'

export interface UserRepositoryState {
  status: RepositoryStatus
  repositories: GitHubRepository[]
  error?: string
}

export type RepositoriesByUser = Record<string, UserRepositoryState>

export interface LeaderboardEntry {
  user: GitHubUser
  openIssuesCount: number
}
