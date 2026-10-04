Firebase Console pe rules deploy karein:

1. https://console.firebase.google.com → project erp-full-system
2. Firestore Database → Rules
3. firestore.rules file ka content paste karein
4. Publish

Rules: koi bhi signed-in user (email admin) read/write kar sakta hai.
Local save Firebase ke baghair bhi kaam karti hai (IndexedDB + localStorage).

Staff username login Firebase auth nahi banata — data local rahega jab tak admin email se login na ho.
