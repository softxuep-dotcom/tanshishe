// vinext 1.0.0-beta.5 calls process.exit(0) immediately after prerendering.
// On Windows, native async handles need a turn to finish closing first.
// Preserve all failure exits; only defer an explicitly successful CLI exit.
if (process.platform === 'win32') {
  const exit = process.exit.bind(process);
  process.exit = (code) => {
    if (code === 0) { setTimeout(() => exit(process.exitCode || 0), 500); return; }
    exit(code);
  };
}
