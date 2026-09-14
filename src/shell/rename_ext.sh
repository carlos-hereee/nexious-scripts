#!/usr/bin/env bash
# DEPRECATED: the full implementation lives in renameFile.sh. This file was a half-
# written variant that sourced `helpers/require_path.sh` from a directory that does
# not exist in this repo, so it never worked. Use renameFile.sh directly.
exec "$(dirname "${BASH_SOURCE[0]}")/renameFile.sh" "$@"
