(function () {
    'use strict';
    const overlay = document.getElementById('portalOverlay');
    if (!overlay) return;
    const cards = Array.from(overlay.querySelectorAll('.portal-season-card'));
    const layers = [document.getElementById('portalBgColor'), document.getElementById('portalBgColorB')];
    const parchment = document.getElementById('portalParchment');
    const enterButton = document.getElementById('portalEnter');
    const reopenButton = document.getElementById('portalReopen');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Resolve assets relative to this script, including when the HTML is opened directly.
    const assetBase = new URL('portal/', document.currentScript.src);
    const backgrounds = Object.fromEntries(cards.map(card => [card.dataset.season, new URL(card.dataset.season + '.jpg', assetBase).href]));
    let active = -1;
    let previewSeason = null;
    let entering = false;
    let baseSeason = seasonToday();
    let previousFocus = null;
    const inertState = new Map();

    function seasonToday() {
        const now = new Date();
        const day = (now.getMonth() + 1) * 100 + now.getDate();
        const terms = solarTerms24.slice().sort((a, b) => a.month * 100 + a.day - b.month * 100 - b.day);
        return terms.filter(term => term.month * 100 + term.day <= day).pop()?.season || 'winter';
    }

    function setBase(season) {
        baseSeason = season;
        const bg = document.getElementById('portalBg');
        bg.style.backgroundImage = 'url("' + backgrounds[season] + '")';
        bg.classList.add('visible');
    }

    function bleedSeason(season, card) {
        if (entering || previewSeason === season) return;
        previewSeason = season;
        const rect = card.getBoundingClientRect();
        const incoming = layers[active < 0 ? 0 : 1 - active];
        incoming.style.setProperty('--mx', ((rect.left + rect.width / 2) / window.innerWidth * 100) + '%');
        incoming.style.setProperty('--my', ((rect.top + rect.height / 2) / window.innerHeight * 100) + '%');
        incoming.style.backgroundImage = 'url("' + backgrounds[season] + '")';
        incoming.classList.add('top', 'bleeding');
        if (active >= 0) layers[active].classList.remove('bleeding', 'top');
        active = layers.indexOf(incoming);
        parchment.classList.add('bleeding');
    }

    function clearBleed() {
        if (entering) return;
        layers.forEach(layer => layer.classList.remove('bleeding', 'top'));
        parchment.classList.remove('bleeding');
        previewSeason = null;
    }

    function lockBackground() {
        Array.from(document.body.children).forEach(element => {
            if (element === overlay || /^(SCRIPT|STYLE|LINK)$/.test(element.tagName)) return;
            inertState.set(element, element.inert);
            element.inert = true;
        });
    }

    function unlockBackground() {
        inertState.forEach((value, element) => { element.inert = value; });
        inertState.clear();
    }

    window.enterPortal = function (season) {
        if (entering || overlay.classList.contains('hidden') || !backgrounds[season]) return;
        entering = true;
        // Update the map under the parchment before revealing it.
        if (typeof window.onPortalEnter === 'function') window.onPortalEnter(season);
        requestAnimationFrame(() => {
            overlay.classList.add('dissolving');
            window.setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.classList.remove('dissolving');
                unlockBackground();
                (previousFocus?.isConnected ? previousFocus : reopenButton).focus({ preventScroll: true });
                overlay.setAttribute('aria-hidden', 'true');
            }, reducedMotion.matches ? 0 : 1150);
        });
    };

    window.reopenPortal = function () {
        if (!overlay.classList.contains('hidden')) return;
        previousFocus = document.activeElement;
        const autoplay = document.getElementById('autoPlayBtn');
        if (autoplay.classList.contains('active')) autoplay.click();
        entering = false;
        clearBleed();
        setBase(currentSeason);
        overlay.classList.remove('hidden', 'dissolving');
        overlay.setAttribute('aria-hidden', 'false');
        lockBackground();
        enterButton.focus({ preventScroll: true });
    };

    cards.forEach(card => {
        card.addEventListener('mouseenter', () => bleedSeason(card.dataset.season, card));
        card.addEventListener('mouseleave', () => { if (document.activeElement !== card) clearBleed(); });
        card.addEventListener('focus', () => bleedSeason(card.dataset.season, card));
        card.addEventListener('blur', clearBleed);
        card.addEventListener('click', () => window.enterPortal(card.dataset.season));
    });
    enterButton.addEventListener('click', () => window.enterPortal(baseSeason));
    reopenButton.addEventListener('click', window.reopenPortal);
    overlay.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const focusable = [...cards, enterButton];
        const index = focusable.indexOf(document.activeElement);
        event.preventDefault();
        focusable[(index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length].focus();
    });
    Object.values(backgrounds).forEach(src => { const img = new Image(); img.src = src; });
    setBase(baseSeason);
    lockBackground();
    enterButton.focus({ preventScroll: true });
})();
