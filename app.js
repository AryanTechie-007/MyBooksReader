// --- AUTHENTICATION LOGIC ---

// Toggle Password Visibility
window.togglePass = (id) => {
    const input = document.getElementById(id);
    input.type = input.type === "password" ? "text" : "password";
};

// Form Switching + tab highlighting
window.showSignup = () => {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'block';
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    if (tabLogin && tabSignup) { tabLogin.classList.remove('active'); tabSignup.classList.add('active'); }
    clearFormMessages();
};

window.showLogin = () => {
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    if (tabLogin && tabSignup) { tabSignup.classList.remove('active'); tabLogin.classList.add('active'); }
    clearFormMessages();
};

// --- User store helpers ---
function getUsers() {
    try {
        const raw = localStorage.getItem('mybooks_users');
        return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
}
function saveUsers(users) { localStorage.setItem('mybooks_users', JSON.stringify(users)); }

function showFormMessage(id, text, type = 'error') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.remove('form-error','form-success');
    el.classList.add(type === 'success' ? 'form-success' : 'form-error');
}
function clearFormMessages() {
    ['login-error','signup-error'].forEach(id => { const el = document.getElementById(id); if (el) { el.textContent = ''; el.classList.remove('form-error','form-success'); } });
}

// Signup Logic
window.handleSignup = () => {
    clearFormMessages();
    const user = document.getElementById('signup-user').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const confirm = document.getElementById('confirm-pass').value;

    if (!user || !pass) { showFormMessage('signup-error','Please fill all fields'); return; }
    if (pass !== confirm) { showFormMessage('signup-error','Passwords do not match!'); return; }

    const users = getUsers();
    if (users[user]) { showFormMessage('signup-error','Username already exists'); return; }

    // Save to users store
    users[user] = pass;
    saveUsers(users);

    // Redirect to login and prefill credentials, then auto-login
    showLogin();
    const loginUser = document.getElementById('login-user');
    const loginPass = document.getElementById('login-pass');
    if (loginUser && loginPass) {
        loginUser.value = user;
        loginPass.value = pass;
    }

    // small success message
    showFormMessage('login-error', 'Account created — logging in...', 'success');

    // Small delay to allow UI switch, then attempt login
    setTimeout(() => { handleLogin(); }, 200);
};

// Login Logic
window.handleLogin = () => {
    clearFormMessages();
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;

    const users = getUsers();
    const storedPass = users[user];

    if (storedPass && storedPass === pass) {
        // Success! Set session, hide login, show app
        localStorage.setItem('currentUser', user);
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        // set top-aligned layout for app views
        document.body.classList.add('in-app');
        const welcome = document.getElementById('welcome-user');
        if (welcome) welcome.innerText = user;
        initBook(); // Function to start the flipbook logic
    } else {
        showFormMessage('login-error', 'Invalid username or password');
    }
};

window.signOut = () => {
    localStorage.removeItem('currentUser');
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('auth-container').style.display = 'flex';
    // remove app layout markers
    document.body.classList.remove('in-app');
    document.body.classList.remove('book-open');
    // Clear inputs
    const ids = ['login-user','login-pass','signup-user','reg-pass','confirm-pass'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    showLogin();
};

// --- FLIPBOOK STATE & INITIALIZATION ---
const appState = {
    pdfDoc: null,
    pdfTotal: 0,
    pdfFinal: 0,
    pdfSpreadLeft: 0,
    pdfCache: {},
    lastPdfFile: null,
    lastPdfUrl: null,
    bookKeydown: null
};

// initBook kept for compatibility but PageFlip has been removed to reduce bundle size
function initBook() {
    // no-op: PageFlip integration removed intentionally
    return;
}

// Helper: simple loading overlay control
function showLoading(show) {
    const ov = document.getElementById('loading-overlay');
    if (!ov) return;
    ov.style.display = show ? 'flex' : 'none';
    ov.setAttribute('aria-hidden', show ? 'false' : 'true');
}

function isSinglePageMode(wrap) {
    // single-page for narrow portrait screens or small container widths
    try {
        return (window.innerWidth < 560 && window.innerHeight > window.innerWidth) || (wrap && wrap.clientWidth < 520);
    } catch (e) { return false; }
} 

// Auto-login if session exists
document.addEventListener('DOMContentLoaded', () => {
    const current = localStorage.getItem('currentUser');
    if (current) {
        const welcome = document.getElementById('welcome-user');
        if (welcome) welcome.innerText = current;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        // mark that the user is in the app (so layout aligns from the top)
        document.body.classList.add('in-app');
        initBook();
    }

    // Initialize drop-zone handlers
    initDropZone();

    // Initialize theme and eye-care controls (light mode + warmth overlay)
    initTheme();

    // Initialize resize handle for book view
    try { initResizeHandle(); } catch (e) { console.warn('Resize init failed', e); }

    // Create atmospheric bubbles behind the UI
    try { createBubbles(); } catch(e){ console.warn('Bubbles failed', e); }

    // Keyboard: Enter submits login/signup when focus is inside those forms; Enter in jump triggers Go
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const active = document.activeElement;
        if (!active) return;
        // If focus is inside login form
        if (active.closest && active.closest('#login-form')) {
            e.preventDefault();
            handleLogin();
            return;
        }
        // If focus is inside signup form
        if (active.closest && active.closest('#signup-form')) {
            e.preventDefault();
            handleSignup();
            return;
        }
        // If focus is on book jump input
        if (active.id === 'book-jump') {
            e.preventDefault();
            goToPage();
            return;
        }
    });
});

