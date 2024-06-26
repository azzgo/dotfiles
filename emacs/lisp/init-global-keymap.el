;; 快速打开配置文件
(defun open-init-file()
  (interactive)
  (find-file "~/.emacs.d/init.el"))

(defun insert-pure-date ()
  "Insert a timestamp without <>."
  (interactive)
  (let* ((selected-date (org-read-date nil 't))
         (formatted-time (format-time-string "%Y-%m-%d %a" selected-date)))
    (insert formatted-time)))

;; macos 特定
(when (eq system-type 'darwin) ;; mac specific settings
  (setq mac-option-modifier 'meta)
  (setq mac-command-modifier 'super)
  (global-set-key [kp-delete] 'delete-char) ;; sets fn-delete to be right-delete
  )


;; 这一行代码，将函数 open-init-file 绑定到 <f2> 键上
(global-set-key (kbd "<f2>") 'open-init-file)
(global-set-key (kbd "s-s") 'save-buffer)
(global-set-key (kbd "C-c n f") 'dired)
(global-set-key (kbd "C-c o t") 'org-todo-list)
(global-set-key (kbd "C-c o c") 'org-capture)

;; bracket binding
(defun insert-quotations (&optional arg)
  (interactive "*P")
  (insert-pair arg ?\' ?\'))

(defun insert-quotes (&optional arg)
  (interactive "*P")
  (insert-pair arg ?\" ?\"))

(defun insert-bracket (&optional arg)
  (interactive "*P")
  (insert-pair arg ?\[ ?\]))

(defun insert-curly (&optional arg)
  (interactive "*P")
  (insert-pair arg ?\{ ?\}))

(global-set-key (kbd "C-c C-.") 'insert-pure-date)
(global-set-key (kbd "M-o") 'other-window)

(provide 'init-global-keymap)
