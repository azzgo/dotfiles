;; 关闭工具栏，tool-bar-mode 即为一个 Minor Mode
(tool-bar-mode -1)
(menu-bar-mode -1)

;; 关闭文件滑动控件
(scroll-bar-mode -1)

;; 关闭默认的自动缩进
(electric-indent-mode -1)

;; 默认字体颜色
(custom-set-faces
 ;; custom-set-faces was added by Custom.
 ;; If you edit it by hand, you could mess it up, so be careful.
 ;; Your init file should contain only one such instance.
 ;; If there is more than one, they won't work right.
 '(default ((t (:family "文泉驿等宽微米黑" :foundry "WQYF" :slant normal :weight normal :height 181 :width normal)))))

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
