# Dotfiles management using Just
# https://github.com/casey/just

# Default variables
dotfiles_dir := justfile_directory()
temp_dir := dotfiles_dir / "temp_dotfiles"

# List all available recipes
default:
    @just --list

# Package dotfiles for Linux x64 distribution
pack-linux64:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "📦 Packaging dotfiles for Linux x64..."
    rm -rf {{ temp_dir }}
    mkdir -p {{ temp_dir }}

    rsync -av \
        --exclude='nvim-linux-x86_64.tar.gz' \
        --exclude='nvim-linux-x86_64' \
        --exclude='temp_dotfiles' \
        --exclude='.github' \
        --exclude='.git' \
        --exclude='dotfiles.tar.gz' \
        --exclude='dotfiles.linux64.tar.gz' \
        --exclude='justfile' \
        {{ dotfiles_dir }}/ {{ temp_dir }}/

    tar -czvf {{ dotfiles_dir }}/dotfiles.linux64.tar.gz -C {{ temp_dir }} .
    rm -rf {{ temp_dir }}
    echo "✅ Package created: dotfiles.linux64.tar.gz"

# Install Neovim configuration
install-neovim:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🚀 Installing Neovim configuration..."

    # Create neovim config directory
    mkdir -p ~/.config/nvim

    # Add source line to init.vim if not already present
    if ! grep -q "source.*{{ dotfiles_dir }}/nvim/init.vim" ~/.config/nvim/init.vim 2>/dev/null; then
        echo "source {{ dotfiles_dir }}/nvim/init.vim" >> ~/.config/nvim/init.vim
    fi

    # Install plugins and update Treesitter
    echo "Installing Lazy plugins..."
    nvim --headless -c 'Lazy install' -c 'qa'
    echo "Updating Treesitter parsers..."
    nvim --headless -c 'TSUpdateSync' -c 'sleep 20' -c 'qa'

    # Create vim symlink
    ln -sf {{ dotfiles_dir }}/vim ~/.vim
    echo "✅ Neovim configuration installed"

# Install Vim configuration
install-vim:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🚀 Installing Vim configuration..."

    # Add source line to .vimrc if not already present
    if ! grep -q "source.*{{ dotfiles_dir }}/vim/vimrc" ~/.vimrc 2>/dev/null; then
        echo "source {{ dotfiles_dir }}/vim/vimrc" >> ~/.vimrc
    fi

    # Install vim plugins
    vim +PlugInstall +qa
    echo "✅ Vim configuration installed"

# Install IdeaVim configuration
install-ideavim:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🚀 Installing IdeaVim configuration..."
    ln -sf {{ dotfiles_dir }}/ideavimrc ~/.ideavimrc
    echo "✅ IdeaVim configuration installed"

# Install terminal configurations (Alacritty, Ghostty)
install-terminals:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🚀 Installing terminal configurations..."

    mkdir -p ~/.config

    # Install terminal configs if they exist
    [ -d {{ dotfiles_dir }}/alacritty ] && ln -sf {{ dotfiles_dir }}/alacritty ~/.config/alacritty
    [ -d {{ dotfiles_dir }}/ghostty ] && ln -sf {{ dotfiles_dir }}/ghostty ~/.config/ghostty

    echo "✅ Terminal configurations installed"

