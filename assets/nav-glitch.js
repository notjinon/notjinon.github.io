(function () {
    const glyphs = ['D', 'F', 'W', 'S', 'F', 'O', 'E', 'W', 'R', 'O', 'R', 'D', 'L', 'A', 'F', 'M', 'N', 'L', 'P', 'V', 'G', 'A', 'M', 'S', 'H', 'N', 'D', 'N', 'R', 'T', 'A', 'T', 'H', 'V', 'C', 'E', '@', ',', '/'];
    const menuButton = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.site-nav');

    if (menuButton && nav) {
        menuButton.addEventListener('click', () => {
            const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
            menuButton.setAttribute('aria-expanded', String(!isOpen));
            nav.classList.toggle('is-open', !isOpen);
        });

        nav.addEventListener('click', (event) => {
            if (event.target.tagName === 'A') {
                menuButton.setAttribute('aria-expanded', 'false');
                nav.classList.remove('is-open');
            }
        });
    }

    document.querySelectorAll('.fun-link').forEach((link) => {
        let timer;
        const restText = link.dataset.rest || link.textContent.trim();
        const hoverText = link.dataset.hover || 'TET';
        link.dataset.rest = restText;
        link.dataset.hover = hoverText;

        function glitchTo(targetText) {
            window.clearInterval(timer);
            const target = targetText.padEnd(restText.length, ' ');
            let tick = 0;

            link.classList.add('is-glitching');
            timer = window.setInterval(() => {
                tick += 1;
                link.textContent = [...target].map((character, index) => {
                    if (tick > index + 1) {
                        return character;
                    }

                    return glyphs[(tick * 5 + index * 7) % glyphs.length];
                }).join('').trim();

                if (tick >= target.length + 2) {
                    window.clearInterval(timer);
                    link.textContent = targetText;
                    link.classList.toggle('is-tet', targetText === hoverText);
                    link.classList.remove('is-glitching');
                }
            }, 34);
        }

        link.addEventListener('mouseenter', () => glitchTo(hoverText));
        link.addEventListener('focus', () => glitchTo(hoverText));
        link.addEventListener('mouseleave', () => glitchTo(restText));
        link.addEventListener('blur', () => glitchTo(restText));
    });
}());
