// Import the functions you need from the SDKs you need via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAP12xuDObrgERpyRJxspz2z4y9Vy6Xs90",
  authDomain: "nulis03.firebaseapp.com",
  projectId: "nulis03",
  storageBucket: "nulis03.firebasestorage.app",
  messagingSenderId: "991922884272",
  appId: "1:991922884272:web:e3a0e49309650f232bb575",
  measurementId: "G-GNSFLBHRGT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Ekspor auth dan db agar dapat diimpor oleh router.js atau file lainnya
export const auth = getAuth(app);
export const db = getFirestore(app);