import { auth, db } from "./firebase.js";

import {
    collection, addDoc, getDocs, getDoc,
    doc, deleteDoc, updateDoc,
    onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";


// Icon helper — renders a small Lucide SVG icon as an inline <img>
// Browse names at https://lucide.dev/icons/
function icon(name, size = 16) {
    return `<img src="https://unpkg.com/lucide-static@latest/icons/${name}.svg" width="${size}" height="${size}" alt="${name}" style="vertical-align:middle;display:inline-block;">`;
}


// just strips commas and currency symbols then parses
function toNumber(price) {
    let clean = String(price).replace(/,/g, "").replace(/[^0-9.]/g, "");
    return parseFloat(clean) || 0;
}

function formatItems(order) {
    let items = order.orderedItems || order.items || [];
    if (!items.length) return "—";
    return items.map(i => i.name + " x" + (i.quantity || i.qty || 1)).join(", ");
}


// redirect if not logged in
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
        const data = userDoc.data();
        const nameEl = document.getElementById("adminName");
        if (nameEl) nameEl.textContent = data.name || user.email.split("@")[0];

        if (data.role !== "admin") {
            alert("Access denied. Admins only.");
            window.location.href = "index.html";
            return;
        }
    }

    loadDashboard();
    listenOrders();
    loadMenuItems();
    loadUsers();
});


document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "signin.html";
});


// sidebar navigation
document.querySelectorAll(".sidebar-nav li").forEach(li => {
    li.addEventListener("click", () => {
        document.querySelectorAll(".sidebar-nav li").forEach(l => l.classList.remove("active"));
        li.classList.add("active");
        showSection(li.dataset.section);
    });
});

function showSection(name) {
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    let target = document.getElementById("sec-" + name);
    if (target) {
        target.classList.add("active");
        document.querySelector(".main").scrollTo({ top: 0, behavior: "smooth" });
    }
}