// Drag & Drop Helpers
function initDropZone() {
    const drop = document.getElementById('drop-zone');
    const fileInput = document.getElementById('drop-input');
    const message = document.getElementById('drop-message');
    if (!drop) return;

    // Prevent default behavior for document-level drag/drop (avoid opening files)
    ['dragenter','dragover','dragleave','drop'].forEach(ev => {
        document.addEventListener(ev, e => e.preventDefault());
    });

    drop.addEventListener('dragover', (e) => {
        e.preventDefault();
        drop.classList.add('drag-over');
    });

    drop.addEventListener('dragleave', () => {
        drop.classList.remove('drag-over');
    });

    drop.addEventListener('drop', (e) => {
        e.preventDefault();
        drop.classList.remove('drag-over');
        const files = e.dataTransfer && e.dataTransfer.files;
        if (!files || files.length === 0) return;
        handleDroppedFile(files[0]);
    });

    // Also support click to choose
    drop.addEventListener('click', () => fileInput && fileInput.click());
    fileInput && fileInput.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) handleDroppedFile(f);
        // clear input to allow same file re-selection
        e.target.value = '';
    });

    function handleDroppedFile(file) {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (isPdf) {
            // keep console feedback but remove the loud on-page text; show transient success
            console.log('PDF dropped (detected)');
            if (message) {
                // visual success state without persistent text
                message.classList.add('drop-success');
                setTimeout(() => { message.classList.remove('drop-success'); }, 1200);
            }

            // Show PDF in viewer (next page)
            const pdfViewer = document.getElementById('pdf-viewer');
            const pdfFrame = document.getElementById('pdf-frame');
            const pdfName = document.getElementById('pdf-name');
            if (pdfName) pdfName.textContent = file.name;

            // Do NOT load a preview into the iframe. Instead show a simple "UPLOAD SUCCESSFUL" status
            if (pdfFrame) {
                // cleanup any previous object URL
                try {
                    if (pdfFrame.dataset && pdfFrame.dataset.objectUrl) { URL.revokeObjectURL(pdfFrame.dataset.objectUrl); delete pdfFrame.dataset.objectUrl; }
                } catch (e) { /* ignore */ }
                pdfFrame.src = '';
                pdfFrame.style.display = 'none';
            }
            const status = document.getElementById('pdf-status');
            if (status) { status.textContent = 'UPLOAD SUCCESSFUL'; status.style.display = 'flex'; }

            // keep references to the last uploaded PDF (stored in appState)
            appState.lastPdfFile = file;
            appState.lastPdfUrl = null;
            // enable Read as Book button
            const readBtn = document.getElementById('read-book');
            if (readBtn) readBtn.disabled = false;

            // show the PDF action area (with buttons) but do not show the preview
            if (pdfViewer) pdfViewer.style.display = 'block';
            // hide the main drop area and book container
            const bookEl = document.getElementById('book');
            if (bookEl) bookEl.style.display = 'none';
            drop.style.display = 'none';

            // provide a transient success on the drop-message as well
            if (message) { message.textContent = 'UPLOAD SUCCESSFUL'; message.classList.add('drop-success'); setTimeout(() => { message.classList.remove('drop-success'); message.textContent = ''; }, 1400); }
        } else {
            if (message) { message.textContent = 'the file is not a pdf'; message.classList.remove('drop-success'); }
        }
    }
}

// Close PDF viewer and cleanup
window.closePdfViewer = function () {
    const pdfFrame = document.getElementById('pdf-frame');
    if (pdfFrame) {
        const url = pdfFrame.dataset.objectUrl;
        pdfFrame.src = '';
        if (url) URL.revokeObjectURL(url);
        delete pdfFrame.dataset.objectUrl;
    }
    const pdfViewer = document.getElementById('pdf-viewer');
    if (pdfViewer) pdfViewer.style.display = 'none';
    const bookEl = document.getElementById('book');
    if (bookEl) bookEl.style.display = 'flex';
    const dropEl = document.getElementById('drop-zone');
    if (dropEl) dropEl.style.display = 'block';
    const messageEl = document.getElementById('drop-message');
    if (messageEl) { messageEl.textContent = ''; messageEl.classList.remove('drop-success'); }
};

// --- Book view (PDF.js based) ---
function loadPdfJs() {
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) return resolve(window.pdfjsLib);
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.min.js';
        script.onload = () => {
            // try to find global
            window.pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib || window.pdfjsLib;
            if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js';
            }
            resolve(window.pdfjsLib);
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function readAsBook() {
    console.log('readAsBook called');
    const mainApp = document.getElementById('main-app');
    if(mainApp){
        try{
            mainApp.style.transform = 'scale(0.98)';
            mainApp.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            setTimeout(()=>{ mainApp.style.transform = 'scale(1)'; }, 100);
        }catch(e){}
    }
    const file = appState.lastPdfFile;
    if (!file) {
        const msg = document.getElementById('drop-message');
        if (msg) { msg.textContent = 'No PDF loaded'; }
        return;
    }

    // show spinner while we load large files
    showLoading(true);
    try {
        // load pdf.js
        try {
            await loadPdfJs();
        } catch (e) {
            console.warn('Failed loading pdf.js', e);
            const msg = document.getElementById('drop-message');
            if (msg) { msg.textContent = 'Unable to load PDF renderer'; }
            return;
        }

        // read file as ArrayBuffer
        const arrayBuffer = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = rej;
            r.readAsArrayBuffer(file);
        });

        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;
        appState.pdfDoc = pdfDoc;
        appState.pdfTotal = pdfDoc.numPages;
        // define virtual final page index
        appState.pdfFinal = appState.pdfTotal + 1; // virtual final closing page

        // initial spread: show intro (virtual page 0) and cover (page 1)
        appState.pdfSpreadLeft = 0; // 0 denotes intro + cover on right
    } finally {
        // hide spinner even if an error occurred; we still let the calling code show messages
        showLoading(false);
    }

    // show book view
    const pdfViewer = document.getElementById('pdf-viewer'); if (pdfViewer) pdfViewer.style.display = 'none';
    const dropEl = document.getElementById('drop-zone'); if (dropEl) dropEl.style.display = 'none';
    const bookView = document.getElementById('book-view'); if (bookView) bookView.style.display = 'block';

    // indicate book is open (used for header visibility and layout)
    document.body.classList.add('book-open');

    // make sure header actions (theme controls) are visible while reading
    const headerActions = document.querySelector('.header-actions'); if (headerActions) headerActions.style.display = 'flex';

    // apply saved book view size (if user previously set one by exiting fullscreen)
    try { applySavedBookSize(); } catch (e) { /* ignore */ }

    // ensure warmth overlay (if enabled) is attached to the book canvas and visible only while reading
    try { _updateOverlayVisibility(); } catch (e) { /* ignore if helpers not present yet */ }

    // focus book and update page count UI
    const pageNumEl = document.getElementById('book-pagenum'); if (pageNumEl) pageNumEl.textContent = `0 / ${appState.pdfTotal}`;

    renderBookSpread();

    // pre-render adjacent pages for smoother navigation
    preRenderPages(appState.pdfSpreadLeft);

    // ensure single-page class is applied if needed
    const wrap = document.querySelector('.book-canvas-wrap');
    if (isSinglePageMode(wrap)) document.querySelector('.book-view')?.classList.add('single');
    else document.querySelector('.book-view')?.classList.remove('single');

    // keyboard navigation (left/right)
    appState.bookKeydown = function (e) {
        if (e.key === 'ArrowRight') nextBookPage();
        if (e.key === 'ArrowLeft') prevBookPage();
    };
    window.addEventListener('keydown', appState.bookKeydown);

    // update Read button state
    const readBtn = document.getElementById('read-book'); if (readBtn) readBtn.disabled = false;
}

// Helpers to draw wrapped, centered titles/subtitles that scale to canvas size
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
        const test = line ? line + ' ' + w : w;
        const width = ctx.measureText(test).width;
        if (width > maxWidth && line) { lines.push(line); line = w; }
        else { line = test; }
    }
    if (line) lines.push(line);
    return lines;
}

