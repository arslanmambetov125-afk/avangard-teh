#!/usr/bin/env python3
import json, re, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

OUT = Path(__file__).parent / 'data' / 'leads.json'
UA = {'User-Agent':'Mozilla/5.0 NOVA-SDR-GitHub/1.1'}

DIRECT_QUERIES = [
    '"вилочный погрузчик" закупка when:45d',
    '"вилочные погрузчики" тендер when:45d',
    '"погрузчик 3 т" закупка when:45d',
    'электропогрузчик закупка when:45d',
    'штабелер закупка тендер when:45d',
    '"складская техника" закупка when:45d',
    '"поставка вилочных погрузчиков" when:45d',
    '"приобретение погрузчика" when:45d',
]
PREDICTIVE_QUERIES = [
    '"строится логистический центр" Россия when:120d',
    '"новый распределительный центр" Россия when:120d',
    '"строительство складского комплекса" Россия when:120d',
    '"расширение склада" Россия when:120d',
    '"открытие логистического центра" Россия when:120d',
    '"новый склад" производство Россия when:120d',
]
PRODUCTS = ['вилочный погрузчик','вилочные погрузчики','электропогрузчик','погрузчик','штабелер','складская техника','гидравлическая тележка']
DIRECT = ['закупка','тендер','аукцион','запрос предложений','запрос котировок','приобретение','на поставку','планирует закупить','закупает']
PREDICTIVE = ['строительство','строится','расширение','новый склад','логистический центр','распределительный центр','складской комплекс','открытие']
NEGATIVE_GEO = ['беларус','казахстан','украин','одесс','минск','гомел']
SUPPLIER_NEWS = ['презентует','презентовать','представила новый','представит новый','выпустил новый','модельный ряд','выставке','производитель погрузчиков','новинка рынка','обзор погрузчика','рейтинг лучших']
NEGATIVE_EVENTS = ['пожар','сгорел','атака бпла','уничтожен','дтп','авария']

def fetch(url, timeout=22):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode('utf-8', 'ignore')

def clean(s):
    s = re.sub(r'<[^>]+>',' ',s or '')
    s = s.replace('&nbsp;',' ').replace('&amp;','&')
    return re.sub(r'\s+',' ',s).strip()

def parse_rss(xml):
    root = ET.fromstring(xml)
    out=[]
    for item in root.findall('.//item'):
        def t(name):
            node=item.find(name)
            return clean(node.text if node is not None and node.text else '')
        out.append({'title':t('title'),'url':t('link'),'desc':t('description'),'published':t('pubDate')})
    return out

def parsed_date(s):
    if not s: return None
    try:
        return parsedate_to_datetime(s).astimezone(timezone.utc)
    except Exception:
        try: return datetime.fromisoformat(s.replace('Z','+00:00')).astimezone(timezone.utc)
        except Exception: return None

def age_days(s):
    dt=parsed_date(s)
    if not dt: return 9999
    return max(0,(datetime.now(timezone.utc)-dt).total_seconds()/86400)

def score(title, desc, source, mode, published):
    text=(title+' '+desc).lower()
    if any(x in text for x in NEGATIVE_GEO): return None
    if any(x in text for x in NEGATIVE_EVENTS): return None
    days=age_days(published)
    max_age=45 if mode=='DIRECT' else 120
    if days>max_age: return None

    product=next((p for p in PRODUCTS if p in text),'')
    has_direct=any(x in text for x in DIRECT)
    has_predictive=any(x in text for x in PREDICTIVE)
    supplier_news=any(x in text for x in SUPPLIER_NEWS)

    if mode=='DIRECT':
        if not has_direct or not product: return None
        if supplier_news and not any(x in text for x in ['закупка','тендер','аукцион','заказчик','на поставку']): return None
        n=72
        why=['свежий прямой закупочный сигнал','целевой продукт: '+product]
        typ='DIRECT'
        if days<=7: n+=14; why.append('≤ 7 дней')
        elif days<=21: n+=8; why.append('≤ 21 дня')
        elif days<=45: n+=3
        if source=='etpgpb': n+=8; why.append('закупочная площадка')
    else:
        if not has_predictive: return None
        if supplier_news: return None
        n=58
        why=['свежее событие перед возможной закупкой']
        typ='PREDICTIVE'
        if product: n+=8; why.append('упомянута техника: '+product)
        if any(x in text for x in ['строится','строительство','расширение']): n+=8
        if any(x in text for x in ['логистический центр','распределительный центр','складской комплекс','новый склад']): n+=8
        if days<=14: n+=8; why.append('≤ 14 дней')
        elif days<=60: n+=4

    n=max(0,min(100,n))
    status='HOT' if n>=86 else 'HIGH' if n>=70 else 'WATCH'
    return {'score':n,'status':status,'type':typ,'product':product,'why':' · '.join(why),'age_days':round(days,1)}

def normalize_date(s):
    dt=parsed_date(s)
    return dt.isoformat() if dt else None

def google_news():
    leads=[]
    for mode,queries in [('DIRECT',DIRECT_QUERIES),('PREDICTIVE',PREDICTIVE_QUERIES)]:
        for q in queries:
            url='https://news.google.com/rss/search?q='+urllib.parse.quote(q)+'&hl=ru&gl=RU&ceid=RU:ru'
            xml=fetch(url)
            for i in parse_rss(xml):
                sc=score(i['title'],i['desc'],'google_news',mode,i['published'])
                if not sc: continue
                leads.append({
                    'source':'google_news','url':i['url'],'title':i['title'],'published':normalize_date(i['published']),
                    'region':'Россия','summary':clean(i['desc'])[:600],**sc
                })
    return leads

def etpgpb():
    leads=[]
    xml=fetch('https://etpgpb.ru/procedures.rss',18)
    for i in parse_rss(xml):
        sc=score(i['title'],i['desc'],'etpgpb','DIRECT',i['published'])
        if not sc: continue
        leads.append({
            'source':'etpgpb','url':i['url'],'title':i['title'],'published':normalize_date(i['published']),
            'region':'Россия','summary':clean(i['desc'])[:600],**sc
        })
    return leads

def title_key(s):
    s=re.sub(r'[^a-zа-я0-9 ]+',' ',(s or '').lower())
    return ' '.join(s.split())[:180]

def main():
    sources={}; all_leads=[]
    for name,fn in [('Google News',google_news),('ЭТП ГПБ',etpgpb)]:
        try:
            x=fn(); sources[name]={'ok':True,'found':len(x)}; all_leads.extend(x)
        except Exception as e:
            sources[name]={'ok':False,'error':str(e)[:240]}
    dedup={}
    for x in all_leads:
        key=title_key(x.get('title')) or x.get('url')
        if key not in dedup or x['score']>dedup[key]['score']:
            dedup[key]=x
    leads=sorted(dedup.values(),key=lambda x:(x['score'],-x.get('age_days',9999)),reverse=True)[:120]
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps({'generated_at':datetime.now(timezone.utc).isoformat(),'sources':sources,'leads':leads},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'found':len(leads),'sources':sources},ensure_ascii=False))

if __name__=='__main__':
    main()
