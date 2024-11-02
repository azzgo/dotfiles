;;  扩展 TODO 的 keyword
(setq org-todo-keywords '((type "TODO" "WAIT" "DOING" "|" "DONE" "CANCELED" "HOLD")))

;; 开启 toggle todo 自动加上完成时间
(setq org-log-done 'time)

;; 默认 org mode 的 折叠层数
(setq org-startup-folded t)
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
  :after org
  :init (progn
     (setq org-download-display-inline-images nil)
     (setq org-download-image-dir "./images")
     (setq org-download-image-org-width 600)
  )
)

(use-package d2-mode
  :after org
  :init (setenv "PATH" (concat (getenv "PATH") ":" (getenv "HOME") "/.local/bin"))
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


;; default org capture
(setq org-default-notes-file (concat org-directory "/notes.org"))

(defun my/org-file-by-date ()
  "Create an Org file with current time as name."
  (find-file (concat org-directory (format-time-string "/meeting-minutes/%Y-%m-%d--%H-%M-%S.org"))))

(defun my/ai-chat-file-by-date ()
  "Create an Org file with current time as name."
  (find-file (concat org-directory (format-time-string "/ai-chats/%Y-%m-%d--%H-%M-%S.md"))))

(setq org-capture-templates
      '(("t" "Todo" entry (file+headline "gtd.org" "Tasks")
         "* TODO %?\n  %i\n")
        ("c" "Capture" entry (file+headline "capture.org" "Short Idea")
         "* %U\n%?")
	("m" "Meeting Minutes" plain (function my/org-file-by-date)
	 "")
	("q" "Quick Note" plain (file "quick-note.org") "")
        ("a" "AI Chat Note" plain (function my/ai-chat-file-by-date) "")
       ))

(provide 'init-org)
