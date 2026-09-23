# THE SMART MODERN ERP SYSTEM — v4 (Professional Core)

**Educating Minds • Building Futures • Empowering Traders**

Offline-first PWA ERP for three institutions under one system.

## What's Working in v4

### Master Dashboard
- Live KPIs (Total Students, Batches/Classes, Today's Collection, Pending Fees)
- Walk-in visitor log
- Module cards with quick navigation

### 🏫 Public School
- Complete Student Admission form
- Approval → Auto enroll as student
- Fee Structure (class-wise monthly fee)
- Auto-fill amount when creating challan
- Fee Challans with Paid/Unpaid toggle + filters
- Student search
- Quick add student

### 📈 FKC Trading Academy
- Batch management (Gender, Timing, Instructor)
- Student enrollment
- Trading Journal (Symbol, Buy/Sell, Entry/Exit, Lots)
- Auto Profit/Loss calculation

### 📚 Educational Academy
- Tutor management
- Classes / Batches with fee
- Student enrollment

### System Features
- Fully offline-first (IndexedDB)
- Automatic sync to Firebase when online
- Activity logs on every create/update/delete
- Professional Navy + Gold branding
- Responsive design

## How to Deploy

1. Replace the files in your GitHub repo with the contents of this `erp-v4` folder (keep the same structure).
2. Make sure `js/firebase-config.js` has your Firebase project keys.
3. In Firebase Console:
   - Enable **Email/Password** authentication
   - Create at least one user
   - Create Firestore database
   - Set rules:
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
4. Push to `main` — GitHub Pages will deploy automatically.

## Brand Colors
- Navy: `#0A1628`
- Gold: `#C9A227`

© The Smart Modern ERP System
