import {createAuthClient} from 'better-auth/client';
import {twoFactorClient} from 'better-auth/client/plugins';
import {oauthProviderClient} from '@better-auth/oauth-provider/client';
import QRCode from 'qrcode';

const path=window.location.pathname;
const suffix=window.location.search||'';
const hasOAuth=new URLSearchParams(suffix).has('sig');
const oauthPage=name=>'/'+name+(hasOAuth?suffix:'');
const ui=document.querySelector('#screen');
const status=document.querySelector('#status');
const client=createAuthClient({
 baseURL:location.origin,
 plugins:[
  twoFactorClient({
   onTwoFactorRedirect(){location.assign(oauthPage('two-factor'));}
  }),
  oauthProviderClient()
 ]
});
const config=await fetch('/api/identity/config',{credentials:'same-origin',cache:'no-store'})
 .then(r=>r.json()).catch(()=>({signupEnabled:false}));
function msg(message,error=false){
 status.textContent=message||'';
 status.className=error?'notice error':'notice';
 status.hidden=!message;
}
function setHTML(html){ui.innerHTML=html;msg('')}
const $=id=>document.getElementById(id);
function field(id,label,type='text',attrs=''){
 return '<label class="field"><span>'+label+'</span><input id="'+id+'" name="'+id+'" type="'+type+'" '+attrs+' required></label>';
}
function button(label){return '<button class="primary" type="submit">'+label+'</button>'}
function fmtError(r,fallback){
 return String(r?.error?.message||r?.error||fallback||'Operation failed').slice(0,240)
}
async function session(){
 const r=await client.getSession();
 return r?.data?.user?r.data:null;
}
const guard=(fn)=>async e=>{
 e?.preventDefault?.();
 const form=e?.currentTarget;
 const submit=form?.querySelector?.('button[type="submit"]');
 if(submit)submit.disabled=true;
 try{await fn(e)}catch(err){msg(err?.message||String(err),true)}
 finally{if(submit)submit.disabled=false}
};
const goAccount=()=>location.assign('/account');

const SOCIAL_CHOICES=[
 {id:'google',label:'Google',symbol:'G'},
 {id:'facebook',label:'Facebook',symbol:'f'},
 {id:'microsoft',label:'Microsoft / Outlook',symbol:'M'}
];
function socialButtons(mode='signin'){
 const registration=mode==='signup';
 const intro=registration?'Or create your account with':'Or continue with';
 const buttons=SOCIAL_CHOICES.map(provider=>{
  const configured=config.socialProviders?.[provider.id]===true;
  const available=configured&&(!registration||config.socialSignupEnabled===true);
  const label=provider.label+(available?'':configured&&registration?' · Registration not yet open':' · Setup pending');
  return '<button class="social-signin" data-social="'+provider.id+'" type="button"'+
   (available?'':' disabled aria-disabled="true"')+
   '><span class="social-symbol social-'+provider.id+'">'+provider.symbol+'</span>'+
   '<span>'+label+'</span></button>';
 }).join('');
 return '<div class="social-section"><p class="social-divider">'+intro+'</p><div class="social-grid">'+buttons+'</div>'+
  '<p class="subtle">You will still verify your Rosie email and enroll an authenticator before accessing a product.</p></div>';
}
function bindSocialButtons(){
 document.querySelectorAll('button[data-social]').forEach(el=>{
  el.onclick=async()=>{
   const provider=el.dataset.social;
   if(config.socialProviders?.[provider]!==true){msg('Provider has not been configured.',true);return;}
   el.disabled=true;msg('Redirecting to your account provider…');
   try{
    const callbackURL=location.origin+oauthPage('setup-mfa');
    const r=await client.signIn.social({provider,callbackURL});
    if(r?.error){msg(fmtError(r),true);el.disabled=false;}
   }catch(e){msg(String(e?.message||e),true);el.disabled=false;}
  };
 });
}


