#!/bin/bash
# ============================================================================
# BetterNic — One-shot GitHub Deploy Script
# Run from inside the betternic/ folder on your Mac
# ============================================================================

set -e

REPO_NAME="betternic"
GITHUB_USER="webworksa1"
DOMAIN="betternic.com"

echo "🚀 BetterNic deploy starting..."
echo ""

# 1. Add CNAME for custom domain (GitHub Pages reads this automatically)
echo "$DOMAIN" > CNAME
echo "✓ CNAME file created"

# 2. Create .nojekyll so GitHub doesn't try to process as Jekyll
touch .nojekyll
echo "✓ .nojekyll created (skips Jekyll processing)"

# 3. Initialize git
git init -b main
echo "✓ Git initialized"

# 4. Add gitignore (skip Mac noise + IDE files)
cat > .gitignore << 'EOF'
.DS_Store
.vscode/
.idea/
*.log
node_modules/
.env
.env.local
EOF
echo "✓ .gitignore created"

# 5. First commit
git add .
git commit -m "Initial commit: BetterNic Phase 1 MVP"
echo "✓ Initial commit made"

# 6. Push to GitHub (you must create the repo on github.com first)
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "MANUAL STEP — Create the repo on GitHub now:"
echo ""
echo "  1. Go to: https://github.com/new"
echo "  2. Owner: $GITHUB_USER"
echo "  3. Repo name: $REPO_NAME"
echo "  4. Public OR Private (your choice)"
echo "  5. DO NOT initialize with README/gitignore/license (we have them)"
echo "  6. Click 'Create repository'"
echo ""
echo "Then run:"
echo ""
echo "  git remote add origin https://github.com/$GITHUB_USER/$REPO_NAME.git"
echo "  git push -u origin main"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "After push completes:"
echo "  1. Repo Settings → Pages"
echo "  2. Source: Deploy from a branch"
echo "  3. Branch: main / (root)"
echo "  4. Custom domain: $DOMAIN"
echo "  5. Wait 2-5 min for deployment"
echo ""
echo "Then update DNS at your registrar:"
echo ""
echo "  A records for @ (apex):"
echo "    185.199.108.153"
echo "    185.199.109.153"
echo "    185.199.110.153"
echo "    185.199.111.153"
echo ""
echo "  CNAME for www:"
echo "    $GITHUB_USER.github.io"
echo ""
echo "Live in 10-15 min after DNS propagates. ✓"
