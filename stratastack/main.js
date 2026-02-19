/*
+ Added: sticky nav state + active-section highlighting for internal anchors (#top, #why, #capabilities, #work, #stack, #naics, #contact)
+ Added: IntersectionObserver reveal animation initialization with reduced-motion fallback
+ Added: contact form/email configuration helper for static deployment
+ Added: copy-to-clipboard utility (currently wired for contact email)
+ Added: capability statement modal using <dialog> with accessible fallback modal
+ Added: back-to-top button behavior and shared scroll handling
+
+ Configure Formspree endpoint:
+   CONFIG.formspreeEndpoint
+
+ Configure contact email (used in mailto link + copy button + modal text):
+   CONFIG.contactEmail
+   CONFIG.contactPhone
*/
(function () {
    'use strict';

    const CONFIG = {
        formspreeEndpoint: 'https://formspree.io/f/XXXXXXXX',
        contactEmail: 'contact@stratastacksolutions.com',
        contactPhone: '(301) 830-2277'
    };

    const state = {
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    };

    function rafThrottle(fn) {
        let ticking = false;
        return function throttled() {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                fn();
                ticking = false;
            });
        };
    }

    function initContactConfiguration() {
        const emailLink = document.getElementById('contactEmailLink');
        if (emailLink) {
            emailLink.href = `mailto:${CONFIG.contactEmail}`;
            emailLink.textContent = CONFIG.contactEmail;
        }

        const form = document.querySelector('.contact-form');
        if (form) {
            form.setAttribute('action', CONFIG.formspreeEndpoint);
        }

        const modalContactNodes = document.querySelectorAll('.modal-content p.muted');
        modalContactNodes.forEach((node) => {
            if (node.textContent && node.textContent.includes('contact@')) {
                node.textContent = `${CONFIG.contactEmail} · Maryland, USA`;
            }
        });
    }

    function initStickyNav() {
        const header = document.querySelector('header');
        const navLinks = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
        if (!header || !navLinks.length) return;

        const targets = navLinks
            .map((link) => {
                const id = link.getAttribute('href');
                if (!id) return null;
                const el = document.querySelector(id);
                if (!el) return null;
                return { link, el };
            })
            .filter(Boolean);

        if (!targets.length) return;

        const update = () => {
            const y = window.scrollY;
            header.classList.toggle('scrolled', y > 4);

            const marker = y + header.offsetHeight + 18;
            let active = targets[0];

            for (let i = 0; i < targets.length; i += 1) {
                if (targets[i].el.offsetTop <= marker) {
                    active = targets[i];
                } else {
                    break;
                }
            }

            targets.forEach(({ link }) => {
                link.classList.toggle('active', link === active.link);
                if (link === active.link) {
                    link.setAttribute('aria-current', 'page');
                } else {
                    link.removeAttribute('aria-current');
                }
            });
        };

        const throttledUpdate = rafThrottle(update);
        window.addEventListener('scroll', throttledUpdate, { passive: true });
        window.addEventListener('resize', throttledUpdate);
        update();
    }

    function initSectionReveal() {
        const revealEls = document.querySelectorAll('.reveal');
        if (!revealEls.length) return;

        if (state.reducedMotion || !('IntersectionObserver' in window)) {
            revealEls.forEach((el) => el.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

        revealEls.forEach((el) => observer.observe(el));
    }

    function initCopyToClipboard() {
        const buttons = document.querySelectorAll('[data-copy-target]');
        if (!buttons.length) return;

        buttons.forEach((button) => {
            button.addEventListener('click', async () => {
                const selector = button.getAttribute('data-copy-target');
                if (!selector) return;
                const target = document.querySelector(selector);
                if (!target) return;

                const href = target.getAttribute('href') || '';
                const value = href.startsWith('mailto:')
                    ? href.replace('mailto:', '')
                    : (target.textContent || '').trim();
                if (!value) return;

                const original = button.textContent;
                try {
                    await navigator.clipboard.writeText(value);
                    button.textContent = 'Copied';
                } catch (_err) {
                    button.textContent = 'Copy failed';
                }

                window.setTimeout(() => {
                    button.textContent = original;
                }, 1500);
            });
        });
    }

    function getFocusableElements(container) {
        if (!container) return [];
        const selectors = [
            'a[href]',
            'button:not([disabled])',
            'textarea:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(',');
        return Array.from(container.querySelectorAll(selectors));
    }

    function initModal() {
        const openButtons = document.querySelectorAll('[data-open-capability]');
        if (!openButtons.length) return;

        const dialog = document.getElementById('capabilityDialog');
        const fallback = document.getElementById('capabilityFallback');
        const fallbackPanel = fallback ? fallback.querySelector('.modal-panel') : null;
        const closeButtons = document.querySelectorAll('[data-close-capability]');
        let lastFocused = null;

        const supportsDialog = !!(dialog && typeof dialog.showModal === 'function');

        function openDialog() {
            lastFocused = document.activeElement;
            if (!dialog) return;
            dialog.showModal();
            const first = getFocusableElements(dialog)[0];
            if (first) first.focus();
        }

        function closeDialog() {
            if (dialog && dialog.open) {
                dialog.close();
            }
            if (lastFocused && typeof lastFocused.focus === 'function') {
                lastFocused.focus();
            }
        }

        function openFallback() {
            if (!fallback || !fallbackPanel) return;
            lastFocused = document.activeElement;
            fallback.hidden = false;
            document.body.style.overflow = 'hidden';
            const first = getFocusableElements(fallbackPanel)[0] || fallbackPanel;
            first.focus();
        }

        function closeFallback() {
            if (!fallback) return;
            fallback.hidden = true;
            document.body.style.overflow = '';
            if (lastFocused && typeof lastFocused.focus === 'function') {
                lastFocused.focus();
            }
        }

        function trapFallbackFocus(event) {
            if (!fallback || fallback.hidden || !fallbackPanel) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                closeFallback();
                return;
            }
            if (event.key !== 'Tab') return;

            const focusables = getFocusableElements(fallbackPanel);
            if (!focusables.length) {
                event.preventDefault();
                return;
            }

            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        openButtons.forEach((button) => {
            button.addEventListener('click', () => {
                if (supportsDialog) openDialog();
                else openFallback();
            });
        });

        closeButtons.forEach((button) => {
            button.addEventListener('click', () => {
                if (supportsDialog) closeDialog();
                else closeFallback();
            });
        });

        if (dialog) {
            dialog.addEventListener('cancel', (event) => {
                event.preventDefault();
                closeDialog();
            });
            dialog.addEventListener('click', (event) => {
                const rect = dialog.getBoundingClientRect();
                const inside = (
                    rect.top <= event.clientY
                    && event.clientY <= rect.top + rect.height
                    && rect.left <= event.clientX
                    && event.clientX <= rect.left + rect.width
                );
                if (!inside) closeDialog();
            });
        }

        if (fallback) {
            fallback.addEventListener('click', (event) => {
                const closeTrigger = event.target.closest('[data-close-capability]');
                if (closeTrigger) {
                    closeFallback();
                }
            });
            document.addEventListener('keydown', trapFallbackFocus);
        }
    }

    function initBackToTop() {
        const button = document.getElementById('backToTop');
        if (!button) return;

        const toggle = () => {
            button.classList.toggle('is-visible', window.scrollY > 600);
        };

        const throttledToggle = rafThrottle(toggle);
        window.addEventListener('scroll', throttledToggle, { passive: true });
        toggle();

        button.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: state.reducedMotion ? 'auto' : 'smooth' });
        });
    }

    function initYear() {
        const year = document.getElementById('y');
        if (year) year.textContent = new Date().getFullYear();
    }

    function init() {
        initYear();
        initContactConfiguration();
        initStickyNav();
        initSectionReveal();
        initCopyToClipboard();
        initModal();
        initBackToTop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
