import { db } from "./firebase.js";
import {
    collection,
    doc,
    getDocs,
    onSnapshot,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import {
    auth
} from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

// Define the order of steps in the tracking timeline
const STEPS = [
    { key: "Pending",   icon: "ri-file-list-3-line" },
    { key: "Preparing", icon: "ri-restaurant-2-line" },
    { key: "Ready",     icon: "ri-checkbox-circle-line" },
    { key: "Delivered", icon: "ri-truck-line" }
];

// Title + description shown for each step
const STEP_DETAILS = {
    Pending:   { title: "Order Placed",  desc: "We've received your order." },
    Preparing: { title: "Preparing",     desc: "Your food is being cooked fresh." },
    Ready:     { title: "Ready",         desc: "Your order is packed and ready for delivery." },
    Delivered: { title: "Delivered",     desc: "Enjoy your meal!" }
};

// "Paid" is treated the same stage as "Pending" for timeline purposes
function normalizeStatus(status) {
    if (status === "Paid") return "Pending";
    return status || "Pending";
}

function isDelivered(status) {
    return normalizeStatus(status) === "Delivered";
}

function showOrderNotFound(statusHeadline, orderIdText, orderAddress, timelineCard) {
    statusHeadline.textContent = "Order not found.";
    orderIdText.textContent = "-";
    orderAddress.textContent = "-";
    timelineCard.innerHTML = "";
}

function renderTrackedOrder(data, orderIdText, statusHeadline, orderAddress, timelineCard) {
    const currentStatus = normalizeStatus(data.status);

    orderAddress.textContent = data.address || "-";

    const headlineMap = {
        Pending:   "Your order has been placed!",
        Preparing: "Your food is being prepared",
        Ready:     "Your order is ready!",
        Delivered: "Your order has been delivered"
    };

    statusHeadline.textContent = headlineMap[currentStatus] || "Tracking your order...";
    renderTimeline(currentStatus, timelineCard);
}

document.addEventListener("DOMContentLoaded", () => {
    const menuToggle = document.getElementById("menu-toggle");
    const navLinks = document.querySelector(".nav-links");

    if (menuToggle && navLinks) {
        menuToggle.addEventListener("click", () => {
            navLinks.classList.toggle("active");
        });
    }

    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("orderId");

    const orderIdText    = document.getElementById("orderIdText");
    const statusHeadline = document.getElementById("statusHeadline");
    const orderAddress   = document.getElementById("orderAddress");
    const timelineCard   = document.getElementById("timelineCard");

    if (!orderId) {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                statusHeadline.textContent = "Please sign in to track your order.";
                timelineCard.innerHTML = "";
                return;
            }

            await loadLatestOrderForUser(user.uid, orderIdText, statusHeadline, orderAddress, timelineCard);
        });
        return;
    }

    orderIdText.textContent = orderId;

    // Listen live — updates automatically when admin changes status
    onSnapshot(doc(db, "orders", orderId), (snap) => {
        if (!snap.exists()) {
            showOrderNotFound(statusHeadline, orderIdText, orderAddress, timelineCard);
            return;
        }

        renderTrackedOrder(snap.data(), orderIdText, statusHeadline, orderAddress, timelineCard);
    }, (error) => {
        console.error("Tracking error:", error);
        statusHeadline.textContent = "Unable to load order status.";
    });
});

async function loadLatestOrderForUser(uid, orderIdText, statusHeadline, orderAddress, timelineCard) {
    try {
        onSnapshot(
            query(
                collection(db, "orders"),
                where("uid", "==", uid)
            ),
            (snap) => {
                if (snap.empty) {
                    showOrderNotFound(statusHeadline, orderIdText, orderAddress, timelineCard);
                    return;
                }

                const orders = snap.docs.map((orderDoc) => orderDoc.data());

                orders.sort((a, b) => {
                    const getTime = (order) => {
                        if (order.createdAt?.seconds) return order.createdAt.seconds * 1000;
                        if (order.createdAt) return new Date(order.createdAt).getTime();
                        return 0;
                    };

                    return getTime(b) - getTime(a);
                });

                const latestOrder = orders[0];

                if (!latestOrder?.orderId) {
                    showOrderNotFound(statusHeadline, orderIdText, orderAddress, timelineCard);
                    return;
                }

                orderIdText.textContent = latestOrder.orderId;
                renderTrackedOrder(latestOrder, orderIdText, statusHeadline, orderAddress, timelineCard);
            },
            (error) => {
                console.error("Tracking error:", error);
                statusHeadline.textContent = "Unable to load order status.";
            }
        );
    } catch (error) {
        console.error("Latest order lookup error:", error);
        showOrderNotFound(statusHeadline, orderIdText, orderAddress, timelineCard);
    }
}


function renderTimeline(currentStatus, container) {
    const currentIndex = STEPS.findIndex(s => s.key === currentStatus);

    container.innerHTML = STEPS.map((step, i) => {
        let stateClass = "";
        if (i < currentIndex) stateClass = "done";
        if (i === currentIndex) stateClass = "current";

        const detail = STEP_DETAILS[step.key];

        return `
            <div class="timeline-step ${stateClass}">
                <div class="line"></div>
                <div class="icon-circle"><i class="${step.icon}"></i></div>
                <div class="step-info">
                    <h4>${detail.title}</h4>
                    <p>${detail.desc}</p>
                </div>
            </div>
        `;
    }).join("");
}

