git fetch --no-tags origin main
if [[ "$GITHUB_SHA" != "$(git rev-parse FETCH_HEAD)" ]]; then
  echo "::warning::Main advanced during promotion; its newer workflow is now the deployment candidate."
  exit 1
fi
