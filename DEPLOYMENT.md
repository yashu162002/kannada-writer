# Kannada Writer - Deployment Guide

## Project Requirements

- Node.js version 20.x or 22.x
- npm (included with Node.js)
- Git (optional, for deployment from repository)

## Installation

```bash
# Clone the repository (or extract the project zip)
git clone <repository-url>
cd kannada-writer

# Install dependencies
npm install

# Verify the build works
npm run build
```

## Local Development

```bash
# Start development server
npm run dev

# The application will be available at http://localhost:5173 (or port 5199 as previously configured)

# To run type-check only (no build):
npm run typecheck
```

## Production Build

```bash
npm run build
```

This command:
1. Runs `tsc -b` - TypeScript build in build mode
2. Runs `vite build` - Vite production build

Output is placed in the `dist/` directory.

### Build Verification

After running `npm run build`, verify:

- `dist/index.html` exists
- `dist/assets/` contains CSS and JavaScript files
- No TypeScript or build errors in the output
- The application renders correctly (open `dist/index.html` in a browser)

## Netlify Deployment

### Option 1: Netlify UI

1. Go to https://netlify.com and create an account/sign in
2. Click "New site from Git" or "Drag and drop"
3. If dragging and drop:
   - Drag the `kannada-writer` folder (or the built project) to the Netlify drop area
   - Netlify will auto-detect the Vite/React setup
4. If using Git:
   - Connect your Git repository
   - Netlify will detect the framework
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click "Deploy site"

### Option 2: Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize project
netlify init

# Or deploy directly
netlify deploy --dir dist

# Or deploy with site creation
netlify deploy
```

## Cloudflare Pages Deployment

1. Go to https://pages.cloudflare.com and create an account/sign in
2. Click "Create a new project"
3. Connect your Git repository (GitHub, GitLab, or Bitbucket)
4. **Framework Preset**: Select "Vite" or "Other"
5. **Build command**: `npm run build`
6. **Output directory**: `dist`
7. Click "Deploy"

### Cloudflare Pages CLI

```bash
npm install -g @cloudflare/cli
wrangler pages project create <project-name>

# Deploy
npx cloudflare pages deploy dist --project-name=<project-name>
```

## Vercel Deployment

1. Go to https://vercel.com and create an account/sign in
2. Click "Add New" → "Project"
3. Import your Git repository
4. Vercel will auto-detect the Vite/React setup
5. **Framework**: Vite
6. **Build Command**: `npm run build`
7. **Output Directory**: `dist`
8. Click "Deploy"

### Vercel CLI

```bash
npm install -g vercel
vercel login

# Deploy
vercel

# Or deploy from the project directory
vercel --prod
```

## Environment Variables

The Kannada Writer is a **frontend-only application** with no backend requirements.

No environment variables are required for basic functionality.

If you need to configure optional settings:

```bash
# Create .env.example if needed
# The project does not require API keys or external services for core functionality
```

### Existing .env handling

The project uses `localStorage` and `IndexedDB` for document storage. No environment variable changes are needed for offline functionality.

## IndexedDB and Offline Support

### Important Notes

- The application uses **IndexedDB** via Dexie.js for document storage and autosave
- Documents are stored locally in the browser's IndexedDB
- Auto-save is debounced at 750ms
- Documents can be reopened from local storage after browser restart
- Personal dictionary is persisted locally

### Backup Warnings

**Before deploying or clearing browser data:**

1. Export documents using the "Backup → JSON" feature in the application
2. Or manually backup the IndexedDB data via the browser's Application tab
3. Store backups externally (cloud storage, email, etc.)

**Deployments do NOT affect IndexedDB data** - documents remain in the browser where they were created.

If you need to migrate documents to a new device:
1. Export as JSON from the old device
2. Import as JSON on the new device
3. Or use the backup/restore feature in the application (File → Backup)

## Troubleshooting Deployment Errors

### Build fails

1. Run `npm install` first to ensure all dependencies are installed
2. Run `npm run typecheck` to find TypeScript errors
3. Check the build output for specific error messages
4. Ensure Node.js version is 20.x or 22.x

### Application doesn't load after deployment

1. Verify the `dist/index.html` file exists
2. Check that the hosting rewrite rules are correct (SPA routing)
3. Ensure all assets are published (check the hosting dashboard)
4. Clear browser cache and try again

### IndexedDB not working

1. Ensure the browser supports IndexedDB (modern browsers do)
2. Check that no privacy extensions are blocking IndexedDB
3. Verify the application is served over HTTPS (IndexedDB requires HTTPS in production)
4. If using localhost for development, IndexedDB works without HTTPS

### Kannada fonts not rendering

1. Verify font files are in `public/fonts/`
2. Check that the CSS font-face rules are loaded
3. Ensure the application is not running in a context that blocks webfonts
4. The project includes 7 Kannada font families + Noto Sans Kannada

### Offline transliteration not working

1. The transliteration engine is completely offline - no network required
2. Verify the browser has not cleared the IndexedDB cache
3. Check that the `TransliterationService` is initialized correctly
4. The personal dictionary learns from user selections and is persisted

## Verifying the Live Application

After deployment, verify:

1. **Home page loads**: `https://your-site.netlify.app/` (or your domain)
2. **New document creation**: Ctrl+N or click "New Document"
3. **Kannada transliteration**: Type English phonetics (e.g., "namaskara") and see Kannada output
4. **Document saving**: Type content, wait for autosave (750ms), verify in IndexedDB
5. **Export functionality**: Test DOCX, PDF, TXT, RTF, HTML, ODT exports
6. **Print/PDF**: Use the print feature to generate PDF
7. **Kannada suggestions**: Type "la" to see multiple suggestions (ಶ/ಳ)
8. **Hash routing**: Navigate to `#/doc/:id` and verify the editor loads
9. **Offline mode**: Disconnect network, verify the application still works for existing documents

## Hosting Comparison

| Feature | Netlify | Cloudflare Pages | Vercel |
|---------|---------|------------------|--------|
| Build command | `npm run build` | `npm run build` | `npm run build` |
| Publish directory | `dist` | `dist` | `dist` |
| SPA routing | `_redirects` with `/ = /index.html` | `/* /index.html 200` | Automatic |
| HTTPS | Automatic (Let's Encrypt) | Automatic (Cloudflare SSL) | Automatic (Let's Encrypt) |
| CDN | Global edge network | Global Cloudflare network | Global edge network |
| Form handling | Available (separate setup) | Available (Workers) | Available (Vercel Functions) |
| Serverless functions | Available | Available (Cloudflare Workers) | Available (Vercel Functions) |
| IndexedDB support | Yes (frontend-only) | Yes (frontend-only) | Yes (frontend-only) |

## Known Limitations

- **No backend required**: This is a fully frontend application
- **IndexedDB is browser-local**: Documents stay on the client device
- **No collaboration**: Single-user editor only
- **PDF is rasterized**: Uses html2canvas-pro + jsPDF for correct Kannada shaping
- **SERTABar**: Continuous page guides rather than true WYSIWYG pagination
- **Headers/footers**: Repeat accurately only in print/PDF preview
- **Offline mode**: Works for existing documents; new documents require local storage

## Contact / Support

For deployment issues, check:
1. The build output logs
2. The hosting service's deployment error messages
3. This DEPLOYMENT.md guide
4. Browser console for JavaScript errors

---
*Last updated: 2026*
*Project: Kannada Writer - Desktop Document Editor*