(use-package gptel
:config (progn
 (setq-default
  gptel-model "gpt-3.5-turbo"
  gptel-backend (gptel-make-openai
    "opeai-sb"
    :host "api.openai-sb.com"
    :stream t
    :key #'gptel-api-key
    :models '("gpt-3.5-turbo" "gpt-4")
  ))
))

(gptel-make-openai
  "kimi"
  :host "api.moonshot.cn"
  :stream t
  :key #'gptel-api-key
  :models '("moonshot-v1-8k" "moonshot-v1-32k" "moonshot-v1-128k")
)


(gptel-make-openai "OpenRouter"               ;Any name you want
  :host "openrouter.ai"
  :endpoint "/api/v1/chat/completions"
  :stream t
  :key #'gptel-api-key
  :models '("openai/gpt-3.5-turbo"
            "mistralai/mixtral-8x7b-instruct"
            "meta-llama/codellama-34b-instruct"
            "codellama/codellama-70b-instruct"
            "google/palm-2-codechat-bison-32k"
            "google/gemini-pro"))



(provide 'init-ai)
