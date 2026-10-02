import { useId, useState } from 'react'
import type {
  GitHubUser,
  RepositoriesByUser,
  UserRepositoryState,
} from '../../types/github'
import './RepositoryList.css'

interface RepositoryListProps {
  selectedUsers: GitHubUser[]
  repositoriesByUser: RepositoriesByUser
}

interface UserRepositoryAccordionProps {
  user: GitHubUser
  repositoryState: UserRepositoryState | undefined
}

function UserRepositoryAccordion({
  user,
  repositoryState,
}: UserRepositoryAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const panelId = `repository-panel-${useId().replaceAll(':', '')}`
  const hasLoaded = repositoryState?.status === 'success'
  const repositoryCount = hasLoaded ? repositoryState.repositories.length : 0
  const totalOpenIssues = hasLoaded
    ? repositoryState.repositories.reduce(
        (total, repository) => total + repository.openIssuesCount,
        0,
      )
    : 0
  const summary = hasLoaded
    ? `${repositoryCount} ${repositoryCount === 1 ? 'repository' : 'repositories'} · ${totalOpenIssues} ${totalOpenIssues === 1 ? 'open issue' : 'open issues'}`
    : repositoryState?.status === 'error'
      ? 'Repository data unavailable'
      : repositoryState?.status === 'loading'
        ? 'Loading repositories…'
        : 'Waiting for repository data…'

  return (
    <li className="repository-list__user">
      <h3 className="repository-list__heading">
        <button
          aria-controls={panelId}
          aria-expanded={isExpanded}
          className="repository-list__toggle"
          id={`${panelId}-toggle`}
          onClick={() => setIsExpanded((expanded) => !expanded)}
          type="button"
        >
          <img className="repository-list__avatar" src={user.avatarUrl} alt="" />
          <span className="repository-list__user-info">
            <span className="repository-list__username">{user.login}</span>
            <span className="repository-list__summary">{summary}</span>
          </span>
          <span aria-hidden="true" className="repository-list__chevron">
            {isExpanded ? '−' : '+'}
          </span>
        </button>
      </h3>

      <div
        aria-labelledby={`${panelId}-toggle`}
        className="repository-list__panel"
        hidden={!isExpanded}
        id={panelId}
      >
        {isExpanded && (
          <>
            <h4 className="repository-list__panel-heading">
              {user.login} repositories
            </h4>

            {!repositoryState && (
              <p className="repository-list__status" role="status">
                Waiting for repository data…
              </p>
            )}

            {repositoryState?.status === 'loading' && (
              <p className="repository-list__status" role="status">
                Loading repositories…
              </p>
            )}

            {repositoryState?.status === 'error' && (
              <p className="repository-list__error" role="alert">
                {repositoryState.error ||
                  'Could not load repositories for this user.'}
              </p>
            )}

            {repositoryState?.status === 'success' &&
              (repositoryState.repositories.length === 0 ? (
                <p className="repository-list__empty">
                  No repositories found.
                </p>
              ) : (
                <ul className="repository-list__repositories">
                  {repositoryState.repositories.map((repository) => (
                    <li
                      className="repository-list__repository"
                      key={repository.id}
                    >
                      <a
                        aria-label={`Open ${repository.fullName} on GitHub (opens in a new tab)`}
                        href={repository.htmlUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {repository.name}
                      </a>
                      {repository.description && (
                        <p className="repository-list__description">
                          {repository.description}
                        </p>
                      )}
                      <p className="repository-list__issues">
                        {repository.openIssuesCount}{' '}
                        {repository.openIssuesCount === 1
                          ? 'open issue'
                          : 'open issues'}
                      </p>
                    </li>
                  ))}
                </ul>
              ))}
          </>
        )}
      </div>
    </li>
  )
}

export function RepositoryList({
  selectedUsers,
  repositoriesByUser,
}: RepositoryListProps) {
  return (
    <section className="repository-list placeholder-panel">
      <h2>Repositories</h2>
      {selectedUsers.length === 0 ? (
        <p className="repository-list__empty">Select users to view repositories.</p>
      ) : (
        <ul className="repository-list__users">
          {selectedUsers.map((user) => (
            <UserRepositoryAccordion
              key={user.id}
              repositoryState={repositoriesByUser[user.login]}
              user={user}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
