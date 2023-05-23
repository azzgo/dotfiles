(use-package magit
  :bind (
	 ("C-M-g" . 'magit-status)
	 ("C-M-f" . 'magit-dispatch)
	 )
  :config
  (progn 
	  (setq magit-pull-or-fetch t)
	  )
)

(provide 'init-magit)
