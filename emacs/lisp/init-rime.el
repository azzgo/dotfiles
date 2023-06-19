(set-locale-environment "zh_CN.UTF-8")
(set-language-environment "UTF-8")

(use-package posframe)
(use-package rime
  :custom
  (rime-librime-root "~/.emacs.d/librime")
  (default-input-method "rime")
  :config
  (setq rime-disable-predicates
	'(meow-normal-mode-p 
	  meow-motion-mode-p
          meow-keypad-mode-p
	  rime-predicate-punctuation-line-begin-p
	  rime-predicate-punctuation-after-ascii-p))
  (setq rime-posframe-properties
      (list :background-color "#333333"
            :foreground-color "#dcdccc"
            :internal-border-width 10))
  (setq rime-show-candidate 'posframe)
)

(provide 'init-rime)
