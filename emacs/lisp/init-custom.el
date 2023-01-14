;; 关闭备份文件
(setq make-backup-files nil)

;; 关闭启动页面
(setq inhibit-startup-screen t)

;; 关闭自动保存
(setq auto-save-default nil)

;; 自动加载文件修改
(global-auto-revert-mode 1)

;; no bell
(setq ring-bell-function 'ignore)

;; set cursor type
(setq-default cursor-type 'bar)

;; fido mode good for me
(fido-vertical-mode t)

;; shell-mode
(autoload 'ansi-color-for-comint-mode-on "ansi-color" nil t)
(add-hook 'shell-mode-hook 'ansi-color-for-comint-mode-on t)

;; follow link not ask
(setq vc-follow-symlinks t)

(provide 'init-custom)
