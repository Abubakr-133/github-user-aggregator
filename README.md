# GitHub User Repository Aggregator

A React application for finding GitHub users, comparing their repositories, and ranking selected users by their repositories’ total open issue count. User search and repository data come from the public GitHub REST API.

## Features

- Search GitHub users with a custom, accessible multi-select dropdown.
- Select multiple users and remove them with the selected-user pills.
- Debounce searches by 300 ms and skip empty queries.
- Cancel superseded searches and ignore stale responses.
- Navigate search results with Arrow Up/Down, Enter, and Escape. Tab retains normal browser focus behavior.
- Close the results dropdown when clicking outside it.
- Fetch repository data when users are selected. Requests run through a FIFO queue, one at a time, with independent per-user loading, error, and success states.
- Expand or collapse each selected user’s repository section. Repository names link to GitHub; successful empty results have a dedicated message.
- View a Most Open Issues leaderboard derived from successfully loaded repository data. Loading and failed users are identified so their scores are not mistaken for zero.
- Use the responsive interface in light or dark theme. The initial theme follows the system preference, and a theme choice is saved in local storage.
- Install the app in supported browsers as a standalone PWA. Its service worker handles the app shell and same-origin build assets; GitHub API responses are not cached.

## Tech stack

- React 19 and TypeScript
- Vite 8
- Native Fetch API and AbortController
- CSS, including custom properties for theme tokens
- Native Web App Manifest and Service Worker APIs

## Project structure

```text
public/
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── manifest.webmanifest
└── sw.js
src/
├── components/
│   ├── Leaderboard/
│   │   ├── Leaderboard.tsx
│   │   └── Leaderboard.css
│   ├── MultiSelect/
│   │   ├── MultiSelect.tsx
│   │   └── MultiSelect.css
│   └── RepositoryList/
│       ├── RepositoryList.tsx
│       └── RepositoryList.css
├── hooks/
│   └── useRepositories.ts
├── services/
│   └── githubApi.ts
├── types/
│   └── github.ts
├── App.css
├── App.tsx
└── main.tsx
index.html
```

## Application data flow

1. `MultiSelect` reports selected GitHub users to `App` through its controlled `value` and `onChange` props.
2. `App` passes the selected users to `useRepositories`.
3. The hook keeps repository state by username and queues uncached requests in FIFO order, with at most one repository request active at a time. Successful results remain cached for the lifetime of the hook; each request updates its user’s state independently.
4. `App` passes the selected users and repository state to `RepositoryList` and `Leaderboard`. Both components derive their display from those props; neither makes API requests.

## GitHub API endpoints

- User search: `GET https://api.github.com/search/users?q={query}`
- User repositories: `GET https://api.github.com/users/{username}/repos`

The API service safely encodes query and path values, supports optional request cancellation, maps API records to the application’s TypeScript types, and reports HTTP failures with a structured error.

## Local setup

Install the project dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. On supported browsers, the app can be installed from the browser’s install option while served from `localhost`.

## Production build

```bash
npm run build
```

## Lint

```bash
npm run lint
```

## API and rate limits

This app calls GitHub’s public REST API directly from the browser without a token or backend. Unauthenticated requests are subject to GitHub’s rate limits, so searches or repository requests may fail when those limits are reached. The UI displays the resulting per-user or search error; repository requests are not automatically retried.

## Leaderboard calculation

For each selected user whose repository request succeeded, the leaderboard sums `openIssuesCount` across that user’s returned repositories. It sorts totals from highest to lowest, with GitHub username as a deterministic tie-breaker. Users whose repository data is loading or failed are shown as incomplete and are excluded from the ranking until successful data is available.