async function loadDashboard() {
    const ordersSnap = await getDocs(collection(db, "orders"));
    const menuSnap = await getDocs(collection(db, "foods"));

    const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let total = orders.length;
    let pending = 0, preparing = 0, ready = 0, delivered = 0, revenue = 0;

    orders.forEach(o => {
        if (o.status === "Pending") pending++;
        if (o.status === "Preparing") preparing++;
        if (o.status === "Ready") ready++;
        if (o.status === "Delivered") delivered++;

        // count revenue if paid or has a payment method
        if (o.status === "Paid" || o.paymentMethod) {
            revenue += toNumber(o.totalAmount);
        }
    });

    let totalEl = document.getElementById("totalOrders");
    if (totalEl) totalEl.textContent = total;

    let pendingEl = document.getElementById("pendingOrders");
    if (pendingEl) pendingEl.textContent = pending;

    let menuEl = document.getElementById("totalMenuItems");
    if (menuEl) menuEl.textContent = menuSnap.size;

    let revEl = document.getElementById("totalRevenue");
    if (revEl) revEl.textContent = "Rs." + revenue.toLocaleString();

    // progress bars
    updateBar("barPending", "countPending", pending, total);
    updateBar("barPreparing", "countPreparing", preparing, total);
    updateBar("barReady", "countReady", ready, total);
    updateBar("barDelivered", "countDelivered", delivered, total);

    // last 5 orders sorted by time
    const sorted = [...orders].sort((a, b) => {
        const getTime = (o) => {
            if (o.createdAt?.seconds) return o.createdAt.seconds * 1000; // Firestore Timestamp
            if (o.createdAt) return new Date(o.createdAt).getTime();    // ISO string
            return 0;
        };
        return getTime(b) - getTime(a);
    });
    const recent = sorted.slice(0, 5);

    const tbody = document.getElementById("recentOrdersBody");
    if (tbody) {
        if (!recent.length) {
            tbody.innerHTML = `<tr><td colspan="4" class="no-data">No orders yet.</td></tr>`;
        } else {
            tbody.innerHTML = recent.map(o => `
                <tr>
                   <td><span class="order-id">${o.orderId || o.id.slice(0, 8).toUpperCase()}</span></td>
                    <td>${o.customerName || "—"}</td>
                    <td>Rs.${toNumber(o.totalAmount).toLocaleString()}</td>
                    <td>${makeStatusBadge(o.status)}</td>
                </tr>
            `).join("");
        }
    }

    const feed = document.getElementById("paymenthisContainer");
    if (feed) {
        if (!recent.length) {
            feed.innerHTML = `<div class="no-data">No recent activity.</div>`;
        } else {
            feed.innerHTML = recent.map(o => `
                <div class="activity-item">
                    <div class="activity-dot">${icon("credit-card", 18)}</div>
                    <div class="activity-body">
                        <div class="activity-title">Order from ${o.customerName || "Customer"}</div>
                        <div class="activity-meta">
                           #${o.orderId || o.id.slice(0, 8).toUpperCase()} · Rs.${toNumber(o.totalAmount).toLocaleString()} · ${o.paymentMethod || "—"} · ${o.status || "Pending"}
                        </div>
                    </div>
                </div>
            `).join("");
        }
    }

    // top selling items
    const itemCount = {};
    orders.forEach(o => {
        (o.orderedItems || []).forEach(i => {
            if (!itemCount[i.name]) itemCount[i.name] = 0;
            itemCount[i.name] += i.quantity || 1;
        });
    });

    const topItems = Object.entries(itemCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const topList = document.getElementById("topItemsList");
    if (topList) {
        if (!topItems.length) {
            topList.innerHTML = `<p class="no-data">No order data yet.</p>`;
        } else {
            topList.innerHTML = topItems.map(([name, qty], i) => `
                <div class="top-item-row">
                    <span class="top-rank">#${i + 1}</span>
                    <span class="top-name">${name}</span>
                    <span class="top-qty">${qty} orders</span>
                </div>
            `).join("");
        }
    }
}


let allOrders = [];

function listenOrders() {
    onSnapshot(collection(db, "orders"), snap => {
        allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderOrders(allOrders);
        loadDashboard();
    });
}

function renderOrders(orders) {
    const tbody = document.getElementById("allOrdersBody");
    if (!tbody) return;

    if (!orders.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="no-data">No orders found.</td></tr>`;
        return;
    }
    tbody.innerHTML = orders.map(o => {
        const itemsStr = formatItems(o);
        return `
            <tr>
                <td><span class="order-id">${o.orderId || o.id.slice(0, 8).toUpperCase()}</span></td>
                <td>${o.customerName || "—"}</td>
                <td>${o.phone || o.address || "—"}</td>
                <td class="items-cell">${itemsStr}</td>
                <td>Rs.${toNumber(o.totalAmount).toLocaleString()}</td>
                <td>${makeStatusBadge(o.status)}</td>
                <td>
                    <select class="status-select" data-id="${o.id}">
                        <option value="Pending"   ${o.status === "Pending" ? "selected" : ""}>Pending</option>
                        <option value="Preparing" ${o.status === "Preparing" ? "selected" : ""}>Preparing</option>
                        <option value="Ready"     ${o.status === "Ready" ? "selected" : ""}>Ready</option>
                        <option value="Delivered" ${o.status === "Delivered" ? "selected" : ""}>Delivered</option>
                        <option value="Paid"      ${o.status === "Paid" ? "selected" : ""}>Paid</option>
                    </select>
                </td>
            </tr>
        `;
    }).join("");

    document.querySelectorAll(".status-select").forEach(sel => {
        sel.addEventListener("change", async e => {
            const id = e.target.dataset.id;
            const status = e.target.value;
            const order = allOrders.find(o => o.id === id);
            const displayId = order?.orderId || id.slice(0, 8).toUpperCase();
            await updateDoc(doc(db, "orders", id), { status });
            showToast("Order " + displayId + " updated to " + status, "success");
        });
    });
}



document.getElementById("orderStatusFilter")?.addEventListener("change", filterOrders);
document.getElementById("orderSearch")?.addEventListener("input", filterOrders);

function filterOrders() {
    const status = document.getElementById("orderStatusFilter").value;
    const search = document.getElementById("orderSearch").value.toLowerCase();

    const filtered = allOrders.filter(o => {
        const matchStatus = !status || o.status === status;
        const matchSearch = !search || (o.customerName || "").toLowerCase().includes(search);
        return matchStatus && matchSearch;
    });

    renderOrders(filtered);
}


let allMenuItems = [];

async function loadMenuItems() {
    const snap = await getDocs(collection(db, "foods"));
    allMenuItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMenu(allMenuItems);
}

function renderMenu(items) {
    const grid = document.getElementById("menuGrid");
    if (!grid) return;

    if (!items.length) {
        grid.innerHTML = `<p class="no-data">No menu items yet. Add one!</p>`;
        return;
    }

    grid.innerHTML = items.map(item => buildMenuCard(item)).join("");
}

function buildMenuCard(item) {
    return `
        <div class="menu-card">
            <div class="menu-img-wrap">
                <img
                    src="${item.image}"
                    alt="${item.name}"
                    class="menu-img"
                    onerror="this.src='https://via.placeholder.com/200x130?text=No+Image'"
                >
                <span class="menu-cat-tag">${item.category}</span>
            </div>
            <div class="menu-body">
                <div class="menu-name">${item.name}</div>
                <div class="menu-desc">${item.description}</div>
                <div class="menu-price">Rs. ${toNumber(item.price).toLocaleString()} <span>/ serving</span></div>
            </div>
            <div class="menu-actions">
                <button class="btn-edit"   onclick="editItem('${item.id}')">${icon("pencil", 14)} Edit</button>
                <button class="btn-delete" onclick="deleteItem('${item.id}', '${item.name.replace(/'/g, "\\'")}')">
                    ${icon("trash-2", 14)} Delete
                </button>
            </div>
        </div>
    `;
}

document.getElementById("menuSearch")?.addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    renderMenu(allMenuItems.filter(item =>
        item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    ));
});


function updatePreview() {
    const name = document.getElementById("foodName").value.trim();
    const price = document.getElementById("foodPrice").value;
    const cat = document.getElementById("foodCategory").value;
    const image = document.getElementById("foodImage").value.trim();
    const desc = document.getElementById("foodDesc").value.trim();
    const avail = document.getElementById("foodAvailable").value;
    const box = document.getElementById("previewBox");

    if (!name && !price && !cat) {
        box.innerHTML = `
            <div class="preview-empty">
                <div class="preview-empty-icon">${icon("utensils", 32)}</div>
                <p>Fill in the form to see a preview of your menu card.</p>
            </div>`;
        return;
    }

    const imgHtml = image
        ? `<img src="${image}" class="menu-img" alt="preview" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : "";

    box.innerHTML = `
        <div class="preview-menu-card">
            <div class="menu-img-wrap">
                ${imgHtml}
                <div class="menu-img-placeholder" style="${image ? "display:none" : ""}">${icon("utensils", 32)}</div>
                ${cat ? `<span class="menu-cat-tag">${cat}</span>` : ""}
            </div>
            <div class="menu-body">
                <div class="menu-name">${name || "Food Name"}</div>
                <div class="menu-desc">${desc || "No description yet."}</div>
                <div class="menu-footer">
                    <div class="menu-price">Rs. ${price ? Number(price).toLocaleString() : "0"}</div>
                    <span class="menu-avail ${avail === "true" ? "avail-yes" : "avail-no"}">
                        ${avail === "true"
            ? icon("circle-check", 14) + " Available"
            : icon("circle-x", 14) + " Unavailable"}
                    </span>
                </div>
            </div>
        </div>`;
}

["foodName", "foodPrice", "foodCategory", "foodImage", "foodDesc", "foodAvailable"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", updatePreview);
    document.getElementById(id)?.addEventListener("change", updatePreview);
});


