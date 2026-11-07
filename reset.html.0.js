
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const money = value => '₦' + Number(value || 0).toLocaleString('en-NG');
  const date = value => value ? new Date(value).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const dateTime = value => value ? new Date(value).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : 'Never';
  let page = 1, pageSize = 50, totalPages = 1, users = [], selected = null, busy = false;

  function setMessage(message, ok=false) { $('actionMsg').textContent=message||''; $('actionMsg').className='msg'+(ok?' ok':''); }
  function statusPill(status) {
    const label = status === 'active' ? 'Active' : status === 'expired' ? 'Expired' : 'Not subscribed';
    return '<span class="pill '+status+'">'+label+'</span>';
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  async function guard() {
    const u = await LPayWallet.user();
    if ((u.email || '').toLowerCase() !== 'gentesjop@gmail.com') throw new Error('Administrator access required.');
    return u;
  }
  async function loadDashboard() {
    if (busy) return;
    busy = true; $('refreshBtn').disabled = true; $('refreshBtn').textContent = 'Loading…';
    $('userRows').classList.add('loading');
    try {
      await guard();
      const result = await LPayWallet.invoke('admin-wallet', {
        action:'dashboard', search:$('search').value.trim(), status:$('status').value,
        sort:$('sort').value, page, page_size:pageSize
      });
      const stats = result.stats || {};
      $('totalUsers').textContent = Number(stats.total_users || 0).toLocaleString('en-NG');
      $('activeSubs').textContent = Number(stats.active_subscribers || 0).toLocaleString('en-NG');
      $('expiredSubs').textContent = Number(stats.expired_subscribers || 0).toLocaleString('en-NG');
      $('notActive').textContent = Number(stats.not_active || 0).toLocaleString('en-NG');
      users = Array.isArray(result.users) ? result.users : [];
      totalPages = Math.max(1, Math.ceil(Number(result.filtered_count ?? stats.filtered_count ?? result.total_filtered ?? 0) / pageSize));
      // The RPC returns the requested page and global totals. Use an explicit has-more signal from row count when needed.
      $('pageLabel').textContent = 'Page ' + page;
      $('prevBtn').disabled = page <= 1;
      $('nextBtn').disabled = !result.has_more;
      $('resultCount').textContent = users.length + ' accounts shown · ' + Number(stats.total_users || 0).toLocaleString('en-NG') + ' total registered';
      $('mobileCount').textContent = users.length;
      renderRows();
    } catch (error) {
      $('userRows').innerHTML = '<tr><td colspan="5" class="empty">'+escapeHtml(error.message || 'Unable to load admin dashboard.')+'</td></tr>';
      if ((error.message || '').toLowerCase().includes('administrator')) $('app').innerHTML = '<section class="panel"><h2>Access denied</h2><p class="muted">This page is restricted to the authorized LPay administrator.</p></section>';
    } finally {
      busy = false; $('refreshBtn').disabled = false; $('refreshBtn').textContent = '↻ Refresh'; $('userRows').classList.remove('loading');
    }
  }
  function renderRows() {
    if (!users.length) { $('userRows').innerHTML='<tr><td colspan="5" class="empty">No accounts match this search or filter.</td></tr>'; return; }
    $('userRows').innerHTML = users.map(u => {
      const active = selected && selected.user_id === u.user_id;
      return '<tr data-id="'+escapeHtml(u.user_id)+'" class="'+(active?'selected':'')+'">'+
        '<td><div class="email">'+escapeHtml(u.email || '(no email)')+'</div><div class="subline">'+escapeHtml(String(u.user_id).slice(0,8))+'…</div></td>'+
        '<td><b>'+money(u.wallet_balance)+'</b></td><td>'+statusPill(u.subscription_status)+'</td>'+
        '<td>'+date(u.created_at)+'</td><td>'+dateTime(u.last_sign_in_at)+'</td></tr>';
    }).join('');
    $('userRows').querySelectorAll('tr[data-id]').forEach(row => row.addEventListener('click', () => {
      selected = users.find(u => u.user_id === row.dataset.id) || null;
      renderRows(); renderSelected(); setMessage('');
    }));
  }
  function renderSelected() {
    if (!selected) { $('selectedCard').innerHTML='<div class="muted">No user selected</div><div class="subline">Tap a user row to view account details and actions.</div>'; $('applyBtn').disabled=true; return; }
    $('selectedCard').innerHTML = '<div class="selected-email">'+escapeHtml(selected.email || '(no email)')+'</div><div class="selected-balance">'+money(selected.wallet_balance)+'</div><div class="subline">Wallet balance · '+statusPill(selected.subscription_status)+'</div><div class="subline">Joined '+date(selected.created_at)+'</div><div class="subline">Subscription expiry: '+dateTime(selected.expires_at)+'</div><div class="subline">Last payment: '+dateTime(selected.last_payment_at)+'</div>';
    $('applyBtn').disabled=false;
  }
  $('action').addEventListener('change', () => {
    const reset = $('action').value === 'reset';
    $('amountLabel').textContent = reset ? 'NEW BALANCE AFTER RESET (₦)' : 'AMOUNT (₦)';
    $('amount').value = reset ? '5000' : '5000';
  });
  $('searchBtn').addEventListener('click', () => { page=1; loadDashboard(); });
  $('search').addEventListener('keydown', e => { if(e.key==='Enter'){page=1;loadDashboard();} });
  $('status').addEventListener('change', () => { page=1; loadDashboard(); });
  $('sort').addEventListener('change', () => { page=1; loadDashboard(); });
  $('refreshBtn').addEventListener('click', loadDashboard);
  $('prevBtn').addEventListener('click', () => { if(page>1){page--;loadDashboard();} });
  $('nextBtn').addEventListener('click', () => { if(users.length===pageSize){page++;loadDashboard();} });
  $('applyBtn').addEventListener('click', async () => {
    if (!selected || busy) return;
    const action = $('action').value;
    const amount = Number($('amount').value);
    if (!Number.isSafeInteger(amount) || amount < 0 || (action !== 'set' && amount === 0)) { setMessage('Enter a valid whole-naira amount.'); return; }
    if (action === 'reset' && !confirm('This clears the selected user’s wallet transaction history and resets the wallet balance. The login and subscription will remain. Continue?')) return;
    $('applyBtn').disabled=true; setMessage('Processing securely…');
    try {
      const result = await LPayWallet.invoke('admin-wallet', {
        action, user_id:selected.user_id, amount, balance:amount
      });
      selected.wallet_balance = Number(result.balance);
      setMessage('Updated '+result.email+'. New balance: '+money(result.balance)+(result.transactions_cleared?' · wallet history cleared':''), true);
      renderSelected(); renderRows();
      await loadDashboard();
      // Keep the selected account visible after the background refresh.
      selected = users.find(u => u.user_id === result.user_id) || selected;
      renderSelected(); renderRows();
    } catch (error) { setMessage(error.message || 'Admin action failed.'); }
    finally { $('applyBtn').disabled = !selected; }
  });
  $('exportBtn').addEventListener('click', () => {
    if (!users.length) { setMessage('There are no visible rows to export.'); return; }
    const columns=['email','user_id','wallet_balance','subscription_status','created_at','last_sign_in_at','expires_at','last_payment_at'];
    const csv=[columns.join(','),...users.map(u=>columns.map(k=>'"'+String(u[k]??'').replace(/"/g,'""')+'"').join(','))].join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='lpay-users-page-'+page+'.csv'; a.click(); URL.revokeObjectURL(url);
  });
  guard().then(loadDashboard).catch(error => {
    $('app').innerHTML='<section class="panel"><h2>Access denied</h2><p class="muted">'+escapeHtml(error.message || 'Administrator access required.')+'</p></section>';
  });
})();