# Install Pi shared configuration
install-pi:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🚀 Linking Pi shared configuration..."

    mkdir -p ~/.pi ~/.pi/agent ~/.pi/agent/extensions

    # prune dangling symlinks (extensions removed from the repo)
    find ~/.pi/agent/extensions -maxdepth 1 -xtype l -delete 2>/dev/null || true

    if [ ! -f ~/.pi/agent/settings.json ]; then
        cp {{ dotfiles_dir }}/pi/agent/settings.json ~/.pi/agent/settings.json
        echo "  📋 Created local copy of settings.json (you can edit it freely)"
    else
        echo "  ⏭️  settings.json already exists, skipping (preserve local copy)"
    fi
    ln -sf {{ dotfiles_dir }}/pi/agent/keybindings.json ~/.pi/agent/keybindings.json
    ln -sf {{ dotfiles_dir }}/pi/agent/APPEND_SYSTEM.md ~/.pi/agent/APPEND_SYSTEM.md
    ln -sf {{ dotfiles_dir }}/pi/mcp.json ~/.pi/agent/mcp.json

    rm -rf ~/.pi/agent/extensions/track
    ln -s {{ dotfiles_dir }}/pi/agent/extensions/track ~/.pi/agent/extensions/track
    rm -rf ~/.pi/agent/extensions/compaction
    ln -s {{ dotfiles_dir }}/pi/agent/extensions/compaction ~/.pi/agent/extensions/compaction
    rm -rf ~/.pi/agent/extensions/workflow-runtime
    ln -s {{ dotfiles_dir }}/pi/agent/extensions/workflow-runtime ~/.pi/agent/extensions/workflow-runtime
    rm -rf ~/.pi/agent/extensions/code-mode ~/.pi/agent/extensions/readonly-mode

    # xfer moved to its own repo (github.com/azzgo/pi-xfer)
    # pi-xfer installed via pi's package manager (no local source clone needed)
    if ! pi install npm:pi-xfer; then
        echo "⚠️  pi install npm:pi-xfer failed"
    fi
    rm -rf ~/.pi/agent/extensions/sub-dispatch
    ln -s {{ dotfiles_dir }}/pi/agent/extensions/sub-dispatch ~/.pi/agent/extensions/sub-dispatch
    rm -rf ~/.pi/agent/extensions/command-palette
    ln -s {{ dotfiles_dir }}/pi/agent/extensions/command-palette ~/.pi/agent/extensions/command-palette
    rm -rf ~/.pi/agent/extensions/project-skills
    ln -s {{ dotfiles_dir }}/pi/agent/extensions/project-skills ~/.pi/agent/extensions/project-skills

    rm -rf ~/.pi/agent/prompts
    ln -s {{ dotfiles_dir }}/pi/agent/prompts ~/.pi/agent/prompts

    rm -rf ~/.pi/agent/patterns
    ln -s {{ dotfiles_dir }}/pi/agent/patterns ~/.pi/agent/patterns

    echo "⚠️  Keep local only: ~/.pi/agent/models.json ~/.pi/agent/auth.json ~/.pi/agent/settings.json"
    echo "✅ Pi shared configuration linked"

# Install shell configurations (bash, zsh, tmux, starship)
install-shell:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🚀 Installing shell configurations..."

    # Add shell sources if not already present
    if ! grep -q "source.*{{ dotfiles_dir }}/shell/bashrc" ~/.bashrc 2>/dev/null; then
        echo "source {{ dotfiles_dir }}/shell/bashrc" >> ~/.bashrc
    fi

    if ! grep -q "source.*{{ dotfiles_dir }}/shell/zshrc" ~/.zshrc 2>/dev/null; then
        echo "source {{ dotfiles_dir }}/shell/zshrc" >> ~/.zshrc
    fi

    # Create symlinks
    ln -sf {{ dotfiles_dir }}/tmux.conf ~/.tmux.conf
    mkdir -p ~/.config
    ln -sf {{ dotfiles_dir }}/starship.toml ~/.config/starship.toml
    echo "✅ Shell configurations installed"

# Install herdr configuration
install-herdr:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🚀 Installing herdr configuration..."

    mkdir -p ~/.config/herdr
    ln -sf {{ dotfiles_dir }}/herdr/config.toml ~/.config/herdr/config.toml
    echo "✅ herdr configuration linked (logs/session state stays local)"
# Install mise (dev tool version manager) configuration
# Link config.toml and install all declared tools
install-mise:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🚀 Linking mise configuration..."

    mkdir -p ~/.config/mise
    ln -sf {{ dotfiles_dir }}/mise/config.toml ~/.config/mise/config.toml

    echo "📦 Installing tools via mise (this may take a while)..."
    mise install

    echo "✅ mise configuration linked and tools installed"

# Alias for install-pi (link Pi shared config)
link: install-pi

# Install the PiG (pi-in-go) second configuration: own config root, own agent dir
pig_version := "0.5.3"

