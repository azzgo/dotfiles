;;  扩展 TODO 的 keyword
(setq org-todo-keywords '((type "TODO" "WAIT" "DOING" "|" "DONE" "CANCEL" "CONTINUE")))

;; 开启 toggle todo 自动加上完成时间
(setq org-log-done 'time)

;; 默认 org mode 的 折叠层数
(setq org-startup-folded 'show2levels)
(setq org-return-follows-link  t)
(setq org-image-actual-width nil)
;; org-babel
(org-babel-do-load-languages
 'org-babel-load-languages '((perl . t)))
(setq org-confirm-babel-evaluate nil)

(provide 'init-org)
