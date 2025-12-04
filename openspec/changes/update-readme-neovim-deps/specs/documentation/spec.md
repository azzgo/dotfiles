## MODIFIED Requirements

### Requirement: Neovim Setup Documentation
The README SHALL provide accurate and current information about Neovim dependencies and setup requirements that match the actual plugin configuration.

#### Scenario: User reviews Neovim dependencies
- **WHEN** a user reads the Neovim section of the README
- **THEN** all mentioned dependencies SHALL be currently used in the configuration
- **AND** no deprecated or unused dependencies SHALL be listed

#### Scenario: User follows fuzzy finder setup instructions
- **WHEN** a user sets up fuzzy finding based on README instructions
- **THEN** the instructions SHALL reference fzf-lua (current implementation)
- **AND** SHALL NOT reference LeaderF (deprecated/commented out)

#### Scenario: User configures snippet support
- **WHEN** a user reads about snippet configuration requirements  
- **THEN** the documentation SHALL reflect that LuaSnip is the current snippet engine
- **AND** SHALL NOT require python-neovim specifically for coc-snippets (no longer active)

## REMOVED Requirements

### Requirement: LeaderF Dependency Documentation  
**Reason**: LeaderF plugin is commented out in current configuration and replaced with fzf-lua
**Migration**: Users should use fzf-lua for fuzzy finding functionality instead