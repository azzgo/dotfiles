local wezterm = require("wezterm")

return {
	color_scheme = "nord",
	font = wezterm.font_with_fallback({
		"Agave Nerd Font Mono",
		"Noto Color Emoji",
		"Material-Design-Iconic-Font",
		"Font Awesome 6 Free",
	}),
	font_size = 18,
	audible_bell = "Disabled",
	leader = { key = "i", mods = "SUPER", timeout_milliseconds = 1000 },
	disable_default_key_bindings = true,
	hide_tab_bar_if_only_one_tab = true,
	adjust_window_size_when_changing_font_size = false,
  warn_about_missing_glyphs = false,
	keys = {
		{ key = "[", mods = "LEADER", action = "ActivateCopyMode" },
		{ key = "=", mods = "CTRL", action = "DisableDefaultAssignment" },
		{ key = "-", mods = "CTRL", action = "DisableDefaultAssignment" },
		{ key = "/", mods = "CTRL", action = "DisableDefaultAssignment" },
		{ key = "Enter", mods = "ALT", action = "DisableDefaultAssignment" },
		{ key = "w", mods = "LEADER", action = wezterm.action({ CloseCurrentTab = { confirm = true } }) },
		{ key = "{", mods = "SHIFT|ALT", action = wezterm.action({ MoveTabRelative = -1 }) },
		{ key = "}", mods = "SHIFT|ALT", action = wezterm.action({ MoveTabRelative = 1 }) },
		-- defautl keys i needed
		{ key = "c", mods = "CTRL|SHIFT", action = wezterm.action({ CopyTo = "ClipboardAndPrimarySelection" }) },
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
