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
- normalize embedded serialized conversation text too, including tool calls, tool results, shell output, `ls -l` owner/group names, JSON string payloads, Markdown links, and generated file references
- preserve the existing `.ai/history/<local-user>/...` directory path created by the export tool

Use structured JSON editing for `.json` files when practical, but do not stop at top-level JSON metadata. Exported JSON message `text` fields may contain serialized command payloads and tool output that also need identity/path normalization. For Markdown exports, rewrite only identity/path metadata, tool-output identity strings, and generated local file links; do not alter conversation meaning.

After normalization, verify exported `.ai` file contents with a recursive hidden-file search for the local username, old machine/system names, and absolute `/Users/<local-user>/...` paths. Ignore the preserved `.ai/history/<local-user>/...` directory name itself, but do not ignore matches inside file contents.
