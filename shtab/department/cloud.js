const projects=[
 ['shtab','Штаб 2.1','operations','Существующий центр; эта панель — агентный preview, без синхронизации.'],
 ['avangard','Авангард','sales','Hangcha/Wecan, Россия, без тендеров; ничего не отправлять автоматически.'],
 ['web','Сайты и маркетинг / AVELNARO','sales','Доводить сайты до проверяемого результата.'],
 ['revenue','AI Revenue Control / ШТАБ AI','product','Коммерческий продукт, отдельно от внутреннего штаба.'],
 ['cashforge','CASHFORGE','product','Спецификация уточняется; не объединять с NOVA.'],
 ['nova','NOVA','product','Применять существующие модули только к конкретному спросу.'],
 ['blog','Личный блог Арслана','content','Позиционирование предпринимателя и стратега; публикация после одобрения.'],
 ['elmar','Эльмар','content','Реальные фото и утверждённый минималистичный стиль.'],
 ['nazym','Назым','content','Мини-продукты TG; без диагностики; клуб в разработке.'],
 ['diana','Диана','content','Реальные фото и отдельный от других тренеров стиль.'],
 ['sunlands','Санлендс','content','Не придумывать расходы и продажи.'],
 ['lareno','Lareno Home','delivery','Статус оплаты уточнять перед крупной работой.'],
 ['ats','ATS AUTO','delivery','Production не менять без отдельного поручения.'],
 ['mozaika','MOZAIKAPAZL','delivery','Уточнить действующий объём и приёмку.'],
 ['kingstore','KINGSTORE','delivery','Демонстрационный кейс, не оплаченная сделка.'],
 ['media','ПРИЧИНА / Media','product','Исторический статус — пауза.']
];
const agents={chief:'Руководитель штаба',sales:'Менеджер продаж',research:'Исследователь',content:'Контент-стратег',script:'Сценарист',design:'Арт-директор',web:'Веб-разработчик',automation:'Инженер автоматизации',product:'Продуктовый менеджер',analytics:'Аналитик роста',finance:'Финансовый аналитик',qa:'Проверяющий'};
const names={operations:'Штаб',sales:'Продажи',research:'Исследование',content:'Контент',script:'Сценарий',design:'Дизайн',web:'Сайт',automation:'Автоматизация',product:'Продукт',analytics:'Аналитика',finance:'Финансы',delivery:'Исполнение'};
const status={new:'Новая',running:'В работе',review:'На проверке',approved:'Утверждена',rework:'Доработка',error:'Ошибка'};
const storage='arslan_department_preview_v1';let tasks=[];try{tasks=JSON.parse(localStorage.getItem(storage)||'[]')}catch{}let selected=null,filter=null;
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){localStorage.setItem(storage,JSON.stringify(tasks));render()}
function toast(msg){let el=$('#toast');el.textContent=msg;el.style.display='block';setTimeout(()=>el.style.display='none',5000)}
function render(){
 $('#mode').textContent='● VERCEL PREVIEW';$('#projectCount').textContent=projects.length;$('#agentCount').textContent=Object.keys(agents).length;$('#taskCount').textContent=tasks.length;$('#reviewCount').textContent=tasks.filter(x=>x.status==='review').length;
 $('#projects').innerHTML='<button class="project '+(!filter?'active':'')+'" onclick="setFilter(null)"><span>Все проекты</span><em>'+tasks.length+'</em></button>'+projects.map(p=>'<button class="project '+(filter===p[0]?'active':'')+'" onclick="setFilter(\''+p[0]+'\')"><span>'+esc(p[1])+'</span><em>'+tasks.filter(t=>t.project_id===p[0]).length+'</em></button>').join('');
 $('#projectSelect').innerHTML=projects.map(p=>'<option value="'+p[0]+'">'+esc(p[1])+'</option>').join('');$('#streamSelect').innerHTML=Object.keys(names).map(s=>'<option value="'+s+'">'+names[s]+'</option>').join('');if(filter)$('#projectSelect').value=filter;
 let list=tasks.filter(t=>!filter||t.project_id===filter);$('#tasks').innerHTML=list.length?list.map(t=>'<div class="task '+(selected===t.id?'active':'')+'" onclick="show(\''+t.id+'\')"><div class="task-top"><strong>'+esc(t.title)+'</strong><span class="badge '+esc(t.status)+'">'+status[t.status]+'</span></div><p>'+esc(t.project_name)+' · '+names[t.stream]+'</p></div>').join(''):'<div class="empty">Пока нет задач. Добавь поручение ниже.</div>';
 if(selected)show(selected)
}
function setFilter(id){filter=id;render()}
function show(id){selected=id;let t=tasks.find(x=>x.id===id);if(!t)return;$('#detail').innerHTML='<div class="box-body"><div class="eyebrow">'+esc(t.project_name)+' / '+status[t.status]+'</div><h3 class="detail-title">'+esc(t.title)+'</h3><small>Задача '+esc(t.id)+' · данные только в этом браузере</small><div class="label">Входные данные</div><div style="white-space:pre-wrap;font-size:13px">'+esc(t.brief)+'</div><div class="label">Критерий готовности</div><div style="white-space:pre-wrap;font-size:13px">'+esc(t.acceptance)+'</div><div class="actions"><button class="primary" onclick="runSelected()" '+(t.status==='running'?'disabled':'')+'>Запустить агентов</button>'+(t.status==='review'?'<button class="secondary" onclick="decide(\'approved\')">Принять</button><button class="secondary" onclick="decide(\'rework\')">На доработку</button>':'')+'</div>'+(t.decision?'<div class="notice">Комментарий: '+esc(t.decision)+'</div>':'')+(t.stages.length?'<div class="label">Результаты этапов</div>':'')+t.stages.map(s=>'<div class="stage"><div class="stage-head">'+esc(agents[s.agent])+'</div><pre>'+esc(s.output)+'</pre></div>').join('')+'</div>'}
async function runSelected(){let t=tasks.find(x=>x.id===selected);if(!t)return;let token=sessionStorage.getItem('department_token')||prompt('Ключ доступа отдела (не API-ключ OpenAI):');if(!token)return;sessionStorage.setItem('department_token',token);t.status='running';save();toast('Агенты выполняют задачу');
 try{let response=await fetch('/api/department-run',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({project:t.project_name,context:t.context,stream:t.stream,title:t.title,brief:t.brief,acceptance:t.acceptance})});let data=await response.json();if(!response.ok)throw Error(data.error||'Ошибка');t.stages=data.stages;t.status='review';save();toast('Результат готов к проверке')}
 catch(e){t.status='error';save();toast(e.message)}
}
function decide(value){let t=tasks.find(x=>x.id===selected);t.decision=prompt(value==='approved'?'Комментарий к приёмке':'Что исправить?')||'';t.status=value;save()}
function downloadExport(){let blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),tasks},null,2)],{type:'application/json'});let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='arslan-agent-department.json';a.click();URL.revokeObjectURL(a.href)}
$('#form').addEventListener('submit',e=>{e.preventDefault();let data=Object.fromEntries(new FormData(e.target));let project=projects.find(x=>x[0]===data.project_id);let t={...data,id:crypto.randomUUID().slice(0,12),project_name:project[1],context:project[3],status:'new',stages:[],decision:''};tasks.unshift(t);selected=t.id;e.target.reset();save();toast('Задача создана')});render();
