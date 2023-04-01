(add-to-list 'load-path "~/.emacs.d/lisp/")


;; Package Management
;; -----------------------------------------------------------------
(require 'init-packages)

(unless (package-installed-p 'use-package)
  (package-refresh-contents)
  (package-install 'use-package))

;; load use-package
(eval-when-compile
  ;; Following line is not needed if use-package.el is in ~/.emacs.d
  (require 'use-package))

(setq use-package-always-ensure t)

(require 'init-local)
(require 'init-ui)
(require 'init-custom)
(require 'init-lang)
(require 'init-global-keymap)
(require 'init-company)
(require 'init-meow)
(require 'init-org)

