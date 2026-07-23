import { db, auth } from "./firebase.js";

import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

export async function updateCartCount(user) {

    const cartCount = document.querySelector(".cart-count");

    if (!cartCount) return;

    if (!user) {
        cartCount.innerText = "0";
        return;
    }

    const snapshot = await getDocs(
        collection(db, "users", user.uid, "cart")
    );

    let count = 0;

    snapshot.forEach((doc) => {
        count += doc.data().quantity;
    });

    cartCount.innerText = count;
}

window.addEventListener("navbarLoaded", () => {

    onAuthStateChanged(auth, (user) => {
        updateCartCount(user);
    });

});