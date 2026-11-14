/* Reuses the owner-scoped School API. No student account, GPS consent or booking
   is created by these forms. Forecast matching stays server-authoritative. */
(function (root) {
  'use strict';
  const STAGES = [['land','Land lesson'],['drag','Body drag'],['start','Water start'],['upwind','Upwind riding'],['trans','Transitions'],['jump','Jumping']];
  const MAX_VIEW_AGE = 5 * 60 * 1000;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const number = value => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(1);

  function planningState(data, loadedAt, now = Date.now()) {
    if (!data) return { allowed:false, label:'Evidence unavailable', reason:'Refresh the planner to load your students and the latest evidence.' };
    if (now - loadedAt >= MAX_VIEW_AGE) return { allowed:false, label:'Refresh needed', reason:'This planning view is over five minutes old. Refresh evidence before reviewing candidate windows.' };
    if (data.school?.sport !== 'kitesurfing') return { allowed:false, label:'Sport not supported', reason:'These lesson stages and wind bands are for kitesurfing. Your roster is saved, but this planner does not calculate lesson windows for other sports.' };
    const safety = data.safety;
    const observation = data.live?.observation;
    const observedAt = Date.parse(observation?.observedAt || '');
    const maxAge = Number(observation?.freshness?.maxAgeMinutes ?? 90) * 60000;
    const fresh = observation?.fresh === true && Number.isFinite(observedAt) && observedAt <= now + 300000 && now - observedAt <= maxAge;
    const allowed = safety?.allowScheduling === true && safety.status === 'GO' && fresh;
    return { allowed, label:allowed?'Candidates available':'Planning withheld', reason:allowed?'Forecast matches only. Check gusts, water state, rescue cover and student readiness on site. These are not bookings or permission to launch.':safety?.status === 'GO' && !fresh?'A fresh, timestamped wind observation is required. Refresh evidence; forecast matches alone do not open lesson planning.':safety?.summary || 'Senlay has not returned the evidence needed to show lesson windows.' };
  }

  function candidateWindows(student, gate, now = Date.now()) {
    if (!gate.allowed) return [];
    return (Array.isArray(student.windows) ? student.windows : []).filter(w => {
      const start = Date.parse(w.startsAt), end = Date.parse(w.endsAt);
      return Number.isFinite(start) && Number.isFinite(end) && start >= now && end > start && end - start >= Number(student.lessonMinutes) * 60000;
    }).slice().sort((a,b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }

  function create({ api, toast, navigate }) {
    const $ = selector => document.querySelector(selector);
    const state = { data:null, loadedAt:0, pending:null, error:'', selected:'', search:'' };
    let expiryTimer;
    const date = value => {
      const parsed = new Date(value);
      if (!Number.isFinite(parsed.getTime())) return 'Time unavailable';
      try { return new Intl.DateTimeFormat(undefined,{ timeZone:state.data?.context?.spot?.timezone || 'UTC', month:'short',day:'numeric',hour:'2-digit',minute:'2-digit' }).format(parsed); }
      catch (_) { return parsed.toISOString().replace('T',' ').slice(0,16)+' UTC'; }
    };
    const students = () => state.data?.students || [];
    const gate = () => planningState(state.data,state.loadedAt);
    const errorHtml = () => state.error ? `<div class="planner-error" role="alert">${escape(state.error)}</div>` : '';
    const studentOptions = () => '<option value="">All students</option>'+students().map(s=>`<option value="${escape(s.id)}" ${String(s.id)===state.selected?'selected':''}>${escape(s.name)}</option>`).join('');
    const studentInfo = s => `${escape(s.stageLabel || STAGES.find(x=>x[0]===s.stage)?.[1] || 'Lesson stage')} · ${escape(s.weightKg)} kg · ${escape(s.lessonMinutes)} min`;
    function windowHtml(w, student, i) {
      // Compare the displayed window against other students, not just the
      // server's first-choice schedule. Alternatives can overlap too.
      const overlaps = students().filter(s=>String(s.id)!==String(student.id)).filter(s=>candidateWindows(s,gate()).some(other=>Date.parse(other.startsAt)<Date.parse(w.endsAt)&&Date.parse(other.endsAt)>Date.parse(w.startsAt)));
      return `<div class="planner-window"><div><strong>${escape(date(w.startsAt))} → ${escape(date(w.endsAt))}</strong><small>${i===0?'First matching window':'Alternative window'} · ${escape(w.durationMinutes)} min forecast coverage<br>${escape(number(w.windMinMs))}–${escape(number(w.windMaxMs))} m/s wind · gust ${escape(number(w.gustMaxMs))} m/s</small>${overlaps.length?`<small>Also matches: ${escape(overlaps.map(s=>s.name).join(', '))}. Arrange separate slots or instructor cover.</small>`:''}</div><span class="pill ${overlaps.length?'caution':'info'}">${overlaps.length?'Potential overlap':'Planning only'}</span></div>`;
    }
    function renderPlan() {
      const g = gate(), data = state.data, school = data?.school || {}, live = data?.live || {};
      if (state.selected && !students().some(s=>String(s.id)===state.selected)) state.selected='';
      const list = students().filter(s=>!state.selected || String(s.id)===state.selected);
      const count = students().filter(s=>candidateWindows(s,g).length).length;
      $('#planner-content').innerHTML = errorHtml()+`
        <div class="planner-summary">
          <article class="card"><div class="card-body"><span class="card-title">Students</span><strong>${students().length}</strong><p>Your private planning roster</p></div></article>
          <article class="card"><div class="card-body"><span class="card-title">With a window</span><strong>${g.allowed?count:'—'}</strong><p>${g.allowed?'Matching stage, duration and teaching hours':'Waiting for usable evidence'}</p></div></article>
          <article class="card"><div class="card-body"><span class="card-title">Measured wind</span><strong>${live.observation?.fresh?escape(number(live.observedWindMs)):'—'} <small>m/s</small></strong><p>${escape(live.observation?.stationName || live.observation?.source || 'No observation available')}</p></div></article>
        </div>
        <div class="planner-intro"><strong>${escape(g.label)}.</strong> ${escape(g.reason)}${school.isDefaultLocation?' <strong>Default location:</strong> this account uses the An Bang draft coordinates. Review the teaching spot and hours below before relying on this plan.':''}</div>
        <div class="planner-toolbar"><div class="field"><label for="planner-student-filter">Review a student</label><select id="planner-student-filter">${studentOptions()}</select></div><button class="button secondary" type="button" data-planner-action="refresh">Refresh evidence</button><button class="button" type="button" data-planner-action="add">+ Add student</button></div>
        <p class="planner-filter-note">${escape(school.spotName || 'Teaching spot not loaded')} · ${escape(data?.context?.spot?.timezone || 'UTC')} · ${state.loadedAt?'Loaded '+escape(date(state.loadedAt)):'Not loaded'}. Times are local to the teaching spot.</p>
        <div class="planner-layout"><div class="planner-list">${list.length?list.map(s=>{
          const windows=candidateWindows(s,g);
          return `<article class="planner-student"><div class="planner-student-head"><div><h2>${escape(s.name)}</h2><p class="planner-meta">${studentInfo(s)}</p></div><button class="button secondary small" type="button" data-planner-edit="${escape(s.id)}">Edit student</button></div><p class="planner-meta">${escape(number(s.minWindMs))}–${escape(number(s.maxWindMs))} m/s planning band · ${escape(s.gustGuidance || 'Review gusts on site')}</p>${windows.length?windows.map((w,i)=>windowHtml(w,s,i)).join(''):`<div class="planner-note">${g.allowed?'No future continuous window meets this student’s saved stage, lesson length and teaching hours.':'Windows withheld. Review the evidence message above.'}</div>`}${s.nextSkill?`<p class="planner-meta">Next focus: ${escape(s.nextSkill)}</p>`:''}</article>`;
        }).join(''):`<div class="planner-empty"><h2>Add your first student</h2>Save their lesson stage, weight and duration to compare the forecast with their planning band. No student app account is required.</div>`}</div>
        <aside class="card planner-evidence"><div class="card-head"><span class="card-title">What this plan uses</span></div><div class="card-body"><h2>${escape(school.spotName || 'Choose your teaching spot')}</h2><p class="planner-meta">${escape(school.name || 'Your teaching profile')}<br>${escape(school.sport || 'Sport not loaded')}</p><div class="divider"></div><p class="planner-meta">Observation: ${escape(live.observation?.observedAt?date(live.observation.observedAt):'Unavailable')}<br>Forecast wind: ${escape(number(live.forecastWindMs))} m/s</p><div class="divider"></div><p class="planner-meta">Windows come from School mode’s deterministic forecast matching, not an AI ranking. The first matching window is shown first; the instructor chooses the appropriate slot.</p><div class="divider"></div><p class="planner-meta">Manual students are private planning records. Live device access still needs a separate rider invitation, consent and an active group session.</p><a class="button secondary" style="margin-top:15px" href="school.html">School evidence &amp; chart ↗</a></div></aside></div>`;
      $('#planner-student-filter').onchange = event => { state.selected=event.target.value;renderPlan(); };
      $('#planner-content').querySelectorAll('[data-planner-action="refresh"]').forEach(b=>{b.disabled=!!state.pending;});
    }
    function renderStudents() {
      $('#planner-students-content').innerHTML=errorHtml()+`<div class="planner-intro"><strong>One roster, shared with your School mode.</strong> Add students manually without an email address or SmartSurf account. These records are private to your signed-in account; adding a student does not enable location sharing.</div><div class="planner-toolbar"><div class="field"><label for="planner-search">Find a student</label><input id="planner-search" type="search" placeholder="Search name or lesson stage" value="${escape(state.search)}"></div><button class="button" type="button" data-planner-action="add">+ Add student</button></div><div id="planner-student-list" class="planner-list"></div>`;
      $('#planner-search').oninput=event=>{state.search=event.target.value;renderStudentList();};
      renderStudentList();
    }
    function renderStudentList() {
      const query=state.search.trim().toLowerCase();
      const list=students().filter(s=>[s.name,s.stageLabel,s.stage].join(' ').toLowerCase().includes(query));
      $('#planner-student-list').innerHTML=list.length?list.map(s=>`<article class="planner-student"><div class="planner-student-head"><div><h2>${escape(s.name)}</h2><p class="planner-meta">${studentInfo(s)}</p></div><div class="row"><button class="button secondary small" type="button" data-planner-window="${escape(s.id)}">Check windows</button><button class="button secondary small" type="button" data-planner-edit="${escape(s.id)}">Edit</button><button class="button danger small" type="button" data-planner-remove="${escape(s.id)}">Remove</button></div></div>${s.notes?`<p class="planner-note">${escape(s.notes)}</p>`:''}</article>`).join(''):`<div class="planner-empty"><h2>${query?'No matching students':'Your roster is empty'}</h2>${query?'Try another name or stage.':'Add a student to start planning a lesson.'}</div>`;
    }
    function renderSetup() {
      const s=state.data?.school;
      if (!s) { $('#planner-setup').innerHTML=''; return; }
      const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
      $('#planner-setup').innerHTML=`<summary>Teaching spot &amp; hours · shared with School mode</summary><form id="planner-setup-form"><p class="planner-meta" style="margin-bottom:14px">Changes here also update School mode for this account. Lesson windows currently support kitesurfing stages only.</p><div class="form-grid"><div class="field"><label for="plan-name">Teaching profile name</label><input id="plan-name" name="name" maxlength="120" required value="${escape(s.name)}"></div><div class="field"><label for="plan-spot">Spot name</label><input id="plan-spot" name="spotName" maxlength="160" required value="${escape(s.spotName)}"></div><div class="field"><label for="plan-lat">Latitude</label><input id="plan-lat" name="lat" type="number" step="any" min="-90" max="90" required value="${escape(s.lat)}"></div><div class="field"><label for="plan-lng">Longitude</label><input id="plan-lng" name="lng" type="number" step="any" min="-180" max="180" required value="${escape(s.lng)}"></div><div class="field"><label for="plan-start">Teaching starts (spot local time)</label><input id="plan-start" name="start" type="time" required value="${clock(s.teachingStartMinute)}"></div><div class="field"><label for="plan-end">Teaching ends (00:00 = midnight)</label><input id="plan-end" name="end" type="time" required value="${clock(s.teachingEndMinute % 1440)}"></div><div class="field"><label for="plan-sport">Sport</label><select id="plan-sport" name="sport">${['kitesurfing','wingfoil','windsurfing','surfing','sup'].map(x=>`<option value="${x}" ${s.sport===x?'selected':''}>${x==='kitesurfing'?'Kitesurfing':x+' (windows unavailable)'}</option>`).join('')}</select></div></div><div id="planner-setup-error" role="alert" class="planner-meta"></div><div class="row"><button class="button" type="submit">Save teaching setup</button><span class="field-help">No bookings or student accounts are created.</span></div></form>`;
      $('#planner-setup-form').onsubmit=async event=>{
        event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
        const b=form.querySelector('[type=submit]'),f=Object.fromEntries(new FormData(form));
        const minute=v=>{const [h,m]=v.split(':').map(Number);return h*60+m;};
        if((minute(f.end)||1440)<=minute(f.start)){$('#planner-setup-error').textContent='Teaching end must be after the start.';return;}
        b.disabled=true;
        try { await api('/api/school/profile',{method:'PATCH',body:{name:f.name.trim(),spotName:f.spotName.trim(),lat:Number(f.lat),lng:Number(f.lng),sport:f.sport,teachingStartMinute:minute(f.start),teachingEndMinute:minute(f.end)||1440}});toast('Teaching setup saved.');await load(); }
        catch(error){$('#planner-setup-error').textContent=error.message;}finally{b.disabled=false;}
      };
    }
    async function load() {
      if(state.pending)return state.pending;
      const task=(async()=>{
        state.error='';
        $('#planner-content').setAttribute('aria-busy','true');
        try {const data=await api('/api/school/dashboard');if(!data.school||!Array.isArray(data.students)||!data.safety)throw new Error('The planner response is incomplete. Try refreshing.');state.data=data;state.loadedAt=Date.now();}
        catch(error){state.error=error.message;state.data=null;state.loadedAt=0;}
        finally {state.pending=null;$('#planner-content').setAttribute('aria-busy','false');renderPlan();renderStudents();renderSetup();clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>renderPlan(),MAX_VIEW_AGE+50);}
      })();
      state.pending=task;
      $('#planner-content').querySelectorAll('[data-planner-action="refresh"]').forEach(b=>{b.disabled=true;b.textContent='Refreshing…';});
      return task;
    }
    function openStudent(id) {
      const student=students().find(s=>String(s.id)===String(id)),s=student||{},dialog=$('#planner-dialog');
      const restore=document.activeElement;
      dialog.innerHTML=`<form id="planner-student-form"><div class="card-head"><h2 id="planner-dialog-title">${student?'Edit student':'Add student'}</h2><button class="button secondary small" type="button" data-planner-close>Close</button></div><div class="card-body"><p class="planner-meta" style="margin:0 0 16px">Private planning record. No email address or app account required.</p><div class="form-grid"><div class="field"><label for="plan-student-name">Student name</label><input id="plan-student-name" name="name" maxlength="100" required value="${escape(s.name)}" autofocus></div><div class="field"><label for="plan-student-weight">Weight (kg)</label><input id="plan-student-weight" name="weightKg" type="number" min="25" max="160" step="0.1" required value="${escape(s.weightKg)}"></div><div class="field"><label for="plan-student-stage">Lesson stage</label><select id="plan-student-stage" name="stage">${STAGES.map(([key,label])=>`<option value="${key}" ${(s.stage||'start')===key?'selected':''}>${label}</option>`).join('')}</select></div><div class="field"><label for="plan-student-length">Lesson length (minutes)</label><input id="plan-student-length" name="lessonMinutes" type="number" min="30" max="360" step="1" required value="${escape(s.lessonMinutes??90)}"></div><div class="field full"><label for="plan-student-notes">Private notes (optional)</label><textarea id="plan-student-notes" name="notes" maxlength="1000" placeholder="Lesson focus and information needed for teaching">${escape(s.notes)}</textarea><span class="field-help">No automatic kite sizing. Equipment and launch conditions need an on-site instructor assessment.</span></div></div><div id="planner-form-error" class="planner-meta" role="alert"></div><div class="dialog-actions"><button type="button" class="button secondary" data-planner-close>Cancel</button><button type="submit" class="button">${student?'Save changes':'Add student'}</button></div></div></form>`;
      dialog.querySelectorAll('[data-planner-close]').forEach(b=>b.onclick=()=>dialog.close());
      dialog.onclose=()=>{if(restore?.isConnected)restore.focus();else $('#planner-add-student').focus();};
      dialog.showModal();
      $('#planner-student-form').onsubmit=async event=>{
        event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
        const b=form.querySelector('[type=submit]'),f=Object.fromEntries(new FormData(form));
        if(!f.name.trim()){$('#planner-form-error').textContent='Enter the student’s name.';return;}
        b.disabled=true;
        try{await api(student?'/api/school/students/'+encodeURIComponent(student.id):'/api/school/students',{method:student?'PATCH':'POST',body:{name:f.name.trim(),weightKg:Number(f.weightKg),stage:f.stage,lessonMinutes:Number(f.lessonMinutes),notes:f.notes}});dialog.close();toast(student?'Student updated.':'Student added to your private roster.');await load();}
        catch(error){$('#planner-form-error').textContent=error.message;b.disabled=false;}
      };
    }
    async function removeStudent(id, button) {
      const s=students().find(x=>String(x.id)===String(id));
      if(!s||!confirm(`Remove ${s.name} from your planning roster? This also removes them from School mode planning, but does not alter GPS consent.`))return;
      button.disabled=true;
      try {await api('/api/school/students/'+encodeURIComponent(id),{method:'DELETE'});toast('Student removed from the active planning roster.');await load();}
      catch(error){toast(error.message);button.disabled=false;}
    }
    for(const selector of ['#planning','#students'])$(selector).addEventListener('click',event=>{
      const b=event.target.closest('button');if(!b)return;
      if(b.dataset.plannerAction==='add')openStudent();
      if(b.dataset.plannerAction==='refresh')load();
      if(b.dataset.plannerEdit)openStudent(b.dataset.plannerEdit);
      if(b.dataset.plannerRemove)removeStudent(b.dataset.plannerRemove,b);
      if(b.dataset.plannerWindow){state.selected=b.dataset.plannerWindow;navigate('planning');renderPlan();}
    });
    renderPlan();renderStudents();
    return { load, enter(){if(!state.loadedAt&&!state.pending)return load();renderPlan();} };
  }
  if(typeof module==='object'&&module.exports)module.exports={planningState,candidateWindows,escape};
  else root.SmartSurfInstructorPlanner={create};
})(typeof window==='object'?window:globalThis);
