# Project Guidelines

## Coding Standards

- Always use TypeScript strict mode
- Never use `any` type - use `unknown` instead
- Use ESM imports, not CommonJS require
- Prefer `const` over `let`

## Testing

- Run tests with `npm test`
- Always add tests for new features
- Use vitest for unit tests
- Test files should be co-located with source

## Database

- Always use parameterized queries
- Never use raw SQL string concatenation
- Run migrations with `npm run migrate`

## Security

- Never commit .env files
- Always validate user input
- Use CSRF protection on all forms
- API keys must be stored in environment variables

## Frontend

- Use Tailwind CSS for styling
- Components should be in PascalCase
- Use Vue 3 composition API
- Always add loading states to async operations

## Deployment

- Use Docker for production
- CI runs on GitHub Actions
- Never push directly to main

<!-- memman:start id=synced -->
## Synced from AGENTS.md
- Use consistent error handling patterns
<!-- memman:end id=synced -->
