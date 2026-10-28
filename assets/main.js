(function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const airportCodes = ['DFW', 'SFO', 'EWR', 'ORD', 'LAF', 'MNL', 'PVG', 'AMS', 'HND', 'NRT', 'ATH', 'VCE'];
    const glyphs = [...airportCodes.join(''), '@', ',', '/'];

    // Menu

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

    // GAME -> TET glitch

    document.querySelectorAll('.fun-link').forEach((link) => {
        let timer;
        const restText = link.dataset.rest || link.textContent.trim();
        const hoverText = link.dataset.hover || 'TET';

        function glitchTo(targetText) {
            window.clearInterval(timer);
            const target = targetText.padEnd(restText.length, ' ');
            let tick = 0;

            link.classList.add('is-glitching');
            timer = window.setInterval(() => {
                tick += 1;
                link.textContent = [...target].map((character, index) => (
                    tick > index + 1 ? character : glyphs[(tick * 5 + index * 7) % glyphs.length]
                )).join('').trim();

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

    // Timestamp

    const timestamp = document.querySelector('#current-timestamp');
    const pad = (value) => String(value).padStart(2, '0');

    function renderTimestamp() {
        const now = new Date();
        const offsetMinutes = -now.getTimezoneOffset();
        const sign = offsetMinutes >= 0 ? '+' : '-';
        const hours = Math.floor(Math.abs(offsetMinutes) / 60);
        const minutes = Math.abs(offsetMinutes) % 60;
        const offset = minutes === 0 ? `${sign}${hours}` : `${sign}${hours}:${pad(minutes)}`;

        timestamp.textContent = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} // `
            + `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} GMT${offset}`;
    }

    if (timestamp) {
        renderTimestamp();
        window.setInterval(renderTimestamp, 1000);
    }

    // Split-flap

    function renderFlapText(element, text) {
        element.textContent = '';
        [...text].forEach((character) => {
            const cell = document.createElement('span');
            cell.className = character === ' ' ? 'flap-space' : 'flap-char';
            cell.textContent = character === ' ' ? ' ' : character;
            cell.dataset.value = character;
            element.appendChild(cell);
        });
    }

    function setCell(cell, character) {
        cell.className = character === ' ' ? 'flap-space' : 'flap-char';
        cell.textContent = character === ' ' ? ' ' : character;
        cell.dataset.value = character;
        void cell.offsetWidth;
        cell.classList.add('is-flipping');
    }

    function animateFlapText(element, targetText, options = {}) {
        const target = targetText.padEnd(Number(element.dataset.cellCount) || targetText.length, ' ');
        const cells = [...element.children];
        const duration = options.duration || 520;
        const maxCycles = options.maxCycles || 4;
        const baseDelay = options.baseDelay || 0;
        // A newer flip on the same board cancels this one mid-way.
        const run = (element.flapRun || 0) + 1;
        element.flapRun = run;

        return Promise.all(cells.map((cell, index) => {
            const finalCharacter = target[index] || ' ';

            if (cell.dataset.value === finalCharacter) {
                return Promise.resolve();
            }

            return new Promise((resolve) => {
                const cycles = finalCharacter === ' ' ? 1 : 1 + ((index * 7 + finalCharacter.charCodeAt(0)) % maxCycles);
                const delay = baseDelay + ((index * 37) % duration);
                const step = 42 + ((index * 13) % 34);

                window.setTimeout(() => {
                    let tick = 0;
                    const timer = window.setInterval(() => {
                        if (element.flapRun !== run) {
                            window.clearInterval(timer);
                            resolve();
                            return;
                        }

                        tick += 1;
                        const isLast = tick >= cycles;
                        setCell(cell, isLast ? finalCharacter : glyphs[Math.abs(index + tick * 5 + finalCharacter.charCodeAt(0)) % glyphs.length]);

                        if (isLast) {
                            window.clearInterval(timer);
                            window.setTimeout(() => {
                                cell.classList.remove('is-flipping');
                                resolve();
                            }, 120);
                        }
                    }, step);
                }, delay);
            });
        }));
    }

    function prepareBoard(element, startText, finalText, cellCount) {
        element.dataset.cellCount = cellCount;
        renderFlapText(element, (reduceMotion ? finalText : startText).padEnd(cellCount, ' '));
    }

    // Hero: "SFO ORD DFW" -> "Hi, I'm Jino", then the route list.

    const titleLines = [...document.querySelectorAll('.title-flap > span')];
    const routeValues = [...document.querySelectorAll('.route-list dd')];

    titleLines.forEach((line) => {
        const finalText = line.dataset.final;
        prepareBoard(line, line.dataset.start, finalText, Math.max(finalText.length, line.dataset.start.length));
    });

    routeValues.forEach((value) => {
        value.setAttribute('aria-label', value.dataset.final);
        prepareBoard(value, value.dataset.start.toUpperCase(), value.dataset.final.toUpperCase(), 17);
    });

    function heroReady() {
        document.body.classList.add('is-ready');
    }

    if (reduceMotion) {
        heroReady();
    } else if (titleLines.length) {
        Promise.all(titleLines.map((line, lineIndex) => animateFlapText(line, line.dataset.final, {
            duration: 360 + lineIndex * 110,
            maxCycles: 5,
            baseDelay: lineIndex * 65
        }))).then(() => {
            heroReady();
            window.setTimeout(() => {
                routeValues.forEach((value, valueIndex) => {
                    animateFlapText(value, value.dataset.final.toUpperCase(), {
                        duration: 520,
                        maxCycles: 3,
                        baseDelay: valueIndex * 85
                    });
                });
            }, 220);
        });
    }

    // Section boards start on airport codes and flip in when scrolled to.

    const codeRun = airportCodes.join(' ');
    const boards = [...document.querySelectorAll('[data-flap]')];

    boards.forEach((board, boardIndex) => {
        const cellCount = Math.max(board.textContent.trim().length, Number(board.dataset.cells) || 0);
        const finalText = board.textContent.trim().toUpperCase().padEnd(cellCount, ' ');
        const offset = (boardIndex * 8) % codeRun.length;
        board.dataset.final = finalText;
        board.setAttribute('aria-label', board.textContent.trim());
        prepareBoard(board, (codeRun + ' ' + codeRun).slice(offset, offset + cellCount), finalText, cellCount);
    });

    // Boards are hidden (via html.js) until their tiles exist, so the raw text never flashes.
    document.documentElement.classList.add('flaps-built');

    function observe(elements, onEnter, options) {
        if (!('IntersectionObserver' in window)) {
            elements.forEach(onEnter);
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    observer.unobserve(entry.target);
                    onEnter(entry.target);
                }
            });
        }, options);

        elements.forEach((element) => observer.observe(element));
    }

    if (!reduceMotion) {
        observe(boards, (board) => animateFlapText(board, board.dataset.final, { duration: 360, maxCycles: 4 }), { threshold: 0.6 });
    }

    // Lets scripts that load data later (e.g. the flight log) flip their own boards.
    window.flapTo = (element, text, options = {}) => {
        const cellCount = Number(element.dataset.cells) || text.length;
        const finalText = text.toUpperCase().slice(0, cellCount).padEnd(cellCount, ' ');

        if (Number(element.dataset.cellCount) !== cellCount) {
            prepareBoard(element, (codeRun + ' ' + codeRun).slice(0, cellCount), finalText, cellCount);
        }

        if (reduceMotion) {
            element.flapRun = (element.flapRun || 0) + 1;
            renderFlapText(element, finalText);
            return Promise.resolve();
        }

        return animateFlapText(element, finalText, { duration: options.duration || 360, maxCycles: options.maxCycles || 3 });
    };

    observe([...document.querySelectorAll('.reveal')], (element) => element.classList.add('is-in'), {
        rootMargin: '0px 0px -8% 0px'
    });

    // Highlight the nav link for the section in view.

    const chapters = [...document.querySelectorAll('.chapter')];
    const navLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
    let ticking = false;

    function onScroll() {
        ticking = false;
        const line = window.innerHeight * 0.45;
        const current = chapters.filter((chapter) => chapter.getBoundingClientRect().top <= line).pop();
        navLinks.forEach((link) => {
            link.setAttribute('aria-current', String(Boolean(current) && link.getAttribute('href') === `#${current.id}`));
        });
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            ticking = true;
            window.requestAnimationFrame(onScroll);
        }
    }, { passive: true });
    onScroll();

    // Lightbox for photos and project images.

    const lightbox = document.querySelector('.lightbox');

    if (lightbox) {
        const lightboxImage = lightbox.querySelector('img');
        const lightboxCaption = lightbox.querySelector('p');

        document.querySelectorAll('.zoom').forEach((button) => {
            button.addEventListener('click', () => {
                const image = button.querySelector('img');
                const holder = button.closest('figure, article');
                const caption = holder.querySelector('figcaption') || holder.querySelector('h3');
                lightboxImage.src = image.currentSrc || image.src;
                lightboxImage.alt = image.alt;
                lightboxCaption.textContent = caption ? caption.textContent : '';
                lightbox.showModal();
            });
        });

        lightbox.addEventListener('click', () => lightbox.close());
    }

    // Fade the cloud video in once it can play.

    const cloudVideo = document.querySelector('.cloud-video');

    if (cloudVideo) {
        if (cloudVideo.readyState >= 3) {
            document.body.classList.add('video-loaded');
        } else {
            cloudVideo.addEventListener('canplay', () => document.body.classList.add('video-loaded'), { once: true });
        }
    }
}());
