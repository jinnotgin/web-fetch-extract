---
name: export-ai-conversations
description: Export, sync, archive, or save local AI assistant conversations from Codex, Cursor, or Claude into this repository using convx.
---

# Export AI Conversations

Use this skill when the user asks to export, sync, archive, save, preserve, or commit local AI assistant conversations, including Codex, Cursor, Claude, or other agent/chat history, into the current repository.

## Command

Run from the repository root:

```bash
uvx --from convx-ai convx sync
```

## Repository Normalization

After syncing, normalize exported `.ai` file contents for this repository without moving history directories:

- set displayed/exported user identity fields to `jin`
- set exported machine/system name fields to `jin-macbook`
- rewrite absolute `/Users/<local-user>/...` paths in exported file contents to `/Users/jin/...`
- preserve the existing `.ai/history/<local-user>/...` directory path created by the export tool

Use structured JSON editing for `.json` files when practical. For Markdown exports, rewrite only identity/path metadata and generated local file links; do not alter conversation meaning.
