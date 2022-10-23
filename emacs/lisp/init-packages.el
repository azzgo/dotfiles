(setq package-archives '(("gnu"   . "http://mirrors.tuna.tsinghua.edu.cn/elpa/gnu/")
			 ("melpa" . "http://mirrors.tuna.tsinghua.edu.cn/elpa/melpa/")))
(package-initialize) ;; You might already have this line

;;防止反复调用 package-refresh-contents 会影响加载速度
(when (not package-archive-contents)
    (package-refresh-contents))

;; export 
(provide 'init-packages)