# Install PiG binary + a separate ~/.pig configuration (not shared with pi)
install-pig:
    #!/usr/bin/env bash
    set -euo pipefail
    version="{{ pig_version }}"
    pig_home="${PIG_HOME:-$HOME/.pig}"
    echo "🐷 Installing PiG ${version} (config root: ${pig_home})..."

    case "$(uname -s)-$(uname -m)" in
      Linux-x86_64) asset="linux-amd64" ;;
      Linux-aarch64|Linux-arm64) asset="linux-arm64" ;;
      Darwin-x86_64) asset="darwin-amd64" ;;
      Darwin-arm64) asset="darwin-arm64" ;;
      *) echo "❌ Unsupported platform: $(uname -s)-$(uname -m)"; exit 1 ;;
    esac

    bin_dir="$HOME/.local/bin"
    mkdir -p "$bin_dir"
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    url="https://github.com/MichaelKinsy/PiG/releases/download/v${version}/pig-${version}-${asset}.tar.gz"
    curl -fsSL "$url" -o "$tmp/pig-${version}-${asset}.tar.gz"
    curl -fsSL "https://github.com/MichaelKinsy/PiG/releases/download/v${version}/EVIDENCE-SHA256SUMS" -o "$tmp/SHA256SUMS"
    (cd "$tmp" && grep " pig-${version}-${asset}.tar.gz\$" SHA256SUMS | sha256sum -c -)
    tar xzf "$tmp/pig-${version}-${asset}.tar.gz" -C "$tmp"
    install -m 0755 "$tmp/pig-${version}-${asset}/pig" "$bin_dir/pig"
    echo "  ✅ $(pig --version)"

    agent_dir="$pig_home/agent"
    mkdir -p "$agent_dir"
    for f in models.json auth.json; do
      if [ ! -f "$agent_dir/$f" ] && [ -f "$HOME/.pi/agent/$f" ]; then
        cp "$HOME/.pi/agent/$f" "$agent_dir/$f"
        echo "  📋 Copied $f into ${agent_dir}"
      fi
    done
    if [ ! -f "$agent_dir/settings.json" ]; then
      printf '%s\n' \
        '{' \
        '  "defaultProvider": "magpie",' \
        '  "defaultModel": "nas/deepseek/deepseek-flash",' \
        '  "defaultThinkingLevel": "off",' \
        '  "theme": "dark",' \
        '  "compaction": { "enabled": true }' \
        '}' > "$agent_dir/settings.json"
      echo "  📋 Created ${agent_dir}/settings.json"
    fi
    ln -sf "{{ dotfiles_dir }}/pi/agent/keybindings.json" "$agent_dir/keybindings.json"
    ln -sf "{{ dotfiles_dir }}/pi/agent/APPEND_SYSTEM.md" "$agent_dir/APPEND_SYSTEM.md"
    ln -sf "{{ dotfiles_dir }}/pi/mcp.json" "$agent_dir/mcp.json"
    rm -rf "$agent_dir/prompts"
    ln -s "{{ dotfiles_dir }}/pi/agent/prompts" "$agent_dir/prompts"
    echo "  🔗 Linked keybindings.json, APPEND_SYSTEM.md, mcp.json, prompts/ into ${agent_dir}"

    pig install npm:pi-xfer
    pig install npm:pi-hashline-edit-pro
    pig install "{{ dotfiles_dir }}/pi/agent/extensions/sub-dispatch"
    pig install "{{ dotfiles_dir }}/pi/agent/extensions/project-skills"
    pig install "{{ dotfiles_dir }}/pi/agent/extensions/track"
    pig install "{{ dotfiles_dir }}/pi/agent/extensions/compaction"
    pig install "{{ dotfiles_dir }}/pi/agent/extensions/command-palette"

    echo "⚠️  Keep local only: ${agent_dir}/models.json ${agent_dir}/auth.json ${agent_dir}/settings.json"
    echo "✅ PiG configuration ready: pig (config root ${pig_home}, project dir .pig)"
