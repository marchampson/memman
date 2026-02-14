# Development Guidelines

## Code Quality

- Always use TypeScript strict mode
- Use ESM imports throughout the project
- Prefer functional programming patterns
- All functions must have return type annotations

## API Design

- RESTful endpoints follow /api/v1/ prefix
- Use proper HTTP status codes
- Rate limit all public endpoints
- Document all endpoints with OpenAPI

## Testing

- Minimum 80% code coverage
- Integration tests for all API endpoints
- Use factory pattern for test data
