/* LPay authenticated per-user wallet. Cached balance is display-only; Supabase remains authoritative. */
(() => {
  const URL='https://dfsxybkcgutpodyfacls.supabase.co';
  const KEY='sb_publishable_nsJMqh1tDkQ4DjAUDnp7MA_6BOsGa41';
  const client=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const cacheKey=id=>'lpay_balance_cache_v1_'+id;
  const txCacheKey=id=>'lpay_transactions_cache_v1_'+id;
  const profileCacheKey=id=>'lpay_profile_text_v1_'+id;
  async function user(){const {data,error}=await client.auth.getUser();if(error||!data.user)throw new Error('Session expired. Please sign in again.');return data.user;}
  async function sessionUser(){const {data,error}=await client.auth.getSession();if(error)throw error;return data.session?.user||null;}
  function cachedBalance(userId){try{const raw=localStorage.getItem(cacheKey(userId));if(!raw)return null;const item=JSON.parse(raw);return Number.isFinite(Number(item.balance))?Number(item.balance):null;}catch(_){return null;}}
  function saveCachedBalance(userId,balance){const n=Number(balance);if(!userId||!Number.isFinite(n))return;try{localStorage.setItem(cacheKey(userId),JSON.stringify({balance:n,updatedAt:Date.now()}));}catch(_){}}
  function cachedTransactions(userId,limit=500){try{const raw=localStorage.getItem(txCacheKey(userId));if(!raw)return null;const item=JSON.parse(raw);return Array.isArray(item.rows)?item.rows.slice(0,limit):null;}catch(_){return null;}}
  function saveCachedTransactions(userId,rows){if(!userId||!Array.isArray(rows))return;try{localStorage.setItem(txCacheKey(userId),JSON.stringify({rows,updatedAt:Date.now()}));}catch(_){}}
  function cachedProfileText(userId){try{return localStorage.getItem(profileCacheKey(userId))||'';}catch(_){return '';}}
  function saveProfileText(userId,value){if(!userId||!value)return;try{localStorage.setItem(profileCacheKey(userId),String(value).slice(0,80));}catch(_){}}
  async function balance(){const u=await user();const {data,error}=await client.from('wallets').select('balance').eq('user_id',u.id).single();if(error)throw error;const n=Number(data.balance);saveCachedBalance(u.id,n);return n;}
  async function transactions(limit=500){const u=await user();const {data,error}=await client.from('wallet_transactions').select('*').eq('user_id',u.id).order('created_at',{ascending:false}).limit(limit);if(error)throw error;const rows=(data||[]).map(r=>{const m=r.metadata||{};let type=r.type==='credit'?'in':r.type==='debit'?'out':'adjustment';if(r.type==='adjustment'){if(m.action==='credit'||Number(m.new_balance)>Number(m.previous_balance))type='in';else if(m.action==='debit'||Number(m.new_balance)<Number(m.previous_balance))type='out';}return {id:r.id,reference:r.reference,type,name:r.title,title:r.title,amount:Number(r.amount),balance_after:Number(r.balance_after),status:r.status,date:new Date(r.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}),time:new Date(r.created_at).toLocaleTimeString('en-NG',{hour:'2-digit',minute:'2-digit'}),timestamp:new Date(r.created_at).getTime(),metadata:m};});saveCachedTransactions(u.id,rows);return rows;}
  async function invoke(name,body){const {data,error}=await client.functions.invoke(name,{body});if(error)throw new Error(error.message||'Server request failed');if(!data?.success)throw new Error(data?.error||'Server request failed');return data;}
  window.LPayWallet={client,user,sessionUser,cachedBalance,saveCachedBalance,cachedTransactions,cachedProfileText,saveProfileText,balance,transactions,invoke};
  // Image caching is handled by the Android WebView shouldInterceptRequest cache.
  // Do not register a service worker here: it would duplicate the native cache path.
})();
