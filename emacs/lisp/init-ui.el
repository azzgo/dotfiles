;; 关闭工具栏，tool-bar-mode 即为一个 Minor Mode
(if (display-graphic-p)
  (progn
    (tool-bar-mode -2)
    (menu-bar-mode -2)
    
    ;; 关闭文件滑动控件
    (scroll-bar-mode -2)
    
    ;; 关闭默认的自动缩进
    (electric-indent-mode -2)
  )
)

(use-package doom-themes
  :config
  (setq doom-themes-enable-bold t    ; if nil, bold is universally disabled
        doom-themes-enable-italic t) ; if nil, italics is universally disabled
  (load-theme 'doom-one-light t)
)

(use-package doom-modeline
  :init (doom-modeline-mode 1)
  :config (progn
      (column-number-mode t)
      (size-indication-mode t)
  )
)


(use-package cnfonts
  :config
  (progn
    ;; 让 cnfonts 在 Emacs 启动时自动生效。
    (cnfonts-mode 1)
    ;; 添加两个字号增大缩小的快捷键
    (define-key cnfonts-mode-map (kbd "C--") #'cnfonts-decrease-fontsize)
    (define-key cnfonts-mode-map (kbd "C-=") #'cnfonts-increase-fontsize))
)




(provide 'init-ui)
