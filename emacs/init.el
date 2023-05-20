(add-to-list 'load-path "~/.emacs.d/lisp/")


;; Package Management
;; -----------------------------------------------------------------
(require 'init-packages)


(require 'init-local)
(require 'init-ui)
(require 'init-custom)
(require 'init-lang)
(require 'init-global-keymap)
(require 'init-company)
(require 'init-meow)
;;(require 'init-evil)
(require 'init-org)

