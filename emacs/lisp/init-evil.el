(use-package evil
  :config (progn 
    (evil-mode 1)
    (evil-set-undo-system 'undo-redo)
    (evil-set-leader nil (kbd "SPC"))
    (evil-define-key 'normal 'global (kbd "<leader>w") 'save-buffer)
    (evil-define-key 'normal 'global (kbd "<leader>b") 'switch-to-buffer)
    (evil-define-key 'normal 'global (kbd "<leader>r") 'org-roam-node-find)
    (evil-define-key 'normal 'global (kbd "<leader>t") 'org-todo-list)
    (evil-define-key 'normal 'global (kbd "<leader>c") 'org-capture)
    (evil-define-key 'normal 'global (kbd "<leader>nf") 'dired)
    (evil-define-key 'normal 'global (kbd "<leader>f") 'consult-find)
    (evil-define-key 'normal 'global (kbd "<leader>/") 'consult-ripgrep)
    (with-eval-after-load 'evil-maps
      (define-key evil-insert-state-map (kbd "C-a") 'move-beginning-of-line)
      (define-key evil-insert-state-map (kbd "C-e") 'move-end-of-line)
    )
  )
)


(provide 'init-evil)
