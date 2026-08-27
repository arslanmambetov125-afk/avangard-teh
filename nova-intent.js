(function(){
  'use strict';
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
  if (localStorage.getItem('nova_intent_optout') === '1') return;

  var ENDPOINT='https://cmfiowuwsdtfyzgqsklr.supabase.co/functions/v1/nova-intent';
  var KEY='nova_vid';
  function id(){
    var v=localStorage.getItem(KEY);
    if(!v){v=(crypto.randomUUID?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2)));localStorage.setItem(KEY,v)}
    return v;
  }
  function product(){
    var p=location.pathname.toLowerCase(), t=(document.title||'').toLowerCase();
    var m=p.match(/product-([a-z0-9-]+)/); if(m) return m[1].replace(/-/g,' ').toUpperCase();
    if(/cpcd\d+/i.test(t)){var x=t.match(/cpcd\d+/i);return x?x[0].toUpperCase():''}
    if(t.includes('погрузчик')) return 'вилочный погрузчик';
    return '';
  }
  function send(type, meta){
    try{
      fetch(ENDPOINT,{method:'POST',mode:'cors',keepalive:true,body:JSON.stringify({
        visitor_id:id(),event_type:type,page_path:location.pathname+location.search,page_title:document.title,
        product:product(),referrer:document.referrer||'',metadata:meta||{}
      })}).catch(function(){});
    }catch(e){}
  }
  if(!sessionStorage.getItem('nova_session_started')){sessionStorage.setItem('nova_session_started','1');send('session_start',{tz:Intl.DateTimeFormat().resolvedOptions().timeZone||'',lang:navigator.language||''})}
  send('page_view',{});
  setTimeout(function(){send('time_30s',{})},30000);

  document.addEventListener('click',function(e){
    var el=e.target.closest('a,button'); if(!el) return;
    var href=(el.getAttribute('href')||'').toLowerCase();
    var text=(el.innerText||el.textContent||'').toLowerCase().replace(/\s+/g,' ').trim().slice(0,160);
    if(href.indexOf('tel:')===0) return send('click_phone',{text:text});
    if(href.indexOf('mailto:')===0) return send('click_email',{text:text});
    if(href.includes('wa.me')||href.includes('whatsapp')||href.includes('t.me')||href.includes('telegram')) return send('click_messenger',{text:text});
    if(/цена|стоимост|прайс|коммерческ.*предлож|получить кп|расчет/.test(text)) return send('intent_price',{text:text});
    if(/лизинг|рассроч/.test(text)) return send('intent_leasing',{text:text});
    if(/доставк/.test(text)) return send('intent_delivery',{text:text});
  },true);

  window.NOVAIntentOptOut=function(){localStorage.setItem('nova_intent_optout','1');localStorage.removeItem(KEY)};
})();
