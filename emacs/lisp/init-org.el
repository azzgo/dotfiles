;;  扩展 TODO 的 keyword
(setq org-todo-keywords '((type "TODO" "WAIT" "DOING" "|" "DONE" "CANCEL" "CONTINUE")))

;; 开启 toggle todo 自动加上完成时间
(setq org-log-done 'time)

;; 默认 org mode 的 折叠层数
(setq org-startup-folded 'show2levels)
(setq org-return-follows-link  t)
(setq org-image-actual-width nil)
;; org-babel
(org-babel-do-load-languages
 'org-babel-load-languages '(
			    (perl . t)
			    (clojure . t))
)
(setq org-confirm-babel-evaluate nil)

;; org-download
(use-package org-download
  :after org)

(use-package d2-mode
  :after org
  :config (setenv "PATH" (concat (getenv "PATH") ":" (getenv "HOME") "/.local/bin"))
)

(use-package plantuml-mode
  :config (progn
     (setq plantuml-default-exec-mode 'jar)
     (add-to-list 'auto-mode-alist '("\\.puml\\'" . plantuml-mode))
   )
)

;; keymap for open bullet file
(defun open-bullet-notes()
  (interactive)
  (find-file (concat org-directory "/bullet.org")))

(global-set-key (kbd "<f3>") 'open-bullet-notes)

;; agenda files
(setq org-agenda-files
   '("bullet.org" "gtd.org"))

;; org-roam
(use-package org-roam
  :bind
  (
    ("C-c n i" . org-roam-node-insert)
    ("C-c n f" . org-roam-node-find)
  )
  :config
  (progn
    (setq org-roam-directory (file-truename (concat org-directory "/org-roam")))
    (org-roam-db-autosync-mode)
  )
)

(use-package org-roam-ui
    :after (org-roam)
;;         normally we'd recommend hooking orui after org-roam, but since org-roam does not have
;;         a hookable mode anymore, you're advised to pick something yourself
;;         if you don't care about startup time, use
;;  :hook (after-init . org-roam-ui-mode)
    :config
    (setq org-roam-ui-sync-theme t
          org-roam-ui-follow t
          org-roam-ui-update-on-save t
          org-roam-ui-open-on-start nil))

;; default capture
(setq org-default-notes-file (concat org-directory "/notes.org"))
(setq org-capture-templates
      '(("t" "Todo" entry (file+headline "gtd.org" "Tasks")
         "* TODO %?\n  %i\n")
        ("c" "Capture" entry (file+headline "capture.org" "Short Idea")
         "* %U\n%?")))

(provide 'init-org)
