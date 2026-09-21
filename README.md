# FKC Group ERP

Unified, offline-first ERP for three brands sharing one reception:

- **The Smart Modern Public School**
- **FKC Trading Academy**
- **The Smart Modern Educational Academy**

Built as a PWA: works fully offline, syncs to Firebase whenever there's a connection, deploys free on GitHub Pages.

## What's included

- `index.html` — staff login
- `dashboard.html` — shared reception dashboard: 3 module cards + walk-in visitor log
- `modules/school/` — students, fee challans (Paid/Unpaid, filterable by month)
- `modules/trading-academy/` — batches (male/female, timing, instructor), trader enrollments
- `modules/educational-academy/` — tutors, tuition classes/timetable, student enrollments
- `js/db.js` — IndexedDB offline engine + sync outbox queue
- `js/sync.js` — pushes the queue to Firestore whenever online
- `js/auth.js` — shared login + route-guard for every page (already wired to your Firebase project)
- `js/firebase-config.js` — **your real Firebase keys are already in this file**
- `sw.js` + `manifest.json` — installable app shell, caches every module for full offline use
- `.github/workflows/deploy.yml` — auto-deploys to GitHub Pages on every push to `main`

## How to replace your repo

1. Delete everything in your repo except `.git`.
2. Copy every file from this folder into the repo root, keeping the exact same folder structure.
3. Commit and push:
   ```
   git add .
   git commit -m "Rebuild: full app with wired Firebase config"
   git push
   ```
4. GitHub Actions will auto-deploy. Your ERP will be live at your existing GitHub Pages URL.

## Still needed in Firebase Console (one-time)

1. **Authentication → Sign-in method** → enable Email/Password.
2. **Authentication → Users** → add your staff login (email + password).
3. **Firestore Database** → Create database (production mode).
4. **Firestore → Rules** → paste:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

Once that's done, sign in on the live site — the sync pill should switch from "checking connection…" to "● synced".
