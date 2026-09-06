/* Trip Together: dependency-free state model. */
(() => {
  'use strict';
  const SLOTS = [
    ['breakfast','아침식사','🍳','아침','08:00','09:00'],['morning','오전 일정','☀️','아침','09:00','12:00'],
    ['lunch','점심식사','🍜','낮','12:00','13:00'],['afternoon1','오후 일정 ①','🌤️','낮','13:00','15:00'],
    ['afternoon2','오후 일정 ②','☕','낮','15:00','18:00'],['dinner','저녁식사','🍽️','저녁','18:00','19:00'],
    ['evening1','저녁 일정 ①','🌙','저녁','19:00','21:00'],['evening2','저녁 일정 ②','✨','저녁','21:00','23:00']
  ].map(([id,label,icon,period,start,end])=>({id,label,icon,period,start,end}));
  const CATEGORIES = {meal:'식사',cafe:'카페',sight:'관광',shopping:'쇼핑',activity:'놀거리',drink:'술',night:'야경',other:'기타'};
  const dates = ['2026-11-06','2026-11-07','2026-11-08'];
  const uid = () => globalThis.crypto?.randomUUID?.() || 'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const copy = x => JSON.parse(JSON.stringify(x));
  const fail = msg => { throw new Error(msg); };
  const need = (test,msg) => { if(!test) fail(msg); };
  const obj = x => x && typeof x === 'object' && !Array.isArray(x);
  const str = (x,max=500,required=false) => { need(typeof x==='string' && x.length<=max,'입력한 글의 형식 또는 길이를 확인해주세요.'); x=x.trim(); need(!required||x.length>0,'필수 항목을 입력해주세요.'); return x; };
  const num = (x,max) => { if(x===null||x==='') return null; need(typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=max,'비용 또는 시간의 범위를 확인해주세요.');return x; };
  const enumValue = (x,values) => { need(values.includes(x),'지원하지 않는 값이 포함되어 있어요.'); return x; };
  const iso = x => { need(typeof x==='string' && x.length<40 && Number.isFinite(Date.parse(x)),'날짜 형식이 올바르지 않아요.');return x; };
  const idStr = x => { x=str(x,80,true);need(/^[a-zA-Z0-9_-]+$/.test(x),'식별자 형식이 올바르지 않아요.');return x; };
  function safeUrl(raw,maps=false){
    raw=str(raw,2000); if(!raw) return '';
    let u; try{u=new URL(raw);}catch{fail('링크는 https://로 시작하는 전체 주소를 입력해주세요.');}
    need(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password,'안전한 웹 주소만 입력할 수 있어요.');
    if(maps){
      const host=u.hostname.toLowerCase();
      const main=['google.com','www.google.com','maps.google.com','google.co.jp','www.google.co.jp','maps.google.co.jp','google.co.kr','www.google.co.kr','maps.google.co.kr'];
      need((host==='maps.app.goo.gl')||(host==='goo.gl'&&u.pathname.startsWith('/maps'))||(main.includes(host)&&(u.pathname.startsWith('/maps')||host.startsWith('maps.'))),'Google 지도에서 복사한 장소 링크를 입력해주세요.');
      need(u.protocol==='https:','지도 링크는 https:// 주소를 사용해주세요.');
    }
    return u.href;
  }
  function create(){
    return {version:1,updatedAt:new Date().toISOString(),participants:Array.from({length:5},(_,i)=>({id:'p'+(i+1),name:i?'여행자 '+(i+1):'지석'})),
      days:dates.map(id=>({id,status:'collect',locked:false,slots:SLOTS.map(s=>({id:s.id,enabled:true,start:s.start,end:s.end,confirmedId:null,rainId:null,transfer:''}))})),candidates:[],bookings:{flights:'',hotel:''}};
  }
  function validate(raw){
    need(obj(raw)&&raw.version===1,'이 보드에서 지원하는 백업 파일이 아니에요.');
    need(Array.isArray(raw.participants)&&raw.participants.length===5,'참여자는 정확히 5명이어야 해요.');
    const participants=raw.participants.map((p,i)=>{need(obj(p)&&p.id==='p'+(i+1),'참여자 정보가 올바르지 않아요.');return {id:p.id,name:str(p.name,24,true)};});
    need(new Set(participants.map(p=>p.name.toLocaleLowerCase())).size===5,'참여자의 이름은 서로 다르게 입력해주세요.');
    const pids=participants.map(p=>p.id);
    need(Array.isArray(raw.days)&&raw.days.length===3,'여행 날짜 정보가 올바르지 않아요.');
    const days=raw.days.map((d,i)=>{
      need(obj(d)&&d.id===dates[i]&&typeof d.locked==='boolean'&&Array.isArray(d.slots)&&d.slots.length===8,'하루 일정 정보가 올바르지 않아요.');
      return {id:d.id,status:enumValue(d.status,['collect','vote','final']),locked:d.locked,slots:d.slots.map((s,j)=>{
        need(obj(s)&&s.id===SLOTS[j].id&&typeof s.enabled==='boolean','시간대 정보가 올바르지 않아요.');
        need(/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end)&&s.start<s.end,'종료 시간은 시작 시간보다 늦어야 해요. 자정을 넘는 일정은 다음 날짜로 나눠주세요.');
        return {id:s.id,enabled:s.enabled,start:s.start,end:s.end,confirmedId:s.confirmedId===null?null:idStr(s.confirmedId),rainId:s.rainId===null?null:idStr(s.rainId),transfer:str(s.transfer,120)};
      })};
    });
    need(Array.isArray(raw.candidates)&&raw.candidates.length<=600,'후보는 최대 600개까지 저장할 수 있어요.');
    const members=a=>{need(Array.isArray(a)&&a.length<=5&&new Set(a).size===a.length&&a.every(x=>pids.includes(x)),'투표자 정보가 올바르지 않아요.');return [...a];};
    const allIds=new Set();
    const unique=x=>{x=idStr(x);need(!allIds.has(x),'중복된 데이터 ID가 있어요.');allIds.add(x);return x;};
    const candidates=raw.candidates.map(c=>{
      need(obj(c)&&dates.includes(c.dayId)&&SLOTS.some(s=>s.id===c.slotId),'후보의 날짜 또는 시간대가 올바르지 않아요.');
      need(pids.includes(c.authorId)&&typeof c.reservation==='boolean','제안자 정보가 올바르지 않아요.');
      need(Array.isArray(c.comments)&&c.comments.length<=200,'후보당 댓글은 최대 200개까지 저장할 수 있어요.');
      const lat=c.lat,lng=c.lng;
      need((lat===null&&lng===null)||(typeof lat==='number'&&typeof lng==='number'&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180),'위도와 경도를 모두 정확하게 입력해주세요.');
      return {id:unique(c.id),dayId:c.dayId,slotId:c.slotId,title:str(c.title,100,true),address:str(c.address,300),mapsUrl:safeUrl(c.mapsUrl,true),category:enumValue(c.category,Object.keys(CATEGORIES)),cost:num(c.cost,10000000),duration:num(c.duration,1440),reservation:c.reservation,weather:enumValue(c.weather,['any','indoor','outdoor']),description:str(c.description,2000),photoUrl:safeUrl(c.photoUrl),lat,lng,authorId:c.authorId,createdAt:iso(c.createdAt),votes:members(c.votes),picks:members(c.picks),comments:c.comments.map(m=>{need(obj(m)&&pids.includes(m.authorId),'댓글 작성자가 올바르지 않아요.');return {id:unique(m.id),authorId:m.authorId,text:str(m.text,500,true),createdAt:iso(m.createdAt)};})};
    });
    for(const d of days){
      for(const s of d.slots){
        for(const id of [s.confirmedId,s.rainId]) if(id)need(candidates.some(c=>c.id===id&&c.dayId===d.id&&c.slotId===s.id),'확정/대체 일정은 같은 날짜와 시간대의 후보여야 해요.');
        need(!s.rainId||s.confirmedId!==s.rainId,'확정 일정과 우천 대체 후보는 달라야 해요.');
      }
      const enabled=d.slots.filter(s=>s.enabled);
      if(d.status==='final')need(enabled.length>0&&enabled.every(s=>s.confirmedId),'사용하는 모든 시간대를 선택한 뒤 일정 확정 상태로 바꿔주세요.');
    }
    for(const p of pids)need(candidates.filter(c=>c.picks.includes(p)).length<=3,'꼭 가고 싶은 곳은 여행 전체에서 3개까지 선택할 수 있어요.');
    need(obj(raw.bookings),'예약 정보 형식이 올바르지 않아요.');
    return {version:1,updatedAt:iso(raw.updatedAt),participants,days,candidates,bookings:{flights:str(raw.bookings.flights,3000),hotel:str(raw.bookings.hotel,3000)}};
  }
  function change(state,a,actorId){
    const n=copy(state);need(n.participants.some(p=>p.id===actorId),'먼저 참여자를 선택해주세요.');
    const candidate=()=>{const c=n.candidates.find(c=>c.id===a.id);need(c,'후보를 찾을 수 없어요.');return c;};
    const day=id=>{const d=n.days.find(d=>d.id===id);need(d,'날짜를 찾을 수 없어요.');return d;};
    const unlocked=d=>need(!d.locked,'잠긴 일정이에요. 날짜 설정에서 잠금을 해제해주세요.');
    const slot=d=>{const s=d.slots.find(s=>s.id===a.slotId);need(s,'시간대를 찾을 수 없어요.');return s;};
    switch(a.type){
      case 'add':{
        const c=a.candidate;const d=day(c.dayId);unlocked(d);need(d.slots.some(s=>s.id===c.slotId&&s.enabled),'사용하지 않는 시간대에는 후보를 추가할 수 없어요.');
        n.candidates.push({...c,id:uid(),authorId:actorId,createdAt:new Date().toISOString(),votes:[],picks:[],comments:[]});break;
      }
      case 'edit':{const c=candidate();unlocked(day(c.dayId));need(c.authorId===actorId,'본인이 제안한 후보만 수정할 수 있어요.');const allowed=['title','address','mapsUrl','category','cost','duration','reservation','weather','description','photoUrl','lat','lng'];for(const key of allowed)if(Object.hasOwn(a.patch,key))c[key]=a.patch[key];break;}
      case 'delete':{const c=candidate();unlocked(day(c.dayId));need(c.authorId===actorId,'본인이 제안한 후보만 삭제할 수 있어요.');n.candidates=n.candidates.filter(x=>x.id!==c.id);for(const d of n.days)for(const s of d.slots){if(s.confirmedId===c.id)s.confirmedId=null;if(s.rainId===c.id)s.rainId=null;}break;}
      case 'vote':case 'pick':{const c=candidate();unlocked(day(c.dayId));const field=a.type==='vote'?'votes':'picks';if(c[field].includes(actorId))c[field]=c[field].filter(x=>x!==actorId);else{if(field==='picks')need(n.candidates.filter(x=>x.picks.includes(actorId)).length<3,'꼭 가고 싶은 곳은 여행 전체에서 3개까지 선택할 수 있어요.');c[field].push(actorId);}break;}
      case 'comment':{const c=candidate();unlocked(day(c.dayId));c.comments.push({id:uid(),authorId:actorId,text:str(a.text,500,true),createdAt:new Date().toISOString()});break;}
      case 'confirm':case 'rain':{const d=day(a.dayId);unlocked(d);const s=slot(d);need(s.enabled,'사용하지 않는 시간대예요.');if(a.id)need(n.candidates.some(c=>c.id===a.id&&c.dayId===d.id&&c.slotId===s.id),'같은 시간대의 후보를 선택해주세요.');if(a.type==='confirm'){s.confirmedId=a.id;if(s.rainId===a.id)s.rainId=null;}else{need(!a.id||a.id!==s.confirmedId,'확정 일정과 다른 대체 후보를 골라주세요.');s.rainId=a.id;}break;}
      case 'day':{const d=day(a.dayId);if(d.locked)need(Object.keys(a.patch).length===1&&a.patch.locked===false,'잠금을 먼저 해제해주세요.');for(const k of ['status','locked'])if(Object.hasOwn(a.patch,k))d[k]=a.patch[k];break;}
      case 'slot':{const d=day(a.dayId);unlocked(d);const s=slot(d);for(const k of ['enabled','start','end','transfer'])if(Object.hasOwn(a.patch,k))s[k]=a.patch[k];break;}
      case 'participants':need(Array.isArray(a.names)&&a.names.length===5,'참여자 이름 5개를 입력해주세요.');n.participants=n.participants.map((p,i)=>({...p,name:a.names[i]}));break;
      case 'bookings':for(const k of ['flights','hotel'])if(Object.hasOwn(a.patch,k))n.bookings[k]=a.patch[k];break;
      default:fail('지원하지 않는 작업이에요.');
    }
    for(const d of n.days){
      const enabled=d.slots.filter(s=>s.enabled);
      if(d.status==='final'&&(!enabled.length||enabled.some(s=>!s.confirmedId))){
        if(a.type==='day'&&a.patch.status==='final')fail('사용하는 모든 시간대를 선택한 뒤 일정 확정 상태로 바꿔주세요.');
        d.status='vote';
      }
    }
    n.updatedAt=new Date().toISOString();return validate(n);
  }
  function rank(cs){
    const sorted=[...cs].sort((a,b)=>b.votes.length-a.votes.length||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
    return sorted.map(candidate=>({candidate,rank:candidate.votes.length?sorted.findIndex(c=>c.votes.length===candidate.votes.length)+1:0,tied:candidate.votes.length>0&&sorted.filter(c=>c.votes.length===candidate.votes.length).length>1}));
  }
  function route(state,dayId,mode='confirmed'){
    const d=state.days.find(d=>d.id===dayId);if(!d)return [];
    return d.slots.filter(s=>s.enabled).flatMap(s=>{let c=state.candidates.find(c=>c.id===s.confirmedId);if(!c&&mode==='leaders')c=rank(state.candidates.filter(c=>c.dayId===dayId&&c.slotId===s.id&&c.votes.length>0))[0]?.candidate;return c?[{candidate:c,slot:s}]:[];}).map((r,i)=>({...r,index:i+1}));
  }
  function budget(state,dayId){const rs=route(state,dayId);return {total:rs.reduce((v,r)=>v+(r.candidate.cost??0),0),unknown:rs.filter(r=>r.candidate.cost===null).length,count:rs.length};}
  function searchUrl(title,address=''){
    let query=[title,address,'Osaka Japan'].filter(Boolean).join(' '),url;
    do{url='https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query});if(url.length<=2048)return url;query=Array.from(query).slice(0,-1).join('');}while(query);
    return 'https://www.google.com/maps/search/?api=1&query=Osaka+Japan';
  }
  function point(c){return c.lat!==null&&c.lng!==null?c.lat+','+c.lng:[Array.from(c.title).slice(0,75).join(''),Array.from(c.address).slice(0,20).join(''),'Osaka Japan'].filter(Boolean).join(' ');}
  function directionsUrl(from,to,mode='transit'){return 'https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',origin:point(from),destination:point(to),travelmode:['transit','walking','driving'].includes(mode)?mode:'transit'});}
  function coordinates(raw){
    try{const u=new URL(raw);safeUrl(raw,true);let m=decodeURIComponent(u.href).match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);if(!m){const q=u.searchParams.get('query')||u.searchParams.get('q')||'';m=q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);}if(m){const lat=+m[1],lng=+m[2];if(Math.abs(lat)<=90&&Math.abs(lng)<=180)return {lat,lng};}}catch{}return null;
  }
  globalThis.TripModel=Object.freeze({SLOTS,CATEGORIES,create,validate,change,rank,budget,route,searchUrl,directionsUrl,coordinates,safeUrl});
})();
