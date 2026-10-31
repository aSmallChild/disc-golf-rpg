---
inclusion: fileMatch
fileMatchPattern: 'ideas/**'
---
# Ideas Folder Workflow

- One idea per file in `ideas/`, kebab-case filename.
- Every file starts with frontmatter:
  ```yaml
  ---
  tags: []          # filled in during review with the user
  status: draft     # draft | reviewed | accepted | rejected
  related: []       # other idea filenames
  ---
  ```
- Only tag ideas the user has confirmed (`status: accepted`). Use the tag vocabulary in `ideas/README.md` and add new tags there. Don't build the skill tree progression until the user reviews it.
- `accepted` covers the user's core idea only. AI suggestions inside stay unconfirmed until the user picks them.
- When the user asks, critique ideas on: is it fun, is it challenging, and is it the right kind of challenge for this game (decisions over reflexes, visible before the shot, no unfair punishment).
- When the user mentions a new idea, add a new file rather than appending to an unrelated one.
- Mark AI-suggested content as *(suggestion)* so the user can tell it apart from their own ideas.
- Keep `ideas/README.md` index up to date.
