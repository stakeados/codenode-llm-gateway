#!/bin/bash
# Check for basic git conflict markers across all files
# It will fail the CI/CD pipeline if it finds them

echo "🔍 Checking for Git conflict markers..."

if grep -RInE '<<<<<<<|=======|>>>>>>>' .; then
  echo "🚨 ERROR: Merge conflict markers found in the files listed above!"
  echo "Please resolve all conflicts before deploying or committing."
  exit 1
else
  echo "✅ No conflict markers found. Code is clean."
  exit 0
fi
