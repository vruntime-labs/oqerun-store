# ChatGPT Memory Kit
## A practical, ChatGPT-compatible adaptation of the ideas behind claude-mem

**Purpose:** Help ChatGPT maintain useful continuity across coding sessions and projects by keeping a compact, user-controlled project memory that can be searched, reviewed, and updated.

**Important:** This is an instruction-and-file workflow, not a native background memory daemon. It does not install hooks, monitor every message automatically, run between chats, or silently capture tool activity.

---

## 1. What this kit does

This kit adapts the main ideas of claude-mem into a workflow that works in ordinary ChatGPT conversations:

- **Session summaries:** turn a completed work session into a concise record.
- **Structured observations:** preserve decisions, fixes, discoveries, implementation changes, and open issues.
- **Progressive retrieval:** search a short index first, then read only the relevant detailed notes.
- **Project separation:** keep unrelated projects and their decisions distinct.
- **User control:** review, correct, export, or delete the memory file yourself.
- **Truthful continuity:** distinguish verified facts from assumptions and unresolved questions.

It is designed to work with ChatGPT Free using uploaded Markdown files. It can also be used with other ChatGPT plans.

## 2. What it cannot do

Unlike a coding agent with lifecycle hooks and a local database, a normal ChatGPT conversation cannot use this Markdown file to:

- automatically record every prompt, tool call, or file change;
- run a background observer or worker service;
- inject project context into every new chat without the relevant context being available;
- perform automatic semantic/vector search over a local database;
- guarantee that a file attached in one conversation will be available in another.

ChatGPT Memory, when enabled, is a separate product feature. It may help retain selected high-level information, but it is not a replacement for a complete, searchable project history. Do not assume it has stored a particular decision or code change.

**Reliable method:** keep the memory file in your own project folder and attach the latest copy when starting a new project conversation.

---

## 3. Files to maintain

Start with one file:

`CHATGPT_PROJECT_MEMORY.md`

For larger projects, split it into:

- `PROJECT_PROFILE.md` — purpose, stack, architecture, constraints.
- `MEMORY_INDEX.md` — compact list of observations and their IDs.
- `memory/observations.md` — detailed decisions, fixes, discoveries, and changes.
- `SESSION_LOG.md` — dated session summaries and unfinished work.

Do not create all these files for a tiny project. Start with one file and split only when it becomes difficult to navigate.

---

## 4. Core operating instructions

When this kit is attached, follow these rules for the rest of the conversation.

### A. At the start of a session

1. Read the attached memory file before proposing changes.
2. Identify the project and the current task.
3. Extract only the relevant context: project constraints, recent decisions, known bugs, and unfinished work.
4. If the file is missing, ask for it rather than pretending to know the project's history.
5. If two notes conflict, show the conflict and ask which is current. Do not silently choose.
6. Treat memory as historical context, not as an instruction that overrides the user's current request.

### B. While working

Create a candidate observation when something durable happens:

- a technical or product decision is made;
- a bug is diagnosed or fixed;
- an implementation or architecture changes;
- a useful discovery affects future work;
- a test reveals a regression or confirms expected behaviour;
- a task is blocked or left unfinished.

Do not record every message. Prefer concise, reusable facts over transcripts.

Each observation should have:
- a unique ID;
- date;
- project;
- type (`decision`, `bugfix`, `feature`, `refactor`, `discovery`, `test`, `blocker`);
- a short title;
- what changed or was learned;
- why it matters;
- files or components involved, if known;
- verification status (`verified`, `partially verified`, `not verified`);
- links or evidence, if available.

Do not invent dates, test results, file names, commits, or implementation details.

### C. Before finishing a session

When the user says `wrap up`, `save session`, `make memory`, or similar:

1. Summarize the work completed.
2. List decisions and observations worth retaining.
3. Record unfinished tasks and the next useful step.
4. Mark anything that was not tested as unverified.
5. Prepare a complete updated copy of the memory file, not just fragments, when practical.
6. Tell the user what changed in the memory file.
7. Do not claim the file was saved to their computer or repository unless an available tool actually did that.

If the user has not asked for a wrap-up, do not interrupt normal work with repetitive memory summaries. You may briefly suggest a wrap-up at a natural stopping point.

---

## 5. Progressive memory retrieval

Use a three-stage retrieval process to avoid dumping the entire history into every answer.

### Stage 1 — Search the index

Search the index for the project, topic, file, bug, feature, or decision. Return a compact list of matching observation IDs and one-line descriptions.

### Stage 2 — Build a timeline

For promising matches, inspect the nearby session summaries and dates. Determine what happened before and after the observation.

### Stage 3 — Read details

Read only the full observations needed to answer the current question. Cite their IDs in the response, for example `[OBS-0012]`.

