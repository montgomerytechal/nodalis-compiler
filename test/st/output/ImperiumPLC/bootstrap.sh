#!/bin/bash
SCRIPT="{script}" # to be replaced by JSCompiler

DIR="$(cd "$(dirname "$0")" && pwd)"
"$DIR/ImperiumPLC" "$SCRIPT"
