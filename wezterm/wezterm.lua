local wezterm = require("wezterm")

return {
  check_for_updates = false,
	color_scheme = "Catppuccin Macchiato",
	font = wezterm.font_with_fallback({
		"Hack Nerd Font Mono",
		"Noto Color Emoji",
    "WenQuanYi Micro Hei"
	}),
	font_size = 18,
	audible_bell = "Disabled",
	leader = { key = "i", mods = "SUPER", timeout_milliseconds = 1000 },
	disable_default_key_bindings = true,
	hide_tab_bar_if_only_one_tab = true,
	adjust_window_size_when_changing_font_size = false,
  warn_about_missing_glyphs = false,
  window_padding = {
    left = 0,
    right = 0,
    top = 0,
    bottom = 0,
  },
	keys = {
		{ key = "[", mods = "LEADER", action = "ActivateCopyMode" },
		{ key = "=", mods = "CTRL", action = "DisableDefaultAssignment" },
		{ key = "-", mods = "CTRL", action = "DisableDefaultAssignment" },
		{ key = "/", mods = "CTRL", action = "DisableDefaultAssignment" },
		{ key = "Enter", mods = "ALT", action = "DisableDefaultAssignment" },
		{ key = "w", mods = "LEADER", action = wezterm.action({ CloseCurrentTab = { confirm = true } }) },
		{ key = "{", mods = "SHIFT|ALT", action = wezterm.action({ MoveTabRelative = -1 }) },
		{ key = "}", mods = "SHIFT|ALT", action = wezterm.action({ MoveTabRelative = 1 }) },
    -- fix macos CTRL-Q needs to be pressed twice to register in macOS #2630
    { mods = "CTRL", key = "q", action = wezterm.action({ SendString="\x11" }) },
		-- default keys i needed
		{ key = "c", mods = "CTRL|SHIFT", action = wezterm.action({ CopyTo = "ClipboardAndPrimarySelection" }) },
		{ key = "v", mods = "CTRL|SHIFT", action = wezterm.action.PasteFrom 'PrimarySelection'  },
		{ key = "t", mods = "SUPER", action = wezterm.action({ SpawnTab = "DefaultDomain" }) },
		{ key = "+", mods = "SHIFT|CTRL", action = "IncreaseFontSize" },
		{ key = "_", mods = "SHIFT|CTRL", action = "DecreaseFontSize" },
		{ key = "{", mods = "SUPER|SHIFT", action = wezterm.action({ ActivateTabRelative = -1 }) },
		{ key = "}", mods = "SUPER|SHIFT", action = wezterm.action({ ActivateTabRelative = 1 }) },
		{ key = "Tab", mods = "CTRL", action = wezterm.action({ ActivateTabRelative = -1 }) },
		{
			key = "%",
			mods = "CTRL|SHIFT|ALT",
			action = wezterm.action({ SplitHorizontal = { domain = "CurrentPaneDomain" } }),
		},
	},
}