async function setupLogin(){
 const current=await session();
 if(current?.user){
  setHTML('<h1>Welcome back.</h1><p>You are signed in to Rosie as <strong id="email"></strong>.</p>'+
   '<button class="primary" id="continue" type="button">Continue securely</button>'+
   '<p class="subtle"><a href="/account">Account settings</a></p>');
  $('email').textContent=current.user.email;
  $('continue').onclick=async()=>{
   if(hasOAuth){const r=await client.oauth2.continue({postLogin:true});
    if(r?.error)msg(fmtError(r),true);
   }else goAccount();
  };
  return;
 }
 setHTML('<h1>Welcome to Rosie.</h1><p class="lead">Your identity across every Rosie AI product.</p>'+
  '<form id="signin">'+field('email','Email','email','autocomplete="email"')+
  field('password','Password','password','minlength="12" autocomplete="current-password"')+
  button('Sign in to Rosie')+'</form>'+socialButtons('signin')+
  '<p class="subtle">New to Rosie? <a href="'+oauthPage('signup')+'">Create an account</a></p>');
 bindSocialButtons();
 $('signin').onsubmit=guard(async()=>{
  const r=await client.signIn.email({email:$('email').value.trim().toLowerCase(),password:$('password').value});
  if(r?.error)throw Error(fmtError(r));
  if(r?.data?.twoFactorRedirect){location.assign(oauthPage('two-factor'));return;}
  if(hasOAuth){
   // OAuth Provider Client redirects automatically when a signed query exists.
   // Do not replace the provider's signed continuation target.
   msg('Credentials verified. Continue through your Rosie authorization flow.');
  }else goAccount();
 });
}
async function setupSignup(){
 setHTML('<h1>Create your Rosie account.</h1><p class="lead">A secure personal identity, separate from every organization.</p>'+
  (!config.signupEnabled?'<div class="alert">Email/password registration is temporarily closed pending email verification testing. Social registration opens when each provider is configured and approved.</div>':'')+
  '<form id="signup">'+field('fullName','Full name','text','minlength="2" autocomplete="name"')+
  field('email','Email','email','autocomplete="email"')+
  field('password','Password (12 characters minimum)','password','minlength="12" autocomplete="new-password"')+
  button('Create secure account')+'</form>'+socialButtons('signup')+
  '<p class="subtle">Already registered? <a href="'+oauthPage('login')+'">Sign in</a></p>');
 bindSocialButtons();
 if(!config.signupEnabled){$('signup').querySelector('button').disabled=true;return;}
 $('signup').onsubmit=guard(async()=>{
  const r=await client.signUp.email({name:$('fullName').value.trim(),email:$('email').value.trim().toLowerCase(),password:$('password').value});
  if(r?.error)throw Error(fmtError(r));
  msg('Registration requested. Verify your email using the link we sent. Authenticator setup is required before product access.');
 });
}
async function setupTwoFactor(){
 setHTML('<h1>Verify your authenticator.</h1><p class="lead">Enter the six-digit code from your Rosie authenticator app. This completes sign-in.</p>'+
  '<form id="totp">'+field('code','Authenticator code','text','inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"')+
  button('Verify and continue')+'</form>'+
  '<p class="subtle">Lost your authenticator? <a href="/account">Use your recovery options</a>.</p>');
 $('totp').onsubmit=guard(async()=>{
  const r=await client.twoFactor.verifyTotp({code:$('code').value.trim()});
  if(r?.error)throw Error(fmtError(r));
  if(hasOAuth)location.assign(oauthPage('setup-mfa'));else goAccount();
 });
}
async function setupMfa(){
 const who=await session();
 if(!who?.user){location.replace(oauthPage('login'));return;}
 if(!who.user.emailVerified){
  setHTML('<h1>Verify your email first.</h1><p class="lead">Before your Rosie account can authorize products, check your inbox for the verification email.</p><button id="resend" class="secondary">Resend verification</button>');
  $('resend').onclick=async()=>{
   const r=await client.sendVerificationEmail({email:who.user.email,callbackURL:location.origin+'/account'});
   msg(r?.error?fmtError(r):'If your address is eligible, a verification email has been sent.',!!r?.error);
  };
  return;
 }
 if(who.user.twoFactorEnabled){
  setHTML('<h1>Authenticator confirmed.</h1><p class="lead">Your verified Rosie account can now continue to the requesting product.</p>'+
   '<button type="button" id="continue" class="primary">Continue to product</button>');
  $('continue').onclick=async()=>{
   if(hasOAuth){const r=await client.oauth2.continue({postLogin:true});
    if(r?.error)msg(fmtError(r),true);
   }else goAccount();
  };
  return;
 }
 const accounts=await client.listAccounts().catch(()=>({data:[]}));
 const needsAccountPassword=(accounts?.data||[]).some(a=>a.providerId==='credential');
 setHTML('<h1>Protect your Rosie account.</h1><p class="lead">An authenticator app is required before Rosie products will authorize you. Social-only accounts can set one up without creating a separate password.</p>'+
  '<form id="enroll">'+(needsAccountPassword?field('password','Confirm your account password','password','autocomplete="current-password"'):'')+
  button('Set up authenticator')+'</form><div id="enrollment"></div>');
 $('enroll').onsubmit=guard(async()=>{
  const r=await client.twoFactor.enable({...(needsAccountPassword?{password:$('password').value}:{}),method:'totp',issuer:'Rosie AI'});
  if(r?.error)throw Error(fmtError(r));
  const data=r?.data||{};
  if(!data.totpURI)throw Error('Authenticator enrollment could not be initialized');
  $('enroll').remove();
  const div=$('enrollment');
  div.innerHTML='<div class="alert">Scan the QR code in your authenticator app. Keep the backup codes in your own password manager—Rosie cannot recover them.</div>'+
   '<canvas id="qr" width="192" height="192"></canvas><pre id="codes"></pre>'+
   '<form id="verify">'+field('code','Six-digit authenticator code','text','inputmode="numeric" pattern="[0-9]{6}" maxlength="6"')+
   button('Confirm authenticator')+'</form>';
  await QRCode.toCanvas($('qr'),data.totpURI,{width:192,margin:1});
  $('codes').textContent=Array.isArray(data.backupCodes)?data.backupCodes.join('\n'):'';
  $('verify').onsubmit=guard(async()=>{
   const verify=await client.twoFactor.verifyTotp({code:$('code').value.trim()});
   if(verify?.error)throw Error(fmtError(verify));
   msg('Authenticator enabled. Account is now eligible for Rosie product authorization.');
   location.assign(oauthPage('setup-mfa'));
  });
 });
}
async function setupConsent(){
 const r=await fetch('/api/identity/consent-context'+suffix,{credentials:'same-origin',cache:'no-store'});
 if(r.status===401){location.replace(oauthPage('login'));return;}
 const data=await r.json().catch(()=>({}));
 if(!r.ok){
  setHTML('<h1>Authorization unavailable.</h1><p class="lead">The request is missing, expired, or your account has not completed email verification and authenticator setup.</p>'+
   '<a href="'+oauthPage('setup-mfa')+'">Verify account security</a>');
  msg(data.error||'Authorization request rejected.',true);
  return;
 }
 setHTML('<h1>Authorize a Rosie product?</h1><p class="lead">Only the account information listed below is requested. Product data and tenant roles stay separate.</p>'+
  '<div class="consent"><strong id="clientName"></strong><p>Verified redirect: <span id="redirectHost"></span></p><p>Requested scopes: <span id="scopes"></span></p></div>'+
  '<div class="actions"><button id="deny" class="secondary" type="button">Decline</button><button id="approve" class="primary" type="button">Authorize</button></div>');
 $('clientName').textContent=data.clientName||'Rosie product';
 $('redirectHost').textContent=data.redirectHost||'';
 $('scopes').textContent=(data.scopes||[]).join(', ');
 for(const [id,accept] of [['deny',false],['approve',true]]){
  $(id).onclick=async()=>{
   $('approve').disabled=$('deny').disabled=true;
   try{const r=await client.oauth2.consent({accept});
    if(r?.error)throw Error(fmtError(r));
    if(r?.data?.url&&r.data.redirect)location.assign(r.data.url);
   }catch(e){msg(e.message,true);$('approve').disabled=$('deny').disabled=false;}
  };
 }
}
async function setupAccount(){
 const who=await session();
 if(!who?.user){location.replace('/login');return;}
 setHTML('<h1>Your Rosie identity.</h1><p class="lead">One account for all Rosie products, with independent product tenant memberships.</p>'+
  '<div class="consent"><strong id="who"></strong><p id="verified"></p><p id="mfa"></p></div>'+
  '<div class="actions"><button id="security" class="primary">Authenticator settings</button>'+
  '<button id="logout" class="secondary">Sign out</button></div>'+
  '<h2 class="account-subhead">Connected sign-in methods</h2><p class="subtle">Link another sign-in method explicitly. We do not automatically combine accounts just because their email addresses match.</p>'+
  '<div id="linkedProviders"></div>'+
  '<p class="subtle">Abracadabra encryption keys and recovery phrases remain separate from your login.</p>');
 $('who').textContent=who.user.email;
 $('verified').textContent=who.user.emailVerified?'Email verified':'Email verification required';
 $('mfa').textContent=who.user.twoFactorEnabled?'Authenticator enrolled':'Authenticator setup required';
 const accountList=await client.listAccounts().catch(()=>({data:[]}));
 const linkedIds=new Set((accountList?.data||[]).map(a=>a.providerId));
 const links=SOCIAL_CHOICES.map(p=>{
  const linked=linkedIds.has(p.id);
  const enabled=config.socialProviders?.[p.id]===true&&who.user.emailVerified===true&&who.user.twoFactorEnabled===true;
  return '<button class="social-signin" type="button" data-link-provider="'+p.id+'"'+
    (!enabled||linked?' disabled aria-disabled="true"':'')+
    '><span class="social-symbol social-'+p.id+'">'+p.symbol+'</span><span>'+p.label+
    (linked?' · Connected':enabled?' · Connect':' · Unavailable')+'</span></button>';
 }).join('');
 $('linkedProviders').innerHTML='<div class="social-grid">'+links+'</div>';
 document.querySelectorAll('[data-link-provider]').forEach(btn=>{
  btn.onclick=async()=>{
   btn.disabled=true;
   try{
    const result=await client.linkSocial({provider:btn.dataset.linkProvider,callbackURL:location.origin+'/account'});
    if(result?.error)throw Error(fmtError(result));
   }catch(e){msg(String(e?.message||e),true);btn.disabled=false;}
  };
 });
 $('security').onclick=()=>location.assign('/setup-mfa');
 $('logout').onclick=async()=>{await client.signOut();location.replace('/login')};
}
(async()=>{
 try{
  if(path==='/signup')await setupSignup();
  else if(path==='/login'||path==='/')await setupLogin();
  else if(path==='/two-factor')await setupTwoFactor();
  else if(path==='/setup-mfa'||path==='/verify-email')await setupMfa();
  else if(path==='/consent')await setupConsent();
  else if(path==='/account')await setupAccount();
  else{setHTML('<h1>Not found</h1>');}
 }catch(e){msg(e?.message||'Identity service unavailable',true);}
})();