function drawCenteredWrapped(ctx, text, centerX, centerY, maxWidth, fontSize, fontWeight = 'bold', lineGap = 1.12) {
    ctx.font = `${fontWeight} ${fontSize}px Inter, Arial`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const lines = wrapText(ctx, text, maxWidth);
    const totalH = lines.length * fontSize * lineGap;
    let y = centerY - totalH / 2 + fontSize / 2;
    for (const ln of lines) {
        const w = ctx.measureText(ln).width;
        ctx.fillText(ln, centerX - w / 2, y);
        y += fontSize * lineGap;
    }
}

function drawTitleAndSubtitle(ctx, title, subtitle, widthCss, heightCss) {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // Draw a subtle decorative border on the intro page
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, widthCss - 80, heightCss - 80);

    // Main Title - Elegant and large
    ctx.fillStyle = '#1a1a1a';
    let titleSize = Math.floor(widthCss * 0.08);
    drawCenteredWrapped(ctx, title, widthCss / 2, heightCss * 0.4, widthCss * 0.8, titleSize, '700');

    // Accent Line
    ctx.beginPath();
    ctx.moveTo(widthCss * 0.4, heightCss * 0.5);
    ctx.lineTo(widthCss * 0.6, heightCss * 0.5);
    ctx.stroke();

    // Subtitle
    ctx.fillStyle = '#666';
    let subSize = Math.floor(titleSize * 0.4);
    drawCenteredWrapped(ctx, subtitle, widthCss / 2, heightCss * 0.6, widthCss * 0.8, subSize, '400');
}

async function renderBookSpread(animate) {
    const pdfDoc = appState.pdfDoc;
    const leftCanvas = document.getElementById('book-left-canvas');
    const rightCanvas = document.getElementById('book-right-canvas');
    const wrap = document.querySelector('.book-canvas-wrap');
    if (!pdfDoc || !wrap || !leftCanvas || !rightCanvas) return;

    // Reset transitions so the large view snaps into place without visual jumps
    try { wrap.style.transition = 'none'; } catch (e) {}

    const total = appState.pdfTotal;
    let leftPage = appState.pdfSpreadLeft; // left page index for spreads (0 = intro) 

    // if intro (0) -> show intro on left and cover (page 1) on right
    if (leftPage === 0) {
        // disable wrapping transition to avoid jump during layout changes
        try { wrap.style.transition = 'none'; } catch(e){}

        // render page 1 into right canvas so it matches spread sizing
        await renderPageToCanvas(1, rightCanvas, wrap, false);
        // make left canvas match right canvas dimensions and draw intro text responsively
        try {
            leftCanvas.width = rightCanvas.width;
            leftCanvas.height = rightCanvas.height;
            leftCanvas.style.width = rightCanvas.style.width;
            leftCanvas.style.height = rightCanvas.style.height;
            const ctx = leftCanvas.getContext('2d');
            // clear previous drawing (let background show through)
            ctx.clearRect(0,0,leftCanvas.width,leftCanvas.height);

            try {
                // draw intro using CSS pixel sizes so text scales correctly
                const cssW = leftCanvas.clientWidth || (leftCanvas.width / (window.devicePixelRatio || 1));
                const cssH = leftCanvas.clientHeight || (leftCanvas.height / (window.devicePixelRatio || 1));
                drawTitleAndSubtitle(ctx,
                    'Welcome to MyBooks',
                    'Created by Aryan Sinha',
                    cssW,
                    cssH
                );
            } catch (e) { console.warn('Intro draw error', e); }
        } catch(e){ console.warn('Intro sizing error', e); }
        leftCanvas.style.display = 'block';
        rightCanvas.style.display = 'block';
        const pageNumEl = document.getElementById('book-pagenum');
        if (pageNumEl) pageNumEl.textContent = `0 - 1 / ${total}`;
        return;
    }

    // otherwise render a two-page spread
    // ensure leftPage is even: if odd, make it previous even
    if (leftPage % 2 !== 0) leftPage = leftPage - 1;

    const rightPage = leftPage + 1 <= total ? leftPage + 1 : null;

    // compute scale for two pages side-by-side
    const samplePage = await pdfDoc.getPage(leftPage);
    const base = samplePage.getViewport({ scale: 1 });
    const wrapW = wrap.clientWidth - 40; // small gap
    const wrapH = wrap.clientHeight - 40;

    // scale so both pages fit side-by-side
    const scale = Math.min(wrapW / (base.width * 2 + 4), wrapH / base.height, 1);

    // render left and right (if exists)
    await renderPageToCanvas(leftPage, leftCanvas, wrap, false, scale);
    if (rightPage) {
        await renderPageToCanvas(rightPage, rightCanvas, wrap, false, scale);
        rightCanvas.style.display = 'block';
    } else if (leftPage === appState.pdfFinal) {
        // virtual final page as left-only closing page
        try {
            // match size to leftCanvas current sizing (use base)
            const dpr = window.devicePixelRatio || 1;
            leftCanvas.width = Math.floor(base.width * scale * dpr);
            leftCanvas.height = Math.floor(base.height * scale * dpr);
            leftCanvas.style.width = Math.ceil(base.width * scale) + 'px';
            leftCanvas.style.height = Math.ceil(base.height * scale) + 'px';

            const ctx = leftCanvas.getContext('2d');
            // white background
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, leftCanvas.width, leftCanvas.height);

            try {
                drawTitleAndSubtitle(ctx,
                    'THANK YOU FOR CHOOSING THIS WEBSITE TO READ THE BOOK',
                    'HOPE YOU HAD A GREAT READ! SEE YOU AGAIN SOON!',
                    leftCanvas.width / (window.devicePixelRatio || 1),
                    leftCanvas.height / (window.devicePixelRatio || 1)
                );
            } catch (e) { console.warn('Final draw error', e); }
        } catch (e) {
            // clear and hide right canvas
            try { const rc = rightCanvas.getContext('2d'); rc && rc.clearRect(0,0,rightCanvas.width,rightCanvas.height); } catch(e){}
            rightCanvas.style.display = 'none'; rightCanvas.width = 0; rightCanvas.height = 0; rightCanvas.style.width = '0px'; rightCanvas.style.height = '0px';
        }
        // ensure right canvas is cleared and hidden (no stale imagery)
        try { const rc = rightCanvas.getContext('2d'); rc && rc.clearRect(0,0,rightCanvas.width,rightCanvas.height); } catch(e){}
        rightCanvas.style.display = 'none'; rightCanvas.width = 0; rightCanvas.height = 0; rightCanvas.style.width = '0px'; rightCanvas.style.height = '0px';
    } else {
        // no right page — final single page. Render a closing 'Thank you' page in the left canvas (right side blank)
        // compute canvas size based on spread scale so it matches layout
        try {
            const page = await pdfDoc.getPage(leftPage);
            const base = page.getViewport({ scale: 1 });
            const wrapW = wrap.clientWidth - 40;
            const wrapH = wrap.clientHeight - 40;
            const lastScale = Math.min(wrapW / (base.width * 2 + 4), wrapH / base.height, 1);

            const dpr = window.devicePixelRatio || 1;
            const targetW = Math.floor(base.width * lastScale * dpr);
            const targetH = Math.floor(base.height * lastScale * dpr);

            leftCanvas.width = targetW;
            leftCanvas.height = targetH;
            leftCanvas.style.width = Math.ceil(base.width * lastScale) + 'px';
            leftCanvas.style.height = Math.ceil(base.height * lastScale) + 'px';

            const ctx = leftCanvas.getContext('2d');
            // white background
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, leftCanvas.width, leftCanvas.height);

            try {
                drawTitleAndSubtitle(ctx,
                    'THANK YOU FOR CHOOSING THIS WEBSITE TO READ THE BOOK',
                    'HOPE YOU HAD A GREAT READ! SEE YOU AGAIN SOON!',
                    leftCanvas.width / (window.devicePixelRatio || 1),
                    leftCanvas.height / (window.devicePixelRatio || 1)
                );
            } catch (e) { console.warn('Final single draw error', e); }
        } catch (e) {
            // fallback: hide right canvas and keep left blank
            rightCanvas.style.display = 'none';
        }
        rightCanvas.style.display = 'none';
    }
    leftCanvas.style.display = 'block';

    const pageNumEl = document.getElementById('book-pagenum');
    if (pageNumEl) pageNumEl.textContent = `${leftPage} - ${rightPage ? rightPage : leftPage} / ${total}`;

    // pre-render neighbors for smoother next/prev
    await preRenderPages(leftPage);
} 

