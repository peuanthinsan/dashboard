vercel inspect "$DEPLOYMENT_URL" --wait --timeout=10m --format=json --scope="$VERCEL_ORG_ID" --token="$VERCEL_TOKEN" > deployment-status.json
jq -e '(.readyState // .state // .status) == "READY"' deployment-status.json
