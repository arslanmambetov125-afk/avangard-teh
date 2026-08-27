#!/usr/bin/env python3
import json, re, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).parent / 'data' / 'leads.json'
UA = {'User-Agent':'Mozilla/5.0 NOVA-SDR-GitHub/1.0'}
QUERIES = [
    '"вилочный погрузчик" закупка',
    '"погрузчик 3 тонны" закупка',
    'электропогрузчик закупка',
    'штабелер закупка',
    '"складская техника" закупка',
    '"новый логистический центр" Россия',
    '"строительство распределительного центра" Россия',
    '"расширение склада" Россия',
    '"новый складской комплекс" Россия',
]
PRODUCTS = ['вилочный погрузчик','электропогрузчик','погрузчик','штабелер','складская техника','гидравлическая тележка']
DIRECT = ['закупка','тендер','поставка','аукцион','запрос предложений','запрос котировок']
PREDICTIVE = ['строительство','строится','расширение','новый склад','логистический центр','распределительный центр','складской комплекс']
NEGATIVE = ['беларус','казахстан','украин','одесс','минск','гомел']

def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode('utf-8', 'ignore')

def clean(s):
    return re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',s or '')).strip()

def parse_rss(xml):
    root = ET.fromstring(xml)
    out=[]
    for item in root.findall('.//item'):
        def t(name):
            node=item.find(name)
            return clean(node.text if node is not None and node.text else '')
        out.append({'title':t('title'),'url':t('link'),'desc':t('description'),'published':t('pubDate')})
    return out

def score(title, desc, source):
    text=(title+' '+desc).lower()
    if any(x in text for x in NEGATIVE): return None
    n=20; why=[]; typ='INFO'
    product=next((p for p in PRODUCTS if p in text),'')
    if any(x in text for x in DIRECT):
        n+=38; typ='DIRECT'; why.append('прямой закупочный сигнал')
    if any(x in text for x in PREDICTIVE):
        n+=28; typ='PREDICTIVE' if typ!='DIRECT' else typ; why.append('событие перед возможной закупкой')
    if product:
        n+=26; why.append('целевой продукт: '+product)
    elif typ=='DIRECT':
        n-=12
    if source=='etpgpb': n+=8
    if re.search(r'202[0-4]', text): n-=25
    n=max(0,min(100,n))
    if n<52: return None
    status='HOT' if n>=86 else 'HIGH' if n>=70 else 'WATCH'
    return {'score':n,'status':status,'type':typ,'product':product,'why':' · '.join(why) or 'релевантный отраслевой сигнал'}

def normalize_date(s):
    if not s: return None
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(s).astimezone(timezone.utc).isoformat()
    except Exception:
        return s

def google_news():
    leads=[]
    for q in QUERIES:
        url='https://news.google.com/rss/search?q='+urllib.parse.quote(q)+'&hl=ru&gl=RU&ceid=RU:ru'
        xml=fetch(url)
        for i in parse_rss(xml):
            sc=score(i['title'],i['desc'],'google_news')
            if not sc: continue
            leads.append({
                'source':'google_news','url':i['url'],'title':i['title'],'published':normalize_date(i['published']),
                'region':'Россия','summary':clean(i['desc'])[:600],**sc
            })
    return leads

def etpgpb():
    leads=[]
    xml=fetch('https://etpgpb.ru/procedures.rss',35)
    for i in parse_rss(xml):
        sc=score(i['title'],i['desc'],'etpgpb')
        if not sc: continue
        leads.append({
            'source':'etpgpb','url':i['url'],'title':i['title'],'published':normalize_date(i['published']),
            'region':'Россия','summary':clean(i['desc'])[:600],**sc
        })
    return leads

def main():
    sources={}; all_leads=[]
    for name,fn in [('Google News',google_news),('ЭТП ГПБ',etpgpb)]:
        try:
            x=fn(); sources[name]={'ok':True,'found':len(x)}; all_leads.extend(x)
        except Exception as e:
            sources[name]={'ok':False,'error':str(e)[:240]}
    dedup={}
    for x in all_leads:
        key=x.get('url') or x.get('title')
        if key not in dedup or x['score']>dedup[key]['score']:
            dedup[key]=x
    leads=sorted(dedup.values(),key=lambda x:x['score'],reverse=True)[:120]
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps({'generated_at':datetime.now(timezone.utc).isoformat(),'sources':sources,'leads':leads},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'found':len(leads),'sources':sources},ensure_ascii=False))

if __name__=='__main__':
    main()