// Pre-render adjacent pages (caching) to improve flip performance
async function preRenderPages(centerLeft) {
    const pdfDoc = appState.pdfDoc;
    const wrap = document.querySelector('.book-canvas-wrap');
    if (!pdfDoc || !wrap) return;
    appState.pdfCache = appState.pdfCache || {};

    const total = appState.pdfTotal;
    const pages = new Set();
    pages.add(centerLeft);
    if (centerLeft + 1 <= total) pages.add(centerLeft + 1);
    // next spread
    pages.add(centerLeft + 2);
    pages.add(centerLeft + 3);
    // previous spread
    pages.add(centerLeft - 2);
    pages.add(centerLeft - 1);

    for (const p of pages) {
        // allow page 0 (intro)
        if (p === 0) {
            if (appState.pdfCache[0]) continue;
            const off = document.createElement('canvas');
            try {
                // match sizing by rendering page 1 into tmp canvas if available
                if (total >= 1) {
                    const tmp = document.createElement('canvas');
                    await renderPageToCanvas(1, tmp, wrap, false);
                    off.width = tmp.width; off.height = tmp.height; off.style.width = tmp.style.width; off.style.height = tmp.style.height;
                } else {
                    off.width = 800; off.height = 1000;
                }
                const ctx = off.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,off.width,off.height);
                try {
                    drawTitleAndSubtitle(ctx, 'Welcome to Reading a Book', 'How a book is read', off.width / (window.devicePixelRatio || 1), off.height / (window.devicePixelRatio || 1));
                } catch(e){ console.warn('Pre-render intro failed', e); }
                appState.pdfCache[0] = off;
            } catch (e) { console.warn('Pre-render intro failed', e); }
            continue;
        }
        if (!p || p < 1 || p > total) continue;
        if (appState.pdfCache[p]) continue; // already cached
        const off = document.createElement('canvas');
        try {
            const single = (p === 1);
            await renderPageToCanvas(p, off, wrap, single);
            appState.pdfCache[p] = off;
        } catch (e) {
            console.warn('Pre-render failed for page', p, e);
        }
    }

    // optionally pre-render the virtual final page (closing 'thank you') when we're near the end
    try {
        if (appState.pdfFinal && !appState.pdfCache[appState.pdfFinal] && (centerLeft + 2 > total)) {
            const off = document.createElement('canvas');
            if (total >= 1) {
                const tmp = document.createElement('canvas');
                await renderPageToCanvas(Math.max(1, total), tmp, wrap, false);
                off.width = tmp.width; off.height = tmp.height; off.style.width = tmp.style.width; off.style.height = tmp.style.height;
            } else {
                off.width = 800; off.height = 1000;
            }
            const ctx = off.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,off.width,off.height);
            try {
                drawTitleAndSubtitle(ctx,
                    'THANK YOU FOR CHOOSING THIS WEBSITE TO READ THE BOOK',
                    'HOPE YOU HAD A GREAT READ! SEE YOU AGAIN SOON!',
                    off.width / (window.devicePixelRatio || 1),
                    off.height / (window.devicePixelRatio || 1)
                );
            } catch (e) { console.warn('Pre-render final draw failed', e); }
            appState.pdfCache[appState.pdfFinal] = off;
        }
    } catch (e) { console.warn('Pre-render final failed', e); }
}

async function renderPageToCanvas(pageNum, canvas, wrap, singlePage = false, forcedScale) {
    const pdfDoc = appState.pdfDoc;
    if (!pdfDoc) return; 
    const page = await pdfDoc.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });

    let scale;
    const MAX_SCALE = 1.6; // allow some upscale so pages can appear larger on wide screens
    if (forcedScale) scale = forcedScale;
    else {
        const wrapW = wrap.clientWidth - 40;
        const wrapH = wrap.clientHeight - 40;
        if (singlePage) scale = Math.min(wrapW / baseViewport.width, wrapH / baseViewport.height, MAX_SCALE);
        else scale = Math.min(wrapW / (baseViewport.width * 2 + 18), wrapH / baseViewport.height, MAX_SCALE);
    }

    const viewport = page.getViewport({ scale });
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = Math.ceil(viewport.width) + 'px';
    canvas.style.height = Math.ceil(viewport.height) + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const renderContext = { canvasContext: ctx, viewport };
    await page.render(renderContext).promise;
}

const BOOK_ANIM_MS = 850; // increased to match new CSS animation duration (0.85s)

function playPageFlipSound(){
    const s = document.getElementById('page-flip-sound');
    if(!s) return;
    try{ s.currentTime = 0; s.play().catch(()=>{}); }catch(e){}
}

// Simple helper to flip demo .page elements (if present) and play sound
function flip(pageId){
    const p = document.getElementById('p'+pageId);
    if(!p) return;
    playPageFlipSound();
    p.classList.toggle('flipped');
}

