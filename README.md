# THE SMART MODERN ERP SYSTEM

**Educating Minds • Building Futures • Empowering Traders**

🔗 **Repository:** [https://github.com/SMPSQ/The-Smart-Modern-ERP-System-](https://github.com/SMPSQ/The-Smart-Modern-ERP-System-)

Unified, offline-first ERP for three brands sharing one reception:

| Institution | Focus |
|-------------|-------|
| 🏫 **The Smart Modern Public School** | Complete school management |
| 📈 **FKC Trading Academy** | Trading education + performance tracking |
| 📚 **The Smart Modern Educational Academy** | Courses, tutors & skill development |

Built as a **PWA**: works fully offline, syncs to Firebase whenever there's a connection, deploys free on GitHub Pages.

---

## What's included

| File / Folder | Description |
|---------------|-------------|
| `index.html` | **Branded staff login** (navy + gold, role selector, reception style) |
| `dashboard.html` | **Master ERP Dashboard** — KPIs, 3 module cards, full feature list, walk-in log |
| `modules/school/` | Students, fee challans (Paid/Unpaid, filterable by month) |
| `modules/trading-academy/` | Batches (male/female, timing, instructor), trader enrollments |
| `modules/educational-academy/` | Tutors, tuition classes/timetable, student enrollments |
| `js/db.js` | IndexedDB offline engine + sync outbox queue |
| `js/sync.js` | Pushes the queue to Firestore whenever online |
| `js/auth.js` | Shared login + route-guard (wired to your Firebase project) |
| `js/firebase-config.js` | **Your real Firebase keys are already in this file** |
| `sw.js` + `manifest.json` | Installable app shell, caches every module for full offline use |
| `.github/workflows/deploy.yml` | Auto-deploys to GitHub Pages on every push to `main` |

---

## Full Feature List

### 🏫 1. THE SMART MODERN PUBLIC SCHOOL
- Student Registration & Admission
- Student Profile & Documents
- Classes & Sections
- Teacher Management
- Student Attendance / Teacher Attendance
- Fee Management, Monthly Fee Challans, Fee Collection & Pending Fees, Fee Receipts
- Exams & Tests, Marks & Result Cards
- Class Timetable / Teacher Timetable
- Student Promotion, Leave Management
- Parent/Guardian Records
- Student ID Cards / Teacher ID Cards
- SMS / WhatsApp Notifications
- Homework & Assignments
- Income & Expense Management
- Reports & Statistics
- Admin Dashboard

### 📈 2. FKC TRADING ACADEMY
- Student Registration
- Course Management / Batch Management
- Student Enrollment
- Trading Class Schedule
- Trainer/Instructor Management
- Student Attendance
- Course Fee Management / Installment Management
- Fee Challans & Receipts
- Trading Assignments
- Quiz & Test Management
- Student Progress Tracking
- Certificates / Student ID Cards
- Trading Notes / PDF Materials
- Announcements
- SMS / WhatsApp Notifications
- Income & Expense Management
- Batch-wise Reports / Trainer Reports
- **Trading Journal**
- Trade Entry & Exit Records
- Profit/Loss Tracking
- Risk Management Records
- Strategy & Lesson Progress
- Student Trading Performance
- Trading Academy Dashboard

### 📚 3. THE SMART MODERN EDUCATIONAL ACADEMY
- Student Registration / Student Profile
- Tutor Management
- Course & Subject Management
- Classes & Batches
- Timetable Management
- Student Attendance / Tutor Attendance
- Monthly Fee Management / Installment Management
- Fee Receipts / Pending Fee Reports
- Tests & Exams / Marks & Results
- Homework & Assignments
- Student Progress Tracking
- Parent/Guardian Records
- Tutor Salary Management
- Certificates
- Notifications
- Income & Expense Management
- Reports & Statistics
- Educational Academy Dashboard

### 💰 4. CENTRAL FINANCE MANAGEMENT
- School / Trading Academy / Educational Academy Fee Collection
- Daily Income / Monthly Income
- Daily Expenses / Monthly Expenses
- Salaries, Rent, Electricity, Marketing Expenses, Other Expenses
- Profit & Loss
- Pending Fees
- Collection Reports
- Module-wise Financial Reports

### 👥 5. STAFF & USER MANAGEMENT
- Super Admin
- School Admin / Academy Admin
- Accountant
- Teacher / Trainer / Tutor
- Receptionist
- Student Login / Parent Login
- User Permissions / Role-based Access
- Password Management
- Activity Logs

### 📊 6. MASTER ERP DASHBOARD
- Total Students / Teachers / Trainers/Tutors
- Active Batches
- Today's Attendance
- Pending Fees / Today's Collection
- Monthly Income / Monthly Expenses / Profit-Loss
- School Overview / Trading Academy Overview / Educational Academy Overview
- Recent Activities / Notifications / Quick Actions

### ⚙️ 7. SYSTEM FEATURES
- Secure Login System
- Role & Permission Management
- Search & Filter
- Print / PDF / Excel Reports
- Data Backup & Restore
- Notifications
- Responsive Design / Mobile Friendly
- Professional Admin Panel
- Dark / Light Mode
- System Settings
- Database Management
- Automatic Reports
- Audit Logs
- Offline-first PWA + Firebase sync

---

## How to replace your repo

1. Delete everything in your repo except `.git`.
2. Copy every file from this folder into the repo root, keeping the exact same folder structure.
3. Commit and push:
   ```bash
   git add .
   git commit -m "Full package: branded login + Master Dashboard + complete feature list"
   git push
   ```
4. GitHub Actions will auto-deploy. Your ERP will be live at your existing GitHub Pages URL.

---

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

---

## Brand

- **Navy:** `#0A1628`
- **Gold:** `#C9A227`
- **Tagline:** Educating Minds • Building Futures • Empowering Traders

© The Smart Modern ERP System
