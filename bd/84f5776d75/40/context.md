# Session Context

## User Prompts

### Prompt 1

Implement the following plan:

# Fix "Fix with AI" — Targeted Line-Number-Based LaTeX Fixing

## Context

The "Fix with AI" button doesn't actually work reliably. The root cause is that the fix-latex route sends the **entire section content** (~2000-5000 lines) to Haiku with a vague error string like `"Compilation failed: ! Missing $ inserted; ! Undefined control sequence"`, and asks it to rewrite the **complete chapter**. This is:

- **Wasteful**: ~10,000 lines of AI I/O per fix
- **Error-pro...

### Prompt 2

now audit the cahnges you just made

### Prompt 3

ok, now push to remote and watch CI