// Create floating bubble particles for atmosphere
function createBubbles(count = 24){
    const container = document.getElementById('bubble-container');
    if(!container) return;
    // avoid creating twice
    if(container.dataset.inited) return;
    container.dataset.inited = '1';

    for(let i=0;i<count;i++){
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        const size = Math.round(Math.random() * 50 + 12);
        bubble.style.width = size + 'px';
        bubble.style.height = size + 'px';
        bubble.style.left = Math.random() * 100 + 'vw';
        // duration between 8s and 18s
        bubble.style.animationDuration = (Math.random() * 10 + 8) + 's';
        bubble.style.animationDelay = (Math.random() * 8) + 's';
        bubble.style.opacity = (Math.random() * 0.4 + 0.15).toString();
        // slight horizontal variance using transform translateX
        bubble.style.transform = 'translateX(' + (Math.random() * 40 - 20) + 'px)';
        container.appendChild(bubble);
    }
}


async function prevBookPage() {
    if (!appState.pdfDoc) return;
    const total = appState.pdfTotal;
    const left = appState.pdfSpreadLeft;
    const wrap = document.querySelector('.book-canvas-wrap');

    // Single-page mode: step by 1 page instead of spreads
    if (isSinglePageMode(wrap)) {
        // compute visible page index
        let visible = left === 0 ? 1 : (left + 1 <= total ? left + 1 : left);
        if (visible <= 1) return; // at start
        visible = visible - 1;
        // map visible back to spread-left
        appState.pdfSpreadLeft = visible === 1 ? 0 : (visible % 2 === 0 ? visible : visible - 1);
        renderBookSpread();
        return;
    }

    // if at intro (page 0), do nothing
    if (left === 0) return;

    const leftCanvas = document.getElementById('book-left-canvas');
    const disableNav = (sel) => { document.querySelectorAll('.nav').forEach(b=>b.disabled = sel); };
    disableNav(true); 

    // If currently on virtual final page, go back to last real spread
    if (left === appState.pdfFinal) {
        const newLeft = Math.max(1, appState.pdfTotal - (appState.pdfTotal % 2 === 0 ? 0 : 1));
        // render the new left page offscreen so we can swap mid-flip
        const off = document.createElement('canvas');
        await renderPageToCanvas(newLeft, off, wrap, false);

        playPageFlipSound();
        leftCanvas.classList.add('flip-prev');
        setTimeout(() => {
            try { const dst = leftCanvas.getContext('2d'); dst && dst.drawImage(off, 0, 0); } catch(e){}
        }, Math.floor(BOOK_ANIM_MS/2));

        leftCanvas.addEventListener('animationend', function onEnd(){
            leftCanvas.classList.remove('flip-prev');
            leftCanvas.removeEventListener('animationend', onEnd);
            appState.pdfSpreadLeft = newLeft;
            renderBookSpread();
            disableNav(false);
        });
        return;
    }

    // prepare the page that will appear on the left after going back
    const newLeft = Math.max(0, left - 2);
    // render the new left page offscreen so we can swap mid-flip
    const off = document.createElement('canvas');
    if (newLeft === 0) {
        // render intro into off
        // we can match size by rendering page 1 into a temp canvas and using its size
        const tmp = document.createElement('canvas');
        if (appState.pdfTotal >= 1) await renderPageToCanvas(1, tmp, wrap, false);
        off.width = tmp.width; off.height = tmp.height; off.style.width = tmp.style.width; off.style.height = tmp.style.height;
        const ctx = off.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,off.width,off.height);
        try {
            drawTitleAndSubtitle(ctx,
                'Welcome to EPIC Book Reader',
                'Developed by Aryan Sinha',
                off.width / (window.devicePixelRatio || 1),
                off.height / (window.devicePixelRatio || 1)
            );
        } catch(e){ console.warn('Intro offscreen draw failed', e); }
    } else {
        await renderPageToCanvas(newLeft, off, wrap, false);
    }

    // trigger flip animation on left page
    playPageFlipSound();
    leftCanvas.classList.add('flip-prev');

    // at midpoint of animation, copy the pre-rendered new content into the left canvas
    setTimeout(() => {
        try {
            const dst = leftCanvas.getContext('2d');
            const cached = appState.pdfCache && appState.pdfCache[newLeft];
            if (cached) dst && dst.drawImage(cached, 0, 0);
            else dst && dst.drawImage(off, 0, 0);
        } catch(e){/* ignore */}
    }, Math.floor(BOOK_ANIM_MS/2));

    leftCanvas.addEventListener('animationend', function onEnd(){
        leftCanvas.classList.remove('flip-prev');
        leftCanvas.removeEventListener('animationend', onEnd);
        // set spread left and re-render to ensure correct layout
        appState.pdfSpreadLeft = newLeft;
        renderBookSpread();
        disableNav(false);
    });
}

async function nextBookPage() {
    if (!appState.pdfDoc) return;
    const total = appState.pdfTotal;
    let left = appState.pdfSpreadLeft;
    const wasIntro = left === 0;

    const rightCanvas = document.getElementById('book-right-canvas');
    const wrap = document.querySelector('.book-canvas-wrap');

    // Single-page mode: step by 1 page instead of spreads
    if (isSinglePageMode(wrap)) {
        // compute visible page index
        let visible = left === 0 ? 1 : (left + 1 <= total ? left + 1 : left);
        if (visible >= total) return; // at end
        visible = visible + 1;
        appState.pdfSpreadLeft = visible === 1 ? 0 : (visible % 2 === 0 ? visible : visible - 1);
        renderBookSpread();
        return;
    }

    if (wasIntro) left = 1; // intro -> first spread (pages 2-3)
    // if already on virtual final page, do nothing
    if (left === appState.pdfFinal) return;

    const disableNav = (sel) => { document.querySelectorAll('.nav').forEach(b=>b.disabled = sel); };
    disableNav(true); 

    // compute target spread
    const newLeft = wasIntro ? 2 : left + 2;
    const newRight = newLeft + 1 <= total ? newLeft + 1 : null;

    // render the page that should appear on the right during/after flip into offscreen canvas
    const off = document.createElement('canvas');
    // if the target is the virtual final page (newLeft > total), prepare a thank-you canvas
    if (newRight && newRight <= appState.pdfTotal) {
        await renderPageToCanvas(newRight, off, wrap, false);
    } else if (newLeft === appState.pdfFinal) {
        // prepare a thank-you canvas matching expected size
        const tmp = document.createElement('canvas');
        await renderPageToCanvas(left, tmp, wrap, false);
        off.width = tmp.width; off.height = tmp.height; off.style.width = tmp.style.width; off.style.height = tmp.style.height;
        const ctx = off.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,off.width,off.height);
        try {
            drawTitleAndSubtitle(ctx,
                'THANK YOU FOR CHOOSING THIS WEBSITE TO READ THE BOOK',
                'HOPE YOU HAD A GREAT READ! SEE YOU AGAIN SOON!',
                off.width / (window.devicePixelRatio || 1),
                off.height / (window.devicePixelRatio || 1)
            );
        } catch(e) { console.warn('Offscreen final draw failed', e); }
    } else {
        off.width = rightCanvas.width; off.height = rightCanvas.height;
        const c = off.getContext('2d'); c && (c.fillStyle = '#fff', c.fillRect(0,0,off.width,off.height));
    }

    // ensure right canvas is visible and sized to the offscreen content before animating
    try {
        rightCanvas.style.display = 'block';
        if (off.width) {
            rightCanvas.width = off.width;
            rightCanvas.height = off.height;
            rightCanvas.style.width = off.style.width || (Math.ceil(off.width / (window.devicePixelRatio||1)) + 'px');
            rightCanvas.style.height = off.style.height || (Math.ceil(off.height / (window.devicePixelRatio||1)) + 'px');
        }
        // clear and paint a white background immediately so we don't show stale content
        const rcctx = rightCanvas.getContext('2d'); if (rcctx) { rcctx.fillStyle = '#fff'; rcctx.fillRect(0,0,rightCanvas.width,rightCanvas.height); }
    } catch(e) { /* ignore sizing failures */ }

