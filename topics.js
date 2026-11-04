'use strict';
const SESSION_KEY='harness-voice-study-v3';
function initializeTopics(){
  state.currentTopic=scenario==='change'?'call':scenario==='quiet'?'data':'leo';
  state.topics={
    leo:{id:'leo',title:'Leo’s proposal',company:'Halcyon',kind:'Partnership',created:1,decisions:['Start with a small pilot.','Agree on scope before commercial terms.']},
    call:{id:'call',title:'Rachel & Tom',company:'Northwind',kind:'Pilot planning',created:2,decisions:['One owner on each side.','Agree on a first milestone before expansion.']},
    data:{id:'data',title:'Data room',company:'Halcyon',kind:'Due diligence',created:3,decisions:['Dana has the next action.','Check after Thursday’s deadline.']}
  };
  state.routines=[];state.routineRuns=[];state.pendingRoutine=null;state.undoRoutine=null;
}
function saveSession(){
  try{localStorage.setItem(SESSION_KEY,JSON.stringify({version:3,scenario,mode,variant,state}));}catch{/* The demo remains usable with browser storage disabled. */}
}
function startSession(){
  let saved;try{saved=JSON.parse(localStorage.getItem(SESSION_KEY));}catch{}
  reset();
  if(saved?.version===3&&saved.state?.topics?.leo&&Array.isArray(saved.state.history)&&Array.isArray(saved.state.routines)&&Object.hasOwn(scenarios,saved.scenario)&&!params.has('scenario')){
    state=saved.state;scenario=saved.scenario;if(!params.has('variant')&&!params.has('mode')&&Object.hasOwn(STUDIES,saved.variant))variant=saved.variant;if(!params.has('mode')&&Object.hasOwn(modes,saved.mode))mode=saved.mode;
    render();
  }
  saveSession();
}
function inferTopic(text){
  if(/\bleo\b|halcyon.*proposal|\bproposal\b/.test(text))return 'leo';
  if(/rachel|\btom\b|northwind|\bcall\b/.test(text))return 'call';
  if(/\bdana\b|data room/.test(text))return 'data';
  if(/hiring|product designer|full.time|contract role/.test(text))return 'hiring';
  const words=text.toLowerCase().match(/[a-z]+/g)||[];
  const matches=Object.values(state.topics||{}).filter(topic=>topic.keywords?.some(word=>words.includes(word)));
  if(matches.length===1)return matches[0].id;
  return null;
}
function ensureTopic(id,title,company='Personal',kind='Exploring'){
  if(!state.topics[id])state.topics[id]={id,title,company,kind,created:Date.now(),decisions:[]};
  return state.topics[id];
}
function useTopic(id){
  if(id==='hiring')ensureTopic(id,'Design hiring','Northwind','Hiring');
  if(state.topics[id])state.currentTopic=id;
}
function topicSummary(id){
  if(id==='funds')return 'Sam needs your decision on server funds by 5. The amount still needs confirming.';
  if(id==='leo')return ['sent','done'].includes(state.proposal)?'The proposal is sent. Leo has the next step.':state.reminder?'Draft ready. Set aside until after your call.':state.shortened?'One-page draft ready. Sending still needs your approval.':'Draft ready. Pilot scope still needs agreement.';
  if(id==='call')return 'Prep ready. The pilot scope is the decision to make.';
  if(id==='data')return 'Waiting on Dana’s list, due Thursday. No chase needed today.';
  if(id==='hiring'){const topic=state.topics[id];if(topic.decisions.some(d=>d.includes('contract')))return `${topic.role||'Design hire'} · explore a contract role first.`;if(topic.decisions.some(d=>d.includes('full-time')))return `${topic.role||'Design hire'} · explore a full-time role.`;return topic.role?`${topic.role}. Contract or full time is still open.`:'You’re exploring a design hire. The role is still open.';}
  return 'An ongoing discussion. Pick it up whenever you’re ready.';
}
function topicStatus(id){return id==='leo'?(['sent','done'].includes(state.proposal)?'Waiting on Leo':'Needs you'):id==='call'?'Prep ready':id==='data'?'Waiting on Dana':'Exploring';}
function contextTabs(active){return `<div class="context-tabs" aria-label="Context views"><button data-context-tab="topics" aria-pressed="${active==='topics'}">Topics</button><button data-context-tab="routines" aria-pressed="${active==='routines'}">Routines</button><button data-context-tab="work" aria-pressed="${active==='work'}">Work</button></div>`;}
function topicRows(query=''){
  const q=query.toLowerCase();
  const topics=orderedTopics().filter(t=>`${t.title} ${t.company} ${t.kind} ${topicSummary(t.id)}`.toLowerCase().includes(q));
  return topics.length?topics.map(t=>`<button class="topic-row" data-topic="${esc(t.id)}"><span class="topic-overline">${esc(t.company)} <span>· ${esc(topicStatus(t.id))}</span></span><strong>${esc(t.title)}</strong><span class="topic-summary">${esc(topicSummary(t.id))}</span><span class="topic-row-foot">${state.history.filter(m=>m.topic===t.id).length} ${state.history.filter(m=>m.topic===t.id).length===1?'turn':'turns'} in this discussion ${icon('next')}</span></button>`).join(''):'<p class="empty-state">No matching topic. Try a person, company, or focus area.</p>';
}
function openTopics(tab='topics',replace=false){
  const render=()=>tab==='topics'?`${contextTabs(tab)}<p class="screen-intro">Everything we’ve been working through, kept together as we talk.</p><label class="sr-only" for="topic-search">Find topics</label><input class="topic-search" id="topic-search" placeholder="Person, company, or topic…" autocomplete="off"><div id="topic-results">${topicRows()}</div>`:tab==='routines'?`${contextTabs(tab)}<p class="screen-intro">How you’ve asked me to help, over time.</p>${state.routines.length?state.routines.map(r=>`<button class="routine-row" data-routine="${esc(r.id)}"><span class="routine-row-top">${icon('routine')}<span class="status-tag ${r.enabled?'':'paused'}">${r.enabled?'Active':'Paused'}</span></span><strong>${esc(r.title)}</strong><span>${esc(routineSentence(r))}</span>${icon('next')}</button>`).join(''):'<div class="routine-empty">'+icon('routine')+'<h3>Tell me once.<br>I’ll keep it in mind.</h3><p>Give me a standing instruction in your own words.</p></div>'}<button class="routine-example" data-command="Whenever I’m directly mentioned in Telegram, draft a reply if it needs an answer. Only interrupt me if it’s urgent.">“When I’m mentioned in Telegram, draft a reply.” ${icon('next')}</button><p class="screen-disclaimer">Prototype routines can be tried with sample messages. No live sources are connected.</p>`:`${contextTabs(tab)}<p class="screen-intro">Prepared work, linked to its topic.</p><button class="work-row" data-artifact="proposal"><span class="work-icon">${icon('file')}</span><span><strong>Halcyon proposal</strong><small>${state.shortened?'1 page':'2 pages'} · Leo’s proposal</small></span>${icon('next')}</button><button class="work-row" data-artifact="prep"><span class="work-icon">${icon('file')}</span><span><strong>Rachel & Tom</strong><small>Call prep · Northwind</small></span>${icon('next')}</button>`;
  if(replace&&screens.at(-1)?.key==='context'){screens.pop();}
  openScreen('YOUR CONTEXT',tab==='topics'?'Pick up any thread.':tab==='routines'?'Your standing instructions.':'Ready when you need it.',render,{key:'context',tab});
}
function openTopic(id,section='overview',replace=false){
  const topic=state.topics[id];if(!topic)return;
  if(replace&&screens.at(-1)?.key==='topic')screens.pop();
  openScreen(`TOPIC · ${topic.company}`,topic.title,()=>{
    const history=state.history.filter(m=>m.topic===id);
    return `<span class="status-tag">${esc(topicStatus(id))}</span><div class="topic-detail-tabs"><button data-topic-section="overview" data-for-topic="${esc(id)}" aria-pressed="${section==='overview'}">Where we are</button><button data-topic-section="history" data-for-topic="${esc(id)}" aria-pressed="${section==='history'}">Discussion <span>${history.length}</span></button></div>${section==='overview'?`<p class="topic-current">${esc(topicSummary(id))}</p><h3>What we’ve decided</h3>${topic.decisions.length?`<ul class="decision-list">${topic.decisions.map(d=>`<li>${icon('check')}<span>${esc(d)}</span></li>`).join('')}</ul>`:'<p>No decisions yet. We’re still working it through.</p>'}${id==='leo'?`<button class="work-row" data-artifact="proposal"><span class="work-icon">${icon('file')}</span><span><strong>Partnership proposal</strong><small>${state.shortened?'1 page':'2 pages'} · Latest draft</small></span>${icon('next')}</button>`:id==='call'?`<button class="work-row" data-artifact="prep"><span class="work-icon">${icon('file')}</span><span><strong>Call talking points</strong><small>Prepared for Rachel & Tom</small></span>${icon('next')}</button>`:''}${['leo','call','data'].includes(id)?`<button class="topic-source" data-topic-sources="${esc(id)}">View the sources ${icon('next')}</button>`:''}<button class="primary" data-resume-topic="${esc(id)}">Continue this conversation</button>`:`<p class="screen-intro">Relevant parts of our conversation, brought together automatically.</p>${history.length?history.map(m=>`<div class="topic-turn ${m.who}"><small>${m.who==='user'?'You':'Harness'}${m.seeded?' · earlier in this demo':''}</small><p>${esc(m.text)}</p></div>`).join(''):'<p>We haven’t discussed this here yet. Its source context is ready when you need it.</p>'}<button class="primary" data-resume-topic="${esc(id)}">Pick this up</button>`}`;
  },{key:'topic',topic:id,section});
}
function openTopicSources(id){
  const topic=state.topics[id];if(!topic)return;
  const quotes={leo:['You → Leo · October 19 · Telegram','I’ll send over a proposal.','No send appears in the selected chat in this demo. You may have sent it somewhere else.'],call:['Rachel · today · Telegram','Can we move to 10:30? Same agenda.','The demo calendar still shows 10:00. Harness has not changed it.'],data:['Dana · yesterday · Telegram','I’ll have the data room list to you Thursday.','Dana has the next action. Today is Wednesday in this demo.']};
  const q=quotes[id];if(!q)return;
  openScreen('EVIDENCE',topic.title,`<div class="source-quote"><small>${esc(q[0])}</small><p>“${esc(q[1])}”</p></div><p>${esc(q[2])}</p>${id==='leo'?'<button class="primary" data-command="I already sent it">I already sent it</button>':''}`,{topic:id});
}
function resumeTopic(id){
  useTopic(id);closeScreens();state.started=true;
  const topic=state.topics[id],latest=latestTopicMessage(id);
  state.text=latest.text;state.artifact=latest.artifact||null;state.lastAction=latest.action||null;
  state.context=`${topic.company} · ${topic.title}`;
  touchTopic(id);render();saveSession();say(latest.text);
}

