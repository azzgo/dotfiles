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

(require 'init-ui)
(require 'init-custom)
(require 'init-lang)
(require 'init-global-keymap)
(require 'init-org)
(require 'init-company)
(require 'init-meow)
(require 'init-local)

(custom-set-variables
 ;; custom-set-variables was added by Custom.
 ;; If you edit it by hand, you could mess it up, so be careful.
 ;; Your init file should contain only one such instance.
 ;; If there is more than one, they won't work right.
 '(package-selected-packages
   '(zenburn-theme plantuml-mode org-download ob-clojure cider clojure-mode use-package typescript-mode todotxt org-roam org-modern meow markdown-mode gruvbox-theme doom-modeline company cnfonts))
 '(warning-suppress-log-types '(((org-roam)) ((org-roam))))
 '(warning-suppress-types '(((org-roam)))))
(custom-set-faces
 ;; custom-set-faces was added by Custom.
 ;; If you edit it by hand, you could mess it up, so be careful.
 ;; Your init file should contain only one such instance.
 ;; If there is more than one, they won't work right.
 '(default ((t (:family "文泉驿等宽微米黑" :foundry "WQYF" :slant normal :weight normal :height 181 :width normal)))))