# Install generic skills (skills/) globally into ~/.agents/skills
install-skills:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🔗 Linking generic skills into ~/.agents/skills..."
    mkdir -p ~/.agents/skills
    for dir in {{ dotfiles_dir }}/skills/*/; do
        name="$(basename "$dir")"
        ln -sfn "$dir" ~/.agents/skills/"$name"
        echo "  🔗 ~/.agents/skills/$name -> $dir"
    done
    echo "✅ Generic skills installed (pi sees them via ~/.agents/skills search path)."

# Wire the secret-scan pre-commit hook (core.hooksPath=.githooks)
install-git-hooks:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🪝 Wiring git hooks..."
    git -C {{ dotfiles_dir }} config core.hooksPath .githooks
    chmod +x {{ dotfiles_dir }}/.githooks/pre-commit
    echo "  ✅ core.hooksPath=.githooks"

# Secret scan: calibration, working tree, and staged index
secret-scan:
    #!/usr/bin/env bash
    set -euo pipefail
    scan="{{ dotfiles_dir }}/pi/agent/skills/secret-scan/scripts/scan.sh"
    echo "🔍 Calibrating the rules against the fixture..."
    "{{ dotfiles_dir }}/scripts/secret-scan-calibrate.sh"
    echo "🔍 Scanning the working tree..."
    "$scan" dir "{{ dotfiles_dir }}"
    echo "🔍 Scanning the index..."
    "$scan" staged
    echo "✅ Secret scan clean"

# Secret scan of the full history — the release-boundary check
secret-scan-history:
    #!/usr/bin/env bash
    set -euo pipefail
    scan="{{ dotfiles_dir }}/pi/agent/skills/secret-scan/scripts/scan.sh"
    echo "🔍 Scanning the full history..."
    "$scan" history "--all"
    echo "✅ History clean"

# Install the nightshift CLI wrappers into ~/.local/bin (no scheduler is created)
# Nightshift is a queue, not a daemon: this only puts `nightshift` and
# `nightshift-keep-awake` on PATH. Point your own scheduler (systemd timer,
# launchd, cron, tmux) at them; nothing here installs or manages timers.
install-nightshift:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🌙 Installing nightshift wrappers into ~/.local/bin..."
    mkdir -p ~/.local/bin
    for script in nightshift nightshift-keep-awake; do
        src="{{ dotfiles_dir }}/skills/nightshift/scripts/$script"
        dst=~/.local/bin/$script
        chmod +x "$src"
        ln -sfn "$src" "$dst"
        echo "  🔗 $dst -> $src"
    done
    echo "✅ nightshift installed. Resolve the CLI with 'just install-skills' (links ~/.agents/skills/nightshift)."
    echo "   Try: nightshift path && nightshift list"
    echo "   Nightly: point your own scheduler at 'nightshift-keep-awake --until 07:00'."

# Install all configurations
install-all: install-mise install-neovim install-vim install-shell install-terminals install-herdr install-skills install-nightshift
    echo "🎉 All configurations installed!"

# Development helpers

# Run the track extension's test suite
# Pass vitest args directly, e.g. `just test-track guards.test.ts`
# Track is pure — no Pi runtime needed, nothing skips.
test-track *args:
    #!/usr/bin/env bash
    set -euo pipefail
    cd {{ dotfiles_dir }}/pi/agent/extensions/track
    if [ ! -d node_modules ]; then
        echo "📦 Installing track extension dev dependencies..."
        npm install --silent
    fi
    npm test -- {{ args }}

# Run the compaction extension's test suite
# Requires the Pi runtime for the model-call integration test; see
# pi/agent/extensions/compaction/README.md to link it (it skips otherwise).
test-compaction *args:
    #!/usr/bin/env bash
    set -euo pipefail
    cd {{ dotfiles_dir }}/pi/agent/extensions/compaction
    if [ ! -d node_modules ]; then
        echo "📦 Installing compaction extension dev dependencies..."
        npm install --silent
    fi
    npm test -- {{ args }}

# Run the nightshift CLI test suite (zero model calls, no network)
test-nightshift *args:
    #!/usr/bin/env bash
    set -euo pipefail
    cd {{ dotfiles_dir }}/skills/nightshift/cli
    node --test {{ if args == "" { "test/" } else { args } }}

# Check Neovim health
nvim-health:
    nvim --headless -c 'checkhealth' -c 'qa'

# Update Neovim plugins
nvim-update:
    nvim --headless -c 'Lazy sync' -c 'qa'

# Install LeaderF C extension
nvim-leaderf:
    nvim -c 'LeaderfInstallCExtension' -c 'qa'

# Clean temporary files
clean:
    rm -rf {{ temp_dir }}
    rm -f {{ dotfiles_dir }}/dotfiles.linux64.tar.gz
    echo "🧹 Cleaned temporary files"

# Show system information
info:
    #!/usr/bin/env bash
    echo "📁 Dotfiles directory: {{ dotfiles_dir }}"
    echo "🖥️  Platform: {{ os() }}"
    echo "🏠 Home directory: $HOME"
    echo ""
    echo "📋 Available configurations:"
    [ -d {{ dotfiles_dir }}/nvim ] && echo "  ✓ Neovim"
    [ -d {{ dotfiles_dir }}/vim ] && echo "  ✓ Vim" 
    [ -f {{ dotfiles_dir }}/ideavimrc ] && echo "  ✓ IdeaVim"
    [ -d {{ dotfiles_dir }}/shell ] && echo "  ✓ Shell configs"
    [ -d {{ dotfiles_dir }}/alacritty ] && echo "  ✓ Alacritty"
    [ -d {{ dotfiles_dir }}/ghostty ] && echo "  ✓ Ghostty"
    [ -d {{ dotfiles_dir }}/herdr ] && echo "  ✓ herdr"
    [ -d {{ dotfiles_dir }}/mise ] && echo "  ✓ mise"
