---
name: spec-creator
description: Author a spec for a module, feature, or system decision. Use when the user asks to write, create, or update a spec, or to turn discussed decisions into a spec document.
---

# Spec Creator

Author specs that capture decisions already made and lay out a verifiable build plan. A spec records the outcome of a discussion — it does not reopen it.

## Location and naming

- Every spec goes in `artifacts/` at the repository root.
- File name: `<topic>-spec.md` (e.g. `auth-module-spec.md`, `rfq-flow-spec.md`).
- Before writing, read one existing spec in `artifacts/` to match its voice.

## Required structure

```
# <Topic> Spec

## Decisions
## <Structure sections — only the ones that fit>
## Implementation plan
## Test approach
```

### Decisions

A numbered list. Each entry:

- Starts with a **bold statement of the decision** in one short sentence.
- Follows with the reason, in one or two plain sentences. The reason is part of the record — a decision without its why gets relitigated.
- States rejected alternatives only when the rejection itself was a decision (e.g. "No JWT — cannot be revoked before expiry").
- Marks deferred work explicitly ("Deferred: cleanup job") and names what makes it possible later.

Include every decision made in the conversation. If the spec requires a call that was never discussed, make it, write it down, and tell the user afterwards which calls were yours.

### Structure sections

Pick only what the topic needs: module layout, tables, service surface, routes, data flow. Use fenced code blocks with tree-style layouts for files and tables. Skip any section that would be empty or obvious.

### Implementation plan — vertical slices only

Open the section with: "Each step is a vertical slice: it ends with something you can run and check before starting the next."

- Each step delivers a runnable slice of behavior end to end — never a layer ("all the tables", "all the routes").
- Each step has `Build:` (one sentence listing what gets made) and `Acceptance criteria:` (bullets).
- Acceptance criteria are observable checks: a curl call and its response, a database row's state, a test that passes. Never "works correctly" or "is implemented".
- Include failure-path criteria, not just the happy path (wrong input, missing auth, retries).
- If a step can be postponed without blocking others, say so in its heading ("can be deferred; nothing depends on it").
- Order steps by dependency: each step may rely only on earlier steps.

### Test approach

Two or three sentences: what kind of tests, against what (real database, no mocks), and any shared helper.

## Writing rules

- Plain English. Prefer the common word. Short sentences.
- Explain every acronym or term of art the first time it appears, inline in parentheses: "CSRF (cross-site request forgery: another website tricking the browser into sending a request with your cookie)".
- No filler: cut "robust", "comprehensive", "seamless", "leverage", "in order to", and any sentence that adds no information.
- Keep exact names: real paths, real commands, real column names. Follow project conventions (e.g. migrations via `pnpm db:generate`, never hand-written).
- A spec is one file. If it grows past roughly 150 lines, the scope is probably two specs.

## After writing

Reply with links to the files and a short list of any decisions you made that the user did not explicitly approve, so they can veto them.
