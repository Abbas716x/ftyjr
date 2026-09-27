/* ==================================================================
   716QX NEXUS 6.5 — Core App
   ================================================================== */
(function () {
    'use strict';

    const KEY = 'qx716_nexus_v65';
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const fmt = n => new Intl.NumberFormat('en-US').format(Math.round(n || 0));
    const now = () => Date.now();

    const defaultState = () => ({
        tables: [],
        debts: [],
        invoices: [],
        categories: [
            { id: 'c1', name: 'بليستيشن', icon: '🎮' },
            { id: 'c2', name: 'المشروبات', icon: '🥤' },
            { id: 'c3', name: 'المأكولات', icon: '🍕' },
            { id: 'c4', name: 'النراكيل', icon: '💨' }
        ],
        products: [
            { id: 'p1', catId: 'c1', name: 'نصف ساعة', icon: '⏱', type: 'countdown', duration: 30, price: 2000 },
            { id: 'p2', catId: 'c1', name: 'ساعة كاملة', icon: '🕐', type: 'countdown', duration: 60, price: 4000 },
            { id: 'p3', catId: 'c1', name: 'وقت مفتوح', icon: '♾', type: 'open', duration: 0, price: 4000 },
            { id: 'p4', catId: 'c2', name: 'بيبسي', icon: '🥤', type: 'direct', duration: 0, price: 1000 },
            { id: 'p5', catId: 'c2', name: 'عصير برتقال', icon: '🍊', type: 'direct', duration: 0, price: 2000 },
            { id: 'p6', catId: 'c2', name: 'ماء', icon: '💧', type: 'direct', duration: 0, price: 500 },
            { id: 'p7', catId: 'c3', name: 'بيتزا', icon: '🍕', type: 'direct', duration: 0, price: 5000 },
            { id: 'p8', catId: 'c4', name: 'نركيلة تفاح', icon: '💨', type: 'direct', duration: 0, price: 5000 }
        ],
        revenue: { daily: 0, yesterday: 0, monthly: 0 },
        activeView: 'dashboard',
        activeTableId: null,
        pickerCatId: null,
        editingProductId: null,
        earlyItemId: null
    });

    let S = load();

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) return Object.assign(defaultState(), JSON.parse(raw));
        } catch (e) {}
        return defaultState();
    }
    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
    }

    /* ============ Toast ============ */
    function toast(msg, type = 'info', dur = 2500) {
        const wrap = $('#toast-wrap');
        if (!wrap) return;
        const el = document.createElement('div');
        el.className = 'toast ' + type;
        el.textContent = msg;
        wrap.appendChild(el);
        setTimeout(() => {
            el.style.transition = 'all .25s';
            el.style.opacity = '0';
            el.style.transform = 'translateY(-15px)';
            setTimeout(() => el.remove(), 300);
        }, dur);
    }

    /* ============ Time ============ */
    const pad = n => String(n).padStart(2, '0');
    function timeStr(sec) {
        sec = Math.max(0, Math.floor(sec));
        return pad(Math.floor(sec / 3600)) + ':' + pad(Math.floor((sec % 3600) / 60)) + ':' + pad(sec % 60);
    }
    function dateStr(iso) {
        const d = new Date(iso);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    /* ============ Clock ============ */
    setInterval(() => {
        const el = $('#live-clock');
        if (el) el.textContent = new Date().toLocaleTimeString('en-GB');
    }, 1000);

    /* ============ Calc ============ */
    function itemElapsed(it) {
        if (it.type === 'direct') return 0;
        let e = it.sessionElapsed || 0;
        if (it.status === 'running') {
            e += (now() - it.startedAt) / 1000 - (it.pausedTotal || 0);
        }
        return Math.max(0, e);
    }
    function itemTotal(it) {
        if (it.type === 'direct') return it.price * it.qty;
        if (it.type === 'countdown') return it.price * it.qty;
        if (it.type === 'open') {
            const e = itemElapsed(it);
            return Math.round((e * it.price / 3600) * it.qty);
        }
        return 0;
    }
    function itemExpired(it) {
        if (it.type !== 'countdown') return false;
        return itemElapsed(it) >= it.duration * 60 * it.qty;
    }
    function tableTotals(t) {
        let sub = 0, early = 0;
        t.items.forEach(it => { sub += itemTotal(it); early += (it.earlyPaid || 0); });
        const disc = Number(t.discount) || 0;
        return { sub, early, disc, final: Math.max(0, sub - early - disc) };
    }

    /* ============ Drawer / Modals ============ */
    function openDrawer() { $('#drawer').classList.add('open'); $('#drawer-overlay').classList.add('show'); }
    function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawer-overlay').classList.remove('show'); }
    function openModal(id) { const m = document.getElementById(id); if (m) m.style.display = 'flex'; }
    function closeModal(id) { const m = document.getElementById(id); if (m) m.style.display = 'none'; }

    /* ============ Views ============ */
    function switchView(v) {
        S.activeView = v;
        save();
        $$('.view').forEach(x => x.classList.remove('active'));
        const target = document.getElementById('view-' + v);
        if (target) target.classList.add('active');
        $$('.nav-item').forEach(b => b.classList.remove('active'));
        const nb = document.querySelector(`.nav-item[data-view="${v}"]`);
        if (nb) nb.classList.add('active');
        closeDrawer();
        window.scrollTo({ top: 0, behavior: 'instant' });
        if (v === 'dashboard') renderDashboard();
        if (v === 'tables') renderTables();
        if (v === 'table-detail') renderTableDetail();
        if (v === 'menu') renderMenu();
        if (v === 'debts') renderDebts();
        if (v === 'invoices') renderInvoices();
    }

    /* ============ Dashboard ============ */
    function renderDashboard() {
        $('#stat-daily').textContent = fmt(S.revenue.daily);
        $('#stat-yesterday').textContent = fmt(S.revenue.yesterday);
        $('#stat-monthly').textContent = fmt(S.revenue.monthly);
    }
    function transferDaily() {
        if (S.revenue.daily <= 0) { toast('لا توجد مبيعات لترحيلها', 'warn'); return; }
        if (!confirm('ترحيل إيراد اليوم إلى الأمس وإضافته للشهر؟')) return;
        S.revenue.monthly += S.revenue.daily;
        S.revenue.yesterday = S.revenue.daily;
        S.revenue.daily = 0;
        save(); renderDashboard();
        toast('تم الترحيل: ' + fmt(S.revenue.yesterday) + ' IQD', 'success');
    }
    function resetMonthly() { S.revenue.monthly = 0; save(); renderDashboard(); toast('تم تصفير الشهر', 'warn'); }
    function resetDaily() { S.revenue.daily = 0; save(); renderDashboard(); toast('تم تصفير اليوم', 'warn'); }
    function resetAll() { S = defaultState(); save(); renderAll(); switchView('dashboard'); toast('تم إعادة الضبط', 'error'); }

    /* ============ Tables List ============ */
    function renderTables() {
        const grid = $('#tables-grid');
        if (!grid) return;
        const q = ($('#search-tables')?.value || '').toLowerCase().trim();
        let list = S.tables.slice();
        if (q) list = list.filter(t => t.name.toLowerCase().includes(q) || (t.customer || '').toLowerCase().includes(q));
        if (list.length === 0) {
            grid.innerHTML = `
                <div class="glass p-8 text-center" style="grid-column:1/-1">
                    <div style="font-size:56px;margin-bottom:12px;opacity:.5">🎮</div>
                    <h3 class="text-xl font-black text-white mb-2">لا توجد طاولات</h3>
                    <p class="text-gray-400 text-sm mb-5">ابدأ بفتح طاولة جديدة</p>
                    <button class="btn btn-primary" onclick="openAddTableModal()">+ فتح طاولة</button>
                </div>`;
            return;
        }
        grid.innerHTML = list.map(t => {
            const tot = tableTotals(t);
            const running = t.items.filter(i => i.type !== 'direct' && i.status === 'running').length;
            return `
                <div class="table-card ${running > 0 ? 'busy' : 'idle'}" onclick="openTableDetail('${t.id}')">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h3 class="text-lg font-black text-white" style="font-family:'Orbitron',sans-serif;letter-spacing:.05em">${escapeHtml(t.name)}</h3>
                            <p class="text-[10px] text-gray-400 font-mono mt-1">${escapeHtml(t.customer || 'GUEST')}</p>
                        </div>
                        <span class="pulse-dot" style="background:${running > 0 ? '#00FF88' : '#4B5563'};color:${running > 0 ? '#00FF88' : '#4B5563'}"></span>
                    </div>
                    <div class="space-y-2 mb-3">
                        <div class="flex justify-between text-xs"><span class="text-gray-500 font-mono">ITEMS</span><span class="text-white font-mono font-bold">${t.items.length}</span></div>
                        <div class="flex justify-between text-xs"><span class="text-gray-500 font-mono">SUBTOTAL</span><span class="font-mono font-bold" style="color:#00FFFF">${fmt(tot.sub)}</span></div>
                    </div>
                    <div class="pt-3 flex justify-between items-center" style="border-top:1.5px solid rgba(255,255,255,.06)">
                        <span class="text-[10px] text-gray-500 font-mono">${dateStr(t.createdAt).slice(0, 10)}</span>
                        <span class="font-mono font-black" style="color:#C026D3;font-size:17px;text-shadow:0 0 15px #C026D3">${fmt(tot.final)} <span style="font-size:9px;color:#6b6b80">IQD</span></span>
                    </div>
                </div>`;
        }).join('');
    }

    function openAddTableModal() {
        $('#new-table-name').value = '';
        openModal('modal-add-table');
        setTimeout(() => $('#new-table-name').focus(), 150);
    }
    function suggestTable(p) {
        const i = $('#new-table-name');
        i.value = p + (S.tables.length + 1);
        i.focus();
    }
    function confirmAddTable() {
        const name = $('#new-table-name').value.trim();
        if (!name) { toast('أدخل اسم الطاولة', 'error'); return; }
        if (S.tables.some(t => t.name === name)) { toast('يوجد طاولة بنفس الاسم', 'error'); return; }
        S.tables.push({ id: uid(), name, customer: '', items: [], discount: 0, createdAt: new Date().toISOString(), status: 'open' });
        save(); closeModal('modal-add-table'); renderTables();
        toast('تم فتح "' + name + '"', 'success');
    }

    /* ============ Table Detail ============ */
    function openTableDetail(id) {
        const t = S.tables.find(x => x.id === id);
        if (!t) return;
        S.activeTableId = id;
        save();
        switchView('table-detail');
    }
    function renderTableDetail() {
        const t = currentTable();
        if (!t) { switchView('tables'); return; }
        $('#detail-table-name').textContent = t.name;
        $('#detail-table-customer').textContent = (t.customer || 'GUEST').toUpperCase();
        $('#detail-customer-input').value = t.customer || '';
        $('#detail-discount-input').value = t.discount || '';
        const list = $('#detail-items');
        if (t.items.length === 0) {
            list.innerHTML = `
                <div class="text-center py-14" style="border:2px dashed rgba(0,255,255,.15);border-radius:18px">
                    <div style="font-size:44px;margin-bottom:8px;opacity:.4">📦</div>
                    <p class="text-gray-500 text-sm">لا توجد أصناف</p>
                    <p class="text-gray-600 text-xs mt-1">اضغط "إضافة منتج"</p>
                </div>`;
        } else {
            list.innerHTML = t.items.map(it => {
                const total = itemTotal(it);
                const elapsed = itemElapsed(it);
                const rem = it.type === 'countdown' ? Math.max(0, it.duration * 60 * it.qty - elapsed) : 0;
                const exp = itemExpired(it);
                let badge = '';
                if (it.type === 'direct') badge = `<span class="badge badge-direct">صنف مباشر</span>`;
                else if (it.status === 'paused') badge = `<span class="badge badge-paused">⏸ موقوف</span>`;
                else if (exp) badge = `<span class="badge badge-expired">⏰ انتهى</span>`;
                else badge = `<span class="badge badge-live">● شغال</span>`;
                return `
                    <div class="item-box">
                        <div class="flex justify-between items-start mb-3">
                            <div class="flex items-center gap-3">
                                <div style="width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,rgba(192,38,211,.2),rgba(0,255,255,.15));border:1.5px solid rgba(0,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:22px">${it.icon}</div>
                                <div>
                                    <h5 class="font-bold text-white">${escapeHtml(it.name)}</h5>
                                    <div class="flex items-center gap-2 mt-1">${badge}</div>
                                </div>
                            </div>
                            <div class="text-left">
                                <div class="font-mono font-black" style="color:#00FFFF;font-size:17px;text-shadow:0 0 15px rgba(0,255,255,.5)">${fmt(total)}</div>
                                <div class="text-[9px] font-mono" style="color:#6b6b80">IQD</div>
                            </div>
                        </div>
                        ${it.type !== 'direct' ? `
                            <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                                <div style="background:rgba(0,0,0,.45);padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.05)">
                                    <div class="text-[9px] font-mono mb-1" style="color:#6b6b80">ELAPSED</div>
                                    <div class="font-mono font-bold text-white">${timeStr(elapsed)}</div>
                                </div>
                                ${it.type === 'countdown' ? `
                                    <div style="background:rgba(0,0,0,.45);padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.05)">
                                        <div class="text-[9px] font-mono mb-1" style="color:#6b6b80">REMAIN</div>
                                        <div class="font-mono font-bold" style="color:${exp ? '#FF0080' : '#00FF88'}">${timeStr(rem)}</div>
                                    </div>` : `
                                    <div style="background:rgba(0,0,0,.45);padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.05)">
                                        <div class="text-[9px] font-mono mb-1" style="color:#6b6b80">TYPE</div>
                                        <div class="font-bold text-[10px]" style="color:#C026D3">مفتوح/ساعة</div>
                                    </div>`}
                            </div>` : ''}
                        <div class="flex items-center gap-2 flex-wrap">
                            <div class="flex items-center gap-2">
                                <button class="qty-btn" onclick="changeQty('${it.id}',-1)">−</button>
                                <span class="font-mono font-black text-white" style="min-width:28px;text-align:center;font-size:15px">${it.qty}</span>
                                <button class="qty-btn" onclick="changeQty('${it.id}',1)">+</button>
                            </div>
                            ${it.type !== 'direct' && it.status === 'running' ? `<button class="btn btn-ghost btn-mini" onclick="pauseItem('${it.id}')">⏸ إيقاف</button>` : ''}
                            ${it.type !== 'direct' && it.status === 'paused' ? `<button class="btn btn-ghost btn-mini" style="color:#00FF88;border-color:rgba(0,255,136,.4)" onclick="resumeItem('${it.id}')">▶ استئناف</button>` : ''}
                            <button class="btn btn-ghost btn-mini" style="color:#00FF88;border-color:rgba(0,255,136,.4)" onclick="openEarly('${it.id}')">⚡ دفع</button>
                            <button class="btn btn-ghost btn-mini" style="color:#FF0080;border-color:rgba(255,0,128,.4);margin-right:auto" onclick="removeItem('${it.id}')">🗑</button>
                        </div>
                        ${(it.earlyPaid || 0) > 0 ? `
                            <div class="mt-3 pt-3 flex justify-between text-xs" style="border-top:1px solid rgba(255,255,255,.05)">
                                <span style="color:#00FF88">مدفوع مسبقاً:</span>
                                <span class="font-mono font-bold" style="color:#00FF88">${fmt(it.earlyPaid)} IQD</span>
                            </div>` : ''}
                    </div>`;
            }).join('');
        }
        const tot = tableTotals(t);
        $('#d-sum-sub').textContent = fmt(tot.sub) + ' IQD';
        $('#d-sum-early').textContent = fmt(tot.early) + ' IQD';
        $('#d-sum-disc').textContent = '-' + fmt(tot.disc) + ' IQD';
        $('#d-sum-final').textContent = fmt(tot.final);
    }
    const currentTable = () => S.tables.find(x => x.id === S.activeTableId);
    function updateTableCustomer(v) {
        const t = currentTable(); if (!t) return;
        t.customer = v.trim(); save();
        $('#detail-table-customer').textContent = (t.customer || 'GUEST').toUpperCase();
    }
    function updateTableDiscount(v) {
        const t = currentTable(); if (!t) return;
        t.discount = Math.max(0, Number(v) || 0); save(); renderTableDetail();
    }
    function changeQty(id, delta) {
        const t = currentTable(); if (!t) return;
        const it = t.items.find(i => i.id === id); if (!it) return;
        it.qty = Math.max(1, (it.qty || 1) + delta); save(); renderTableDetail();
    }
    function pauseItem(id) {
        const t = currentTable(); if (!t) return;
        const it = t.items.find(i => i.id === id); if (!it || it.status !== 'running') return;
        it.sessionElapsed = itemElapsed(it); it.status = 'paused'; it.pausedAt = now();
        save(); renderTableDetail();
    }
    function resumeItem(id) {
        const t = currentTable(); if (!t) return;
        const it = t.items.find(i => i.id === id); if (!it || it.status !== 'paused') return;
        it.startedAt = now(); it.pausedTotal = 0; it.status = 'running';
        save(); renderTableDetail();
    }
    function removeItem(id) {
        const t = currentTable(); if (!t) return;
        if (!confirm('حذف هذا الصنف؟')) return;
        t.items = t.items.filter(i => i.id !== id); save(); renderTableDetail();
        toast('تم الحذف', 'warn');
    }

    /* ============ Product Picker ============ */
    function openProductPicker() { S.pickerCatId = null; renderPicker(); openModal('modal-picker'); }
    function pickerBack() { S.pickerCatId = null; renderPicker(); }
    function pickerSelectCat(catId) { S.pickerCatId = catId; renderPicker(); }
    function renderPicker() {
        const body = $('#picker-body');
        const title = $('#picker-title');
        const sub = $('#picker-subtitle');
        const backBtn = $('#picker-back');
        if (!S.pickerCatId) {
            title.textContent = 'اختر القسم';
            sub.textContent = 'اضغط على القسم لعرض الأصناف';
            backBtn.classList.add('hidden');
            if (S.categories.length === 0) { body.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:#6b6b80">لا توجد أقسام</div>`; return; }
            body.innerHTML = S.categories.map(c => `
                <div class="cat-card" onclick="pickerSelectCat('${c.id}')">
                    <div style="font-size:38px;margin-bottom:10px">${c.icon}</div>
                    <div class="font-black text-white text-sm">${escapeHtml(c.name)}</div>
                    <div class="text-[10px] mt-1 font-mono" style="color:#6b6b80">${S.products.filter(p => p.catId === c.id).length} صنف</div>
                </div>`).join('');
        } else {
            const cat = S.categories.find(c => c.id === S.pickerCatId);
            title.textContent = cat ? cat.name : 'الأصناف';
            sub.textContent = 'اضغط على الصنف لإضافته';
            backBtn.classList.remove('hidden');
            const prods = S.products.filter(p => p.catId === S.pickerCatId);
            if (prods.length === 0) { body.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:#6b6b80">لا توجد أصناف</div>`; return; }
            body.innerHTML = prods.map(p => `
                <div class="cat-card" onclick="pickerAddProduct('${p.id}')">
                    <div style="font-size:34px;margin-bottom:8px">${p.icon}</div>
                    <div class="font-black text-white text-xs">${escapeHtml(p.name)}</div>
                    <div class="font-mono font-black text-sm mt-2" style="color:#00FFFF;text-shadow:0 0 12px rgba(0,255,255,.5)">${fmt(p.price)}</div>
                    <div class="text-[9px] mt-1" style="color:#6b6b80">${p.type === 'direct' ? 'مباشر' : p.type === 'countdown' ? p.duration + ' دقيقة' : 'مفتوح/ساعة'}</div>
                </div>`).join('');
        }
    }
    function pickerAddProduct(pid) {
        const p = S.products.find(x => x.id === pid);
        const t = currentTable();
        if (!p || !t) return;
        t.items.push({
            id: uid(), productId: p.id, name: p.name, icon: p.icon,
            type: p.type, price: p.price, duration: p.duration || 0,
            qty: 1, startedAt: now(), pausedAt: null, pausedTotal: 0,
            sessionElapsed: 0, earlyPaid: 0,
            status: p.type === 'direct' ? 'done' : 'running'
        });
        save(); renderTableDetail();
        toast('تمت إضافة "' + p.name + '"', 'success', 1200);
        S.pickerCatId = null; renderPicker();
    }

    /* ============ Early Payment ============ */
    function openEarly(id) {
        const t = currentTable(); if (!t) return;
        const it = t.items.find(i => i.id === id); if (!it) return;
        S.earlyItemId = id;
        const total = itemTotal(it);
        const paid = it.earlyPaid || 0;
        const rem = Math.max(0, total - paid);
        $('#early-name').textContent = it.name;
        $('#early-total').textContent = fmt(total) + ' IQD';
        $('#early-paid').textContent = fmt(paid) + ' IQD';
        $('#early-remain').textContent = fmt(rem) + ' IQD';
        $('#early-amount').value = rem;
        openModal('modal-early');
    }
    function quickPayOne() {
        const t = currentTable(); if (!t) return;
        const it = t.items.find(i => i.id === S.earlyItemId); if (!it) return;
        const rem = Math.max(0, itemTotal(it) - (it.earlyPaid || 0));
        $('#early-amount').value = Math.min(it.price, rem);
    }
    function quickPayAll() {
        const t = currentTable(); if (!t) return;
        const it = t.items.find(i => i.id === S.earlyItemId); if (!it) return;
        const rem = Math.max(0, itemTotal(it) - (it.earlyPaid || 0));
        $('#early-amount').value = rem;
    }
    function confirmEarly() {
        const t = currentTable(); if (!t) return;
        const it = t.items.find(i => i.id === S.earlyItemId); if (!it) return;
        const amount = Math.max(0, Number($('#early-amount').value) || 0);
        const total = itemTotal(it);
        const paid = it.earlyPaid || 0;
        const rem = Math.max(0, total - paid);
        if (amount <= 0) { toast('أدخل مبلغاً صحيحاً', 'error'); return; }
        if (amount > rem) { toast('المبلغ أكبر من المتبقي', 'error'); return; }
        it.earlyPaid = paid + amount;
        S.revenue.daily += amount;
        save(); closeModal('modal-early'); renderTableDetail();
        toast('تم استلام ' + fmt(amount) + ' IQD', 'success');
    }

    /* ============ Checkout ============ */
    function openCheckout() {
        const t = currentTable(); if (!t) return;
        const tot = tableTotals(t);
        $('#co-total').textContent = fmt(tot.final) + ' IQD';
        $('#co-paid').value = tot.final;
        $('#co-debt').value = '0 IQD';
        openModal('modal-checkout');
    }
    function calcSplit() {
        const t = currentTable(); if (!t) return;
        const tot = tableTotals(t);
        const paid = Math.max(0, Number($('#co-paid').value) || 0);
        const debt = Math.max(0, tot.final - paid);
        $('#co-debt').value = fmt(debt) + ' IQD';
    }
    function confirmCheckout() {
        const t = currentTable(); if (!t) return;
        const tot = tableTotals(t);
        const paid = Math.max(0, Math.min(tot.final, Number($('#co-paid').value) || 0));
        const debt = Math.max(0, tot.final - paid);
        const inv = {
            id: 'INV-' + Date.now().toString().slice(-7),
            tableName: t.name,
            customer: t.customer || 'زبون عام',
            total: tot.final,
            subtotal: tot.sub,
            discount: tot.disc,
            early: tot.early,
            paid, debt,
            date: new Date().toISOString(),
            items: t.items.map(i => ({
                name: i.name, icon: i.icon, qty: i.qty,
                price: i.price, total: itemTotal(i), type: i.type,
                duration: i.duration, earlyPaid: i.earlyPaid || 0
            }))
        };
        S.invoices.unshift(inv);
        S.revenue.daily += paid;
        if (debt > 0) {
            S.debts.unshift({
                id: uid(), customer: t.customer || 'زبون عام',
                amount: debt, paid: 0, tableName: t.name,
                date: new Date().toISOString(), status: 'unpaid', invoiceId: inv.id
            });
        }
        S.tables = S.tables.filter(x => x.id !== t.id);
        S.activeTableId = null;
        save(); closeModal('modal-checkout'); switchView('invoices');
        toast(debt > 0 ? 'دفع ' + fmt(paid) + ' + دين ' + fmt(debt) : 'تم إغلاق الحساب', 'success');
    }

    /* ============ Transfer ============ */
    function openTransfer() {
        const t = currentTable(); if (!t) return;
        const others = S.tables.filter(x => x.id !== t.id);
        const sel = $('#transfer-select');
        if (others.length === 0) sel.innerHTML = '<option value="">لا توجد طاولات أخرى</option>';
        else sel.innerHTML = others.map(o => `<option value="${o.id}">${escapeHtml(o.name)}${o.customer ? ' — ' + escapeHtml(o.customer) : ''}</option>`).join('');
        openModal('modal-transfer');
    }
    function confirmTransfer() {
        const t = currentTable(); if (!t) return;
        const tid = $('#transfer-select').value;
        const target = S.tables.find(x => x.id === tid);
        if (!target) { toast('اختر طاولة صحيحة', 'error'); return; }
        target.items = target.items.concat(t.items);
        target.discount = (target.discount || 0) + (t.discount || 0);
        if (t.customer && !target.customer) target.customer = t.customer;
        S.tables = S.tables.filter(x => x.id !== t.id);
        S.activeTableId = target.id;
        save(); closeModal('modal-transfer'); renderTableDetail();
        toast('تم الدمج مع "' + target.name + '"', 'success');
    }
    function deleteCurrentTable() {
        S.tables = S.tables.filter(x => x.id !== S.activeTableId);
        S.activeTableId = null; save(); switchView('tables');
        toast('تم إلغاء الطاولة', 'warn');
    }

    /* ============ Debts ============ */
    function renderDebts() {
        const grid = $('#debts-grid');
        if (!grid) return;
        const q = ($('#search-debts')?.value || '').toLowerCase().trim();
        let list = S.debts.slice();
        if (q) list = list.filter(d => (d.customer || '').toLowerCase().includes(q));
        if (list.length === 0) {
            grid.innerHTML = `
                <div class="glass p-8 text-center" style="grid-column:1/-1">
                    <div style="font-size:52px;margin-bottom:12px">📒</div>
                    <h3 class="text-xl font-black text-white mb-1">لا توجد ديون</h3>
                    <p class="text-gray-400 text-sm">كل الحسابات مسددة ✅</p>
                </div>`;
            return;
        }
        grid.innerHTML = list.map(d => {
            const rem = Math.max(0, d.amount - (d.paid || 0));
            const paidFull = rem <= 0;
            return `
                <div class="debt-card ${paidFull ? 'paid' : ''}">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h3 class="font-black text-white text-base">${escapeHtml(d.customer)}</h3>
                            <p class="text-[10px] text-gray-400 mt-1 font-mono">${escapeHtml(d.tableName)} • ${dateStr(d.date)}</p>
                        </div>
                        <span class="badge ${paidFull ? 'badge-live' : 'badge-expired'}">${paidFull ? 'مسدد' : 'غير مسدد'}</span>
                    </div>
                    <div class="space-y-2 mb-4 text-xs">
                        <div class="flex justify-between"><span class="text-gray-400">الأصلي:</span><span class="font-mono font-bold text-white">${fmt(d.amount)}</span></div>
                        <div class="flex justify-between"><span class="text-gray-400">المدفوع:</span><span class="font-mono font-bold" style="color:#00FF88">${fmt(d.paid || 0)}</span></div>
                        <div class="flex justify-between"><span class="text-gray-400">المتبقي:</span><span class="font-mono font-bold" style="color:#FF0080;font-size:15px">${fmt(rem)}</span></div>
                    </div>
                    ${!paidFull ? `
                        <div class="flex gap-2">
                            <button class="btn btn-success flex-1" style="padding:10px;font-size:12px" onclick="payDebt('${d.id}')">💵 تسديد</button>
                            <button class="btn btn-ghost" style="padding:10px;font-size:12px" onclick="payDebtFull('${d.id}')">كامل</button>
                        </div>` : `<div class="text-center text-xs font-bold py-2" style="color:#00FF88">✓ تم التسديد</div>`}
                </div>`;
        }).join('');
    }
    function payDebt(id) {
        const d = S.debts.find(x => x.id === id); if (!d) return;
        const rem = d.amount - (d.paid || 0);
        const amt = prompt(`المتبقي: ${fmt(rem)} IQD\nأدخل المبلغ:`, rem);
        if (amt === null) return;
        const n = Math.max(0, Math.min(rem, Number(amt) || 0));
        if (n <= 0) { toast('مبلغ غير صحيح', 'error'); return; }
        d.paid = (d.paid || 0) + n;
        if (d.paid >= d.amount) d.status = 'paid';
        S.revenue.daily += n;
        save(); renderDebts();
        toast('تم استلام ' + fmt(n) + ' IQD', 'success');
    }
    function payDebtFull(id) {
        const d = S.debts.find(x => x.id === id); if (!d) return;
        const rem = d.amount - (d.paid || 0);
        if (!confirm('تسديد كلي: ' + fmt(rem) + ' IQD؟')) return;
        d.paid = d.amount; d.status = 'paid';
        S.revenue.daily += rem; save(); renderDebts();
        toast('تم التسديد', 'success');
    }

    /* ============ Invoices ============ */
    function renderInvoices() {
        const grid = $('#invoices-grid');
        if (!grid) return;
        const q = ($('#search-invoices')?.value || '').toLowerCase().trim();
        let list = S.invoices.slice();
        if (q) list = list.filter(i =>
            i.id.toLowerCase().includes(q) ||
            (i.tableName || '').toLowerCase().includes(q) ||
            (i.customer || '').toLowerCase().includes(q)
        );
        if (list.length === 0) {
            grid.innerHTML = `
                <div class="glass p-8 text-center" style="grid-column:1/-1">
                    <div style="font-size:52px;margin-bottom:12px;opacity:.5">🧾</div>
                    <h3 class="text-xl font-black text-white mb-1">لا توجد فواتير</h3>
                    <p class="text-gray-400 text-sm">${q ? 'لا نتائج مطابقة' : 'لم يتم أرشفة أي فاتورة بعد'}</p>
                </div>`;
            return;
        }
        grid.innerHTML = list.map(inv => `
            <div class="inv-card" onclick="openInvoiceDetail('${inv.id}')">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <div class="font-mono text-[11px] font-black" style="color:#00FFFF">${inv.id}</div>
                        <h3 class="font-black text-white text-base mt-1">${escapeHtml(inv.tableName)}</h3>
                        <p class="text-[11px] text-gray-400 mt-0.5">${escapeHtml(inv.customer)}</p>
                    </div>
                    <span class="badge ${inv.debt > 0 ? 'badge-expired' : 'badge-live'}">${inv.debt > 0 ? 'دين' : 'مسدد'}</span>
                </div>
                <div class="space-y-1.5 text-xs mt-3 pt-3" style="border-top:1px solid rgba(255,255,255,.06)">
                    <div class="flex justify-between"><span class="text-gray-500">عدد الأصناف</span><span class="font-mono text-white">${inv.items.length}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">الإجمالي</span><span class="font-mono font-black" style="color:#C026D3;font-size:15px">${fmt(inv.total)} <span style="font-size:9px;color:#6b6b80">IQD</span></span></div>
                    ${inv.debt > 0 ? `<div class="flex justify-between"><span class="text-gray-500">المتبقي</span><span class="font-mono font-bold" style="color:#FF0080">${fmt(inv.debt)} IQD</span></div>` : ''}
                </div>
                <div class="mt-3 pt-3 flex justify-between items-center text-[10px] font-mono" style="border-top:1px solid rgba(255,255,255,.06);color:#6b6b80">
                    <span>${dateStr(inv.date)}</span>
                    <span style="color:#00FFFF">اضغط للتفاصيل →</span>
                </div>
            </div>
        `).join('');
    }

    function openInvoiceDetail(id) {
        const inv = S.invoices.find(x => x.id === id);
        if (!inv) return;
        const body = $('#invoice-detail-body');
        const itemsRows = inv.items.map(i => `
            <tr>
                <td>${i.icon || '📦'} ${escapeHtml(i.name)}</td>
                <td class="font-mono">${i.qty}</td>
                <td class="font-mono">${fmt(i.price)}</td>
                <td class="font-mono font-black" style="color:#00FFFF">${fmt(i.total)}</td>
            </tr>`).join('');

        body.innerHTML = `
            <div class="balance-panel mb-4">
                <div class="flex justify-between items-center mb-1" style="position:relative;z-index:1">
                    <span class="font-mono text-xs" style="color:#00FFFF">${inv.id}</span>
                    <span class="badge ${inv.debt > 0 ? 'badge-expired' : 'badge-live'}">${inv.debt > 0 ? 'دين' : 'مسدد'}</span>
                </div>
                <div class="flex justify-between items-center mt-2" style="position:relative;z-index:1">
                    <h4 class="font-black text-white text-lg">${escapeHtml(inv.tableName)}</h4>
                    <span class="text-[11px] text-gray-400 font-mono">${dateStr(inv.date)}</span>
                </div>
                <div class="text-[11px] text-gray-400 mt-1" style="position:relative;z-index:1">👤 ${escapeHtml(inv.customer)}</div>
            </div>

            <h5 class="text-xs font-black mb-2" style="color:#00FFFF;font-family:'JetBrains Mono',monospace;letter-spacing:.1em">◆ ITEMS (${inv.items.length})</h5>
            <div class="glass" style="padding:0;overflow:hidden">
                <div class="overflow-x-auto no-scrollbar">
                    <table class="inv-items-table" style="min-width:400px">
                        <thead>
                            <tr>
                                <th>الصنف</th>
                                <th>الكمية</th>
                                <th>السعر</th>
                                <th>الإجمالي</th>
                            </tr>
                        </thead>
                        <tbody>${itemsRows || '<tr><td colspan="4" style="text-align:center;color:#6b6b80;padding:20px">لا توجد أصناف</td></tr>'}</tbody>
                    </table>
                </div>
            </div>

            <div class="mt-4">
                <div class="inv-row"><span class="inv-label">الإجمالي الفرعي:</span><span class="inv-value">${fmt(inv.subtotal || inv.total + (inv.discount||0))} IQD</span></div>
                ${(inv.early || 0) > 0 ? `<div class="inv-row"><span class="inv-label" style="color:#00FF88">مدفوع مسبقاً:</span><span class="inv-value" style="color:#00FF88">-${fmt(inv.early)} IQD</span></div>` : ''}
                ${(inv.discount || 0) > 0 ? `<div class="inv-row"><span class="inv-label" style="color:#FF0080">خصم:</span><span class="inv-value" style="color:#FF0080">-${fmt(inv.discount)} IQD</span></div>` : ''}
            </div>

            <div class="inv-total-box">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-sm font-bold text-white">الإجمالي النهائي:</span>
                    <span class="font-mono font-black" style="color:#C026D3;font-size:18px">${fmt(inv.total)} IQD</span>
                </div>
                <div class="flex justify-between items-center mb-2 text-xs">
                    <span style="color:#00FF88">المدفوع كاش:</span>
                    <span class="font-mono font-bold" style="color:#00FF88">${fmt(inv.paid)} IQD</span>
                </div>
                ${inv.debt > 0 ? `
                    <div class="flex justify-between items-center text-xs">
                        <span style="color:#FF0080">المتبقي (دين):</span>
                        <span class="font-mono font-bold" style="color:#FF0080">${fmt(inv.debt)} IQD</span>
                    </div>` : ''}
            </div>

            <div class="flex gap-2 mt-5">
                <button class="btn btn-ghost flex-1" onclick="printInv('${inv.id}')">🖨 طباعة</button>
                <button class="btn btn-primary flex-1" onclick="closeModal('modal-invoice')">إغلاق</button>
            </div>
        `;
        openModal('modal-invoice');
    }

    function printInv(id) {
        const inv = S.invoices.find(x => x.id === id); if (!inv) return;
        const w = window.open('', '_blank');
        w.document.write(`<html dir="rtl"><head><title>${inv.id}</title><meta charset="utf-8"><style>
            body{font-family:Tahoma;padding:30px;color:#000;max-width:500px;margin:auto}
            h1{text-align:center;color:#8B5CF6;margin-bottom:6px}
            .sub{text-align:center;color:#888;margin-bottom:20px;font-size:12px}
            table{width:100%;border-collapse:collapse;margin-top:20px}
            th,td{border:1px solid #ccc;padding:10px;text-align:right;font-size:13px}
            th{background:#f5f5f5}
            .tot{margin-top:20px;padding:14px;border-radius:10px;background:#f9f9f9;border:2px solid #8B5CF6}
            .tot p{margin:4px 0}
        </style></head><body>
            <h1>716QX NEXUS</h1>
            <div class="sub">فاتورة رقم ${inv.id}</div>
            <p><b>الطاولة:</b> ${inv.tableName}</p>
            <p><b>الزبون:</b> ${inv.customer}</p>
            <p><b>التاريخ:</b> ${dateStr(inv.date)}</p>
            <table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
            <tbody>${inv.items.map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>${fmt(i.price)}</td><td>${fmt(i.total)}</td></tr>`).join('')}</tbody></table>
            <div class="tot">
                <p><b>الإجمالي:</b> ${fmt(inv.total)} IQD</p>
                <p><b>المدفوع:</b> ${fmt(inv.paid)} IQD</p>
                <p><b>الدين:</b> ${fmt(inv.debt)} IQD</p>
            </div>
        </body></html>`);
        w.document.close();
        setTimeout(() => w.print(), 400);
    }

    function exportCSV() {
        if (S.invoices.length === 0) { toast('لا توجد فواتير', 'warn'); return; }
        const rows = [['ID', 'Table', 'Customer', 'Subtotal', 'Discount', 'Total', 'Paid', 'Debt', 'Date']];
        S.invoices.forEach(inv => rows.push([
            inv.id, inv.tableName, inv.customer,
            inv.subtotal || 0, inv.discount || 0,
            inv.total, inv.paid, inv.debt, dateStr(inv.date)
        ]));
        const csv = '\uFEFF' + rows.map(r => r.map(x => `"${x}"`).join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        a.download = 'invoices_' + Date.now() + '.csv';
        a.click();
        toast('تم التصدير', 'success');
    }
    function clearInvoices() { S.invoices = []; save(); renderInvoices(); toast('تم المسح', 'warn'); }

    /* ============ Menu ============ */
    function renderMenu() {
        const container = $('#menu-container');
        if (!container) return;
        if (S.categories.length === 0) {
            container.innerHTML = `<div class="glass p-8 text-center"><div style="font-size:52px;margin-bottom:12px">📋</div><p class="text-gray-400">لا توجد أقسام. أضف قسماً جديداً</p></div>`;
            return;
        }
        container.innerHTML = S.categories.map(c => {
            const prods = S.products.filter(p => p.catId === c.id);
            return `
                <div class="glass p-5">
                    <div class="flex justify-between items-center mb-4">
                        <div class="flex items-center gap-3">
                            <div style="font-size:28px">${c.icon}</div>
                            <div>
                                <h3 class="text-lg font-black text-white">${escapeHtml(c.name)}</h3>
                                <p class="text-[10px] font-mono" style="color:#6b6b80">${prods.length} ITEMS</p>
                            </div>
                        </div>
                        <button class="btn btn-ghost btn-mini" style="color:#FF0080;border-color:rgba(255,0,128,.3)" onclick="deleteCategory('${c.id}')">🗑 حذف</button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        ${prods.length === 0
                            ? `<div style="grid-column:1/-1;text-align:center;padding:20px;color:#6b6b80;font-size:12px;border:1px dashed rgba(255,255,255,.08);border-radius:12px">لا توجد أصناف</div>`
                            : prods.map(p => `
                                <div class="flex items-center gap-3 p-3" style="background:rgba(0,0,0,.4);border:1.5px solid rgba(255,255,255,.06);border-radius:14px">
                                    <div style="font-size:22px">${p.icon}</div>
                                    <div class="flex-1 min-w-0">
                                        <div class="font-bold text-white text-xs truncate">${escapeHtml(p.name)}</div>
                                        <div class="text-[9px] font-mono" style="color:#6b6b80">${p.type === 'direct' ? 'DIRECT' : p.type === 'countdown' ? p.duration + 'MIN' : 'OPEN/H'}</div>
                                    </div>
                                    <div class="text-left flex flex-col items-end gap-1">
                                        <div class="font-mono font-black text-xs" style="color:#00FFFF">${fmt(p.price)}</div>
                                        <div class="flex gap-1">
                                            <button class="btn btn-ghost btn-mini" onclick="openEditProduct('${p.id}')">✎</button>
                                            <button class="btn btn-ghost btn-mini" style="color:#FF0080;border-color:rgba(255,0,128,.3)" onclick="deleteProduct('${p.id}')">✕</button>
                                        </div>
                                    </div>
                                </div>`).join('')}
                    </div>
                </div>`;
        }).join('');
    }

    function openAddCategoryModal() { $('#cat-name').value = ''; $('#cat-icon').value = '📁'; openModal('modal-add-cat'); }
    function confirmAddCategory() {
        const name = $('#cat-name').value.trim();
        const icon = $('#cat-icon').value.trim() || '📁';
        if (!name) { toast('أدخل اسم القسم', 'error'); return; }
        S.categories.push({ id: uid(), name, icon });
        save(); closeModal('modal-add-cat'); renderMenu();
        toast('تمت إضافة "' + name + '"', 'success');
    }
    function deleteCategory(id) {
        const prods = S.products.filter(p => p.catId === id);
        if (prods.length > 0) { if (!confirm('يوجد ' + prods.length + ' صنف في هذا القسم. سيُحذفون معه. متأكد؟')) return; }
        else { if (!confirm('حذف القسم؟')) return; }
        S.categories = S.categories.filter(c => c.id !== id);
        S.products = S.products.filter(p => p.catId !== id);
        save(); renderMenu(); toast('تم الحذف', 'warn');
    }
    function openAddProductModal() {
        S.editingProductId = null;
        $('#prod-modal-title').textContent = 'صنف جديد';
        $('#prod-cat').innerHTML = S.categories.map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join('');
        $('#prod-name').value = ''; $('#prod-type').value = 'direct'; $('#prod-duration').value = '';
        $('#prod-price').value = ''; $('#prod-icon').value = '📦';
        typeChanged(); openModal('modal-add-prod');
    }
    function openEditProduct(id) {
        const p = S.products.find(x => x.id === id); if (!p) return;
        S.editingProductId = id;
        $('#prod-modal-title').textContent = 'تعديل الصنف';
        $('#prod-cat').innerHTML = S.categories.map(c => `<option value="${c.id}" ${c.id === p.catId ? 'selected' : ''}>${c.icon} ${escapeHtml(c.name)}</option>`).join('');
        $('#prod-name').value = p.name;
        $('#prod-type').value = p.type;
        $('#prod-duration').value = p.duration || '';
        $('#prod-price').value = p.price;
        $('#prod-icon').value = p.icon;
        typeChanged(); openModal('modal-add-prod');
    }
    function typeChanged() {
        const t = $('#prod-type').value;
        const wrap = $('#prod-duration-wrap');
        const lbl = $('#prod-price-lbl');
        if (t === 'countdown') { wrap.classList.remove('hidden'); lbl.textContent = 'السعر الإجمالي (IQD)'; }
        else if (t === 'open') { wrap.classList.add('hidden'); lbl.textContent = 'سعر الساعة (IQD)'; }
        else { wrap.classList.add('hidden'); lbl.textContent = 'السعر (IQD)'; }
    }
    function confirmSaveProduct() {
        const catId = $('#prod-cat').value;
        const name = $('#prod-name').value.trim();
        const type = $('#prod-type').value;
        const duration = Number($('#prod-duration').value) || 0;
        const price = Number($('#prod-price').value) || 0;
        const icon = $('#prod-icon').value.trim() || '📦';
        if (!name) { toast('أدخل اسم الصنف', 'error'); return; }
        if (price <= 0) { toast('أدخل سعراً صحيحاً', 'error'); return; }
        if (type === 'countdown' && duration <= 0) { toast('أدخل مدة صحيحة', 'error'); return; }
        if (S.editingProductId) {
            const p = S.products.find(x => x.id === S.editingProductId);
            if (p) {
                p.catId = catId; p.name = name; p.icon = icon; p.type = type;
                p.duration = type === 'countdown' ? duration : 0; p.price = price;
            }
        } else {
            S.products.push({ id: uid(), catId, name, icon, type, duration: type === 'countdown' ? duration : 0, price });
        }
        save(); closeModal('modal-add-prod'); renderMenu();
        toast('تم الحفظ', 'success');
    }
    function deleteProduct(id) {
        if (!confirm('حذف هذا الصنف؟')) return;
        S.products = S.products.filter(p => p.id !== id);
        save(); renderMenu(); toast('تم الحذف', 'warn');
    }

    /* ============ Utils ============ */
    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
    }

    function renderAll() {
        renderDashboard(); renderTables(); renderMenu(); renderDebts(); renderInvoices();
    }

    /* ============ Live ticker ============ */
    setInterval(() => {
        if (S.activeView === 'table-detail' && S.activeTableId) renderTableDetail();
        if (S.activeView === 'tables') renderTables();
        if (S.activeView === 'dashboard') renderDashboard();
    }, 1000);

    /* ============ Keyboard ============ */
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            ['modal-add-table','modal-picker','modal-early','modal-checkout','modal-transfer','modal-add-cat','modal-add-prod','modal-invoice'].forEach(closeModal);
            closeDrawer();
        }
    });

    /* ============ Modal backdrop close ============ */
    document.querySelectorAll('.modal-bd').forEach(m => {
        m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
    });

    /* ============ Init ============ */
    function init() {
        renderAll();
        switchView(S.activeView || 'dashboard');
        console.log('%c716QX NEXUS 6.5 ✅', 'color:#00FFFF;font-size:20px;font-weight:bold;text-shadow:0 0 20px #00FFFF;');
    }

    /* ============ Expose ============ */
    Object.assign(window, {
        openDrawer, closeDrawer, switchView, openModal, closeModal,
        transferDaily, resetMonthly, resetDaily, resetAll,
        openAddTableModal, suggestTable, confirmAddTable, renderTables,
        openTableDetail, renderTableDetail,
        updateTableCustomer, updateTableDiscount, changeQty, pauseItem, resumeItem, removeItem,
        openProductPicker, pickerBack, pickerSelectCat, pickerAddProduct,
        openEarly, quickPayOne, quickPayAll, confirmEarly,
        openCheckout, calcSplit, confirmCheckout,
        openTransfer, confirmTransfer, deleteCurrentTable,
        renderDebts, payDebt, payDebtFull,
        renderInvoices, openInvoiceDetail, printInv, exportCSV, clearInvoices,
        renderMenu, openAddCategoryModal, confirmAddCategory, deleteCategory,
        openAddProductModal, openEditProduct, typeChanged, confirmSaveProduct, deleteProduct
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
