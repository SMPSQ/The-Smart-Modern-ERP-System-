# FKC Group ERP

Unified, offline-first ERP for three brands sharing one reception:

- **The Smart Modern Public School**
- **FKC Trading Academy**
- **The Smart Modern Educational Academy**

Built as a PWA: works fully offline, syncs to Firebase whenever there's a connection, and deploys free on GitHub Pages.

## What's in this scaffold

- `index.html` — staff login
- `dashboard.html` — shared reception dashboard: 3 module cards + walk-in visitor log (already wired end-to-end as a working example)
- `modules/school/`, `modules/trading-academy/`, `modules/educational-academy/` — placeholders, one folder per brand, ready for their own pages/features
- `js/db.js` — IndexedDB local storage + outbox queue (**this is the offline engine** — every module should read/write through it)
- `js/sync.js` — pushes the queue to Firestore whenever online
- `js/firebase-config.js` — your Firebase project keys go here
- `sw.js` + `manifest.json` — installable app shell, works with no connection at all
- `.github/workflows/deploy.yml` — auto-deploys to GitHub Pages on every push to `main`

## How the offline sync works

1. Every write (e.g. logging a visitor) saves instantly to IndexedDB via `saveLocal()` — the UI never waits on the network.
2. The same write is added to a local `sync_queue`.
3. `sync.js` drains that queue into Firestore the moment the browser is online (on load, on the `online` event, and every 30s as a safety net).
4. If the sync fails partway (flaky wifi), the queue item stays put and retries automatically — nothing is lost.

To add a new data type (e.g. `students` for the school module): add the store name to `STORES` in `db.js`, then call `saveLocal("students", {...})` / `getAllLocal("students")` from your module's JS exactly like `dashboard.js` does for visitors.

## Setup

### 1. Create a Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. In the new project, click the **Web** icon to register an app, and copy the config object it gives you.
3. Paste those values into `js/firebase-config.js` (replace every `REPLACE_ME`).
4. In the Firebase Console, enable **Authentication → Sign-in method → Email/Password**, and add a staff account under **Authentication → Users**.
5. Enable **Firestore Database** (start in production mode).

### 2. Lock down Firestore
In **Firestore → Rules**, require sign-in for everything, e.g.:
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
(Tighten further per-collection as modules grow — e.g. only admins can delete fee records.)

### 3. Push to GitHub and deploy
```bash
git init
git add .
git commit -m "Initial FKC Group ERP scaffold"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```
Then in the repo on GitHub: **Settings → Pages → Build and deployment → Source → GitHub Actions**. The included workflow will deploy automatically on every push — your ERP will be live at `https://<your-username>.github.io/<repo-name>/`.

### 4. Try it
- Open the deployed URL (or just open `index.html` locally for a quick test).
- Sign in with the staff account you created.
- On the dashboard, log a walk-in visitor — it saves instantly and syncs once online (watch the "● synced" pill top-right).
- Turn off wifi and log another visitor — it still saves, marked pending, and syncs automatically once you're back online.

## What's next

Say the word and I'll build out one module at a time in this same repo:
- **School**: student records, attendance, fee challans separated by month (paid vs unpaid)
- **Trading Academy**: batches, enrollments, male/female class schedules
- **Educational Academy**: tuition classes, tutors, timetables
