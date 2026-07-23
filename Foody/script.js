// Load Navbar
fetch("navbar.html")
    .then(res => res.text())
    .then(data => {
        document.getElementById("navbar").innerHTML = data;

        // After navbar is loaded → attach events
        setupNavbar();
        window.dispatchEvent(new Event("navbarLoaded"));
    });

function smoothScrollTo(targetElement, duration = 3200) {
    const startY = window.scrollY || window.pageYOffset;
    const targetY = targetElement.getBoundingClientRect().top + startY;
    const distance = targetY - startY;
    const startTime = performance.now();

    function easeInOutCubic(t) {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeInOutCubic(progress);

        window.scrollTo(0, startY + distance * easedProgress);

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
}

document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");

    if (!link) {
        return;
    }

    const targetUrl = new URL(link.getAttribute("href"), window.location.href);
    const currentUrl = new URL(window.location.href);

    if (targetUrl.origin !== currentUrl.origin || targetUrl.pathname !== currentUrl.pathname || !targetUrl.hash) {
        return;
    }

    const targetSection = document.querySelector(targetUrl.hash);

    if (!targetSection) {
        return;
    }

    event.preventDefault();
    smoothScrollTo(targetSection, 1000);
    window.history.replaceState(null, "", targetUrl.hash);
});

function setupNavbar() {

    // Mobile menu toggle
    const toggle = document.getElementById("menu-toggle");
    const navLinks = document.querySelector(".nav-links");

    if (toggle && navLinks) {
        toggle.addEventListener("click", () => {
            navLinks.classList.toggle("active");
        });
    }
}
