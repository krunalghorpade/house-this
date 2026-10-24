#!/bin/sh
set -eu

deploy_path="${HOUSE_THIS_DEPLOY_PATH:-$HOME/housethis.kratex.in}"
if [ ! -d "$deploy_path" ]; then
  echo "cPanel Document Root does not exist: $deploy_path" >&2
  exit 1
fi

repo_path=$(CDPATH= cd "$(dirname "$0")/.." && pwd -P)
target_path=$(CDPATH= cd "$deploy_path" && pwd -P)

# A clone inside the Document Root already serves the root entry page.
# Copying dist/ over that checkout would leave Git changes and block later pulls.
if [ "$repo_path" = "$target_path" ]; then
  echo "Repository is already the Document Root; no copy needed."
  exit 0
fi

/bin/cp -R "$repo_path/dist/." "$target_path/"
echo "Deployed dist/ to $target_path"
