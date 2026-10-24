#!/bin/sh
set -eu
cd "$(dirname "$0")"
exec ./run-local.command --keyword-only
