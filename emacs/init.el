(add-to-list 'load-path "~/.emacs.d/lisp/")


;; Package Management
;; -----------------------------------------------------------------
(require 'init-packages)

(let ((local-config "~/.emacs.d/lisp/init-local.el"))  
  (when (file-exists-p local-config)
    (load-file local-config)
    )
)
(require 'init-ui)
(require 'init-custom)
(require 'init-lang)
(require 'init-global-keymap)
(require 'init-company)
(require 'init-meow)
(require 'init-rime)
(require 'init-magit)
(require 'init-ai)
;;(require 'init-evil)
(require 'init-org)

