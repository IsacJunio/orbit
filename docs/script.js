document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    init3DTilt();
    initSmoothScroll();
});

// Particle System
function initParticles() {
    const container = document.getElementById('particles');
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        createParticle(container);
    }
}

function createParticle(container) {
    const particle = document.createElement('div');
    particle.classList.add('particle');

    // Random properties
    const size = Math.random() * 3 + 1;
    const posX = Math.random() * 100;
    const duration = Math.random() * 20 + 10;
    const delay = Math.random() * 5;

    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${posX}%`;
    particle.style.animationDuration = `${duration}s`;
    particle.style.animationDelay = `-${delay}s`;

    container.appendChild(particle);
}

// 3D Tilt Effect
function init3DTilt() {
    const hero = document.querySelector('.hero');
    const device = document.querySelector('.device-frame');

    if (!hero || !device) return;

    hero.addEventListener('mousemove', (e) => {
        const { clientX, clientY } = e;
        const { left, top, width, height } = hero.getBoundingClientRect();

        // Calculate center of hero section
        const centerX = left + width / 2;
        const centerY = top + height / 2;

        // Calculate distance from center (normalized -1 to 1)
        const percentX = (clientX - centerX) / (width / 2);
        const percentY = (clientY - centerY) / (height / 2);

        // Max rotation degrees
        const maxRotateY = 10; // Left/Right tilt
        const maxRotateX = 10; // Up/Down tilt

        // Invert Y axis for natural feel
        const rotateY = percentX * maxRotateY;
        const rotateX = -percentY * maxRotateX;

        // Apply transform
        device.style.transform = `
            perspective(1000px)
            rotateX(${rotateX}deg)
            rotateY(${rotateY}deg)
            scale3d(1.02, 1.02, 1.02)
        `;
    });

    // Reset on mouse leave
    hero.addEventListener('mouseleave', () => {
        device.style.transform = `
            perspective(1000px)
            rotateX(5deg)
            rotateY(-10deg)
            scale3d(1, 1, 1)
        `;
    });
}

// Smooth Scroll for anchor links
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
}
