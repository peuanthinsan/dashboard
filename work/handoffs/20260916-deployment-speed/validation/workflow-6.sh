git fetch --no-tags origin main
if [[ "$GITHUB_SHA" == "$(git rev-parse FETCH_HEAD)" ]]; then
  echo "current=true" >> "$GITHUB_OUTPUT"
else
  echo "current=false" >> "$GITHUB_OUTPUT"
  echo "::notice::Skipping stale production deployment; main has advanced."
fi
