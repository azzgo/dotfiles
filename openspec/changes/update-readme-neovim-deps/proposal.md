# Change: Update README Neovim Dependencies

## Why
The README.md contains outdated information about Neovim dependencies and tools that are no longer used in the current configuration. Specifically, the README mentions LeaderF and coc-snippets which have been replaced or disabled, and references python-neovim requirements that may no longer be necessary.

## What Changes
- Remove references to LeaderF as a required dependency (replaced with fzf-lua)
- Update or remove coc-snippets python-neovim requirement (coc-snippets disabled, using LuaSnip now)
- Clarify current fuzzy finder setup (fzf-lua instead of LeaderF)
- Update dependency list to reflect current Neovim plugin configuration
- Ensure README accurately reflects the actual project dependencies

## Impact
- Affected specs: documentation capability (user-facing documentation)
- Affected code: README.md
- Users will have accurate setup instructions
- Reduces confusion during initial setup
- Documentation aligns with actual codebase state