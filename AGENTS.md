## Description

The codename for the project is forge-kivu! This is not the product name!

## Project setup and organization

- Use portable imports across package boundaries: workspace package names, relative paths, or package-scoped `#` aliases—not `@/*`.
- Dependencies versions should be pinned!
- Create new database migrations with `pnpm db:generate` in `apps/api` — never write migration files by hand.

## Code output style (Important!)

- NO NARRATIVE COMMENTS ALLOWED!
- CONVERSATION SHOULD NOT BE LEAKED INTO THE COMMENTS
- COMMENTS SHOULD NOT BE USED TO DESCRIBE DECISIONS
- THE ACTUAL CODE IS THE ONLY SOURCE OF truth

## Project documentation (specs, plans, etc...)
- Every LLM generated specs, plans should live inside the artifacts/ directory
- If the artifact specs has to be updated, then to keep the revisions visible, the old fact need to be struct-through, and the new fact beneath it.
