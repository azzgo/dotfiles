(use-package evil
  :config (progn 
    (evil-mode 1)
    (evil-set-undo-system 'undo-redo)
    (evil-set-leader nil (kbd "SPC"))
    (evil-define-key 'normal 'global (kbd "<leader>w") 'save-buffer)
    (evil-define-key 'normal 'global (kbd "<leader>b") 'consult-buffer)
    (evil-define-key 'normal 'global (kbd "<leader>rf") 'org-roam-node-find)
    (evil-define-key 'normal 'global (kbd "<leader>nf") 'dired)
    (evil-define-key 'normal 'global (kbd "<leader>f") 'consult-find)
    (evil-define-key 'normal 'global (kbd "<leader>/") 'consult-ripgrep)
  )
)


(provide 'init-evil)
