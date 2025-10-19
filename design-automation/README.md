# Design Automation Setup

## Structure
```
design-automation/
├── bundles/
│   ├── ExtractLayers/          # Extracts layer names from DWG
│   │   ├── PackageContents.xml
│   │   └── Contents/
│   │       └── extract-layers.lsp
│   └── RenameLayers/           # Renames layers based on mapping
│       ├── PackageContents.xml
│       └── Contents/
│           └── rename-layers.lsp
└── setup/
    ├── create-appbundle.js     # Upload AppBundles to APS
    └── create-activity.js      # Create Activities in APS
```

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install dotenv archiver form-data
   ```

2. **Set environment variables in .env:**
   ```
   APS_CLIENT_ID=your_client_id
   APS_CLIENT_SECRET=your_client_secret
   APS_NICKNAME=snapclean
   CLAUDE_API_KEY=your_claude_key
   ```

3. **Run setup scripts (once):**
   ```bash
   cd design-automation/setup
   node create-appbundle.js
   node create-activity.js
   ```

4. **Deploy to Vercel:**
   ```bash
   git add .
   git commit -m "Add Design Automation"
   git push
   ```

## Done! 🎉
Your AppBundles and Activities are now ready in APS cloud.
