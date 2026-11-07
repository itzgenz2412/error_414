
(() => {
"use strict";

const SUPABASE_URL = "https://dfsxybkcgutpodyfacls.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_nsJMqh1tDkQ4DjAUDnp7MA_6BOsGa41";

const PAYSTACK_PUBLIC_KEY = "pk_live_e9a96afe4201822f45ddfd0dd128ae6bb7e0bf21";

const ADMIN_EMAIL = "gentesjop@gmail.com";

const client = window.supabase.createClient(
SUPABASE_URL,
SUPABASE_ANON_KEY,
{
auth:{
persistSession:true,
autoRefreshToken:true,
detectSessionInUrl:true
}
}
);

const $ = id => document.getElementById(id);

let loginMode = false;
let busy = false;

function toast(text,type="success"){

const t=$("toast");
const txt=$("toastText");
const icon=$("toastIcon");

txt.textContent=text;

t.className="toast "+type;

icon.innerHTML = type==="success"
? `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>`
: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 8v5"/><path d="M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg>`;

t.classList.add("show");

clearTimeout(window._toastTimer);

window._toastTimer=setTimeout(
()=>t.classList.remove("show"),
3200
);

}

function message(text,type=""){

const b=$("msg-box");

if(!text){
b.className="msg hidden";
b.textContent="";
return;
}

b.textContent=text;

b.className="msg "+
(type==="error"?"error-bg":type==="success"?"success-bg":"")+
" fade";

b.classList.remove("hidden");

}

function showOnly(id){

["auth-box","pay-box","dashboard-box"].forEach(x=>{

const el=$(x);

el.classList.toggle("hidden",x!==id);

if(x===id)el.classList.add("fade");

});

}

function setMode(){

$("form-title").textContent=loginMode?"Welcome back":"Create account";

$("auth-btn").querySelector(".btn-text").textContent=
loginMode?"Log in":"Create account";

$("toggle-prefix").textContent=
loginMode?"New to LPay?":"Already have account?";

$("toggle-mode").textContent=
loginMode?"Create account":"Log in";

validateForm();

}

$("toggle-mode").addEventListener("click",()=>{

loginMode=!loginMode;

setMode();

message("");

$("error").textContent="";

});

$("showPassword").addEventListener("click",()=>{

const p=$("password");
const b=$("showPassword");

if(p.type==="password"){
p.type="text";
b.textContent="HIDE";
}else{
p.type="password";
b.textContent="SHOW";
}

});

function isGmailValid(v){
return /^[^@\s]+@gmail\.com$/i.test(v.trim());
}

function isPassValid(v){
return v.length>=8;
}

function validateForm(){

const emailVal=$("email").value;
const passVal=$("password").value;

const emailOk=isGmailValid(emailVal);
const passOk=isPassValid(passVal);

const btn=$("auth-btn");

const emailInput=$("email");
const passInput=$("password");

const emailHint=$("emailHint");
const passHint=$("passHint");

if(emailVal.length>0){

if(emailOk){

emailInput.classList.remove("invalid");
emailInput.classList.add("valid");

emailHint.textContent="✓ Valid Gmail";
emailHint.className="hint ok";

}else{

emailInput.classList.remove("valid");
emailInput.classList.add("invalid");

emailHint.textContent="Must be @gmail.com";
emailHint.className="hint";

}

}else{

emailInput.classList.remove("valid","invalid");
emailHint.textContent="Must be a Gmail address";
emailHint.className="hint";

}

if(passVal.length>0){

if(passOk){

passInput.classList.remove("invalid");
passInput.classList.add("valid");

passHint.textContent=`✓ ${passVal.length} characters`;
passHint.className="hint ok";

}else{

passInput.classList.remove("valid");
passInput.classList.add("invalid");

passHint.textContent=`${passVal.length}/8 characters`;
passHint.className="hint";

}

}else{

passInput.classList.remove("valid","invalid");
passHint.textContent="Min 8 characters";
passHint.className="hint";

}

btn.disabled=!(emailOk&&passOk&&!busy);

}

$("email").addEventListener("input",validateForm);
$("password").addEventListener("input",validateForm);

async function invokeFunction(name,body={}){

const {data,error}=await client.functions.invoke(name,{body});

if(error)throw new Error(error.message);

if(!data||data.success===false){
throw new Error(data?.error||"Server error");
}

return data;

}

async function routeUser(user){

if(!user){
showOnly("auth-box");
return;
}

if(user.email?.toLowerCase()===ADMIN_EMAIL.toLowerCase()){

showOnly("dashboard-box");

$("user-display-email").textContent=user.email;

$("expiry-info").textContent="👑 Administrator — Unlimited access";

toast("Welcome Admin","success");

return;

}

try{

const access=await invokeFunction("check-access");

if(access.allowed){

showOnly("dashboard-box");

$("user-display-email").textContent=user.email||"";

$("expiry-info").textContent=
access.is_admin
?"Administrator access"
:"Active until: "+new Date(access.expires_at).toLocaleString();

toast("Login successful","success");

return;

}

showOnly("pay-box");

$("pay-email").textContent="Signed in as "+(user.email||"");

$("pay-status").textContent=
access.expires_at
?"Subscription expired. Renew for 14 days."
:"Pay ₦1,000 to unlock 14 days access.";

}catch(err){

try{

const {data:sub}=await client
.from("subscriptions")
.select("*")
.eq("user_id",user.id)
.single();

if(sub&&sub.active&&new Date(sub.expires_at)>new Date()){

showOnly("dashboard-box");

$("user-display-email").textContent=user.email;

$("expiry-info").textContent=
"Active until: "+new Date(sub.expires_at).toLocaleString();

toast("Welcome back","success");

return;

}

}catch(_e){}

showOnly("pay-box");

$("pay-email").textContent="Signed in as "+(user.email||"");

$("pay-status").textContent=
"Unable to check subscription: "+err.message;

}

}

function setBtnLoading(btn,loading){

btn.classList.toggle("loading",loading);

btn.disabled=loading;

if(btn.id==="auth-btn"&&!loading){
validateForm();
}

}

$("auth-btn").addEventListener("click",async()=>{

if(busy||$("auth-btn").disabled)return;

const email=$("email").value.trim().toLowerCase();
const password=$("password").value;

$("error").textContent="";

if(!isGmailValid(email)){

$("error").textContent="Use a valid Gmail address.";

$("email").classList.add("error-shake");

setTimeout(()=>$("email").classList.remove("error-shake"),400);

toast("Gmail only allowed","error");

return;

}

if(!isPassValid(password)){

$("error").textContent="Password must be at least 8 characters.";

$("password").classList.add("error-shake");

setTimeout(()=>$("password").classList.remove("error-shake"),400);

return;

}

busy=true;

setBtnLoading($("auth-btn"),true);

$("auth-btn").querySelector(".btn-text").textContent="Processing…";

try{

if(loginMode){

const {data,error}=await client.auth.signInWithPassword({
email,
password
});

if(error)throw error;

await routeUser(data.user);

}else{

const {data,error}=await client.auth.signUp({
email,
password
});

if(error)throw error;

if(!data.session){

message(
"Account created! Check your email for confirmation link, then log in.",
"success"
);

toast("Check your Gmail inbox","success");

loginMode=true;

setMode();

}else{

await routeUser(data.user);

}

}

}catch(e){

$("error").textContent=e.message;

toast(e.message,"error");

}finally{

busy=false;

setBtnLoading($("auth-btn"),false);

$("auth-btn").querySelector(".btn-text").textContent=
loginMode?"Log in":"Create account";

}

});

/* =====================================
   PAYSTACK PAYMENT VERIFICATION
===================================== */

async function verifyPending(ref){

$("pay-status").textContent="Verifying payment securely…";

try{

await invokeFunction("verify-paystack",{
reference:ref
});

sessionStorage.removeItem("lpay_pending_reference");

toast("Payment verified — 14 days active!","success");

const {data:{user}}=await client.auth.getUser();

if(user){
setTimeout(()=>routeUser(user),900);
}

return true;

}catch(err){

$("pay-status").textContent=
"We couldn't confirm yet: "+
err.message+
" — reference saved. Don't pay twice.";

toast(err.message,"error");

return false;

}

}

/* =====================================
   PAYSTACK INLINEJS V2 CHECKOUT
===================================== */

$("pay-btn").addEventListener("click",async()=>{

if(busy)return;

const btn=$("pay-btn");
const btnText=btn.querySelector(".btn-text");
const originalText="Pay ₦1,000 — 14 Days";

try{

const {data:{user},error}=await client.auth.getUser();

if(error)throw error;

if(!user){
showOnly("auth-box");
return;
}

if(!window.PaystackPop){
throw new Error("Paystack failed to load. Refresh and try again.");
}

busy=true;

setBtnLoading(btn,true);

btnText.textContent="Opening Paystack...";

/* V2 accepts only letters, numbers, hyphens, dots and equals in references. */

const reference=
"LPAY-"+crypto.randomUUID().replaceAll("-","");

sessionStorage.setItem(
"lpay_pending_reference",
reference
);

const popup=new PaystackPop();

popup.newTransaction({

key:PAYSTACK_PUBLIC_KEY,

email:user.email,

amount:100000,

currency:"NGN",

reference:reference,

metadata:{
user_id:user.id,
subscription:"14_days"
},

onLoad:()=>{

$("pay-status").textContent=
"Complete your ₦1,000 payment securely.";

},

onSuccess:async(transaction)=>{

const paymentReference=
transaction.reference||
transaction.trxref;

if(!paymentReference){

$("pay-status").textContent=
"Payment response missing reference. Please contact support.";

busy=false;

setBtnLoading(btn,false);

btnText.textContent=originalText;

return;

}

$("pay-status").textContent=
"Payment received. Verifying with Paystack...";

try{

await verifyPending(paymentReference);

}catch(err){

$("pay-status").textContent=
"Verification pending: "+err.message;

}finally{

busy=false;

setBtnLoading(btn,false);

btnText.textContent=originalText;

}

},

onCancel:()=>{

busy=false;

setBtnLoading(btn,false);

btnText.textContent=originalText;

/*
Keep the pending reference.
If the bank debited the user before checkout closed,
the reference can still be checked after reload.
*/

$("pay-status").textContent=
"Checkout closed. If you were debited, don't pay again. Your pending reference is saved.";

},

onError:(err)=>{

busy=false;

setBtnLoading(btn,false);

btnText.textContent=originalText;

$("pay-status").textContent=
"Paystack error: "+(err.message||"Unable to initialize payment.");

toast("Paystack initialization failed","error");

}

});

}catch(err){

busy=false;

setBtnLoading(btn,false);

btnText.textContent=originalText;

$("pay-status").textContent=err.message;

toast(err.message,"error");

}

});

/* =====================================
   LOGOUT
===================================== */

async function logout(){

try{

await client.auth.signOut();

sessionStorage.removeItem("lpay_pending_reference");

showOnly("auth-box");

toast("Logged out","success");

validateForm();

}catch(err){

toast(err.message,"error");

}

}

$("pay-logout").addEventListener("click",logout);

$("dash-logout").addEventListener("click",logout);

$("continue-btn").addEventListener("click",()=>{
location.href="dashboard.html";
});

/* =====================================
   SESSION RESTORE AND PAYMENT RECOVERY
===================================== */

window.addEventListener("load",async()=>{

validateForm();

try{

const {data:{session},error}=await client.auth.getSession();

if(error)throw error;

if(session?.user){

const pending=sessionStorage.getItem(
"lpay_pending_reference"
);

if(pending){

showOnly("pay-box");

$("pay-email").textContent=
"Signed in as "+session.user.email;

await verifyPending(pending);

}else{

await routeUser(session.user);

}

}

}catch(err){

console.error("LPay initialization error:",err);

toast("Unable to restore session: "+err.message,"error");

}

});

$("password").addEventListener("keydown",e=>{

if(e.key==="Enter"&&!$("auth-btn").disabled){
$("auth-btn").click();
}

});

$("email").addEventListener("keydown",e=>{

if(e.key==="Enter"){
$("password").focus();
}

});

})();
