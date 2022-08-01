local ok, jdtls = pcall(require, "jdtls")

if not ok then
	return
end

local user_cmp = require("users.cmp")
local user_util = require("users.util")

local workspace_folder_name = vim.fn.fnamemodify(root_dir, ":p:h:t")

local config = {
	cmd = { "java-lsp", workspace_folder_name },
  on_attach = user_util.lsp_on_attach,
  capabilities = user_cmp.capabilities
}

jdtls.start_or_attach(config)
