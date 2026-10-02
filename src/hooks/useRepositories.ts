import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getUserRepositories } from '../services/githubApi'
import type {
  GitHubRepository,
  GitHubUser,
  RepositoriesByUser,
} from '../types/github'

interface RepositoryRequestJob {
  username: string
  requestId: number
}

interface ActiveRepositoryRequest extends RepositoryRequestJob {
  controller: AbortController
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Could not load this user’s repositories.'
}

export function useRepositories(
  selectedUsers: GitHubUser[],
): RepositoriesByUser {
  const [repositoriesByUser, setRepositoriesByUser] =
    useState<RepositoriesByUser>({})
  const repositoriesByUserRef = useRef(repositoriesByUser)
  const queuedRequests = useRef<RepositoryRequestJob[]>([])
  const inFlightRequests = useRef(new Map<string, number>())
  const activeRequest = useRef<ActiveRepositoryRequest | null>(null)
  const requestRunner = useRef<() => void>(() => {})
  const selectedUsernamesRef = useRef(new Set<string>())
  const previouslySelectedUsernames = useRef(new Set<string>())
  const nextRequestId = useRef(0)
  const isMounted = useRef(false)

  const selectedUsernames = useMemo(
    () => selectedUsers.map((user) => user.login),
    [selectedUsers],
  )

  const updateRepositoriesByUser = useCallback(
    (update: (current: RepositoriesByUser) => RepositoriesByUser) => {
      const next = update(repositoriesByUserRef.current)
      repositoriesByUserRef.current = next
      if (isMounted.current) setRepositoriesByUser(next)
    },
    [],
  )

  const startNextRequest = useCallback(() => {
    if (!isMounted.current || activeRequest.current) return

    let job: RepositoryRequestJob | undefined
    while (queuedRequests.current.length > 0 && !job) {
      const candidate = queuedRequests.current.shift()
      if (!candidate) continue

      if (
        inFlightRequests.current.get(candidate.username) !== candidate.requestId
      ) {
        continue
      }

      if (!selectedUsernamesRef.current.has(candidate.username)) {
        inFlightRequests.current.delete(candidate.username)
        updateRepositoriesByUser((current) => {
          if (current[candidate.username]?.status !== 'loading') return current
          const next = { ...current }
          delete next[candidate.username]
          return next
        })
        continue
      }

      job = candidate
    }

    if (!job) return

    const controller = new AbortController()
    const active: ActiveRepositoryRequest = { ...job, controller }
    activeRequest.current = active

    void getUserRepositories(job.username, controller.signal)
      .then((repositories: GitHubRepository[]) => {
        if (
          !isMounted.current ||
          inFlightRequests.current.get(job.username) !== job.requestId ||
          activeRequest.current?.requestId !== job.requestId
        ) {
          return
        }

        updateRepositoriesByUser((current) => ({
          ...current,
          [job.username]: { status: 'success', repositories },
        }))
      })
      .catch((error: unknown) => {
        if (
          !isMounted.current ||
          inFlightRequests.current.get(job.username) !== job.requestId ||
          activeRequest.current?.requestId !== job.requestId
        ) {
          return
        }

        if (isAbortError(error)) {
          updateRepositoriesByUser((current) => {
            if (current[job.username]?.status !== 'loading') return current
            const next = { ...current }
            delete next[job.username]
            return next
          })
          return
        }

        updateRepositoriesByUser((current) => ({
          ...current,
          [job.username]: {
            status: 'error',
            repositories: current[job.username]?.repositories ?? [],
            error: getErrorMessage(error),
          },
        }))
      })
      .finally(() => {
        if (activeRequest.current?.requestId === job.requestId) {
          activeRequest.current = null
        }
        if (inFlightRequests.current.get(job.username) === job.requestId) {
          inFlightRequests.current.delete(job.username)
        }
        requestRunner.current()
      })
  }, [updateRepositoriesByUser])

  useEffect(() => {
    requestRunner.current = startNextRequest
  }, [startNextRequest])

  useLayoutEffect(() => {
    selectedUsernamesRef.current = new Set(selectedUsernames)
  }, [selectedUsernames])

  useEffect(() => {
    isMounted.current = true
    const requests = inFlightRequests.current

    return () => {
      isMounted.current = false
      activeRequest.current?.controller.abort()
      activeRequest.current = null
      queuedRequests.current = []
      requests.clear()
      selectedUsernamesRef.current.clear()
      previouslySelectedUsernames.current.clear()

      const retained = { ...repositoriesByUserRef.current }
      for (const [username, userState] of Object.entries(retained)) {
        if (userState.status === 'loading') delete retained[username]
      }
      repositoriesByUserRef.current = retained
    }
  }, [])

  useEffect(() => {
    const currentSelection = new Set(selectedUsernames)
    const removedQueuedUsernames: string[] = []

    queuedRequests.current = queuedRequests.current.filter((job) => {
      if (currentSelection.has(job.username)) return true

      if (inFlightRequests.current.get(job.username) === job.requestId) {
        inFlightRequests.current.delete(job.username)
        removedQueuedUsernames.push(job.username)
      }
      return false
    })

    if (removedQueuedUsernames.length > 0) {
      updateRepositoriesByUser((current) => {
        let next = current
        for (const username of removedQueuedUsernames) {
          if (next[username]?.status !== 'loading') continue
          if (next === current) next = { ...current }
          delete next[username]
        }
        return next
      })
    }

    const previouslySelected = previouslySelectedUsernames.current
    const newlySelectedUsernames = selectedUsernames.filter(
      (username) => !previouslySelected.has(username),
    )
    previouslySelectedUsernames.current = currentSelection

    const requestsToStart = newlySelectedUsernames.filter((username) => {
      const cachedState = repositoriesByUserRef.current[username]
      if (cachedState?.status === 'success' || cachedState?.status === 'loading') {
        return false
      }
      return !inFlightRequests.current.has(username)
    })

    if (requestsToStart.length > 0) {
      const jobs = requestsToStart.map((username) => {
        const requestId = ++nextRequestId.current
        inFlightRequests.current.set(username, requestId)
        return { username, requestId }
      })

      queuedRequests.current.push(...jobs)
      updateRepositoriesByUser((current) => {
        const next = { ...current }
        for (const { username } of jobs) {
          next[username] = {
            status: 'loading',
            repositories: current[username]?.repositories ?? [],
          }
        }
        return next
      })
    }

    startNextRequest()
  }, [selectedUsernames, startNextRequest, updateRepositoriesByUser])

  return repositoriesByUser
}
