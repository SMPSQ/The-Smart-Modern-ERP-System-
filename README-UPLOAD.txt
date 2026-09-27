UPLOAD — Future Tech ERP v6.2 COMPLETE
=====================================

1. Unzip this folder
2. On GitHub repo, replace / upload matching paths:

Root:
  sw.js, dashboard.html, VERSION.txt

js/:
  db.js, print.js, staff-auth.js, sw-register.js, auth.js

css/:
  style.css

modules/school/:
  index.html, school.js

modules/shop/:
  index.html, shop.js

modules/educational-academy/:
  index.html, academy.js

modules/trading-academy/:
  index.html, trading.js

3. Commit to main → wait for Pages deploy
4. Hard refresh (Ctrl+Shift+R) or Update banner

USER ROLES:
- Super Admin / Principal / Admin → full access + user management
- Shop Salesman → only Shop module after login
- Teacher, Accountant, etc. → limited school tabs
- Only Admin can create/edit/delete users and reset passwords

EDUCATIONAL:
- Subjects tab → save once → appears in search lists everywhere

SCHOOL:
- Classes module → appears in Admission class dropdown

TRADING / FOREX:
- Courses tab → type on admission also auto-saves course