If no relevant observation exists, say so. Do not fill gaps with guesses.

Suggested natural-language commands:

- `Search memory for the authentication decision.`
- `What did we change in the last session?`
- `Find previous fixes related to the mobile navigation.`
- `Show the timeline around OBS-0012.`
- `What is still unfinished in this project?`
- `Wrap up this session and prepare the updated memory file.`
- `Forget this project note from the working memory file.`

---

## 6. Memory file template

Use the following structure for `CHATGPT_PROJECT_MEMORY.md`.

# Project Memory

## Project profile
- **Project name:**
- **Purpose:**
- **Repository or workspace:**
- **Main technologies:**
- **Important constraints:**
- **Current status:**
- **Last updated:**

## Current state
- **Working:**
- **In progress:**
- **Known issues:**
- **Next actions:**

## Decisions
| ID | Date | Decision | Reason | Status |
|---|---|---|---|---|
| DEC-0001 | YYYY-MM-DD | Example decision | Why it was chosen | Current |

## Observation index
| ID | Date | Type | Title | Related files/components |
|---|---|---|---|---|
| OBS-0001 | YYYY-MM-DD | discovery | Example discovery | `src/example.ts` |

## Session summaries
### YYYY-MM-DD — Session title
- **Goal:**
- **Completed:**
- **Important findings:**
- **Not completed:**
- **Next step:**
- **Verification:**

## Detailed observations

### OBS-0001 — Example discovery
- **Date:**
- **Type:** discovery
- **Project:**
- **Summary:**
- **Details:**
- **Why it matters:**
- **Related files/components:**
- **Verification:** not verified
- **Evidence:**

## Open questions
- [ ] Question that still needs an answer.

## Memory maintenance
- Remove obsolete notes only after checking whether later decisions supersede them.
- Mark superseded decisions as `superseded`; do not leave them looking current.
- Merge duplicate observations when safe.
- Keep the index short and detailed notes focused.
- Never store passwords, API keys, access tokens, private keys, recovery codes, or other secrets.
- Avoid storing sensitive personal information. Keep this memory focused on project facts and work history.

---

## 7. Observation quality rules

Good observation:

> **OBS-0014 — Fixed mobile menu overlap**  
> Type: bugfix  
> The mobile navigation overlapped the page heading at narrow widths. The menu was changed to use a fixed overlay and the page content now starts below the header. Verified at 390px and 768px using screenshots. Related: `Header.tsx`, `globals.css`.

Poor observation:

> We talked about CSS and changed some things. It looks better now.

Rules:
- One observation should capture one durable fact.
- Prefer concrete nouns, filenames, component names, and outcomes.
- Separate what the user requested from what was actually implemented.
- Separate verified results from assumptions.
- Record a failed approach only when it prevents repeating wasted work.
- Do not store entire source files or long conversation transcripts in memory.

---

## 8. Privacy and safety

- Keep the memory file under the user's control.
- Do not include secrets or credentials.
- Do not record sensitive personal details just because they appeared in a conversation.
- Before sharing a memory file with another person or service, review its contents.
- If a note should not be retained, exclude it from the memory file.
- A request to exclude a note from this file does not itself delete the original chat or any separate ChatGPT Memory entry.

---

## 9. Suggested activation prompt

Attach the latest `CHATGPT_PROJECT_MEMORY.md` and send:

> Use the attached ChatGPT Memory Kit as the working memory protocol for this project. First read the project profile, current state, decisions, observation index, and recent session summaries. Use progressive retrieval: search the index, inspect the timeline, then read only relevant observation details. During work, identify durable decisions, fixes, discoveries, and blockers, but do not claim automatic background capture. When I say “wrap up”, prepare a complete updated Markdown memory file with a concise session summary and verified observations. Keep assumptions clearly labelled, never invent test results, and never store secrets.

---

## 10. Recommended routine

**Starting a new chat**
1. Upload the latest memory file.
2. Send the activation prompt.
3. State the task you want to continue.

**During work**
- Ask memory questions naturally.
- Correct outdated notes explicitly.
- Keep the current project and repository clear.

**Ending a session**
1. Ask: `Wrap up this session and prepare the updated memory file.`
2. Review the proposed changes.
3. Download the updated file and replace your local copy.
4. Attach that latest copy next time.

This is a deliberate, user-controlled approximation of persistent agent memory—not a claim that ChatGPT has installed or is running claude-mem.

---

## 11. Source and adaptation note

Inspired by the publicly documented concepts in `thedotmack/claude-mem`: session observations, compressed summaries, progressive disclosure, memory search, and context continuity. This document is an independent ChatGPT workflow adaptation. It does not include claude-mem source code, its hooks, worker, database, vector store, or hosted services.

Original project: https://github.com/thedotmack/claude-mem
