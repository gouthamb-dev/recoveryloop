# Recovery Loop — Unit of Work Plan

## Plan Overview

This plan decomposes Recovery Loop into three units of work, generates the unit artifacts,
and maps components to units. The three-unit structure is already established from the
application design. Questions focus on remaining build/tooling decisions.

---

## Steps

### Part 1: Planning
- [x] Step 1: Analyze application design and identify unit boundaries
- [x] Step 2: Answer decomposition questions (user input required)
- [x] Step 3: Get user approval to proceed to generation

### Part 2: Generation
- [x] Step 4: Generate `unit-of-work.md` — unit definitions, responsibilities, code structure
- [x] Step 5: Generate `unit-of-work-dependency.md` — dependency matrix and build order
- [x] Step 6: Generate `unit-of-work-story-map.md` — component-to-unit mapping
- [x] Step 7: Validate unit boundaries and completeness

---

## Preliminary Unit Structure (from Application Design)

| Unit | Name | Key Components |
|---|---|---|
| Unit 1 | infrastructure | SAM Stack, DynamoDB, S3, CloudFront, API GW, IAM, CloudWatch |
| Unit 2 | backend-lambda | UnblockAgentHandler, SessionService, PromptBuilder, BedrockService, SandboxService, InputValidator, Logger |
| Unit 3 | frontend | App, LeftPane, RightPane, ApiClient |

---

## Decomposition Questions

Please answer each question by filling in the letter choice after the `[Answer]:` tag.

---

### Question 1
The backend Lambda (`backend-lambda`) and the frontend both need the shared TypeScript
types (e.g. `SseEvent`, `UnblockRequest`, `SessionRecord`). How should shared types be managed?

A) Duplicate types in each unit — simpler for MVP, no shared package overhead

B) A shared `types/` directory at the workspace root that both units import locally (monorepo-style path import, no npm package)

C) A separate published npm package — full decoupling but adds versioning overhead

D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 2
What should the top-level workspace folder structure look like?

A) Flat — `infrastructure/`, `backend-lambda/`, `frontend/` all at workspace root alongside `README.md`

B) Nested under `packages/` — `packages/infrastructure/`, `packages/backend-lambda/`, `packages/frontend/`

C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

### Question 3
The `backend-lambda` unit needs a test runner for unit tests and PBT. Which should be used?

A) Jest + ts-jest — the standard for Lambda TypeScript projects; well-supported with fast-check

B) Vitest — faster, native ESM support, compatible with fast-check

C) Other (please describe after [Answer]: tag below)

[Answer]: B

---

### Question 4
The `frontend` unit uses Svelte + Vite. Should the frontend include component unit tests?

A) Yes — use Vitest + @testing-library/svelte for component tests alongside the Svelte app

B) No — frontend testing is out of scope for the MVP; only backend tests needed

C) Other (please describe after [Answer]: tag below)

[Answer]: B

---

*Please fill in all [Answer]: tags, then let me know and I will proceed to generate the unit artifacts.*
