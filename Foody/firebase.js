// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";



// our web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCF7nsPQjCYGZcWup6TRvSXUielHtTRSbc",
    authDomain: "foody-9f4c4.firebaseapp.com",
    projectId: "foody-9f4c4",
    storageBucket: "foody-9f4c4.firebasestorage.app",
    messagingSenderId: "1041269697143",
    appId: "1:1041269697143:web:cd29d249b99c9946e2f472",
    measurementId: "G-ZPTKBCZTCZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);