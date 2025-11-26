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

# Install Emacs configuration
install-emacs:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🚀 Installing Emacs configuration..."
    
    # Create emacs config directory
    mkdir -p ~/.emacs.d/lisp
    
    # Create symlinks
    ln -sf {{ dotfiles_dir }}/emacs/init.el ~/.emacs.d/init.el
    ln -sf {{ dotfiles_dir }}/emacs/lisp ~/.emacs.d/lisp
    
    # Create local config file if it doesn't exist
    if [ ! -f ~/.emacs.d/lisp/init-local.el ]; then
        echo "(provide 'init-local)" > ~/.emacs.d/lisp/init-local.el
    fi
    echo "✅ Emacs configuration installed"

# Install terminal configurations (Alacritty, Kitty, Ghostty)
install-terminals:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🚀 Installing terminal configurations..."
    
    mkdir -p ~/.config
    
    # Install terminal configs if they exist
    [ -d {{ dotfiles_dir }}/alacritty ] && ln -sf {{ dotfiles_dir }}/alacritty ~/.config/alacritty
    [ -d {{ dotfiles_dir }}/kitty ] && ln -sf {{ dotfiles_dir }}/kitty ~/.config/kitty  
    [ -d {{ dotfiles_dir }}/ghostty ] && ln -sf {{ dotfiles_dir }}/ghostty ~/.config/ghostty
    
    echo "✅ Terminal configurations installed"

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

# Install all configurations
install-all: install-neovim install-vim install-shell install-terminals
    echo "🎉 All configurations installed!"

# Development helpers

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
    [ -d {{ dotfiles_dir }}/emacs ] && echo "  ✓ Emacs"
    [ -d {{ dotfiles_dir }}/shell ] && echo "  ✓ Shell configs"
    [ -d {{ dotfiles_dir }}/alacritty ] && echo "  ✓ Alacritty"
    [ -d {{ dotfiles_dir }}/kitty ] && echo "  ✓ Kitty"
    [ -d {{ dotfiles_dir }}/ghostty ] && echo "  ✓ Ghostty"