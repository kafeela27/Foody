import { db, auth } from "./firebase.js";

import {
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const cartContainer = document.getElementById("cart-container");

let currentTotal = 0; // track the latest total for checkout

// Load Cart
async function loadCart(user) {

    const snapshot = await getDocs(
        collection(db, "users", user.uid, "cart")
    );

    cartContainer.innerHTML = "";

    let totalItems = 0;
    let subtotal = 0;

    // Empty Cart
    if (snapshot.empty) {

        cartContainer.innerHTML = `
            <div class="empty-cart">
                <h2>Your Cart is Empty</h2>
                <p>Add some delicious food to your cart 🍔🍕🥤</p>
            </div>
        `;

        document.getElementById("subtotal").innerText = "Rs. 0";
        document.getElementById("total").innerText = "Rs. 200";
        currentTotal = 200;

        const cartCount = document.querySelector(".cart-count");

        if (cartCount) {
            cartCount.innerText = "0";
        }

        return;
    }

    snapshot.forEach((cartDoc) => {

        const item = cartDoc.data();

        totalItems += item.quantity;

        let price = parseInt(
            item.price.toString()
                .replace("LKR", "")
                .replace("Rs.", "")
                .replace(/,/g, "")
                .trim()
        );

        const itemTotal = price * item.quantity;

        subtotal += itemTotal;

        cartContainer.innerHTML += `
<div class="cart-item">

    <div class="left-section">

        <img src="${item.image}" alt="${item.name}">

        <div class="item-info">

            <h3>${item.name}</h3>

            <p>Fresh & Delicious Food</p>

            <div class="item-price">
                Rs. ${price.toLocaleString()}
            </div>

        </div>

    </div>

    <div class="right-section">

        <div class="action-row">

            <button class="remove-btn"
                data-id="${cartDoc.id}">
                <i class="ri-delete-bin-6-line"></i>
            </button>

            <div class="quantity-box">

                <button class="decrease-btn"
                    data-id="${cartDoc.id}"
                    data-qty="${item.quantity}">
                    -
                </button>

                <span>${item.quantity}</span>

                <button class="increase-btn"
                    data-id="${cartDoc.id}"
                    data-qty="${item.quantity}">
                    +
                </button>

            </div>

        </div>

        <div class="item-total">
            Rs. ${itemTotal.toLocaleString()}
        </div>

    </div>

</div>
`;
    });

    // Increase Quantity
    document.querySelectorAll(".increase-btn").forEach(btn => {

        btn.onclick = async () => {

            const id = btn.dataset.id;
            const qty = Number(btn.dataset.qty);

            await updateDoc(
                doc(db, "users", user.uid, "cart", id),
                {
                    quantity: qty + 1
                }
            );

            loadCart(user);
        };

    });

    // Decrease Quantity
    document.querySelectorAll(".decrease-btn").forEach(btn => {

        btn.onclick = async () => {

            const id = btn.dataset.id;
            const qty = Number(btn.dataset.qty);

            if (qty > 1) {

                await updateDoc(
                    doc(db, "users", user.uid, "cart", id),
                    {
                        quantity: qty - 1
                    }
                );

            } else {

                await deleteDoc(
                    doc(db, "users", user.uid, "cart", id)
                );

            }

            loadCart(user);
        };

    });

    // Remove Item
    document.querySelectorAll(".remove-btn").forEach(btn => {

        btn.onclick = async () => {

            const id = btn.dataset.id;

            await deleteDoc(
                doc(db, "users", user.uid, "cart", id)
            );

            loadCart(user);
        };

    });

    // Cart Count
    const cartCount = document.querySelector(".cart-count");

    if (cartCount) {
        cartCount.innerText = totalItems;
    }

    // Summary
    const deliveryFee = 200;
    const total = subtotal + deliveryFee;

    currentTotal = total; // save for checkout

    document.getElementById("subtotal").innerText =
        "Rs. " + subtotal.toLocaleString();

    document.getElementById("total").innerText =
        "Rs. " + total.toLocaleString();
}

// Wait until Firebase knows the logged-in user
onAuthStateChanged(auth, (user) => {

    if (user) {

        loadCart(user);

    } else {

        alert("Logged out successfully");
        window.location.href = "signin.html";

    }

});


// Proceed to Checkout — save total and go to payment page
document.getElementById("checkoutBtn")?.addEventListener("click", () => {

    if (currentTotal <= 200) {
        alert("Your cart is empty!");
        return;
    }

    localStorage.setItem("totalAmount", currentTotal);
    window.location.href = "payment.html";

});