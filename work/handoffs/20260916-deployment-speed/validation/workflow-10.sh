deployment_json="$(vercel deploy --prebuilt --prod --skip-domain --archive=tgz --no-wait --yes --format=json --scope="TEST_VALUE" --token=TEST_VALUE)"
deployment_url="$(jq -er '.deployment.url // .url' <<<"$deployment_json")"
echo "url=$deployment_url" >> "$GITHUB_OUTPUT"
