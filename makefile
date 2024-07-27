pack:
	tar --exclude='.git' --exclude='dotfiles.tar.gz' -czvf dotfiles.tar.gz ./

install-neovim:
	# install neovim
	mkdir -p ~/.config/nvim
	echo "source $PWD/dotfiles/nvim/init.vim" >> ~/.config/nvim/init.vim
	nvim -c ":Lazy install"

install-vim:
	ln -sf $PWD/dotfiles/vim ~/.vim
	echo "source $PWD/dotfiles/vim/vimrc" >> ~/.vimrc
	vim -c ":PlugInstall"

install-ideavim:
	ln -sf $PWD/dotfils/ideavim ~/.ideavim

install-emacs:
	mkdir -p ~/.emacs.d
	ln -sf $ $PWD/dotfils/emacs/init.el ~/.emacs.d/init.el
	ln -sf $ $PWD/dotfils/emacs/lisp ~/.emacs.d/lisp
	## your customize local file
	echo "(provide 'init-local)" >> ~/.emacs/lisp/init-local

install-wezterm:
	mkdir -p ~/.config
	ln -sf $PWD/wezterm ~/.config/wezterm

install-shell:
	echo "source $PWD/shell/bashrc" >> ~/.bashrc
	echo "source $PWD/shell/zshrc" >> ~/.zshrc
	ln -sf $PWD/tmux.conf ~/.tmux.conf
	ln -sf $PWD/starship.toml ~/.config/starship.toml

