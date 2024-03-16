(use-package markdown-mode)
(use-package gptel
:config (progn
 (setq-default
  gptel-model "gpt-3.5-turbo"
  gptel-backend (gptel-make-openai
    "opeai-sb"
    :host "api.openai-sb.com"
    :stream t
    :models '("gpt-3.5-turbo" "gpt-4")
  ))
))

(provide 'init-ai)
