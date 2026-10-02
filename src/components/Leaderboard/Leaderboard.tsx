import { useMemo } from 'react'
import type {
  GitHubUser,
  LeaderboardEntry,
  RepositoriesByUser,
} from '../../types/github'
import './Leaderboard.css'

interface LeaderboardProps {
  selectedUsers: GitHubUser[]
  repositoriesByUser: RepositoriesByUser
}

export function Leaderboard({
  selectedUsers,
  repositoriesByUser,
}: LeaderboardProps) {
  const loadingUsers: GitHubUser[] = []
  const errorUsers: Array<{ user: GitHubUser; message: string }> = []

  for (const user of selectedUsers) {
    const userState = repositoriesByUser[user.login]

    if (!userState || userState.status === 'loading') {
      loadingUsers.push(user)
    } else if (userState.status === 'error') {
      errorUsers.push({
        user,
        message: userState.error || 'Could not load this user’s repositories.',
      })
    }
  }

  const scores = useMemo(() => {
    const derivedScores: LeaderboardEntry[] = []

    for (const user of selectedUsers) {
      const userState = repositoriesByUser[user.login]
      if (userState?.status !== 'success') continue

      const openIssuesCount = userState.repositories.reduce(
        (total, repository) => total + repository.openIssuesCount,
        0,
      )
      derivedScores.push({ user, openIssuesCount })
    }

    derivedScores.sort((left, right) => {
      const scoreOrder = right.openIssuesCount - left.openIssuesCount
      if (scoreOrder !== 0) return scoreOrder

      const leftLogin = left.user.login.toLowerCase()
      const rightLogin = right.user.login.toLowerCase()
      return (
        leftLogin.localeCompare(rightLogin) ||
        left.user.login.localeCompare(right.user.login)
      )
    })

    return derivedScores
  }, [selectedUsers, repositoriesByUser])

  const hasIncompleteData = loadingUsers.length > 0 || errorUsers.length > 0

  return (
    <section
      aria-labelledby="leaderboard-heading"
      className="leaderboard placeholder-panel"
    >
      <h2 id="leaderboard-heading">Most open issues</h2>

      {selectedUsers.length === 0 ? (
        <p className="leaderboard__empty">
          Select users to view the leaderboard.
        </p>
      ) : (
        <>
          {hasIncompleteData && (
            <div className="leaderboard__incomplete" role="status">
              <p className="leaderboard__incomplete-message">
                The leaderboard may be incomplete while repository data loads or
                failed requests are addressed.
              </p>

              {loadingUsers.length > 0 && (
                <div className="leaderboard__user-status">
                  <h3>Still loading</h3>
                  <ul>
                    {loadingUsers.map((user) => (
                      <li key={user.id}>{user.login} — loading repositories</li>
                    ))}
                  </ul>
                </div>
              )}

              {errorUsers.length > 0 && (
                <div
                  aria-label="Repository loading errors"
                  className="leaderboard__user-status leaderboard__user-status--error"
                  role="alert"
                >
                  <h3>Could not load repository data</h3>
                  <ul>
                    {errorUsers.map(({ user, message }) => (
                      <li key={user.id}>
                        <strong>{user.login}:</strong> {message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {scores.length === 0 ? (
            <p className="leaderboard__empty" role="status">
              No scores are available until repository data loads successfully.
            </p>
          ) : (
            <ol className="leaderboard__ranking" aria-label="Users ranked by total open issues">
              {scores.map((entry, index) => (
                <li className="leaderboard__entry" key={entry.user.id}>
                  <span className="leaderboard__rank">Rank {index + 1}</span>
                  <span className="leaderboard__identity">
                    <img src={entry.user.avatarUrl} alt="" />
                    <span>{entry.user.login}</span>
                  </span>
                  <span className="leaderboard__score">
                    {entry.openIssuesCount}{' '}
                    {entry.openIssuesCount === 1 ? 'open issue' : 'open issues'}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  )
}
