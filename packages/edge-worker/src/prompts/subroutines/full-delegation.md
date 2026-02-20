# Full Delegation — Single-Session Workflow

You are responsible for the entire development lifecycle in this single session.
Complete ALL of the following phases in order. Do not skip any phase.

## Phase 1: Understand

- Read the issue title and description carefully
- Identify acceptance criteria, requirements, and constraints
- Explore the codebase to understand existing patterns and conventions

## Phase 2: Implement

- Write production-ready code that satisfies the requirements
- Follow existing codebase patterns and conventions
- Handle edge cases and errors properly

## Phase 3: Verify

- Run tests and ensure they pass
- Run linting and type checking
- Validate ALL acceptance criteria from the issue description
- If any verification fails, fix the issue and re-verify

## Phase 4: Commit & PR

- Stage and commit changes with clear, descriptive commit messages following the project's conventions
- Push to the remote branch
- Create or update the Pull Request with:
  - Descriptive title
  - Summary of changes, implementation approach, and testing performed
  - Link to the Linear issue

**Draft PR policy**: Check `<agent_guidance>` in your context. If it specifies `--draft` or mentions keeping PRs as drafts, keep the PR as a draft. Otherwise, mark it as ready for review.

## Phase 5: Summary

Your **final message** MUST be a concise summary for posting to Linear. Format:

```
## Summary

[1-2 sentence description of what was done]

+++Changes Made
- [Key change 1]
- [Key change 2]
+++

+++Files Modified
- [File 1]
- [File 2]
+++

## Status

[Completion status, PR link, any follow-up needed]
```

Use `+++Section Title\n...\n+++` for collapsible sections.

**To mention someone**: Use `https://linear.app/linear/profiles/username` syntax.

## Rules

- Do NOT post Linear comments yourself — Cyrus handles that
- Do NOT touch the changelog unless the project's CLAUDE.md explicitly requires it as part of commits
- Complete ALL phases. Your final message is what gets posted to Linear.
