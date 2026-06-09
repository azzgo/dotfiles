/**
 * Bash command safety checker for read-only mode.
 *
 * Determines whether a bash command is safe (non-mutating) and can be
 * allowed in read-only mode.
 */

/**
 * Check if a bash command is safe for read-only mode.
 *
 * Strategy:
 * 1. Block any command that contains pipes to destructive commands.
 * 2. Block any command that contains output redirects (>, >>).
 * 3. Whitelist known safe commands by their leading keyword.
 * 4. Block everything else as a safety net.
 */
export function isSafeCommand(command: string): boolean {
  const trimmed = command.trim();

  if (!trimmed) return false;

  // Block output redirects (except 2>/dev/null stderr silence)
  if (hasRedirectionExceptStderrNull(trimmed)) return false;

  // Block pipes into destructive commands
  if (hasPipeToDestructive(trimmed)) return false;

  // Extract the primary command (first word, ignoring leading env vars)
  const primary = extractPrimaryCommand(trimmed);
  if (!primary) return false;

  return SAFE_COMMANDS.has(primary) || isSafeCommandPattern(primary, trimmed);
}

/**
 * Known safe commands — read-only, no side effects.
 */
const SAFE_COMMANDS = new Set([
  // File reading
  'cat', 'dog', 'bat', 'head', 'tail', 'less', 'more', 'nl', 'od', 'xxd',
  'hexdump', 'strings', 'file', 'stat', 'wc', 'fold', 'cut',
  // Directory listing
  'ls', 'dir', 'tree', 'du', 'df',
  // Searching
  'grep', 'egrep', 'fgrep', 'rg', 'ripgrep', 'ag', 'pt', 'ack',
  'find', 'locate', 'mlocate', 'whereis', 'which', 'type',
  // System info
  'pwd', 'echo', 'printf', 'env', 'printenv', 'uname', 'arch', 'hostname',
  'whoami', 'id', 'groups', 'date', 'cal', 'uptime', 'time',
  // Sorting / processing (non-destructive)
  'sort', 'uniq', 'comm', 'diff', 'sdiff', 'cmp',
  // File metadata
  'basename', 'dirname', 'realpath', 'readlink',
  // Process info
  'ps', 'top', 'htop', 'lsof', 'jobs',
  // Network (read-only)
  'host', 'dig', 'nslookup', 'ping', 'traceroute', 'whois',
  // Git (read-only)
  'git',
  // Curl / HTTP (read-only if no output file)
  'curl', 'wget',
  // Package info
  'npm', 'pip', 'pip3', 'cargo', 'go',
  // Compression (reading only)
  'zcat', 'zless', 'zmore', 'zgrep', 'zdiff', 'bzcat', 'xzcat',
  // Xcode / dev (read-only)
  'xcrun', 'xcodebuild', 'swift',
  // tldr / man
  'tldr', 'man', 'help', 'info', 'whatis', 'apropos',
  // JQ / JSON processing
  'jq', 'yq',
  // Tmux
  'tmux',
  // Pipelines and subshells
  'source', '.',
]);

/**
 * Check if a command follows a safe pattern even if the primary command
 * isn't in the strict whitelist.
 */
function isSafeCommandPattern(command: string, fullCommand: string): boolean {
  // Allow variable assignments and exports
  if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(command)) return true;
  if (/^export\s+[A-Za-z_][A-Za-z0-9_]*=/.test(command)) return true;

  // Allow `command -v` to check tool availability
  if (/^command\s+-v\s+/.test(command)) return true;

  // Allow `test` and `[` conditions
  if (/^test\s+/.test(command)) return true;
  if (/^\[\[?\s+/.test(command)) return true;

  return false;
}

/**
 * Check if the command contains output redirects beyond 2>/dev/null.
 */
function hasRedirectionExceptStderrNull(command: string): boolean {
  // Strip all stderr redirects to /dev/null first
  const cleaned = command.replaceAll(/2>\s*\/dev\/null\s*/g, '');

  // Check for remaining redirects
  if (/ >[>|]?(\s|\||$)/.test(cleaned)) return true;
  if (/ >>[>|]?(\s|\||$)/.test(cleaned)) return true;
  if (/>\s*[^\s]/.test(cleaned) && !/\/dev\/null/.test(cleaned)) return true;

  return false;
}

/**
 * Check if a pipe leads to a destructive command.
 * Simple heuristic: after the last `|`, check the first command word.
 */
function hasPipeToDestructive(command: string): boolean {
  const pipes = command.split('|');
  for (const segment of pipes) {
    const cmd = extractPrimaryCommand(segment.trim());
    if (cmd && DESTRUCTIVE_COMMANDS.has(cmd)) return true;
  }
  return false;
}

/**
 * Commands that are never safe in read-only mode.
 */
const DESTRUCTIVE_COMMANDS = new Set([
  'rm', 'mv', 'cp', 'mkdir', 'rmdir', 'touch', 'chmod', 'chown', 'ln',
  'dd', 'truncate', 'fallocate',
  'sed', 'awk', 'ed', 'ex', 'vi', 'vim', 'nvim', 'nano', 'emacs',
  'tee', 'install',
  'su', 'sudo', 'chsh', 'passwd',
  'kill', 'killall', 'pkill',
  'mount', 'umount',
  'mkfs', 'fdisk', 'parted',
  'apt', 'apt-get', 'apt-cache', 'dpkg', 'brew', 'port',
  'yum', 'dnf', 'rpm', 'pacman',
  'pip', 'pip3', 'npm', 'cargo', 'go',
  'git', // destructive git commands checked separately
  'docker', 'podman',
  'ssh', 'scp', 'rsync',
  'crontab', 'at',
  'sysctl', 'launchctl',
  'mesg', 'write', 'wall',
  'make', 'cmake', 'ninja',
  'sqlite3', 'mysql', 'psql',
  'ruby', 'python', 'python3', 'node', 'deno', 'bun',
  'php', 'perl', 'R',
]);

/**
 * Extract the primary command from a bash statement.
 */
function extractPrimaryCommand(command: string): string | undefined {
  // Strip leading variable assignments
  let cleaned = command.trim();
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(cleaned)) {
    const eqIndex = cleaned.indexOf('=');
    cleaned = cleaned.slice(eqIndex + 1).trim();
    // If value is quoted, strip past the closing quote
    if (cleaned.startsWith("'")) {
      const end = cleaned.indexOf("'", 1);
      if (end === -1) return undefined;
      cleaned = cleaned.slice(end + 1).trim();
    } else if (cleaned.startsWith('"')) {
      const end = cleaned.indexOf('"', 1);
      if (end === -1) return undefined;
      cleaned = cleaned.slice(end + 1).trim();
    } else {
      // Unquoted value - strip to next space
      const spaceIndex = cleaned.indexOf(' ');
      if (spaceIndex === -1) return undefined;
      cleaned = cleaned.slice(spaceIndex + 1).trim();
    }
  }

  // Strip leading time, timeout, nice, etc.
  const prefixPattern = /^(time|timeout|nice|nohup|stdbuf|env)\s+/;
  cleaned = cleaned.replace(prefixPattern, '').trim();

  // Also strip export prefix for export FOO=bar
  cleaned = cleaned.replace(/^export\s+/, '').trim();

  // Take the first word
  const firstWord = cleaned.split(/\s+/)[0];
  if (!firstWord) return undefined;

  // Strip path prefix
  return firstWord.replace(/^.*\//, '');
}
