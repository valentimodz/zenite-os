# Repository Rules for Zenite OS

## Commit & Deployment Policy
- Whenever code changes or bug fixes are completed, always verify the build (`npm run build`) and automatically commit & push all changes to GitHub:
  ```powershell
  git add . ; git commit -m "<descriptive message>" ; git push origin main
  ```
- Pushing to `origin main` automatically triggers automatic build and deployment on Vercel Production for `valentimodz/zenite-os`.
