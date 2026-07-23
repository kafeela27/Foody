import { db, auth } from "./firebase.js";

import {
    collection,
    doc,
    setDoc,
    getDocs,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";


// Generates a unique order ID like "ORD-20260705-0001"
async function generateOrderId() {
    const today = new Date();
    const dateStr = today.getFullYear().toString() +
        String(today.getMonth() + 1).padStart(2, "0") +
        String(today.getDate()).padStart(2, "0");

    const counterRef = doc(db, "counters", dateStr);

    const newCount = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        const currentCount = counterDoc.exists() ? counterDoc.data().count : 0;
        const updatedCount = currentCount + 1;
        transaction.set(counterRef, { count: updatedCount }, { merge: true });
        return updatedCount;
    });

    const orderNumber = String(newCount).padStart(4, "0");
    return `ORD-${dateStr}-${orderNumber}`;
}


document.addEventListener("DOMContentLoaded", () => {

    // Load Total Amount
    const total = localStorage.getItem("totalAmount") || "0";
    document.getElementById("totalAmount").innerText = total;


    // Elements
    const paymentOptions = document.querySelectorAll('input[name="payment"]');
    const cardForm = document.getElementById("cardForm");

    const cardNameInput = document.getElementById("cardName");
    const cardNumberInput = document.getElementById("cardNumber");
    const expiryInput = document.getElementById("expiryDate");
    const cvvInput = document.getElementById("cvv");


    // Show / Hide Card Form
    paymentOptions.forEach(option => {
        option.addEventListener("change", () => {
            if (option.value === "card" && option.checked) {
                cardForm.style.display = "block";
            } else {
                cardForm.style.display = "none";
            }
        });
    });


    // Card validations (live input)
    cardNumberInput.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, "").slice(0, 10);
        e.target.value = value;
    });

    cvvInput.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, "").slice(0, 3);
        e.target.value = value;
    });

    expiryInput.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, "").slice(0, 4);

        if (value.length >= 3) {
            value = value.substring(0, 2) + "/" + value.substring(2);
        }

        e.target.value = value;
    });



    // Submit Payment
    document.getElementById("submitPayment").addEventListener("click", async () => {

        try {

            const user = auth.currentUser;

            if (!user) {
                alert("Please login again.");
                return;
            }

            const selectedPayment =
                document.querySelector('input[name="payment"]:checked')?.value;

            if (!selectedPayment) {
                alert("Please select a payment method!");
                return;
            }


            // FIXED: Get address properly
            const address = document.getElementById("address").value.trim();

            if (!address) {
                alert("Please enter delivery address!");
                return;
            }



            // Card validation
            if (selectedPayment === "card") {

                const name = cardNameInput.value.trim();
                const number = cardNumberInput.value.trim();
                const expiry = expiryInput.value.trim();
                const cvv = cvvInput.value.trim();

                if (!name || !number || !expiry || !cvv) {
                    alert("Please fill all card details!");
                    return;
                }

                if (!/^\d{10}$/.test(number)) {
                    alert("Card number must be exactly 10 digits!");
                    return;
                }

                if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
                    alert("Expiry must be in MM/YY format.");
                    return;
                }

                if (!/^\d{3}$/.test(cvv)) {
                    alert("CVV must be 3 digits!");
                    return;
                }
            }



            // Get cart items
            const cartSnapshot = await getDocs(
                collection(db, "users", user.uid, "cart")
            );

            const orderedItems = [];

            cartSnapshot.forEach(doc => {
                orderedItems.push(doc.data());
            });

            const customerName =
                user.displayName || user.email || "Unknown User";




            // Save order to Firestore
            const orderId = await generateOrderId();

            await setDoc(doc(db, "orders", orderId), {
                orderId: orderId,
                customerName: customerName,
                totalAmount: total,
                uid: user.uid,
                paymentMethod: selectedPayment,
                address: address,
                orderedItems: orderedItems,
                status: "Paid",
                createdAt: new Date().toISOString()
            });
            alert("Payment Successful!");

            localStorage.removeItem("totalAmount");

            window.location.href = "tracking.html?orderId=" + encodeURIComponent(orderId);

        } catch (error) {
            console.error("Firebase Error:", error);
            alert("Payment failed!\n\n" + error.message);
        }
    });



    // Load Navbar + Cart Count

    fetch("navbar.html")
        .then(res => res.text())
        .then(data => {

            document.getElementById("navbar").innerHTML = data;

            setTimeout(() => {

                onAuthStateChanged(auth, (user) => {
                    if (user) {
                        updateCartCount(user);
                    } else {
                        const cartCount = document.querySelector(".cart-count");
                        if (cartCount) cartCount.innerText = "0";
                    }
                });

            }, 100);

        });

});



// Update Cart Count
async function updateCartCount(user) {

    const snapshot = await getDocs(
        collection(db, "users", user.uid, "cart")
    );

    let totalItems = 0;

    snapshot.forEach(doc => {
        totalItems += doc.data().quantity || 0;
    });

    const cartCount = document.querySelector(".cart-count");

    if (cartCount) {
        cartCount.innerText = totalItems;
    }
}