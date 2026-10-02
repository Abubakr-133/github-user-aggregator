import { useEffect, useState } from 'react'
import { Leaderboard } from './components/Leaderboard/Leaderboard'
import { MultiSelect } from './components/MultiSelect/MultiSelect'
import { RepositoryList } from './components/RepositoryList/RepositoryList'
import { useRepositories } from './hooks/useRepositories'
import type { GitHubUser } from './types/github'
import './App.css'

type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'github-data-explorer-theme'

function getInitialTheme(): Theme {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
  } catch {
    // Storage may be unavailable in private browsing or restricted contexts.
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function App() {
  const [selectedUsers, setSelectedUsers] = useState<GitHubUser[]>([])
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const repositoriesByUser = useRepositories(selectedUsers)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#111827' : '#f5f7fb')

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // The in-memory theme still works when storage is unavailable.
    }
  }, [theme])

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header__topline">
          <p className="eyebrow">GitHub data explorer</p>
          <button
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            aria-pressed={theme === 'dark'}
            className="theme-toggle"
            onClick={() =>
              setTheme((currentTheme) =>
                currentTheme === 'dark' ? 'light' : 'dark',
              )
            }
            type="button"
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
        </div>
        <h1>GitHub User &amp; Derived State Aggregator</h1>
        <p className="app-description">
          The application structure is ready for implementation.
        </p>
      </header>

      <div className="app-sections">
        <MultiSelect value={selectedUsers} onChange={setSelectedUsers} />
        <RepositoryList
          repositoriesByUser={repositoriesByUser}
          selectedUsers={selectedUsers}
        />
        <Leaderboard
          repositoriesByUser={repositoriesByUser}
          selectedUsers={selectedUsers}
        />
      </div>
    </main>
  )
}

export default App
