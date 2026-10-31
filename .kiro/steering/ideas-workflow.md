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
- Don't tag, categorise, or build the skill tree progression until the user reviews it with you.
- When the user mentions a new idea, add a new file rather than appending to an unrelated one.
- Mark AI-suggested content as *(suggestion)* so the user can tell it apart from their own ideas.
- Keep `ideas/README.md` index up to date.
