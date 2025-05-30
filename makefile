pack-linux64:
	rm -rf temp_dotfiles
	mkdir temp_dotfiles
	rsync -av --exclude='nvim-linux-x86_64.tar.gz' --exclude='nvim-linux-x86_64' --exclude='temp_dotfiles' --exclude='.github' --exclude='.git' --exclude='dotfiles.tar.gz' . temp_dotfiles/
	tar -czvf dotfiles.linux64.tar.gz -C temp_dotfiles .

install-neovim:
	# install neovim
	mkdir -p ~/.config/nvim
	echo "source $$PWD/nvim/init.vim" >> ~/.config/nvim/init.vim
	nvim --headless -c 'Lazy install' -c 'qa'
	nvim --headless -c 'TSUpdateSync' -c 'sleep 20' -c 'qa'

	ln -sf $$PWD/vim ~/.vim
install-vim:
	echo "source $$PWD/vim/vimrc" >> ~/.vimrc
	vim -c ":PlugInstall" -c "qa"

install-ideavim:
	ln -sf $$PWD/dotfils/ideavim ~/.ideavim

install-emacs:
	mkdir -p ~/.emacs.d
	ln -sf $$PWD/dotfils/emacs/init.el ~/.emacs.d/init.el
	ln -sf $$PWD/dotfils/emacs/lisp ~/.emacs.d/lisp
	## your customize local file
	echo "(provide 'init-local)" >> ~/.emacs/lisp/init-local

install-wezterm:
	mkdir -p ~/.config
	ln -sf $$PWD/wezterm ~/.config/wezterm

install-shell:
	echo "source $$PWD/shell/bashrc" >> ~/.bashrc
	echo "source $$PWD/shell/zshrc" >> ~/.zshrc
	ln -sf $$PWD/tmux.conf ~/.tmux.conf
	ln -sf $$PWD/starship.toml ~/.config/starship.toml