function routineSentence(r){if(r.source==='Calendar')return `Bring my prep ${r.minutes||10} minutes before a calendar call.`;return `${r.source==='Telegram'?'Direct mentions in selected Telegram chats':'Emails in the selected inbox'}${r.person==='Leo'?' from Leo':''} → ${r.action==='draft'?'prepare a reply':'flag for review'}. ${r.notify==='urgent'?'Only interrupt if urgent.':'Bring each match to me.'}`;}
function beginRoutine(existing=null){
  state.pendingRoutine=existing?{...existing}:{id:`routine-${Date.now()}`,title:'Replies to direct mentions',source:'Telegram',person:'Anyone',action:'draft',notify:'urgent',enabled:true};
  openRoutineReview();
}
function openRoutineReview(replace=false){
  if(isNewStudy())return openPendingRoutineAudit(replace);
  const r=state.pendingRoutine;if(!r)return;
  if(replace&&screens.at(-1)?.key==='routine-review')screens.pop();
  openScreen('ROUTINE · REVIEW','Here’s what I’ll do.',()=>`<p class="routine-sentence">${esc(routineSentence(r))}</p><form id="routine-form" class="routine-form"><label>When<select aria-label="When" name="source"><option value="Telegram" ${r.source==='Telegram'?'selected':''}>I’m mentioned in Telegram</option><option value="Email" ${r.source==='Email'?'selected':''}>A new email arrives</option>${r.source==='Calendar'?'<option value="Calendar" selected>A calendar call is coming up</option>':''}</select></label><label>From<select aria-label="From" name="person"><option ${r.person==='Anyone'?'selected':''}>Anyone</option><option ${r.person==='Leo'?'selected':''}>Leo</option></select></label><label>Prepare<select aria-label="Prepare" name="action"><option value="draft" ${r.action==='draft'?'selected':''}>A draft reply</option><option value="flag" ${r.action==='flag'?'selected':''}>An item for review</option>${r.action==='prep'?'<option value="prep" selected>Call prep</option>':''}</select></label><label>Bring it to me<select aria-label="Bring it to me" name="notify"><option value="urgent" ${r.notify==='urgent'?'selected':''}>Only if urgent</option><option value="every" ${r.notify==='every'?'selected':''}>For every match</option>${r.notify==='before-call'?'<option value="before-call" selected>Before the call</option>':''}</select></label><p class="screen-disclaimer">Only selected sources. Replies stay drafts until you approve the exact send.</p><button class="primary" type="submit">Save routine</button><button class="text-link routine-cancel" type="button" data-cancel-routine>Leave it for now</button></form>`,{key:'routine-review'});
}
function saveRoutine(form){
  const data=new FormData(form),r={...state.pendingRoutine};
  for(const key of ['source','person','action','notify'])r[key]=data.get(key);
  r.title=r.source==='Calendar'?'Before my calls':r.source==='Telegram'?'Replies to direct mentions':'Email replies';
  const index=state.routines.findIndex(x=>x.id===r.id);
  state.undoRoutine={id:r.id,previous:index<0?null:{...state.routines[index]}};
  if(index<0)state.routines.push(r);else state.routines[index]=r;
  state.pendingRoutine=null;closeScreens();response(r.enabled?'Saved. I’ll prepare the work and keep replies as drafts. You can change or pause this whenever you want.':'Saved. This routine stays paused. Resume it whenever you’re ready.',{context:'Your routines'});openRoutine(r.id);saveSession();
}
function openRoutine(id,replace=false){
  if(isNewStudy())return openRoutineAudit(id,replace);
  const r=state.routines.find(x=>x.id===id);if(!r)return;
  if(replace&&screens.at(-1)?.key==='routine')screens.pop();
  openScreen('ROUTINE',r.title,()=>`<span class="status-tag ${r.enabled?'':'paused'}">${r.enabled?'Active':'Paused'}</span><p class="routine-sentence">${esc(routineSentence(r))}</p><div class="routine-fact"><span>Sources</span><strong>${esc(r.source==='Telegram'?'Selected Telegram chats':'Selected email inbox')}</strong></div><div class="routine-fact"><span>Who</span><strong>${esc(r.person)}</strong></div><div class="routine-fact"><span>Delivery</span><strong>Drafts only · approval before sending</strong></div><div class="routine-actions"><button data-toggle-routine="${esc(id)}">${r.enabled?'Pause routine':'Resume routine'}</button><button data-edit-routine="${esc(id)}">Edit instruction</button></div><button class="primary" data-test-routine="${esc(id)}">Try with a sample message</button>${state.undoRoutine?.id===id?`<button class="text-link routine-cancel" data-undo-routine="${esc(id)}">Undo last change</button>`:''}<p class="screen-disclaimer">A local prototype instruction. No real messages are being monitored.</p>`,{key:'routine',routine:id});
}
function toggleRoutine(id){
  const r=state.routines.find(x=>x.id===id);if(!r)return;
  state.undoRoutine={id,previous:{...r}};r.enabled=!r.enabled;saveSession();openRoutine(id,true);
}
function testRoutine(id){
  if(state.routines.find(r=>r.id===id)?.source==='Calendar')return testStudyCalendar(id);
  const r=state.routines.find(x=>x.id===id);if(!r)return;
  const drafted=r.enabled&&r.action==='draft';
  state.routineRuns.push({id,at:Date.now(),outcome:!r.enabled?'paused':drafted?'draft':'flag'});saveSession();
  openScreen('ROUTINE · SAMPLE','A message comes in.',`<div class="source-quote"><small>Leo · ${esc(r.source)} · sample message</small><p>“Can you confirm the pilot scope, @you?”</p></div>${!r.enabled?'<span class="status-tag paused">Paused</span><p>No work prepared. This routine is paused.</p>':drafted?'<span class="status-tag">Draft prepared</span><h3>Reply, ready for your review</h3><p class="sample-draft">Thanks, Leo. Which part of the pilot scope needs my input?</p>':'<span class="status-tag">Flagged for review</span><p>Leo’s question is saved for you to review.</p>'}${r.enabled?`<p class="screen-disclaimer">${r.notify==='urgent'?'No interruption: the sample has no urgent deadline.':'This match would be brought to you.'} Nothing was sent.</p>`:''}<button class="text-link" data-back-routine="${esc(id)}">Back to the routine ${icon('next')}</button>`,{routine:id});
}
function handleOrganization(t,text){
  if(/(?:show|open|view).*(?:chat |conversation |topic )?history/.test(t)){openConversation();return true;}
  if(/\bi (?:also )?(?:need|want|have) to\s+/.test(t)&&(!inferTopic(t)||inferTopic(t).startsWith('focus-')||/\b(?:plan|organize|book)\b/.test(t))&&!/whenever|automatically|every time|anytime/.test(t)){
    const task=text.match(/\bi (?:also )?(?:need|want|have) to\s+(.+?)[.!?]*$/i)?.[1]?.trim();
    if(task){
      const title=task.charAt(0).toUpperCase()+task.slice(1);
      const id=(inferTopic(t)?.startsWith('focus-')?inferTopic(t):null)||`focus-${task.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'')}`;
      const isNew=!state.topics[id];
      const topic=ensureTopic(id,title,'Personal');
      topic.keywords=(task.toLowerCase().match(/[a-z]{4,}/g)||[]).filter(word=>!['also','need','want','have','plan','make','this','that','with','about','some','something'].includes(word));
      useTopic(id);state.history.at(-1).topic=id;mode='voice';
      response(/offsite/.test(t)?'Let’s work through the offsite. Do you have a date and location in mind?':`Let’s work through ${task.replace(/^(plan|prepare|organize|review|arrange)\s+/i,'')}. What’s the first thing we need to decide?`,{context:`${topic.company} · ${topic.title}`});
      if(isNew)announceTopic(topic.title);return true;
    }
  }
  if(/show.*topics|open.*topics|find.*topics/.test(t)){response('Here are the things we’ve been working through. Pick any of them up.',{context:'Your topics'});openTopics();return true;}
  if(/show.*routine|standing instruction|what.*asked.*do/.test(t)){response('Here’s how you’ve asked me to help over time.',{context:'Your routines'});openTopics('routines');return true;}
  if(/undo.*routine|undo.*instruction/.test(t)&&state.undoRoutine){undoRoutine();return true;}
  if(/(?:pause|resume|stop).*routine|(?:pause|resume).*replies/.test(t)){
    const r=state.routines.at(-1);if(!r){response('There aren’t any standing instructions yet.');return true;}
    const wantEnabled=/resume/.test(t);if(r.enabled!==wantEnabled){state.undoRoutine={id:r.id,previous:{...r}};r.enabled=wantEnabled;}
    response(wantEnabled?'Resumed. I’ll prepare drafts for matching messages.':'Paused. I won’t prepare new replies for that routine.',{context:'Your routines'});return true;
  }
  if(/whenever|anytime|any time|every time|when (?:i|someone|a)|automatically|always.*(?:telegram|email)/.test(t)&&/telegram|mention|email/.test(t)){
    if(/send.*automatically|automatically.*send/.test(t)){response('I can prepare replies automatically. Sending still needs your approval of the exact message. Shall I set it up for drafts?');return true;}
    if(!/draft|reply|flag/.test(t)){response('When you’re mentioned, should I prepare a draft reply or flag it for you?');state.awaitingRoutine={source:/email/.test(t)?'Email':'Telegram'};return true;}
    beginRoutine();state.pendingRoutine.source=/email/.test(t)?'Email':'Telegram';state.pendingRoutine.person=/from leo/.test(t)?'Leo':'Anyone';state.pendingRoutine.action=/flag/.test(t)?'flag':'draft';openRoutineReview(true);return true;
  }
  if(state.awaitingRoutine&&/draft|flag/.test(t)){const source=state.awaitingRoutine.source;state.awaitingRoutine=false;beginRoutine();state.pendingRoutine.source=source;state.pendingRoutine.action=/flag/.test(t)?'flag':'draft';openRoutineReview(true);return true;}
  if(/only from leo|make (?:that|it).*email|notify.*every match|only.*urgent/.test(t)&&(state.pendingRoutine||state.routines.length)){
    if(!state.pendingRoutine)beginRoutine(state.routines.at(-1));
    if(/only from leo/.test(t))state.pendingRoutine.person='Leo';
    if(/email/.test(t))state.pendingRoutine.source='Email';
    if(/every match/.test(t))state.pendingRoutine.notify='every';
    if(/urgent/.test(t))state.pendingRoutine.notify='urgent';
    openRoutineReview(true);return true;
  }
  if(/edit.*routine|change.*instruction/.test(t)){const r=state.routines.at(-1);if(r)beginRoutine(r);else response('Give me a standing instruction first, such as drafting replies to direct Telegram mentions.');return true;}
  if(/back to|where were we|pick.*back up|tell me about.*proposal|where.*with leo|resume.*leo/.test(t)){
    const id=inferTopic(t)||state.currentTopic;resumeTopic(id);return true;
  }
  if(/^(?:what|how) about\b|^about\b/.test(t)&&inferTopic(t)){resumeTopic(inferTopic(t));return true;}
  if(/what.*decide|why did we (?:choose|decide)/.test(t)){const topic=state.topics[state.currentTopic];response(topic.decisions.length?topic.decisions.join(' '):'We haven’t settled on a decision yet.',{context:`${topic.company} · ${topic.title}`});return true;}
  if(/(?:let'?s|can we|want to) (?:talk about|discuss|focus on)/.test(t)){
    const match=text.match(/(?:talk about|discuss|focus on)\s+(.+?)[.!?]?$/i);const title=match?.[1].trim();
    const id=inferTopic(t)||`focus-${Date.now()}`;ensureTopic(id,id==='hiring'?'Design hiring':title||'A new focus',id==='hiring'?'Northwind':'Personal',id==='hiring'?'Hiring':'Exploring');useTopic(id);state.history.at(-1).topic=id;
    response(id==='hiring'?'Of course. What role are you thinking about?':'I’ll keep this discussion together. What would you like to work through?',{context:`${state.topics[id].company} · ${state.topics[id].title}`});return true;
  }
  if(state.currentTopic==='hiring'&&/designer|contract|full.time/.test(t)){
    state.topics.hiring.role=/designer/.test(t)?'Product designer':state.topics.hiring.role||'Design hire';
    if(/contract|full.time/.test(t)){const decision=/contract/.test(t)?'Explore a contract role first.':'Explore a full-time role.';if(!state.topics.hiring.decisions.includes(decision))state.topics.hiring.decisions.push(decision);}
    response(/designer/.test(t)?'A product designer. Are you thinking contract or full time?':'I’ve kept that with the hiring discussion. We can come back to the role when you’re ready.',{context:`${state.topics.hiring.company} · Design hiring`});return true;
  }
  if(/(?:belongs|move|put|keep).*(?:under|with|to|in).*\b(?:halcyon|northwind|personal)\b/.test(t)){
    const topic=state.topics[state.currentTopic],company=/northwind/.test(t)?'Northwind':/halcyon/.test(t)?'Halcyon':'Personal';topic.company=company;response(`I’ve moved ${topic.title} under ${company}. Its discussion and decisions stay together.`,{context:`${company} · ${topic.title}`});return true;
  }
  if(state.currentTopic.startsWith('focus-')&&!/\b(?:show|open|view|history|routine|remind|cancel|stop|pause|repeat|send|approve|source|evidence)\b/.test(t)){
    const topic=state.topics[state.currentTopic];
    if(/why|what.*next/.test(t)){response('We’ve just started this topic. Let’s settle the main details first.',{context:`${topic.company} · ${topic.title}`});return true;}
    topic.notes=topic.notes||[];topic.notes.push(text);
    response(/offsite/.test(topic.title.toLowerCase())?`${text.replace(/[.!?]+$/,'')}. Roughly how many people should we plan for?`:`I’ve kept that with ${topic.title}. What would you like to settle next?`,{context:`${topic.company} · ${topic.title}`});return true;
  }
  return false;
}
function undoRoutine(){
  const change=state.undoRoutine;if(!change)return;
  const i=state.routines.findIndex(r=>r.id===change.id);
  if(change.previous){if(i>=0)state.routines[i]=change.previous;else state.routines.push(change.previous);}else if(i>=0)state.routines.splice(i,1);
  state.undoRoutine=null;closeScreens();response('Undone. I’ve restored the previous standing instructions.',{context:'Your routines'});openTopics('routines');
}
document.addEventListener('click',e=>{
  const tab=e.target.closest('[data-context-tab]');if(tab)return openTopics(tab.dataset.contextTab,true);
  const topic=e.target.closest('[data-topic]');if(topic)return openTopic(topic.dataset.topic);
  const section=e.target.closest('[data-topic-section]');if(section)return openTopic(section.dataset.forTopic,section.dataset.topicSection,true);
  const resume=e.target.closest('[data-resume-topic]');if(resume)return resumeTopic(resume.dataset.resumeTopic);
  const sources=e.target.closest('[data-topic-sources]');if(sources)return openTopicSources(sources.dataset.topicSources);
  const backRoutine=e.target.closest('[data-back-routine]');if(backRoutine){screens.pop();return openRoutine(backRoutine.dataset.backRoutine,true);}
  const routine=e.target.closest('[data-routine]');if(routine)return openRoutine(routine.dataset.routine);
  const toggle=e.target.closest('[data-toggle-routine]');if(toggle)return toggleRoutine(toggle.dataset.toggleRoutine);
  const edit=e.target.closest('[data-edit-routine]');if(edit)return beginRoutine(state.routines.find(r=>r.id===edit.dataset.editRoutine));
  const test=e.target.closest('[data-test-routine]');if(test)return testRoutine(test.dataset.testRoutine);
  if(e.target.closest('[data-undo-routine]'))return undoRoutine();
  if(e.target.closest('[data-cancel-routine]')){state.pendingRoutine=null;goBack();}
});
document.addEventListener('input',e=>{if(e.target.id==='topic-search')$('#topic-results').innerHTML=topicRows(e.target.value);});
document.addEventListener('submit',e=>{if(e.target.id==='routine-form'){e.preventDefault();saveRoutine(e.target);}});

document.addEventListener('change',e=>{const form=e.target.closest('#routine-form');if(!form||!state.pendingRoutine)return;const values=new FormData(form);for(const key of ['source','person','action','notify'])state.pendingRoutine[key]=values.get(key);$('.routine-sentence').textContent=routineSentence(state.pendingRoutine);});

function orderedTopics(){
  return Object.values(state.topics).sort((a,b)=>{
    const activity=topic=>topic.updatedAt??Math.max(0,...state.history.filter(m=>m.topic===topic.id).map(m=>m.at||0))+(topic.id==='leo'?3:topic.id==='call'?2:1);
    return activity(b)-activity(a);
  });
}
function touchTopic(id){
  if(!state.topics[id])return;
  state.topicClock=Math.max(Date.now(),(state.topicClock||0)+1);
  state.topics[id].updatedAt=state.topicClock;
}
function latestTopicMessage(id){
  return state.history.findLast(m=>m.who==='assistant'&&m.topic===id)||{
    who:'assistant',topic:id,text:topicSummary(id),artifact:id==='leo'?'proposal':id==='call'?'prep':null,seeded:true
  };
}
function canUseFeed(){return !drawerOpen&&variant!=='asked'&&!screens.length&&(mode==='feed'||mode==='voice'&&isNewStudy()||mode==='brief'&&state.started);}
function browseTopic(direction){
  if(!canUseFeed())return false;
  const topics=feedTopics(),index=/^Your (?:routines|topics)/.test(state.context)?(direction>0?-1:topics.length):topics.findIndex(t=>t.id===state.currentTopic),topic=topics[index+direction];
  if(!topic)return false;
  stopMedia();useTopic(topic.id);state.started=true;
  const latest=latestTopicMessage(topic.id);
  if(!state.history.some(m=>m.who==='assistant'&&m.topic===topic.id))state.history.push({...latest,at:0});
  state.text=latest.text;state.artifact=latest.artifact||null;state.lastAction=latest.action||null;
  state.context=`${topic.company} · ${topic.title}`;
  render();saveSession();return true;
}
function openConversation(){stopMedia();closeScreens();if(mode!=='thread')state.latestMode=mode;mode='thread';render();saveSession();}
function returnToLatest(){stopMedia();mode=['voice','brief','feed'].includes(state.latestMode)?state.latestMode:'voice';const latest=/^Your (?:routines|topics)/.test(state.context)?state.history.findLast(m=>m.who==='assistant'&&m.topic===null)||latestTopicMessage(state.currentTopic):latestTopicMessage(state.currentTopic);state.text=latest.text;state.artifact=latest.artifact||null;state.lastAction=latest.action||null;render();saveSession();}
function topicHeader(history=false){
  const topic=state.topics[state.currentTopic];
  const general=/^Your (?:routines|topics)/.test(state.context);
  return `<div class="voice-topic-header"><div><p>${general?'Personal':esc(topic.company)}</p><button class="topic-title" ${general?`data-context-tab="${state.context.includes('routines')?'routines':'topics'}"`:`data-topic="${esc(topic.id)}"`}>${esc(general?state.context:topic.title)} ${icon('next')}</button></div><button class="history-button" ${history?'data-back-latest':'data-open-history'}>${icon(history?'back':'message')}<span>${history?'Latest':'History'}</span></button></div>`;
}
function topicPager(){
  if(/^Your (?:routines|topics)/.test(state.context))return `<nav class="topic-pager" aria-label="Browse topics"><button class="browse-all-topics" data-context-tab="topics">Browse topics ${icon('next')}</button></nav>`;
  const topics=orderedTopics(),index=topics.findIndex(t=>t.id===state.currentTopic);
  return `<nav class="topic-pager" aria-label="Browse topics"><button data-browse-topic="-1" aria-label="Previous topic" ${index===0?'disabled':''}>${icon('chevron-up')}</button><span><b>${index+1} / ${topics.length}</b>Swipe between topics</span><button data-browse-topic="1" aria-label="Next topic" ${index===topics.length-1?'disabled':''}>${icon('chevron-down')}</button></nav>`;
}
function announceTopic(title){
  const status=$('#feed-announcement');status.textContent=`New topic · ${title}`;status.hidden=false;
  clearTimeout(announceTopic.timer);announceTopic.timer=setTimeout(()=>{status.hidden=true;},3200);
}
document.addEventListener('click',e=>{
  if(e.target.closest('[data-open-history]'))return openConversation();
  if(e.target.closest('[data-back-latest]'))return returnToLatest();
  const pager=e.target.closest('[data-browse-topic]');if(pager)browseTopic(Number(pager.dataset.browseTopic));
});
let feedPointer=null,lastWheel=0;
function canBrowseFrom(target){return canUseFeed()&&!target.closest('button,a,input,select,textarea')&&!$('#app-body').classList.contains('feed-scrolls');}
document.addEventListener('pointerdown',e=>{
  if(!e.target.closest('#app-body')||!canBrowseFrom(e.target))return;
  feedPointer={x:e.clientX,y:e.clientY,id:e.pointerId};
  if(e.pointerType==='mouse')e.preventDefault();
});
document.addEventListener('pointerup',e=>{
  const start=feedPointer;feedPointer=null;if(!start||start.id!==e.pointerId||!canBrowseFrom(e.target))return;
  const dy=e.clientY-start.y,dx=e.clientX-start.x;
  if(variant==='across')return;
  if(Math.abs(dy)>55&&Math.abs(dy)>Math.abs(dx)*1.4)browseTopic(dy<0?1:-1);
});
document.addEventListener('pointercancel',()=>{feedPointer=null;});
document.addEventListener('wheel',e=>{
  if(!e.target.closest('#app-body')||!canBrowseFrom(e.target)||Math.abs(e.deltaY)<12)return;
  if(Date.now()-lastWheel<650){e.preventDefault();return;}
  if(browseTopic(e.deltaY>0?1:-1)){lastWheel=Date.now();e.preventDefault();}
},{passive:false});
document.addEventListener('keydown',e=>{
  if(variant==='across'||!['ArrowUp','ArrowDown'].includes(e.key)||!canUseFeed()||e.target.closest('input,textarea,select'))return;
  if(!document.body.classList.contains('focus-mode')&&!e.target.closest('#phone'))return;
  if(browseTopic(e.key==='ArrowDown'?1:-1))e.preventDefault();
});
