# FKC Group ERP

Unified, offline-first ERP for three brands sharing one reception:

- **The Smart Modern Public School**
- **FKC Trading Academy**
- **The Smart Modern Educational Academy**

Built as a PWA: works fully offline, syncs to Firebase whenever there's a connection, and deploys free on GitHub Pages.

## What's in this build

- `index.html` — staff login
- `dashboard.html` — shared reception dashboard: 3 module cards + walk-in visitor log
- `modules/school/` — **The Smart Modern Public School**: student records, and fee challans split into Paid / Unpaid, filterable by month
- `modules/trading-academy/` — **FKC Trading Academy**: batches (male/female, timing, instructor) and trader enrollments per batch
- `modules/educational-academy/` — **The Smart Modern Educational Academy**: tutors, tuition classes/timetable (subject, room, timing, assigned tutor), and student enrollments per class
- `js/db.js` — IndexedDB local storage + outbox queue (**this is the offline engine** — every module reads/writes through it)
- `js/sync.js` — pushes the queue to Firestore whenever online
- `js/firebase-config.js` — your Firebase project keys go here (only thing left to fill in)
- `sw.js` + `manifest.json` — installable app shell, caches every module too, so the whole ERP works with no connection at all
- `.github/workflows/deploy.yml` — auto-deploys to GitHub Pages on every push to `main`

Every module follows the same pattern: add a record → it saves to the device instantly → it queues → `sync.js` pushes it to Firestore the moment there's a connection. Try turning off wifi in any module — it keeps working, and the "● synced" pill up top switches to "● offline — saved on device" until you're back online.

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

## Only step left: Firebase

Everything above works right now using only the on-device database — you can click through every module, add students, batches, tutors, fee challans, and enrollments, and it all just works. The **only thing not live yet is cloud sync**, because `js/firebase-config.js` still has placeholder keys. Once you create your Firebase project and paste in the real config (steps above), every record already saved on the device will sync up automatically the next time the app loads — nothing needs to be re-entered.
