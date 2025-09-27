# SnapClean Backend

This is a minimal backend for SnapClean powered by Vercel Functions and a Python DWG Parser.

## Structure

- `api/process-dwg.js`: Handles file input and calls the Python parser
- `dwg-parser/dwg_cleaner.py`: Cleans the DWG file using `ezdxf`

## Deployment

1. Push to GitHub
2. Link repo to Vercel
3. Set environment variables