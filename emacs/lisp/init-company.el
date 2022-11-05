(use-package company
  :config
  (progn
    ;; company settings
    (add-hook 'after-init-hook 'global-company-mode)
    (global-company-mode 1)

    (setq company-idle-delay
                (lambda () (if (company-in-string-or-comment) nil 0.3)))

    (setq company-backends '((company-capf :with company-files)))

    (defun add-pcomplete-to-capf ()
        (add-hook 'completion-at-point-functions 'pcomplete-completions-at-point nil t))

    (add-hook 'org-mode-hook #'add-pcomplete-to-capf)
  )
)



(provide 'init-company)
