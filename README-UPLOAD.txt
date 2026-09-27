Future Tech ERP v6 — Full replace package
========================================

Upload / replace these paths in your GitHub repo
(https://github.com/SMPSQ/The-Smart-Modern-ERP-System-):

  sw.js                         → repo root sw.js
  VERSION.txt                   → repo root VERSION.txt
  dashboard.html                → repo root dashboard.html

  js/db.js                      → js/db.js
  js/print.js                   → js/print.js
  js/staff-auth.js              → js/staff-auth.js
  js/sw-register.js             → js/sw-register.js

  css/style.css                 → css/style.css

  modules/school/index.html     → modules/school/index.html
  modules/school/school.js      → modules/school/school.js

  modules/shop/index.html       → NEW folder modules/shop/
  modules/shop/shop.js          → NEW

How to upload on GitHub:
1. Unzip this folder
2. For each existing file: open file on GitHub → Edit → paste content OR use "Upload files" on the folder
3. For modules/shop: go to modules/ → Add file → Upload files → select both shop files (or create folder by naming modules/shop/index.html)
4. Commit all changes to main
5. Wait for GitHub Pages deploy
6. Hard refresh browser (Ctrl+Shift+R) or click "Update now" banner

What is included:
- Modern ID cards (photo + QR), admission form, certificates
- Dashboard UI + School Shop card
- Monthly school accounting (expense categories)
- Shop POS module + Shop Salesman role
- Privacy: CNIC/phone/salary only for Admin/Principal/Super Admin
- Cache version v6.0.0 + auto update banner