// at midpoint copy the new content into the right canvas so user sees the incoming page
    setTimeout(() => {
        try {
            const dst = rightCanvas.getContext('2d');
            const cached = appState.pdfCache && appState.pdfCache[newRight];
            if (cached) dst && dst.drawImage(cached, 0, 0);
            else dst && dst.drawImage(off, 0, 0);
        } catch(e){/* ignore */}
    }, Math.floor(BOOK_ANIM_MS/2));

    // trigger flip animation on right page
    playPageFlipSound();
    rightCanvas.classList.add('flip-next');

    // also ensure wrappers call sound when API is invoked externally
    try{
        if(window.nextBookPage && !window.nextBookPage.__wrapped) {
            const _orig = window.nextBookPage;
            window.nextBookPage = function(){ playPageFlipSound(); return _orig.apply(this, arguments); };
            window.nextBookPage.__wrapped = true;
        }
        if(window.prevBookPage && !window.prevBookPage.__wrapped) {
            const _orig = window.prevBookPage;
            window.prevBookPage = function(){ playPageFlipSound(); return _orig.apply(this, arguments); };
            window.prevBookPage.__wrapped = true;
        }
    } catch(e) { /* no-op */ }

    rightCanvas.addEventListener('animationend', function onEnd(){
        rightCanvas.classList.remove('flip-next');
        rightCanvas.removeEventListener('animationend', onEnd);
        // advance spread by 2 (or to first spread after cover)
        // If we surpassed the last page, move into the virtual final page
        if (newLeft > appState.pdfTotal) {
            appState.pdfSpreadLeft = appState.pdfFinal;
        } else {
            appState.pdfSpreadLeft = newLeft;
        }
        renderBookSpread();
        disableNav(false);
    });
}

function closeBookView() {
    // hide book view, show drop zone and pdf viewer preview
    const bookView = document.getElementById('book-view'); if (bookView) bookView.style.display = 'none';
    const pdfViewer = document.getElementById('pdf-viewer'); if (pdfViewer) pdfViewer.style.display = 'block';
    const dropEl = document.getElementById('drop-zone'); if (dropEl) dropEl.style.display = 'block';
    // cleanup canvases
    ['book-left-canvas','book-right-canvas'].forEach(id => {
        const c = document.getElementById(id); if (c) { const ctx = c.getContext('2d'); ctx && ctx.clearRect(0,0,c.width,c.height); c.style.width='0px'; c.style.height='0px'; c.style.display='block'; }
    });
    // free pdf doc (stored in appState)
    if (appState.pdfDoc) { appState.pdfDoc.destroy && appState.pdfDoc.destroy(); appState.pdfDoc = null; appState.pdfSpreadLeft = 0; appState.pdfTotal = 0; }
    const readBtn = document.getElementById('read-book'); if (readBtn) readBtn.disabled = false;
    // clear jump input
    const jump = document.getElementById('book-jump'); if (jump) jump.value = '';
    // clear any book notices
    const notice = document.getElementById('book-notice'); if (notice) notice.textContent = '';
    // remove keyboard handler
    if (appState.bookKeydown) { window.removeEventListener('keydown', appState.bookKeydown); appState.bookKeydown = null; }
    // clear pre-render cache
    if (appState.pdfCache) { appState.pdfCache = {}; }

    // exit fullscreen if active (so we don't leave the browser in a fullscreen state)
    try { exitFullScreen(); } catch(e){}

    // remove book-open marker so header controls hide again
    document.body.classList.remove('book-open');
    const headerActions = document.querySelector('.header-actions'); if (headerActions) headerActions.style.display = 'none';

    // hide / detach warmth overlay so it does not affect the rest of the app
    try { _updateOverlayVisibility(); } catch (e) { /* ignore if helpers not present yet */ }
}

// Book notice helper
function showBookNotice(msg, timeout = 3000) {
    const el = document.getElementById('book-notice');
    if (!el) return;
    el.textContent = msg;
    if (timeout > 0) {
        setTimeout(() => { el.textContent = ''; }, timeout);
    }
}

// Jump-to-page helper
function goToPage() {
    const raw = document.getElementById('book-jump').value;
    const val = parseInt(raw, 10);
    if (!appState.pdfDoc || isNaN(val)) return;
    const total = appState.pdfTotal || 0;

    // If user asks for the virtual final page explicitly (total + 1), go there
    if (val === total + 1) {
        appState.pdfSpreadLeft = appState.pdfFinal || (total + 1);
        renderBookSpread();
        return;
    }

    if (val > total) {
        // Show explicit message and clamp to last real page
        showBookNotice(`Sorry, Book ended at page ${total}`);
        const page = total;
        const left = page === 1 ? 0 : (page % 2 === 0 ? page : page - 1);
        appState.pdfSpreadLeft = left; 
        renderBookSpread();
        return;
    }

    // normal in-range jump
    const page = Math.max(1, Math.min(total, val));
    const left = page === 1 ? 0 : (page % 2 === 0 ? page : page - 1);
    // clear any existing notices
    showBookNotice('', 0);
    appState.pdfSpreadLeft = left;
    renderBookSpread();
}

// Theme controls (light mode)
function initTheme() {
    const mode = localStorage.getItem('themeMode') || 'dark';
    if (mode === 'light') document.body.classList.add('light-theme');
    const btnLight = document.getElementById('btn-light');
    if (btnLight) {
        updateThemeButton(document.body.classList.contains('light-theme'));
    }
}

