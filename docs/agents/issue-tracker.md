# Issue Tracker: GitHub

Issues and PRDs for this repo live as GitHub issues in `moritzbrantner/workflow-editor`. Use the `gh` CLI or the GitHub connector for all issue operations.

## Conventions

- Create an issue: `gh issue create --repo moritzbrantner/workflow-editor --title "..." --body "..."`
- Read an issue: `gh issue view <number> --repo moritzbrantner/workflow-editor --comments`
- List issues: `gh issue list --repo moritzbrantner/workflow-editor --state open --json number,title,body,labels,comments`
- Comment on an issue: `gh issue comment <number> --repo moritzbrantner/workflow-editor --body "..."`
- Apply or remove labels: `gh issue edit <number> --repo moritzbrantner/workflow-editor --add-label "..."` or `--remove-label "..."`
- Close an issue: `gh issue close <number> --repo moritzbrantner/workflow-editor --comment "..."`

## Publishing Work

When a skill says "publish to the issue tracker", create a GitHub issue in `moritzbrantner/workflow-editor`.

When a skill says "fetch the relevant ticket", run `gh issue view <number> --repo moritzbrantner/workflow-editor --comments`.
