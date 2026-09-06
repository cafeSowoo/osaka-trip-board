/* Shared Supabase adapter for the published GitHub Pages board. */
(() => {
  'use strict';

  const URL='https://myincubzgvhyreyqbban.supabase.co';
  const KEY='sb_publishable_6NmnzRERi_Azsyh44zbZnw_HjqHh7hd';
  const TRIP_ID='osaka-2026';
  const TOKEN_KEY='trip-together.osaka.2026.invite-token';
  const LOCAL_HOSTS=new Set(['127.0.0.1','localhost']);

  const isRemote=()=>location.protocol!=='file:'&&!LOCAL_HOSTS.has(location.hostname);

  function tokenFromHash(){
    const raw=location.hash.startsWith('#')?location.hash.slice(1):location.hash;
    if(!raw)return '';
    const params=new URLSearchParams(raw);
    const token=(params.get('join')||'').trim();
    if(!token)return '';
    history.replaceState(null,'',location.pathname+location.search);
    return token;
  }

  function getToken(){
    const fromHash=tokenFromHash();
    if(fromHash){try{localStorage.setItem(TOKEN_KEY,fromHash);}catch{}return fromHash;}
    try{return localStorage.getItem(TOKEN_KEY)||'';}catch{return '';}
  }

  function setToken(token){
    token=String(token||'').trim();
    if(!/^[A-Za-z0-9_-]{20,100}$/.test(token))throw new Error('초대 코드 형식을 확인해주세요.');
    try{localStorage.setItem(TOKEN_KEY,token);}catch{throw new Error('이 브라우저에 초대 코드를 저장할 수 없어요.');}
    return token;
  }

  function clearToken(){try{localStorage.removeItem(TOKEN_KEY);}catch{}}

  async function request(path,{method='GET',body,prefer,token=getToken()}={}){
    if(!token)throw new Error('초대 코드가 필요해요.');
    const headers={apikey:KEY,Authorization:`Bearer ${KEY}`,'x-osaka-trip-token':token};
    if(body!==undefined)headers['Content-Type']='application/json';
    if(prefer)headers.Prefer=prefer;
    let response;
    try{response=await fetch(URL+'/rest/v1/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});}
    catch{throw new Error('공용 보드에 연결할 수 없어요. 인터넷 연결을 확인해주세요.');}
    const text=await response.text();
    let data=null;
    if(text){try{data=JSON.parse(text);}catch{data=text;}}
    if(!response.ok){
      const message=data?.message||data?.hint||`서버 요청에 실패했어요. (${response.status})`;
      throw new Error(message);
    }
    return data;
  }

  async function whoami(token=getToken()){
    const data=await request('rpc/osaka_trip_whoami',{method:'POST',body:{p_trip_id:TRIP_ID},token});
    if(typeof data!=='string'||!/^p[1-5]$/.test(data))throw new Error('유효하지 않은 초대 코드예요.');
    return data;
  }

  async function rows(table,query=''){
    return request(`${table}?trip_id=eq.${encodeURIComponent(TRIP_ID)}${query?'&'+query:''}`);
  }

  const time=v=>String(v||'').slice(0,5);

  async function load(){
    const [trips,members,days,slots,candidates,votes,picks,comments]=await Promise.all([
      request(`osaka_trip_trips?id=eq.${TRIP_ID}&select=*`),
      rows('osaka_trip_members','select=*&order=sort_order.asc'),
      rows('osaka_trip_days','select=*&order=day_date.asc'),
      rows('osaka_trip_slots','select=*&order=day_date.asc,sort_order.asc'),
      rows('osaka_trip_candidates','select=*&order=created_at.asc'),
      rows('osaka_trip_votes','select=*&order=created_at.asc'),
      rows('osaka_trip_picks','select=*&order=created_at.asc'),
      rows('osaka_trip_comments','select=*&order=created_at.asc')
    ]);
    const trip=trips?.[0];
    if(!trip||members.length!==5||days.length!==3||slots.length!==24)throw new Error('공용 여행 보드의 기본 데이터가 올바르지 않아요.');
    const voteMap=new Map(),pickMap=new Map(),commentMap=new Map();
    for(const v of votes){if(!voteMap.has(v.candidate_id))voteMap.set(v.candidate_id,[]);voteMap.get(v.candidate_id).push(v.member_id);}
    for(const p of picks){if(!pickMap.has(p.candidate_id))pickMap.set(p.candidate_id,[]);pickMap.get(p.candidate_id).push(p.member_id);}
    for(const c of comments){if(!commentMap.has(c.candidate_id))commentMap.set(c.candidate_id,[]);commentMap.get(c.candidate_id).push({id:c.id,authorId:c.member_id,text:c.body,createdAt:c.created_at});}
    const state={
      version:1,
      updatedAt:trip.updated_at,
      participants:members.map(m=>({id:m.member_id,name:m.display_name})),
      days:days.map(d=>({
        id:d.day_date,status:d.status,locked:d.locked,
        slots:slots.filter(s=>s.day_date===d.day_date).map(s=>({id:s.slot_id,enabled:s.enabled,start:time(s.start_time),end:time(s.end_time),confirmedId:s.confirmed_candidate_id,rainId:s.rain_candidate_id,transfer:s.transfer||''}))
      })),
      candidates:candidates.map(c=>({
        id:c.id,dayId:c.day_date,slotId:c.slot_id,title:c.title,address:c.address||'',mapsUrl:c.maps_url,category:c.category,
        cost:c.cost===null?null:Number(c.cost),duration:c.duration_minutes===null?null:Number(c.duration_minutes),reservation:c.reservation,
        weather:c.weather,description:c.description||'',photoUrl:c.photo_url||'',lat:c.lat===null?null:Number(c.lat),lng:c.lng===null?null:Number(c.lng),
        authorId:c.author_member_id,createdAt:c.created_at,votes:voteMap.get(c.id)||[],picks:pickMap.get(c.id)||[],comments:commentMap.get(c.id)||[]
      })),
      bookings:{flights:trip.flights||'',hotel:trip.hotel||''}
    };
    return globalThis.TripModel.validate(state);
  }

  function candidateBody(c,actor){return {trip_id:TRIP_ID,day_date:c.dayId,slot_id:c.slotId,title:c.title,address:c.address,maps_url:c.mapsUrl,category:c.category,cost:c.cost,duration_minutes:c.duration,reservation:c.reservation,weather:c.weather,description:c.description,photo_url:c.photoUrl,lat:c.lat,lng:c.lng,author_member_id:actor};}
  function candidatePatch(c){return {title:c.title,address:c.address,maps_url:c.mapsUrl,category:c.category,cost:c.cost,duration_minutes:c.duration,reservation:c.reservation,weather:c.weather,description:c.description,photo_url:c.photoUrl,lat:c.lat,lng:c.lng};}

  async function persist(action,{actor,state,next}){
    const one=async a=>{
      if(a.type==='add')return request('osaka_trip_candidates',{method:'POST',body:candidateBody(a.candidate,actor),prefer:'return=minimal'});
      if(a.type==='edit')return request(`osaka_trip_candidates?id=eq.${encodeURIComponent(a.id)}`,{method:'PATCH',body:candidatePatch(a.patch),prefer:'return=minimal'});
      if(a.type==='delete')return request(`osaka_trip_candidates?id=eq.${encodeURIComponent(a.id)}`,{method:'DELETE',prefer:'return=minimal'});
      if(a.type==='vote'||a.type==='pick'){
        const c=state.candidates.find(c=>c.id===a.id);if(!c)throw new Error('후보를 찾을 수 없어요.');
        const selected=(a.type==='vote'?c.votes:c.picks).includes(actor),table=a.type==='vote'?'osaka_trip_votes':'osaka_trip_picks';
        if(selected)return request(`${table}?candidate_id=eq.${encodeURIComponent(a.id)}&member_id=eq.${actor}`,{method:'DELETE',prefer:'return=minimal'});
        return request(table,{method:'POST',body:{trip_id:TRIP_ID,candidate_id:a.id,member_id:actor},prefer:'return=minimal'});
      }
      if(a.type==='comment')return request('osaka_trip_comments',{method:'POST',body:{trip_id:TRIP_ID,candidate_id:a.id,member_id:actor,body:a.text},prefer:'return=minimal'});
      if(a.type==='confirm'||a.type==='rain'){
        const column=a.type==='confirm'?'confirmed_candidate_id':'rain_candidate_id';
        return request(`osaka_trip_slots?day_date=eq.${a.dayId}&slot_id=eq.${a.slotId}`,{method:'PATCH',body:{[column]:a.id},prefer:'return=minimal'});
      }
      if(a.type==='slot'){
        const patch={};
        if(Object.hasOwn(a.patch,'enabled'))patch.enabled=a.patch.enabled;
        if(Object.hasOwn(a.patch,'start'))patch.start_time=a.patch.start;
        if(Object.hasOwn(a.patch,'end'))patch.end_time=a.patch.end;
        if(Object.hasOwn(a.patch,'transfer'))patch.transfer=a.patch.transfer;
        return request(`osaka_trip_slots?day_date=eq.${a.dayId}&slot_id=eq.${a.slotId}`,{method:'PATCH',body:patch,prefer:'return=minimal'});
      }
      if(a.type==='day')return request(`osaka_trip_days?day_date=eq.${a.dayId}`,{method:'PATCH',body:a.patch,prefer:'return=minimal'});
      if(a.type==='bookings')return request(`osaka_trip_trips?id=eq.${TRIP_ID}`,{method:'PATCH',body:a.patch,prefer:'return=minimal'});
      if(a.type==='participants'){
        const targets=actor==='p1'?next.participants:next.participants.filter(p=>p.id===actor);
        for(const p of targets)await request(`osaka_trip_members?member_id=eq.${p.id}`,{method:'PATCH',body:{display_name:p.name},prefer:'return=minimal'});
        return;
      }
      throw new Error('공용 보드에서 지원하지 않는 작업이에요.');
    };
    for(const a of (Array.isArray(action)?action:[action]))await one(a);
  }

  async function revision(){
    const rows=await request(`osaka_trip_trips?id=eq.${TRIP_ID}&select=updated_at`);
    return rows?.[0]?.updated_at||'';
  }

  globalThis.TripRemote=Object.freeze({isRemote,TRIP_ID,TOKEN_KEY,getToken,setToken,clearToken,whoami,load,persist,revision});
})();
