/* ==================================================================
   716QX NEXUS 6.5 — 3D SPACE BACKGROUND
   Wireframe rotating shapes + starfield + particle network
   ================================================================== */
(function () {
    'use strict';

    const canvas = document.getElementById('scene-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
    const FOCAL = 700;

    let mouse = { x: -9999, y: -9999, tx: 0, ty: 0, cx: 0, cy: 0 };

    /* ---- Starfield ---- */
    let stars = [];
    const STAR_COUNT_BASE = 160;

    /* ---- 3D Wireframe shapes ---- */
    const COLORS = ['#00FFFF', '#C026D3', '#00FF88', '#FF0080', '#7C3AED'];
    let shapes = [];

    /* ---- Particles (network) ---- */
    let particles = [];
    const PARTICLE_COUNT = 40;

    /* ==================================================
       GEOMETRY DEFINITIONS
       ================================================== */
    function cubeV() {
        const s = 1;
        return [
            [-s,-s,-s],[s,-s,-s],[s,s,-s],[-s,s,-s],
            [-s,-s,s],[s,-s,s],[s,s,s],[-s,s,s]
        ];
    }
    function cubeE() {
        return [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    }
    function octaV() {
        return [
            [0,0,1],[0,0,-1],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0]
        ];
    }
    function octaE() {
        return [
            [0,2],[0,3],[0,4],[0,5],
            [1,2],[1,3],[1,4],[1,5],
            [2,4],[4,3],[3,5],[5,2]
        ];
    }
    function tetraV() {
        return [
            [1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1]
        ];
    }
    function tetraE() {
        return [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
    }
    function icosaV() {
        const t = (1 + Math.sqrt(5)) / 2;
        const s = 1 / Math.sqrt(1 + t*t);
        const a = 1 * s, b = t * s;
        return [
            [-a,-b,0],[a,-b,0],[-a,b,0],[a,b,0],
            [0,-a,-b],[0,a,-b],[0,-a,b],[0,a,b],
            [-b,0,-a],[b,0,-a],[-b,0,a],[b,0,a]
        ];
    }
    function icosaE() {
        return [
            [0,1],[0,4],[0,5],[0,2],[0,3],
            [1,4],[1,5],[1,7],[1,6],
            [2,3],[2,5],[2,7],[2,8],
            [3,4],[3,6],[3,8],
            [4,5],[4,9],[4,10],
            [5,9],[5,10],
            [6,7],[6,9],[6,11],
            [7,10],[7,11],
            [8,9],[8,10],
            [9,11],[10,11]
        ];
    }

    const GEOMS = {
        cube: { v: cubeV(), e: cubeE() },
        octa: { v: octaV(), e: octaE() },
        tetra: { v: tetraV(), e: tetraE() },
        icosa: { v: icosaV(), e: icosaE() }
    };

    /* ==================================================
       SHAPE CLASS
       ================================================== */
    function makeShape(type) {
        const g = GEOMS[type];
        const z = Math.random() * 800 - 400;
        const sizeBase = 30 + Math.random() * 50;
        // Nearer shapes are bigger
        const depthScale = 1 + (z / 1000);
        return {
            type,
            verts: g.v,
            edges: g.e,
            x: (Math.random() - 0.5) * 1400,
            y: (Math.random() - 0.5) * 900,
            z,
            rx: Math.random() * Math.PI * 2,
            ry: Math.random() * Math.PI * 2,
            rz: Math.random() * Math.PI * 2,
            vrx: (Math.random() - 0.5) * 0.006,
            vry: (Math.random() - 0.5) * 0.006,
            vrz: (Math.random() - 0.5) * 0.004,
            vx: (Math.random() - 0.5) * 0.25,
            vy: (Math.random() - 0.5) * 0.25,
            vz: (Math.random() - 0.5) * 0.15,
            size: sizeBase * Math.max(0.5, depthScale),
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            pulse: Math.random() * Math.PI * 2,
            glow: 0.4 + Math.random() * 0.5
        };
    }

    /* ==================================================
       PROJECT 3D -> 2D
       ================================================== */
    function project(x, y, z) {
        const scale = FOCAL / (FOCAL + z + 500);
        return {
            x: W / 2 + x * scale,
            y: H / 2 + y * scale,
            scale
        };
    }

    /* ==================================================
       ROTATION MATRICES
       ================================================== */
    function rotatePoint(p, rx, ry, rz) {
        let [x, y, z] = p;
        // X rotation
        let cy = Math.cos(rx), sy = Math.sin(rx);
        let ny = y * cy - z * sy;
        let nz = y * sy + z * cy;
        y = ny; z = nz;
        // Y rotation
        cy = Math.cos(ry); sy = Math.sin(ry);
        let nx = x * cy + z * sy;
        nz = -x * sy + z * cy;
        x = nx; z = nz;
        // Z rotation
        cy = Math.cos(rz); sy = Math.sin(rz);
        nx = x * cy - y * sy;
        ny = x * sy + y * cy;
        x = nx; y = ny;
        return [x, y, z];
    }

    /* ==================================================
       INIT
       ================================================== */
    function initStars() {
        stars = [];
        const count = Math.floor(STAR_COUNT_BASE * (W * H) / (1920 * 1080));
        const total = Math.max(80, Math.min(count, STAR_COUNT_BASE));
        for (let i = 0; i < total; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                z: Math.random(),
                r: Math.random() * 1.4 + 0.2,
                c: ['#ffffff', '#a5f3fc', '#c4b5fd', '#fbcfe8'][Math.floor(Math.random() * 4)],
                twinkle: Math.random() * Math.PI * 2,
                twinkleSpeed: 0.02 + Math.random() * 0.04
            });
        }
    }

    function initParticles() {
        particles = [];
        const count = Math.max(20, Math.min(PARTICLE_COUNT, Math.floor(W / 30)));
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                z: 0.4 + Math.random() * 0.6,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                r: 1 + Math.random() * 1.5,
                c: COLORS[Math.floor(Math.random() * COLORS.length)],
                pulse: Math.random() * Math.PI * 2
            });
        }
    }

    function initShapes() {
        shapes = [];
        const types = ['cube', 'octa', 'tetra', 'icosa'];
        const count = W < 640 ? 4 : W < 1024 ? 6 : 8;
        for (let i = 0; i < count; i++) {
            shapes.push(makeShape(types[i % types.length]));
        }
    }

    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * DPR;
        canvas.height = H * DPR;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        initStars();
        initParticles();
        initShapes();
    }

    /* ==================================================
       RENDER
       ================================================== */
    let lastT = 0;

    function loop(t) {
        const dt = Math.min((t - lastT) / 1000, 0.05);
        lastT = t;

        // Smooth mouse parallax
        mouse.cx += (mouse.tx - mouse.cx) * 0.06;
        mouse.cy += (mouse.ty - mouse.cy) * 0.06;

        ctx.clearRect(0, 0, W, H);

        drawStars(dt);
        drawParticles(dt);
        drawShapes(dt);

        requestAnimationFrame(loop);
    }

    /* ---- Stars ---- */
    function drawStars(dt) {
        stars.forEach(s => {
            s.twinkle += s.twinkleSpeed;
            const tw = 0.55 + Math.sin(s.twinkle) * 0.45;
            const px = s.x + mouse.cx * (8 + s.z * 30);
            const py = s.y + mouse.cy * (8 + s.z * 30);
            ctx.globalAlpha = tw * (0.4 + s.z * 0.6);
            ctx.fillStyle = s.c;
            ctx.beginPath();
            ctx.arc(px, py, s.r * (0.6 + s.z * 0.9), 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    /* ---- Particle network ---- */
    function drawParticles(dt) {
        particles.forEach(p => {
            p.x += p.vx * p.z;
            p.y += p.vy * p.z;
            p.pulse += dt * 2;

            if (p.x < 0 || p.x > W) p.vx *= -1;
            if (p.y < 0 || p.y > H) p.vy *= -1;
            p.x = Math.max(0, Math.min(W, p.x));
            p.y = Math.max(0, Math.min(H, p.y));
        });

        // Connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const d = Math.hypot(dx, dy);
                if (d < 160) {
                    const a = (1 - d / 160) * 0.22;
                    ctx.strokeStyle = `rgba(0, 255, 255, ${a})`;
                    ctx.lineWidth = 0.6;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }

        // Dots
        particles.forEach(p => {
            const r = p.r * (1 + Math.sin(p.pulse) * 0.15);
            ctx.shadowColor = p.c;
            ctx.shadowBlur = 12;
            ctx.globalAlpha = 0.75 * p.z;
            ctx.fillStyle = p.c;
            ctx.beginPath();
            ctx.arc(p.x + mouse.cx * 15 * p.z, p.y + mouse.cy * 15 * p.z, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        });
    }

    /* ---- Wireframe 3D shapes ---- */
    function drawShapes(dt) {
        shapes.forEach(s => {
            // Update rotation
            s.rx += s.vrx;
            s.ry += s.vry;
            s.rz += s.vrz;
            s.pulse += dt * 1.5;

            // Update position (slow drift)
            s.x += s.vx * dt * 30;
            s.y += s.vy * dt * 30;

            // Wrap around
            if (s.x > 900) s.x = -900;
            if (s.x < -900) s.x = 900;
            if (s.y > 600) s.y = -600;
            if (s.y < -600) s.y = 600;

            // Project vertices
            const projected = s.verts.map(v => {
                const rv = rotatePoint(v, s.rx, s.ry, s.rz);
                const scaled = [rv[0] * s.size, rv[1] * s.size, rv[2] * s.size];
                const world = [
                    scaled[0] + s.x + mouse.cx * 60,
                    scaled[1] + s.y + mouse.cy * 60,
                    scaled[2] + s.z
                ];
                const p = project(world[0], world[1], world[2]);
                return { x: p.x, y: p.y, z: world[2], scale: p.scale };
            });

            // Compute depth & alpha
            const avgScale = projected.reduce((a, p) => a + p.scale, 0) / projected.length;
            const alpha = Math.min(0.85, Math.max(0.15, avgScale * 1.4)) * s.glow;
            const pulse = 0.85 + Math.sin(s.pulse) * 0.15;

            // Glow
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 12 * avgScale * pulse;

            // Draw edges
            ctx.strokeStyle = hexToRgba(s.color, alpha);
            ctx.lineWidth = Math.max(0.7, avgScale * 1.6);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            s.edges.forEach(e => {
                const a = projected[e[0]];
                const b = projected[e[1]];
                if (!a || !b) return;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            });

            // Draw vertices
            ctx.shadowBlur = 15 * avgScale * pulse;
            ctx.fillStyle = hexToRgba(s.color, Math.min(1, alpha * 1.4));
            projected.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(1.2, p.scale * 2.2 * pulse), 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.shadowBlur = 0;
        });
    }

    function hexToRgba(hex, a) {
        const c = hex.replace('#', '');
        const r = parseInt(c.substring(0, 2), 16);
        const g = parseInt(c.substring(2, 4), 16);
        const b = parseInt(c.substring(4, 6), 16);
        return `rgba(${r},${g},${b},${a})`;
    }

    /* ==================================================
       EVENTS
       ================================================== */
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 100);
    });

    window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.tx = (e.clientX / W - 0.5) * 2;
        mouse.ty = (e.clientY / H - 0.5) * 2;

        // Orbs parallax
        document.querySelectorAll('.orb').forEach((orb, i) => {
            const f = (i % 2 === 0 ? -1 : 1) * (10 + i * 4);
            orb.style.transform = `translate(${mouse.tx * f}px, ${mouse.ty * f}px)`;
        });
    });

    window.addEventListener('mouseleave', () => {
        mouse.tx = 0; mouse.ty = 0;
    });

    window.addEventListener('touchmove', e => {
        if (!e.touches[0]) return;
        const t = e.touches[0];
        mouse.tx = (t.clientX / W - 0.5) * 2;
        mouse.ty = (t.clientY / H - 0.5) * 2;
    }, { passive: true });

    window.addEventListener('touchend', () => {
        mouse.tx = 0; mouse.ty = 0;
    });

    // Reduce motion support
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // Show static background
        resize();
        drawStars(0);
        drawParticles(0);
        drawShapes(0);
    } else {
        resize();
        requestAnimationFrame(loop);
    }
})();
