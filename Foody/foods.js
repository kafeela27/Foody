import { db, auth } from "./firebase.js";
import { updateCartCount } from "./cartCount.js";
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const foodContainer = document.getElementById("food-container");
const buttons = document.querySelectorAll(".category-filter button");



let allFoods = []; // store all foods from Firebase

//  Load foods from firebase
async function loadFoods() {

    const querySnapshot = await getDocs(collection(db, "foods"));

    allFoods = [];

    querySnapshot.forEach((doc) => {
        allFoods.push(doc.data());
    });

    displayFoods(allFoods);
}

// Display foods
function displayFoods(foods) {

    foodContainer.innerHTML = "";

    foods.forEach((food, index) => {

        foodContainer.innerHTML += `
            <div class="food-card">
                <img src="${food.image}" alt="${food.name}">
                <h3>${food.name}</h3>
                <p>${food.description}</p>

                <div class="food-footer">
                    <span>Rs. ${food.price}</span>
                    <button class="cart-btn" data-index="${index}">
                        Add to Cart
                    </button>
                </div>
            </div>
        `;
    });

    document.querySelectorAll(".cart-btn").forEach(btn => {

        btn.addEventListener("click", async () => {

            const food = foods[btn.dataset.index];
            await auth.authStateReady();

            const user = auth.currentUser;

            if (!user) {
                alert("Please login first.");
                window.location.href = "signin.html";
                return;
            }

            const cartRef = collection(db, "users", user.uid, "cart");

            // Check if this food already exists
            const q = query(cartRef, where("name", "==", food.name));

            const snapshot = await getDocs(q);

            if (!snapshot.empty) {

                const cartDoc = snapshot.docs[0];

                const currentQty = cartDoc.data().quantity;

                await updateDoc(cartDoc.ref, {
                    quantity: currentQty + 1
                });

            } else {

                await addDoc(cartRef, {
                    name: food.name,
                    image: food.image,
                    price: food.price,
                    quantity: 1
                });

            }

            alert("Added to Cart!");

            await updateCartCount(user);

            window.location.href = "cart.html";
        });

    });
}

//  Filter foods
function filterFoods(category) {

    if (category === "all") {
        displayFoods(allFoods);
    } else {
        const filteredFoods = allFoods.filter(
            (food) => food.category === category
        );

        displayFoods(filteredFoods);
    }
}

//  Category button events
buttons.forEach((btn) => {

    btn.addEventListener("click", () => {

        // remove active class from all buttons
        buttons.forEach(b => b.classList.remove("active"));

        // add active to clicked button
        btn.classList.add("active");

        const category = btn.getAttribute("data-category");
        filterFoods(category);
    });
});

//  Init
loadFoods();