const SVG_SUN = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
const SVG_MOON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" stroke="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
const SVG_FULLSCREEN_ENTER = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V3h6M21 15v6h-6M3 15v6h6M21 9V3h-6"/></svg>';
const SVG_FULLSCREEN_EXIT = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H3v6M21 3h-6M3 21h6M21 21v-6"/></svg>';
const SVG_RESET = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-3.1-6.36"/><path d="M21 3v6h-6"/></svg>';

function _setButtonIcon(btnId, svgHtml) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const icon = btn.querySelector('.btn-icon');
    if (icon) icon.innerHTML = svgHtml;
}

function updateThemeButton(isLight) {
    const btn = document.getElementById('btn-light');
    if (!btn) return;
    const label = btn.querySelector('.btn-label'); if (label) label.textContent = isLight ? 'Dark' : 'Light';
    btn.title = isLight ? 'Switch to dark theme' : 'Switch to light theme';
    btn.classList.toggle('active', isLight);
    _setButtonIcon('btn-light', isLight ? SVG_MOON : SVG_SUN);
}

// Toggle light/dark theme and persist preference
function toggleLightTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    try { localStorage.setItem('themeMode', isLight ? 'light' : 'dark'); } catch (e) {}
    updateThemeButton(isLight);
}
window.toggleLightTheme = toggleLightTheme;

function updateFullscreenButton(isFull) {
    const btn = document.getElementById('btn-fullscreen');
    if (!btn) return;
    const label = btn.querySelector('.btn-label'); if (label) label.textContent = isFull ? 'Exit Full' : 'Fullscreen';
    btn.title = isFull ? 'Exit fullscreen' : 'Enter fullscreen';
    btn.classList.toggle('active', isFull);
    _setButtonIcon('btn-fullscreen', isFull ? SVG_FULLSCREEN_EXIT : SVG_FULLSCREEN_ENTER);
}

window.resetBookSize = function () {
    try { localStorage.removeItem('bookDefaultSize'); } catch(e){}
    applySavedBookSize();
    try { renderBookSpread(); preRenderPages(appState.pdfSpreadLeft); } catch(e){}
    showBookNotice('Reset view size to default', 2000);
};

// Wire a keyboard shortcut: press 'F' to toggle fullscreen when reading a book and not focused in input
document.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') {
        const active = document.activeElement;
        const tag = active && active.tagName && active.tagName.toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (active && active.isContentEditable)) return;
        if (document.body.classList.contains('book-open')) { e.preventDefault(); toggleFullscreen(); }
    }
});

// Ensure theme button is in sync at startup
try { updateThemeButton(document.body.classList.contains('light-theme')); } catch(e) {}


window.toggleEyeCare = function () {
    const currently = localStorage.getItem('eyeCare') === 'true';
    const now = !currently; localStorage.setItem('eyeCare', now);
    const eyeControls = document.getElementById('eye-controls'); const btn = document.getElementById('btn-eye');
    if (eyeControls) eyeControls.style.display = now ? 'flex' : 'none';
    if (btn) btn.classList.toggle('active', now);
    if (!now) {
        // hide overlay and clear applied warmth visually
        document.documentElement.style.setProperty('--warmth-opacity', '0');
        _updateOverlayVisibility();
    } else {
        const val = parseInt(localStorage.getItem('eyeWarmth'), 10);
        setWarmth(isNaN(val) ? 70 : val);
        // show overlay only when reading a book
        _updateOverlayVisibility();
    }
};

function setWarmth(value, skipSave) {
    const v = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
    if (!skipSave) localStorage.setItem('eyeWarmth', v);
    const opacity = (v / 100);
    document.documentElement.style.setProperty('--warmth-opacity', opacity.toString());
    const disp = document.getElementById('warmth-display'); if (disp) disp.textContent = v;
    const slider = document.getElementById('warmth-slider'); if (slider) slider.value = v;
}

// Internal helpers to keep the warmth overlay scoped to the book view
function _ensureWarmthOverlay() {
    let ov = document.getElementById('warmth-overlay');
    if (!ov) { ov = document.createElement('div'); ov.id = 'warmth-overlay'; ov.style.display = 'none'; document.body.appendChild(ov); }
    return ov;
}

function showOverlayWithFade(ov) {
    ov = ov || _ensureWarmthOverlay();
    ov.style.display = 'block';
    // start from 0 to trigger transition
    ov.style.opacity = '0';
    // ensure the browser has applied the display change
    setTimeout(() => { ov.style.opacity = '1'; }, 12);
}
function hideOverlayWithFade(ov) {
    ov = ov || _ensureWarmthOverlay();
    ov.style.opacity = '0';
    // hide after transition completes
    setTimeout(() => { try { ov.style.display = 'none'; } catch(e){} }, 280);
}

function _updateOverlayVisibility() {
    const ov = _ensureWarmthOverlay();
    const enabled = localStorage.getItem('eyeCare') === 'true';
    if (enabled && document.body.classList.contains('book-open')) {
        const wrap = document.querySelector('.book-canvas-wrap');
        if (wrap) { wrap.style.position = wrap.style.position || 'relative'; wrap.appendChild(ov); showOverlayWithFade(ov); }
        else { hideOverlayWithFade(ov); }
    } else {
        hideOverlayWithFade(ov);
        if (document.body && !document.body.contains(ov)) document.body.appendChild(ov);
    }
}

// Book view sizing helpers: save the current reading view size (persisted to localStorage)
const BOOK_DEFAULT_W = 1200; // nearly full width (updated)
const BOOK_DEFAULT_H = 800; // tall reading area (updated)

document.documentElement.style.setProperty('--warmth-opacity', '0'); // disable warmth overlay by default

function saveBookSize(width, height) {
    try {
        const w = Math.round(Math.max(300, Math.min(window.innerWidth - 80, width || window.innerWidth)));
        const h = Math.round(Math.max(300, Math.min(window.innerHeight - 120, height || window.innerHeight - 120)));
        const data = { w, h };
        localStorage.setItem('bookDefaultSize', JSON.stringify(data));
    } catch (e) { /* ignore */ }
}

function applySavedBookSize() {
    const wrap = document.querySelector('.book-canvas-wrap');
    if (!wrap) return;

    // Force it to be large and responsive (user can still resize)
    wrap.style.width = '95%';
    wrap.style.maxWidth = '2000px';
    wrap.style.minHeight = '88vh';

    // Ensure the resize handle is visible for fine-tuning
    const handle = document.getElementById('resize-handle');
    if (handle) handle.style.display = 'block';
}

