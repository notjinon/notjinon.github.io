(async function () {
    const map = document.querySelector('.flight-map');

    if (!map || !window.d3 || !window.topojson) {
        return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const { airports, flights } = await fetch(map.dataset.src).then((response) => response.json());
    flights.sort((a, b) => a.date.localeCompare(b.date));

    const lonLat = (code) => [airports[code][1], airports[code][0]];
    const miles = (flight) => d3.geoDistance(lonLat(flight.from), lonLat(flight.to)) * 3958.8;
    const routeKey = (flight) => [flight.from, flight.to].sort().join('-');
    const formatMiles = (value) => Math.round(value).toLocaleString('en-US');
    const route = (flight) => `${flight.from}-${flight.to}`;

    // Map, centred on the Pacific so trans-Pacific routes don't wrap at the edges.

    const width = 1000;
    const height = 500;
    const svg = d3.select(map).append('svg').attr('viewBox', `0 0 ${width} ${height}`);
    const world = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json').then((response) => response.json());
    const projection = d3.geoNaturalEarth1().rotate([150, 0]).fitExtent([[8, 8], [width - 8, height - 8]], { type: 'Sphere' });
    const path = d3.geoPath(projection);
    const line = (flight) => path({ type: 'LineString', coordinates: [lonLat(flight.from), lonLat(flight.to)] });

    // Everything in `layer` scales with zoom; stops and the plane sit on top at a constant size.
    const layer = svg.append('g');
    layer.append('path').attr('class', 'map-graticule').attr('d', path(d3.geoGraticule10()));
    layer.append('path').attr('class', 'map-land').attr('d', path(topojson.feature(world, world.objects.land)));

    // Least-flown first, so the most-flown routes and airports are drawn (and clicked) on top.
    const routes = d3.groups(flights, routeKey)
        .map(([key, group]) => ({ key, ends: key.split('-'), flights: group }))
        .sort((a, b) => a.flights.length - b.flights.length);
    const maxCount = d3.max(routes, (item) => item.flights.length);

    const drawn = layer.append('g').selectAll('path')
        .data(routes)
        .join('path')
        .attr('class', 'map-route')
        .attr('stroke-width', (item) => 0.8 + (item.flights.length / maxCount) * 1.8)
        .attr('d', (item) => line(item.flights[0]));

    const selectedLine = layer.append('path').attr('class', 'map-route map-route--selected');

    // Wide invisible strokes so thin routes are easy to hit.
    layer.append('g').selectAll('path')
        .data(routes)
        .join('path')
        .attr('class', 'map-hit')
        .attr('d', (item) => line(item.flights[0]))
        .on('click', (event, item) => {
            event.stopPropagation();
            selectRoute(item);
        });

    const visits = d3.rollup(flights.flatMap((flight) => [flight.from, flight.to]), (group) => group.length, (code) => code);
    const visited = [...visits.keys()].sort((a, b) => visits.get(a) - visits.get(b));
    const stops = svg.append('g').selectAll('g').data(visited).join('g').attr('class', 'map-stop');
    stops.append('circle').attr('class', 'map-stop__hit').attr('r', 9);
    stops.append('circle').attr('class', 'map-stop__dot').attr('r', 2.4);
    stops.append('text').attr('x', 5).attr('y', -5).text((code) => code);
    stops.on('click', (event, code) => {
        event.stopPropagation();
        selectAirport(code);
    });

    const plane = svg.append('path')
        .attr('class', 'map-plane')
        .attr('d', 'M-8,0 L5,-1.4 L8,0 L5,1.4 Z M-1,0 L-4.5,-6.5 L-1.8,-6.5 L3.5,0 L-1.8,6.5 L-4.5,6.5 Z M-7,0 L-9,-3 L-7.6,-3 L-5.4,0 L-7.6,3 L-9,3 Z');

    // Zoom: buttons in the corner, drag to pan, pinch or ctrl+wheel to zoom (plain wheel still scrolls the page).

    let view = d3.zoomIdentity;
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .translateExtent([[0, 0], [width, height]])
        .filter((event) => (event.type === 'wheel' ? event.ctrlKey : !event.button))
        .on('zoom', (event) => {
            view = event.transform;
            layer.attr('transform', view);
            placeStops();
            if (reduceMotion) {
                placePlane(0.55);
            }
            map.classList.toggle('is-zoomed', view.k > 1.01);
        });
    svg.call(zoom).on('dblclick.zoom', null);

    function placeStops() {
        stops.attr('transform', (code) => `translate(${view.apply(projection(lonLat(code)))})`);
    }
    placeStops();

    const controls = document.createElement('div');
    controls.className = 'map-zoom';
    controls.innerHTML = `
        <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
        <button type="button" data-zoom="out" aria-label="Zoom out">&minus;</button>
        <button type="button" data-zoom="reset" aria-label="Reset zoom">RESET</button>`;
    map.appendChild(controls);
    controls.addEventListener('click', (event) => {
        const action = event.target.closest('button')?.dataset.zoom;
        const animated = reduceMotion ? svg : svg.transition().duration(450);
        if (action === 'in') animated.call(zoom.scaleBy, 1.8);
        if (action === 'out') animated.call(zoom.scaleBy, 1 / 1.8);
        if (action === 'reset') animated.call(zoom.transform, d3.zoomIdentity);
    });

    // The plane flies whichever flight is highlighted (the latest one by default).

    let along = null;

    function highlight(flight) {
        selectedLine.attr('d', flight ? line(flight) : null);
        along = flight ? d3.geoInterpolate(lonLat(flight.from), lonLat(flight.to)) : null;
        plane.attr('display', flight ? null : 'none');
    }

    function placePlane(t) {
        if (!along) {
            return;
        }
        const [x, y] = view.apply(projection(along(t)));
        const [nx, ny] = view.apply(projection(along(Math.min(t + 0.01, 1))));
        plane.attr('transform', `translate(${x},${y}) rotate(${Math.atan2(ny - y, nx - x) * 180 / Math.PI})`);
    }

    const latest = flights[flights.length - 1];
    highlight(latest);

    if (reduceMotion) {
        placePlane(0.55);
    } else {
        d3.timer((elapsed) => placePlane((elapsed % 9000) / 9000));
    }

    // Two flip lines: labels over values, six slots wide.

    const slots = [...document.querySelectorAll('.log-slot')].map((slot) => ({
        label: slot.querySelector('.log-label'),
        value: slot.querySelector('.log-value')
    }));
    const readout = document.getElementById('log-readout');

    function show(pairs) {
        pairs.forEach(([label, value], index) => {
            window.setTimeout(() => {
                window.flapTo(slots[index].label, label);
                window.flapTo(slots[index].value, value);
            }, index * 70);
        });
        readout.textContent = pairs.map(([label, value]) => `${label} ${value}`).join(', ');
    }

    const byMiles = [...flights].sort((a, b) => miles(a) - miles(b));
    const topRoute = d3.greatest(routes, (item) => item.flights.length);
    const topJet = d3.greatest(d3.rollups(flights, (group) => group.length, (flight) => flight.equip), ([, count]) => count);

    const superlatives = [
        ['LAST', route(latest)],
        ['LONGEST', route(byMiles[byMiles.length - 1])],
        ['SHORTEST', route(byMiles[0])],
        ['TOP RTE', topRoute.key],
        ['TOP JET', topJet[0]]
    ];

    const totals = [
        ['FLIGHTS', String(flights.length)],
        ['MILES', formatMiles(d3.sum(flights, miles))],
        ['AIRPORTS', String(visited.length)],
        ['COUNTRIES', String(new Set(visited.map((code) => airports[code][2])).size)],
        ['AIRLINES', String(new Set(flights.map((flight) => flight.flight.split(' ')[0])).size)]
    ];

    let superlativeIndex = 0;
    let selected = null;
    let rotateTimer = null;
    let inView = false;

    function label(codes) {
        stops.classed('is-labeled', (code) => codes.includes(code));
    }

    function showTotals() {
        show([...totals, superlatives[superlativeIndex]]);
    }

    // While the board is on screen and nothing is picked, the last slot cycles through superlatives.
    function scheduleRotation() {
        window.clearTimeout(rotateTimer);

        if (!inView || selected || reduceMotion) {
            return;
        }

        rotateTimer = window.setTimeout(() => {
            superlativeIndex = (superlativeIndex + 1) % superlatives.length;
            const [name, value] = superlatives[superlativeIndex];
            window.flapTo(slots[5].label, name);
            window.flapTo(slots[5].value, value);
            scheduleRotation();
        }, 3600);
    }

    function selectRoute(item) {
        // Clicking the same route again steps back through every flight flown on it.
        const list = [...item.flights].reverse();
        const index = selected && selected.route === item ? (selected.index + 1) % list.length : 0;
        const flight = list[index];
        selected = { route: item, index };

        drawn.classed('is-dim', (other) => other !== item);
        label(item.ends);
        highlight(flight);
        window.clearTimeout(rotateTimer);

        show([
            ['FLIGHT', flight.flight],
            ['DATE', flight.date],
            ['DIST', `${formatMiles(miles(flight))} MI`],
            ['ORIG', flight.from],
            ['DEST', flight.to],
            ['EQUIP', flight.equip]
        ]);
    }

    function selectAirport(code) {
        const touching = routes.filter((item) => item.ends.includes(code));
        const legs = flights.filter((flight) => flight.from === code || flight.to === code);
        const partners = touching.map((item) => item.ends.find((end) => end !== code));
        const topDest = d3.greatest(touching, (item) => item.flights.length).ends.find((end) => end !== code);
        selected = { airport: code };

        drawn.classed('is-dim', (item) => !touching.includes(item));
        label([code, ...partners]);
        highlight(null);
        window.clearTimeout(rotateTimer);

        show([
            ['AIRPORT', code],
            ['FIRST', legs[0].date],
            ['FLIGHTS', String(legs.length)],
            ['ROUTES', String(touching.length)],
            ['COUNTRY', airports[code][2]],
            ['TOP DEST', topDest]
        ]);
    }

    function clearSelection() {
        if (!selected) {
            return;
        }

        selected = null;
        drawn.classed('is-dim', false);
        label([]);
        highlight(latest);
        showTotals();
        scheduleRotation();
    }

    svg.on('click', clearSelection);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            clearSelection();
        }
    });

    showTotals();

    new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        scheduleRotation();
    }, { threshold: 0.4 }).observe(document.querySelector('.log-board'));
}());