document.getElementById("saveItemBtn")?.addEventListener("click", async () => {
    const name = document.getElementById("foodName").value.trim();
    const price = document.getElementById("foodPrice").value;
    const category = document.getElementById("foodCategory").value;
    const image = document.getElementById("foodImage").value.trim();
    const desc = document.getElementById("foodDesc").value.trim();
    const editId = document.getElementById("editItemId").value;

    if (!name || !category || !price || !image || !desc) {
        showFormMsg("Please fill in all required fields.", "error");
        return;
    }

    const data = { name, price: Number(price), category, image, description: desc };

    try {
        if (editId) {
            await updateDoc(doc(db, "foods", editId), data);
            showFormMsg("Item updated successfully!", "success");
            showToast("Menu item updated.", "success");
        } else {
            data.createdAt = serverTimestamp();
            await addDoc(collection(db, "foods"), data);
            showFormMsg("Item added successfully!", "success");
            showToast("New item added to menu.", "success");
        }
        clearForm();
        loadMenuItems();
        loadDashboard();
    } catch (err) {
        showFormMsg("Error: " + err.message, "error");
    }
});

document.getElementById("clearFormBtn")?.addEventListener("click", clearForm);

function clearForm() {
    ["editItemId", "foodName", "foodPrice", "foodImage", "foodDesc"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    const cat = document.getElementById("foodCategory");
    if (cat) cat.value = "";

    const avail = document.getElementById("foodAvailable");
    if (avail) avail.value = "true";

    const title = document.getElementById("formTitle");
    if (title) title.textContent = "Add New Food Item";

    const msg = document.getElementById("formMsg");
    if (msg) {
        msg.textContent = "";
        msg.className = "form-msg";
    }

    updatePreview();
}


window.editItem = async (id) => {
    const snap = await getDoc(doc(db, "foods", id));
    if (!snap.exists()) return;

    const d = snap.data();
    document.getElementById("editItemId").value = id;
    document.getElementById("foodName").value = d.name || "";
    document.getElementById("foodCategory").value = d.category || "";
    document.getElementById("foodPrice").value = d.price || "";
    document.getElementById("foodImage").value = d.image || "";
    document.getElementById("foodDesc").value = d.description || "";

    const title = document.getElementById("formTitle");
    if (title) title.textContent = "Edit Food Item";

    document.querySelectorAll(".sidebar-nav li").forEach(l => l.classList.remove("active"));
    document.querySelector('[data-section="add-item"]').classList.add("active");
    showSection("add-item");
    updatePreview();
};


window.deleteItem = async (id, name) => {
    if (!confirm('Delete "' + name + '"? This cannot be undone.')) return;
    await deleteDoc(doc(db, "foods", id));
    showToast('"' + name + '" deleted from menu.', "success");
    loadMenuItems();
    loadDashboard();
};


async function loadUsers() {
    const snap = await getDocs(collection(db, "users"));
    const tbody = document.getElementById("usersBodyFull");
    if (!tbody) return;

    if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="5" class="no-data">No users found.</td></tr>`;
        return;
    }

    const rows = await Promise.all(snap.docs.map(async d => {
        const u = d.data();
        const initial = (u.name || u.email || "?")[0].toUpperCase();

        let cartQty = 0;
        try {
            const cartSnap = await getDocs(collection(db, "users", d.id, "cart"));
            cartSnap.docs.forEach(cartDoc => {
                cartQty += cartDoc.data().quantity || 1;
            });
        } catch (e) {
            // cart subcollection might not exist yet, that's fine
        }

        // match by uid or fall back to email match
        const userOrders = allOrders.filter(o => o.uid === d.id || o.customerName === u.email);

        const cartDisplay = cartQty > 0
            ? `<span class="badge badge-pending">${icon("shopping-cart", 13)} ${cartQty} item${cartQty !== 1 ? "s" : ""}</span>`
            : `<span style="color:var(--text-muted);font-size:12px">Empty</span>`;

        return `
            <tr>
                <td><span class="order-id">${d.id.slice(0, 10)}…</span></td>
                <td><span class="user-avatar">${initial}</span>${u.name || u.displayName || "—"}</td>
                <td>${u.email || "—"}</td>
                <td>${userOrders.length}</td>
                <td>${cartDisplay}</td>
            </tr>
        `;
    }));

    tbody.innerHTML = rows.join("");
}


document.getElementById("modalClose")?.addEventListener("click", () => {
    document.getElementById("modalOverlay").classList.remove("show");
});

document.getElementById("modalOverlay")?.addEventListener("click", e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove("show");
});


function makeStatusBadge(status) {
    const classes = {
        Pending: "badge-pending",
        Preparing: "badge-preparing",
        Ready: "badge-ready",
        Delivered: "badge-delivered",
        Paid: "badge-delivered"
    };
    // Lucide icon name per status
    const icons = {
        Pending: "clock",
        Preparing: "chef-hat",
        Ready: "circle-check",
        Delivered: "truck",
        Paid: "banknote"
    };
    const cls = classes[status] || "badge-pending";
    const iconName = icons[status] || "clock";
    return `<span class="badge ${cls}">${icon(iconName, 13)} ${status || "Pending"}</span>`;
}

function updateBar(barId, countId, count, total) {
    const pct = total ? Math.round((count / total) * 100) : 0;
    const bar = document.getElementById(barId);
    const cnt = document.getElementById(countId);
    if (bar) bar.style.width = pct + "%";
    if (cnt) cnt.textContent = count;
}

function showFormMsg(msg, type) {
    const el = document.getElementById("formMsg");
    if (!el) return;
    el.textContent = msg;
    el.className = "form-msg " + type + " show";
    setTimeout(() => {
        el.textContent = "";
        el.className = "form-msg";
    }, 4000);
}

function showToast(msg, type) {
    type = type || "default";
    const iconMap = { success: "circle-check", error: "circle-x", default: "info" };
    const t = document.createElement("div");
    t.className = "toast toast-" + type;
    t.innerHTML = `<span class="toast-icon">${icon(iconMap[type], 16)}</span>${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3100);
}