// Initialize resize handle used to drag-resize the book view
function initResizeHandle() {
    const handle = document.getElementById('resize-handle');
    const wrap = document.querySelector('.book-canvas-wrap');
    if (!handle || !wrap) return;

    // tooltip element (created in DOM) — used to show live W×H
    let tooltip = document.getElementById('resize-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'resize-tooltip';
        tooltip.className = 'resize-tooltip';
        tooltip.setAttribute('aria-hidden', 'true');
        wrap.appendChild(tooltip);
    }

    let resizing = false; let startX = 0; let startY = 0; let startW = 0; let startH = 0; let pointerId = null;
    let rafPending = false; let lastX = 0; let lastY = 0;

    function updateTooltipPosition(x, y, text) {
        if (!tooltip) return;
        const r = wrap.getBoundingClientRect();
        // keep tooltip inside the wrap horizontally
        const left = Math.min(Math.max(12, x - r.left), r.width - 12);
        const top = Math.max(8, y - r.top - 30);
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        tooltip.textContent = text;
        tooltip.style.opacity = '1';
        tooltip.setAttribute('aria-hidden', 'false');
    }

    function hideTooltip() {
        if (!tooltip) return;
        tooltip.style.opacity = '0';
        tooltip.setAttribute('aria-hidden', 'true');
    }

    function onMove(e) {
        if (!resizing) return;
        lastX = e.clientX; lastY = e.clientY;
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
            rafPending = false;
            const dx = lastX - startX; const dy = lastY - startY;
            let newW = Math.round(startW + dx);
            let newH = Math.round(startH + dy);
            // clamp to viewport
            newW = Math.max(300, Math.min(newW, window.innerWidth - 80));
            newH = Math.max(300, Math.min(newH, window.innerHeight - 120));

            // During drag, disable wrap transitions for instant feedback
            try { wrap.style.transition = 'none'; } catch (err) {}

            // apply size; set maxWidth/height too so CSS constraints don't override
            wrap.style.width = newW + 'px';
            wrap.style.maxWidth = newW + 'px';
            wrap.style.height = newH + 'px';
            wrap.style.minHeight = newH + 'px';

            // update tooltip at the current pointer position
            updateTooltipPosition(lastX, lastY, `${newW}×${newH}`);
        });
    }

    function endResize(e) {
        if (!resizing) return;
        resizing = false;
        try { handle.releasePointerCapture(pointerId); } catch (err) {}
        pointerId = null;
        // remove listeners we added during drag
        document.removeEventListener('pointermove', onMove, { passive: true });
        document.removeEventListener('pointerup', endResize);
        document.removeEventListener('pointercancel', endResize);
        document.body.classList.remove('resizing');

        // restore smooth transitions for subsequent changes
        wrap.style.transition = 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1), min-height 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
        // force layout so transition takes effect smoothly
        void wrap.offsetWidth;

        // persist the new size and re-render (so page canvases fit new size)
        const r = wrap.getBoundingClientRect();
        saveBookSize(Math.round(r.width), Math.round(r.height));
        hideTooltip();
        try { renderBookSpread(); preRenderPages(appState.pdfSpreadLeft); } catch(e){}
        try { showBookNotice(`Saved view size: ${Math.round(r.width)}×${Math.round(r.height)}`, 2200); } catch(e){}
    }

    handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        resizing = true;
        pointerId = e.pointerId;
        startX = e.clientX; startY = e.clientY;
        const r = wrap.getBoundingClientRect(); startW = r.width; startH = r.height;
        try { handle.setPointerCapture(pointerId); } catch (err) {}
        // attach move/up handlers only during drag to avoid extra global work
        document.addEventListener('pointermove', onMove, { passive: true });
        document.addEventListener('pointerup', endResize);
        document.addEventListener('pointercancel', endResize);
        document.body.classList.add('resizing');

        // show tooltip immediately
        updateTooltipPosition(e.clientX, e.clientY, `${Math.round(startW)}×${Math.round(startH)}`);
    });

    // Make handle visible only when a book is open
    handle.style.display = document.body.classList.contains('book-open') ? 'block' : 'none';

    // small hover/tactile feedback for the handle
    handle.addEventListener('mouseenter', () => {
        try { handle.style.backgroundColor = 'rgba(0,120,255,1)'; handle.style.transform = 'scale(1.06)'; } catch(e){}
    });
    handle.addEventListener('mouseleave', () => {
        try { handle.style.backgroundColor = ''; handle.style.transform = ''; } catch(e){}
    });

    // update visibility when book opens or closes
    const observer = new MutationObserver(() => { handle.style.display = document.body.classList.contains('book-open') ? 'block' : 'none'; });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    console.log('Resize handle initialized');
}

// Fullscreen helpers for book reading
function enterFullScreen() {
    try {
        const elem = document.documentElement; // target the whole document so background & bubbles remain visible in fullscreen
        if (elem.requestFullscreen) return elem.requestFullscreen();
        if (elem.webkitRequestFullscreen) return elem.webkitRequestFullscreen();
        if (elem.msRequestFullscreen) return elem.msRequestFullscreen();
    } catch (e) { console.warn('Fullscreen enter failed', e); }
}

function exitFullScreen() {
    try {
        if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
            if (document.exitFullscreen) return document.exitFullscreen();
            if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
            if (document.msExitFullscreen) return document.msExitFullscreen();
        }
    } catch (e) { console.warn('Fullscreen exit failed', e); }
}

window.toggleFullscreen = function () {
    if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
        exitFullScreen();
    } else {
        enterFullScreen();
    }
};

// update UI when fullscreen enters/exits
document.addEventListener('fullscreenchange', () => {
    const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    document.body.classList.toggle('is-fullscreen', isFull);
    const btn = document.getElementById('btn-fullscreen');
    if (btn) { btn.textContent = isFull ? 'Exit Full' : 'Fullscreen'; btn.title = isFull ? 'Exit fullscreen' : 'Enter fullscreen'; btn.classList.toggle('active', isFull); }
    // overlay visibility may need updating when fullscreen changes
    try { _updateOverlayVisibility(); } catch(e) {}

    // When exiting fullscreen while reading a book, capture the current wrap size and make it the default
    if (!isFull && document.body.classList.contains('book-open')) {
        try {
            const wrap = document.querySelector('.book-canvas-wrap');
            if (wrap) {
                const rect = wrap.getBoundingClientRect();
                saveBookSize(Math.round(rect.width), Math.round(rect.height));
                applySavedBookSize();
            }
        } catch(e) { /* ignore measurement errors */ }
    }
});

window.setWarmth = setWarmth;

// expose to inline handlers
window.readAsBook = readAsBook;
window.prevBookPage = prevBookPage;
window.nextBookPage = nextBookPage;
window.closeBookView = closeBookView;
window.goToPage = goToPage;
