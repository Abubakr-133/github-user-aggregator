import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { searchUsers } from '../../services/githubApi'
import type { GitHubUser } from '../../types/github'
import './MultiSelect.css'

interface MultiSelectProps {
  value: GitHubUser[]
  onChange: (users: GitHubUser[]) => void
}

const DEBOUNCE_DELAY_MS = 300

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

export function MultiSelect({ value, onChange }: MultiSelectProps) {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GitHubUser[]>([])
  const [resultsQuery, setResultsQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingQuery, setLoadingQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorQuery, setErrorQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [focusedUserId, setFocusedUserId] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const requestVersionRef = useRef(0)
  const searchControllerRef = useRef<AbortController | null>(null)
  const componentId = useId().replaceAll(':', '')
  const inputId = `multi-select-input-${componentId}`
  const listboxId = `multi-select-listbox-${componentId}`
  const normalizedQuery = query.trim()

  const selectedLogins = useMemo(
    () => new Set(value.map((user) => user.login.toLocaleLowerCase())),
    [value],
  )

  const availableUsers = useMemo(
    () =>
      (resultsQuery === normalizedQuery ? searchResults : []).filter(
        (user) => !selectedLogins.has(user.login.toLocaleLowerCase()),
      ),
    [normalizedQuery, resultsQuery, searchResults, selectedLogins],
  )

  const focusedIndex = availableUsers.findIndex(
    (user) => user.id === focusedUserId,
  )
  const currentLoading = isLoading && loadingQuery === normalizedQuery
  const currentError = errorQuery === normalizedQuery ? error : null
  const hasCurrentResults =
    normalizedQuery.length > 0 && resultsQuery === normalizedQuery
  const shouldShowDropdown =
    isOpen &&
    (currentLoading || currentError !== null || hasCurrentResults)

  useEffect(() => {
    const requestVersion = ++requestVersionRef.current
    if (!normalizedQuery) return

    const timeoutId = window.setTimeout(() => {
      searchControllerRef.current?.abort()
      const controller = new AbortController()
      searchControllerRef.current = controller

      void searchUsers(normalizedQuery, controller.signal)
        .then((users) => {
          if (requestVersionRef.current !== requestVersion) return
          setSearchResults(users)
          setResultsQuery(normalizedQuery)
        })
        .catch((searchError: unknown) => {
          if (requestVersionRef.current !== requestVersion) return
          if (isAbortError(searchError)) return

          setError(
            searchError instanceof Error
              ? searchError.message
              : 'Unable to search GitHub users. Please try again.',
          )
          setErrorQuery(normalizedQuery)
        })
        .finally(() => {
          if (searchControllerRef.current === controller) {
            searchControllerRef.current = null
          }
          if (requestVersionRef.current !== requestVersion) return
          setIsLoading(false)
        })
    }, DEBOUNCE_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
      searchControllerRef.current?.abort()
      searchControllerRef.current = null
      if (requestVersionRef.current === requestVersion) {
        requestVersionRef.current += 1
      }
    }
  }, [normalizedQuery])

  useEffect(() => {
    if (!shouldShowDropdown) return

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setIsOpen(false)
        setFocusedUserId(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [shouldShowDropdown])

  useEffect(() => {
    if (focusedIndex < 0) return
    document
      .getElementById(`${listboxId}-option-${availableUsers[focusedIndex]?.id}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [availableUsers, focusedIndex, listboxId])

  const selectUser = (user: GitHubUser) => {
    requestVersionRef.current += 1
    onChange([...value, user])
    setQuery('')
    setIsOpen(false)
    setFocusedUserId(null)
    setSearchResults([])
    setResultsQuery('')
    setIsLoading(false)
    setLoadingQuery('')
    setError(null)
    setErrorQuery('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && availableUsers.length > 0) {
      event.preventDefault()
      setIsOpen(true)
      const nextIndex =
        focusedIndex < 0
          ? 0
          : Math.min(focusedIndex + 1, availableUsers.length - 1)
      setFocusedUserId(availableUsers[nextIndex].id)
    } else if (event.key === 'ArrowUp' && availableUsers.length > 0) {
      event.preventDefault()
      setIsOpen(true)
      const previousIndex =
        focusedIndex < 0
          ? availableUsers.length - 1
          : Math.max(focusedIndex - 1, 0)
      setFocusedUserId(availableUsers[previousIndex].id)
    } else if (
      event.key === 'Enter' &&
      shouldShowDropdown &&
      focusedIndex >= 0 &&
      availableUsers[focusedIndex]
    ) {
      event.preventDefault()
      selectUser(availableUsers[focusedIndex])
    } else if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      setIsOpen(false)
      setFocusedUserId(null)
    }
  }

  return (
    <div className="multi-select" ref={containerRef}>
      <label className="multi-select__label" htmlFor={inputId}>
        Search GitHub users
      </label>

      <ul className="multi-select__selected" aria-label="Selected users">
        {value.map((user) => (
          <li className="multi-select__pill" key={user.id}>
            <img src={user.avatarUrl} alt="" />
            <span>{user.login}</span>
            <button
              aria-label={`Remove ${user.login}`}
              className="multi-select__remove"
              onClick={() =>
                onChange(value.filter((selected) => selected.id !== user.id))
              }
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="multi-select__control">
        <input
          aria-activedescendant={
            shouldShowDropdown && focusedIndex >= 0
              ? `${listboxId}-option-${availableUsers[focusedIndex]?.id}`
              : undefined
          }
          aria-autocomplete="list"
          aria-controls={shouldShowDropdown ? listboxId : undefined}
          aria-expanded={shouldShowDropdown}
          aria-haspopup="listbox"
          autoComplete="off"
          id={inputId}
          onChange={(event) => {
            const nextQuery = event.target.value
            const trimmedQuery = nextQuery.trim()
            setQuery(nextQuery)
            if (trimmedQuery !== normalizedQuery) {
              requestVersionRef.current += 1
              setSearchResults([])
              setResultsQuery('')
              setIsLoading(trimmedQuery.length > 0)
              setLoadingQuery(trimmedQuery)
              setError(null)
              setErrorQuery('')
            }
            setIsOpen(true)
            setFocusedUserId(null)
          }}
          onFocus={() => {
            if (normalizedQuery) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a GitHub username"
          role="combobox"
          type="search"
          value={query}
        />
      </div>

      {shouldShowDropdown && (
        <div className="multi-select__dropdown">
          {currentLoading && (
            <p className="multi-select__message" role="status">
              Searching GitHub users…
            </p>
          )}

          {currentError && (
            <p
              className="multi-select__message multi-select__message--error"
              role="alert"
            >
              {currentError}
            </p>
          )}

          <ul
            aria-label="GitHub user search results"
            aria-multiselectable="true"
            className="multi-select__options"
            id={listboxId}
            role="listbox"
          >
            {availableUsers.map((user, index) => (
              <li
                aria-selected={focusedIndex === index}
                className={`multi-select__option${focusedIndex === index ? ' is-focused' : ''}`}
                id={`${listboxId}-option-${user.id}`}
                key={user.id}
                onClick={() => selectUser(user)}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setFocusedUserId(user.id)}
                role="option"
              >
                <img alt="" src={user.avatarUrl} />
                <span>{user.login}</span>
              </li>
            ))}
          </ul>

          {!currentLoading && !currentError && availableUsers.length === 0 && (
            <p className="multi-select__message" role="status">
              No unselected users found.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
