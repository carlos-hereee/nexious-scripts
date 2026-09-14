#!/usr/bin/env bash
# DEPRECATED: this file is a duplicate of src/shell/require_path.sh which is the
# canonical snake_case version (matches the function name `require_path`). Source the
# other file directly; this stub remains only so old scripts that reference the
# camelCase name keep working until the next major cleanup.
#
# Migration: `source require_path.sh` instead of `source requirePath.sh`.
source "$(dirname "${BASH_SOURCE[0]}")/require_path.sh"
