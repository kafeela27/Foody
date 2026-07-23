import { auth, db } from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

let currentAuthUser = null;
let navbarObserverStarted = false;

function bindUserDropdown() {
    const userIcon = document.getElementById("userIcon");
    const dropdown = document.getElementById("dropdown");

    if (!userIcon || !dropdown || userIcon.dataset.dropdownBound === "true") {
        return;
    }

    userIcon.dataset.dropdownBound = "true";

    userIcon.addEventListener("click", (event) => {
        event.stopPropagation();
        dropdown.classList.toggle("show");
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest("#user-area")) {
            dropdown.classList.remove("show");
        }
    });
}

function applyAuthState(user) {
    const authArea = document.getElementById("auth-area");
    const userArea = document.getElementById("user-area");
    const cartIcon = document.querySelector(".cart-icon");
    const trackOrderBtn = document.getElementById("track-order-btn");
    const hideAuthArea = document.body?.dataset.hideAuthArea === "true";
    const hideCartIcon = document.body?.dataset.hideCartIcon === "true";
    const showTrackOrder = document.body?.dataset.showTrackOrder === "true";

    if (cartIcon) {
        cartIcon.style.display = hideCartIcon ? "none" : "block";
    }

    if (trackOrderBtn) {
        trackOrderBtn.style.display = user && showTrackOrder ? "flex" : "none";
        trackOrderBtn.onclick = user && showTrackOrder ? () => {
            window.location.href = "tracking.html";
        } : null;
    }

    if (user) {
        if (authArea) {
            authArea.style.display = "none";
        }

        if (userArea) {
            userArea.style.display = "flex";
        }

        bindUserDropdown();

        // Logout button
        const logoutBtn = document.getElementById("logoutBtn");

        if (logoutBtn) {
            logoutBtn.onclick = async () => {

                try {

                    await signOut(auth);

                    alert("Logged out successfully");

                    window.location.href = "index.html";

                } catch (err) {

                    alert(err.message);

                }
            };
        }

        return;
    }

    if (authArea) {
        authArea.style.display = hideAuthArea ? "none" : "flex";
    }

    if (userArea) {
        userArea.style.display = "none";
    }
}

function ensureNavbarBinding() {
    if (navbarObserverStarted) {
        return;
    }

    navbarObserverStarted = true;

    const navbarMount = document.getElementById("navbar");

    if (!navbarMount) {
        return;
    }

    const observer = new MutationObserver(() => {
        applyAuthState(currentAuthUser);
    });

    observer.observe(navbarMount, {
        childList: true,
        subtree: true
    });

    applyAuthState(currentAuthUser);
}

// Sign Up
const signupBtn = document.getElementById("signup-btn");

if (signupBtn) {
    signupBtn.addEventListener("click", async () => {

        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;
        const role = document.getElementById("role").value;

        if (password !== confirmPassword) {
            alert("Passwords do not match");
            return;
        }

        try {
            const userCredential =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            const user = userCredential.user;

            // Save user data to Firestore
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name: name,
                email: email,
                role: role,
                createdAt: new Date()
            });

            localStorage.setItem("userName", name);

            alert("Account created successfully");

            window.location.href = "index.html";

        } catch (err) {
            alert(err.message);
        }
    });
}
//-------------------------------------------------------------------------------------------

// Login
const signinBtn = document.getElementById("signin-btn");

if (signinBtn) {
    signinBtn.addEventListener("click", async () => {

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        try {

            const userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            const user = userCredential.user;

            //  Get user document from Firestore
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {

                const userData = docSnap.data();

                alert("Sign in successful");

                // Redirect based on role
                if (userData.role === "admin") {
                    window.location.href = "admin_dashboard.html";
                } else {
                    window.location.href = "index.html";
                }

            } else {
                alert("No user data found");
            }

        } catch (err) {
            alert(err.message);
        }
    });
}

//--------------------------------------------------------------------------------------------------------

//  Authentication State
onAuthStateChanged(auth, (user) => {
    currentAuthUser = user;
    applyAuthState(user);
});

window.addEventListener("navbarLoaded", () => {
    applyAuthState(currentAuthUser);
});

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureNavbarBinding);
} else {
    ensureNavbarBinding();
}