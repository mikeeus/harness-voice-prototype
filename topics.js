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
  try{localStorage.setItem(SESSION_KEY,JSON.stringify({version:3,scenario,mode,state}));}catch{/* The demo remains usable with browser storage disabled. */}
}
function startSession(){
  let saved;try{saved=JSON.parse(localStorage.getItem(SESSION_KEY));}catch{}
  reset();
  if(saved?.version===3&&saved.state?.topics?.leo&&Array.isArray(saved.state.history)&&Array.isArray(saved.state.routines)&&Object.hasOwn(scenarios,saved.scenario)&&!params.has('scenario')){
    state=saved.state;scenario=saved.scenario;if(!params.has('mode')&&Object.hasOwn(modes,saved.mode))mode=saved.mode;
    render();
  }
  saveSession();
}
function inferTopic(text){
  if(/\bleo\b|halcyon.*proposal|\bproposal\b/.test(text))return 'leo';
  if(/rachel|\btom\b|northwind|\bcall\b/.test(text))return 'call';
  if(/\bdana\b|data room/.test(text))return 'data';
  if(/hiring|product designer|full.time|contract role/.test(text))return 'hiring';
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
  if(id==='leo')return ['sent','done'].includes(state.proposal)?'The proposal is sent. Leo has the next step.':state.reminder?'Draft ready. Set aside until after your call.':state.shortened?'One-page draft ready. Sending still needs your approval.':'Draft ready. Pilot scope still needs agreement.';
  if(id==='call')return 'Prep ready. The pilot scope is the decision to make.';
  if(id==='data')return 'Waiting on Dana’s list, due Thursday. No chase needed today.';
  if(id==='hiring')return state.topics[id].role?`${state.topics[id].role}. Contract or full time is still open.`:'You’re exploring a design hire. The role is still open.';
  return 'An ongoing discussion. Pick it up whenever you’re ready.';
}
function topicStatus(id){return id==='leo'?(['sent','done'].includes(state.proposal)?'Waiting on Leo':'Needs you'):id==='call'?'Prep ready':id==='data'?'Waiting on Dana':'Exploring';}
function contextTabs(active){return `<div class="context-tabs" aria-label="Context views"><button data-context-tab="topics" aria-pressed="${active==='topics'}">Topics</button><button data-context-tab="routines" aria-pressed="${active==='routines'}">Routines</button><button data-context-tab="work" aria-pressed="${active==='work'}">Work</button></div>`;}
function topicRows(query=''){
  const q=query.toLowerCase();
  const topics=Object.values(state.topics).filter(t=>`${t.title} ${t.company} ${t.kind} ${topicSummary(t.id)}`.toLowerCase().includes(q));
  return topics.length?topics.map(t=>`<button class="topic-row" data-topic="${esc(t.id)}"><span class="topic-overline">${esc(t.company)} <span>· ${esc(topicStatus(t.id))}</span></span><strong>${esc(t.title)}</strong><span class="topic-summary">${esc(topicSummary(t.id))}</span><span class="topic-row-foot">${state.history.filter(m=>m.topic===t.id).length} turns in this discussion ${icon('next')}</span></button>`).join(''):'<p class="empty-state">No matching topic. Try a person, company, or focus area.</p>';
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
  const topic=state.topics[id];
  response(id==='leo'?['sent','done'].includes(state.proposal)?'The proposal is with Leo now. You’re waiting on his reply.':`You chose a small pilot. The ${state.shortened?'one-page':'latest'} proposal is ready; sending still needs your approval. Want to review it?`:id==='hiring'?state.topics.hiring.role?'We were discussing a product designer. Contract or full time is the next question.':'We were exploring a design hire. What role do you have in mind?':topicSummary(id),{context:`${topic.company} · ${topic.title}`,artifact:id==='leo'?'proposal':id==='call'?'prep':null});
}
function routineSentence(r){return `${r.source==='Telegram'?'Direct mentions in selected Telegram chats':'Emails in the selected inbox'}${r.person==='Leo'?' from Leo':''} → ${r.action==='draft'?'prepare a reply':'flag for review'}. ${r.notify==='urgent'?'Only interrupt if urgent.':'Bring each match to me.'}`;}
function beginRoutine(existing=null){
  state.pendingRoutine=existing?{...existing}:{id:'telegram-mentions',title:'Replies to direct mentions',source:'Telegram',person:'Anyone',action:'draft',notify:'urgent',enabled:true};
  openRoutineReview();
}
function openRoutineReview(replace=false){
  const r=state.pendingRoutine;if(!r)return;
  if(replace&&screens.at(-1)?.key==='routine-review')screens.pop();
  openScreen('ROUTINE · REVIEW','Here’s what I’ll do.',()=>`<p class="routine-sentence">${esc(routineSentence(r))}</p><form id="routine-form" class="routine-form"><label>When<select aria-label="When" name="source"><option value="Telegram" ${r.source==='Telegram'?'selected':''}>I’m mentioned in Telegram</option><option value="Email" ${r.source==='Email'?'selected':''}>A new email arrives</option></select></label><label>From<select aria-label="From" name="person"><option ${r.person==='Anyone'?'selected':''}>Anyone</option><option ${r.person==='Leo'?'selected':''}>Leo</option></select></label><label>Prepare<select aria-label="Prepare" name="action"><option value="draft" ${r.action==='draft'?'selected':''}>A draft reply</option><option value="flag" ${r.action==='flag'?'selected':''}>An item for review</option></select></label><label>Bring it to me<select aria-label="Bring it to me" name="notify"><option value="urgent" ${r.notify==='urgent'?'selected':''}>Only if urgent</option><option value="every" ${r.notify==='every'?'selected':''}>For every match</option></select></label><p class="screen-disclaimer">Only selected sources. Replies stay drafts until you approve the exact send.</p><button class="primary" type="submit">Save routine</button><button class="text-link routine-cancel" type="button" data-cancel-routine>Leave it for now</button></form>`,{key:'routine-review'});
}
function saveRoutine(form){
  const data=new FormData(form),r={...state.pendingRoutine};
  for(const key of ['source','person','action','notify'])r[key]=data.get(key);
  r.title=r.source==='Telegram'?'Replies to direct mentions':'Email replies';
  const index=state.routines.findIndex(x=>x.id===r.id);
  state.undoRoutine={id:r.id,previous:index<0?null:{...state.routines[index]}};
  if(index<0)state.routines.push(r);else state.routines[index]=r;
  state.pendingRoutine=null;closeScreens();response('Saved. I’ll prepare the work and keep replies as drafts. You can change or pause this whenever you want.',{context:'Your routines'});openRoutine(r.id);saveSession();
}
function openRoutine(id,replace=false){
  const r=state.routines.find(x=>x.id===id);if(!r)return;
  if(replace&&screens.at(-1)?.key==='routine')screens.pop();
  openScreen('ROUTINE',r.title,()=>`<span class="status-tag ${r.enabled?'':'paused'}">${r.enabled?'Active':'Paused'}</span><p class="routine-sentence">${esc(routineSentence(r))}</p><div class="routine-fact"><span>Sources</span><strong>${esc(r.source==='Telegram'?'Selected Telegram chats':'Selected email inbox')}</strong></div><div class="routine-fact"><span>Who</span><strong>${esc(r.person)}</strong></div><div class="routine-fact"><span>Delivery</span><strong>Drafts only · approval before sending</strong></div><div class="routine-actions"><button data-toggle-routine="${esc(id)}">${r.enabled?'Pause routine':'Resume routine'}</button><button data-edit-routine="${esc(id)}">Edit instruction</button></div><button class="primary" data-test-routine="${esc(id)}">Try with a sample message</button>${state.undoRoutine?.id===id?`<button class="text-link routine-cancel" data-undo-routine="${esc(id)}">Undo last change</button>`:''}<p class="screen-disclaimer">A local prototype instruction. No real messages are being monitored.</p>`,{key:'routine',routine:id});
}
function toggleRoutine(id){
  const r=state.routines.find(x=>x.id===id);if(!r)return;
  state.undoRoutine={id,previous:{...r}};r.enabled=!r.enabled;saveSession();openRoutine(id,true);
}
function testRoutine(id){
  const r=state.routines.find(x=>x.id===id);if(!r)return;
  const drafted=r.enabled&&r.action==='draft';
  state.routineRuns.push({id,at:Date.now(),outcome:!r.enabled?'paused':drafted?'draft':'flag'});saveSession();
  openScreen('ROUTINE · SAMPLE','A message comes in.',`<div class="source-quote"><small>Leo · ${esc(r.source)} · sample message</small><p>“Can you confirm the pilot scope, @you?”</p></div>${!r.enabled?'<span class="status-tag paused">Paused</span><p>No work prepared. This routine is paused.</p>':drafted?'<span class="status-tag">Draft prepared</span><h3>Reply, ready for your review</h3><p class="sample-draft">Thanks, Leo. Which part of the pilot scope needs my input?</p>':'<span class="status-tag">Flagged for review</span><p>Leo’s question is saved for you to review.</p>'}${r.enabled?`<p class="screen-disclaimer">${r.notify==='urgent'?'No interruption: the sample has no urgent deadline.':'This match would be brought to you.'} Nothing was sent.</p>`:''}<button class="text-link" data-back-routine="${esc(id)}">Back to the routine ${icon('next')}</button>`,{routine:id});
}
function handleOrganization(t,text){
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
  if(/what.*decide|why did we (?:choose|decide)/.test(t)){const topic=state.topics[state.currentTopic];response(topic.decisions.length?topic.decisions.join(' '):'We haven’t settled on a decision yet.',{context:`${topic.company} · ${topic.title}`});return true;}
  if(/(?:let'?s|can we|want to) (?:talk about|discuss|focus on)/.test(t)){
    const match=text.match(/(?:talk about|discuss|focus on)\s+(.+?)[.!?]?$/i);const title=match?.[1].trim();
    const id=inferTopic(t)||`focus-${Date.now()}`;ensureTopic(id,id==='hiring'?'Design hiring':title||'A new focus',id==='hiring'?'Northwind':'Personal',id==='hiring'?'Hiring':'Exploring');useTopic(id);state.history.at(-1).topic=id;
    response(id==='hiring'?'Of course. What role are you thinking about?':'I’ll keep this discussion together. What would you like to work through?',{context:`${state.topics[id].company} · ${state.topics[id].title}`});return true;
  }
  if(state.currentTopic==='hiring'&&/designer|contract|full.time/.test(t)){
    state.topics.hiring.role=/designer/.test(t)?'Product designer':state.topics.hiring.role||'Design hire';
    if(/contract|full.time/.test(t)){const decision=/contract/.test(t)?'Explore a contract role first.':'Explore a full-time role.';if(!state.topics.hiring.decisions.includes(decision))state.topics.hiring.decisions.push(decision);}
    response(/designer/.test(t)?'A product designer. Are you thinking contract or full time?':'I’ve kept that with the hiring discussion. We can come back to the role when you’re ready.',{context:'Northwind · Design hiring'});return true;
  }
  if(/(?:belongs|move|put|keep).*(?:under|with|to|in).*\b(?:halcyon|northwind|personal)\b/.test(t)){
    const topic=state.topics[state.currentTopic],company=/northwind/.test(t)?'Northwind':/halcyon/.test(t)?'Halcyon':'Personal';topic.company=company;response(`I’ve moved ${topic.title} under ${company}. Its discussion and decisions stay together.`,{context:`${company} · ${topic.title}`});return true;
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
