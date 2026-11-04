'use strict';
const STUDIES={
  classic:{},
  dots:{caption:'04 / Left-side dots — one topic, one reply, a quiet position marker.',observation:'Compare this with the Topic feed variation’s arrows. The dots sit on the left; swiping only changes the topic. History and prepared work remain available.',prompts:['I also need to plan the team offsite','Show my chat history','Show my topics','Whenever I’m mentioned in Telegram, draft a reply. Only interrupt if urgent.','Show my routines']},
  across:{caption:'05 / One thing at a time — browse the work, then decide what to do.',observation:'Swipe left or right through today’s work. Browsing changes no status. Set aside and Mark handled are separate actions, with Undo and an overview to recover anything.',prompts:['Show everything I’m working on','Put this aside','Mark this handled','Show my routines']},
  drawer:{caption:'06 / Topics at your side — swipe right to find a thread.',observation:'Compare a searchable topics sidebar with an overview requested in conversation. A small personal greeting and an icon-only microphone keep the main screen quiet.',prompts:['Show my topics','Let’s talk about hiring','I also need to plan the team offsite','Back to Leo','Show my routines']},
  asked:{caption:'07 / Just ask — the overview appears when it is useful.',observation:'No permanent topics navigation. Ask for everything you’re working on and get a prioritized overview. Standing instructions are created in conversation and audited in plain language.',prompts:['Show everything I’m working on','Show my topics','Prep me for Rachel’s call','Whenever I’m mentioned in Telegram, draft a reply. Only interrupt if urgent.','Show my routines']}
};
let drawerOpen=false;
function isNewStudy(){return variant!=='classic';}
function ensureStudyState(){
  state.workDispositions=state.workDispositions||{};
  if(variant==='across')ensureTopic('funds','Server funds','Brightline','Decision');
}
function feedTopics(){
  if(variant!=='across')return orderedTopics();
  return ['leo','call','funds'].map(id=>state.topics[id]).filter(t=>t&&!state.workDispositions[t.id]);
}
function selectTopicQuietly(id){
  const topic=state.topics[id];if(!topic)return;
  stopMedia();useTopic(id);
  const latest=latestTopicMessage(id);
  state.text=latest.text;state.artifact=latest.artifact||null;state.lastAction=latest.action||null;
  state.context=`${topic.company} · ${topic.title}`;
  render();saveSession();
}
function chooseStudy(value){
  if(!Object.hasOwn(STUDIES,value))return;
  closeTopicDrawer();closeScreens();stopMedia();variant=value;mode='voice';state.latestMode='voice';ensureStudyState();
  if(value==='across'&&!feedTopics().some(t=>t.id===state.currentTopic)){
    if(feedTopics().length)return selectTopicQuietly(feedTopics()[0].id);
  }
  render();saveSession();
}
function studyVoiceHTML(){
  const topics=feedTopics(),index=topics.findIndex(t=>t.id===state.currentTopic);
  const empty=variant==='across'&&!topics.length;
  const text=empty?'You’re clear for now. Everything you set aside or handled is still in your overview.':state.text.replace(/^Morning\.\s*/, '');
  const heading=empty?'<div class="voice-topic-header"><div><p>Today</p><h2 class="topic-title">A little room to breathe.</h2></div><button class="history-button" data-study-overview>Overview</button></div>':topicHeader();
  const dots=variant==='dots'?`<nav class="left-topic-dots" aria-label="Topic positions">${topics.map((t,i)=>`<button data-dot-topic="${esc(t.id)}" aria-label="Topic ${i+1} of ${topics.length}: ${esc(t.title)}" ${t.id===state.currentTopic?'aria-current="true"':''}><span></span></button>`).join('')}</nav>`:'';
  const navigation=variant==='across'&&!empty?`<div class="across-navigation"><nav aria-label="Today’s work"><button data-browse-topic="-1" aria-label="Previous work item" ${index<=0?'disabled':''}>${icon('back')}</button><span>${topics.map((t,i)=>`<button data-dot-topic="${esc(t.id)}" aria-label="Work item ${i+1}: ${esc(t.title)}" ${t.id===state.currentTopic?'aria-current="true"':''}><i></i></button>`).join('')}</span><button data-browse-topic="1" aria-label="Next work item" ${index===topics.length-1?'disabled':''}>${icon('next')}</button></nav><p>Swipe across to browse · ${index+1} of ${topics.length}</p><div class="work-actions"><button data-work-action="later">Set aside</button><button data-work-action="done">Mark handled</button></div></div>`:'';
  const undo=variant==='across'&&state.studyWorkUndo?`<div class="work-undo">${esc(state.studyWorkUndo.label)} <button data-undo-work>Undo</button><button data-study-overview>Overview</button></div>`:'';
  return `<p class="personal-greeting">Morning, Alex.</p>${heading}${dots}<div class="latest-message"><p class="latest-label">${variant==='across'?'Prepared for you':'Latest from Harness'}</p><div class="latest-copy"><p class="spoken-text ${text.length>185?'long':''}" aria-live="polite">${esc(text)}</p>${!empty&&state.artifact?artifactLink(state.artifact):''}${!empty&&state.lastAction==='review'?'<button class="approval-inline" data-open="approval">Review draft ↗</button>':''}${state.studyLastRoutine&&/^Your routines/.test(state.context)?`<button class="inline-link" data-routine="${esc(state.studyLastRoutine)}">View the standing instruction ${icon('next')}</button>`:''}${receipt()}</div></div>${navigation}${undo}`;
}
function renderStudyChrome(){
  $('#phone').dataset.variant=variant;
  $('#study-menu').hidden=variant!=='drawer';
  $('#open-day').hidden=variant==='drawer'||variant==='asked';
  $('#open-topics').hidden=variant==='asked';
  $('#talk-button').setAttribute('aria-label',isNewStudy()?(listening?'Stop listening':speaking?'Interrupt spoken reply':'Speak to Harness'):$('#talk-label').textContent);
  $('#screen-talk').setAttribute('aria-label',isNewStudy()?'Speak about this':'Talk about this');
  document.querySelectorAll('[data-study]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.study===variant)));
}
function drawerRows(query=''){
  const q=query.toLowerCase();
  const topics=orderedTopics().filter(t=>`${t.title} ${t.company} ${topicSummary(t.id)}`.toLowerCase().includes(q));
  return topics.length?topics.map(t=>`<button data-drawer-topic="${esc(t.id)}" ${t.id===state.currentTopic?'aria-current="true"':''}><small>${esc(t.company)}</small><strong>${esc(t.title)}</strong><span>${esc(topicSummary(t.id))}</span></button>`).join(''):'<p class="empty-state">No matching topics.</p>';
}
function openTopicDrawer(){
  if(variant!=='drawer')return openStudyOverview('topics');
  closeScreens();stopMedia();drawerOpen=true;
  $('#drawer-search').value='';$('#drawer-topics').innerHTML=drawerRows();$('#topics-drawer').hidden=false;
  document.querySelectorAll('#phone>.app-header,#phone>.app-body,#phone>.app-footer').forEach(e=>e.inert=true);
  $('#close-drawer').focus({preventScroll:true});
}
function closeTopicDrawer(){
  if(!drawerOpen)return;
  drawerOpen=false;$('#topics-drawer').hidden=true;
  document.querySelectorAll('#phone>.app-header,#phone>.app-body,#phone>.app-footer').forEach(e=>e.inert=false);
}
function openStudyOverview(scope='all'){
  closeTopicDrawer();
  openScreen('YOUR CONTEXT',scope==='topics'?'Your topics, together.':'Here’s what matters.',()=>{
    const topics=orderedTopics();
    const rank={leo:0,call:1,funds:2};
    const groups=[
      ['Needs you',topics.filter(t=>['leo','call','funds'].includes(t.id)&&!state.workDispositions[t.id]&&!(t.id==='leo'&&['sent','done'].includes(state.proposal))).sort((a,b)=>rank[a.id]-rank[b.id])],
      ['In progress',topics.filter(t=>!['leo','call','funds','data'].includes(t.id))],
      ['Waiting on others',topics.filter(t=>t.id==='data'||t.id==='leo'&&['sent','done'].includes(state.proposal))],
      ['Set aside',topics.filter(t=>state.workDispositions[t.id]==='later')],
      ['Handled',topics.filter(t=>state.workDispositions[t.id]==='done')]
    ];
    return `<p class="screen-intro">${scope==='topics'?'The threads from our conversations, kept in context.':'The work that needs you first. Waiting and set-aside items stay separate.'}</p>${groups.filter(([,items])=>items.length).map(([label,items])=>`<section class="overview-group"><h3>${label}</h3>${items.map(t=>`<div class="overview-item"><button data-study-resume="${esc(t.id)}"><small>${esc(t.company)}</small><strong>${esc(t.title)}</strong><span>${esc(topicSummary(t.id))}</span>${icon('next')}</button>${state.workDispositions[t.id]?`<button class="restore-work" data-restore-work="${esc(t.id)}">Bring back</button>`:''}</div>`).join('')}</section>`).join('')}<button class="text-link" data-study-routines>Standing instructions ${icon('next')}</button>`;
  },{key:'study-overview',scope});
}
function changeWorkStatus(value){
  if(variant!=='across'||!['later','done'].includes(value))return;
  const id=state.currentTopic,topic=state.topics[id];if(!topic)return;
  const oldIndex=feedTopics().findIndex(t=>t.id===id);if(oldIndex<0)return;
  const previous=state.workDispositions[id]||null;
  state.workDispositions[id]=value;
  state.studyWorkUndo={id,previous,label:`${topic.title} · ${value==='later'?'set aside':'recorded as handled'}`};
  const remaining=feedTopics(),next=remaining[Math.min(oldIndex,remaining.length-1)];
  if(next)selectTopicQuietly(next.id);else{render();saveSession();}
}
function restoreWork(id){
  delete state.workDispositions[id];state.studyWorkUndo=null;closeScreens();selectTopicQuietly(id);
}
function auditRoutineHTML(r){
  const runs=state.routineRuns.filter(x=>x.id===r.id);
  const steps=r.source==='Calendar'?`<li>Check calls in the selected calendar.</li><li>Gather the relevant prep ${r.minutes||10} minutes before the call.</li><li>Bring you the short version, with the full prep available.</li>`:`<li>Read only the selected ${r.source==='Telegram'?'Telegram chats':'inbox'}${r.person==='Leo'?' and messages from Leo':''}.</li><li>${r.action==='draft'?'Prepare a reply when an answer is needed.':'Keep an item ready for your review.'}</li><li>${r.notify==='urgent'?'Interrupt only when it’s urgent.':'Bring each matching item to you.'} Replies stay drafts.</li>`;
  return `<span class="status-tag ${r.enabled?'':'paused'}">${r.enabled?'Active':'Paused'}</span><p class="routine-sentence">${esc(routineSentence(r))}</p><h3>The instruction I keep</h3><blockquote class="audit-instruction">${esc(r.instruction||routineSentence(r))}</blockquote><h3>How I’d handle it</h3><ol class="audit-steps">${steps}</ol><p class="audit-activity">${runs.length?`${runs.length} sample ${runs.length===1?'run':'runs'} in this demo. Last result: ${esc(runs.at(-1).outcome)}.`:'No sample runs yet.'}</p><div class="routine-actions"><button data-toggle-routine="${esc(r.id)}">${r.enabled?'Pause routine':'Resume routine'}</button><button data-study-change-routine="${esc(r.id)}">Change by talking</button></div><button class="primary" data-test-routine="${esc(r.id)}">Try a sample ${r.source==='Calendar'?'call':'message'}</button>${state.undoRoutine?.id===r.id?'<button class="text-link routine-cancel" data-undo-routine>Undo last change</button>':''}<p class="screen-disclaimer">Audit view · no live monitoring or sending in this prototype.</p>`;
}
function testStudyCalendar(id){
  const r=state.routines.find(x=>x.id===id);if(!r)return;
  state.routineRuns.push({id,at:Date.now(),outcome:r.enabled?'prep':'paused'});saveSession();
  openScreen('ROUTINE · SAMPLE CALL','Before Rachel & Tom',`<p class="eyebrow">Sample · ${r.minutes||10} minutes before the call</p>${r.enabled?'<span class="status-tag">Prep ready</span><p>The pilot scope is the one decision. My suggestion: one use case and an owner on each side.</p><button class="work-row" data-artifact="prep"><span class="work-icon">'+icon('file')+'</span><span><strong>Full talking points</strong><small>Northwind · Rachel & Tom</small></span>'+icon('next')+'</button>':'<span class="status-tag paused">Paused</span><p>No prep surfaced. This instruction is paused.</p>'}<p class="screen-disclaimer">Simulated event. No real calendar or notification is connected.</p>`,{routine:id});
}
function openRoutineAudit(id,replace=false){
  const r=state.routines.find(x=>x.id===id);if(!r)return;
  if(replace&&screens.at(-1)?.key==='routine')screens.pop();
  openScreen('ROUTINE · AUDIT',r.title,()=>auditRoutineHTML(r),{key:'routine',routine:id});
}
function openPendingRoutineAudit(replace=false){
  const r=state.pendingRoutine;if(!r)return;
  if(replace&&screens.at(-1)?.key==='routine-review')screens.pop();
  openScreen('ROUTINE · AUDIT','The instruction, in plain words.',()=>`<p class="routine-sentence">${esc(routineSentence(r))}</p><p>Describe any changes in conversation. There are no fields to configure here.</p><button class="primary" data-keep-study-routine>Keep this instruction</button><button class="text-link" data-study-edit-pending>Change by talking</button>`,{key:'routine-review'});
}
function storeSpokenRoutine(r,previous){
  state.undoRoutine={id:r.id,previous:previous?{...previous}:null};
  const index=state.routines.findIndex(x=>x.id===r.id);
  if(index>=0)state.routines[index]=r;else state.routines.push(r);
  state.studyLastRoutine=r.id;state.pendingRoutine=null;state.studyAwaitingRoutine=null;closeScreens();
  response(r.enabled?`Got it. ${routineSentence(r)} Replies will stay drafts.`:'Updated. This instruction is still paused.',{context:'Your routines'});
}
function handleStudyIntent(t,text){
  if(!isNewStudy())return false;
  if(/show.*(?:topics|everything|working on|my day)|what.*(?:most pressing|most urgent)|what needs me/.test(t)){
    response('Here’s the work that needs you, with the rest kept in view.',{context:'Your topics'});openStudyOverview(/topics/.test(t)?'topics':'all');return true;
  }
  if(variant==='across'&&/put.*aside|set.*aside|mark.*handled|already handled/.test(t)){changeWorkStatus(/handled/.test(t)?'done':'later');return true;}
  const routineTrigger=/whenever|anytime|any time|every time|when (?:i|someone|a)|automatically/.test(t)&&/telegram|mention|email|calendar|meeting|call/.test(t);
  if(routineTrigger||state.studyAwaitingRoutine){
    if(/automatically.*send|send.*automatically/.test(t)){response('I can prepare replies automatically. Sending will still wait for your approval of the exact message.',{context:'Your routines'});return true;}
    if(/calendar|meeting|call/.test(t)&&!/telegram|email/.test(t)){
      const r={id:`routine-${Date.now()}`,title:'Before my calls',source:'Calendar',person:'Anyone',action:'prep',notify:'before-call',minutes:10,enabled:true,instruction:'Ten minutes before a calendar call, bring me the relevant prep.'};
      state.undoRoutine={id:r.id,previous:null};state.routines.push(r);state.studyLastRoutine=r.id;response('I’ll keep a standing instruction to bring your prep ten minutes before a call.',{context:'Your routines'});return true;
    }
    if(!/draft|reply|flag/.test(t)){state.studyAwaitingRoutine={source:/email/.test(t)?'Email':'Telegram'};response('When you’re mentioned, should I prepare a reply or just flag it for you?',{context:'Your routines'});return true;}
    const source=state.studyAwaitingRoutine?.source||(/email/.test(t)?'Email':'Telegram');
    const r={id:`routine-${Date.now()}`,title:source==='Telegram'?'Replies to direct mentions':'Email replies',source,person:/from leo/.test(t)?'Leo':'Anyone',action:/flag/.test(t)?'flag':'draft',notify:/every match|every message/.test(t)?'every':'urgent',enabled:true,instruction:text};
    storeSpokenRoutine(r,null);return true;
  }
  if(/only from leo|make (?:that|it).*email|notify.*every match|only.*urgent/.test(t)&&(state.routines.length||state.pendingRoutine)){
    const previous=state.routines.find(r=>r.id===state.studyEditingRoutine)||state.routines.at(-1),r={...(state.pendingRoutine||previous)};
    if(/from leo/.test(t))r.person='Leo';if(/email/.test(t)){r.source='Email';r.title='Email replies';}if(/every match/.test(t))r.notify='every';if(/urgent/.test(t))r.notify='urgent';
    r.instruction=routineSentence(r);storeSpokenRoutine(r,previous);return true;
  }
  return false;
}
document.addEventListener('click',e=>{
  const study=e.target.closest('[data-study]');if(study)return chooseStudy(study.dataset.study);
  const dot=e.target.closest('[data-dot-topic]');if(dot)return selectTopicQuietly(dot.dataset.dotTopic);
  if(e.target.closest('#study-menu'))return openTopicDrawer();
  if(e.target.closest('[data-close-drawer]')){closeTopicDrawer();$('#study-menu').focus();return;}
  const topic=e.target.closest('[data-drawer-topic]');if(topic){closeTopicDrawer();return resumeTopic(topic.dataset.drawerTopic);}
  if(e.target.closest('[data-drawer-routines]')){closeTopicDrawer();return openTopics('routines');}
  if(e.target.closest('[data-study-overview]'))return openStudyOverview();
  if(e.target.closest('[data-study-routines]'))return openTopics('routines');
  const resume=e.target.closest('[data-study-resume]');if(resume)return resumeTopic(resume.dataset.studyResume);
  const work=e.target.closest('[data-work-action]');if(work)return changeWorkStatus(work.dataset.workAction);
  const restore=e.target.closest('[data-restore-work]');if(restore)return restoreWork(restore.dataset.restoreWork);
  if(e.target.closest('[data-undo-work]')&&state.studyWorkUndo){const change=state.studyWorkUndo;if(change.previous)state.workDispositions[change.id]=change.previous;else delete state.workDispositions[change.id];state.studyWorkUndo=null;return selectTopicQuietly(change.id);}
  const edit=e.target.closest('[data-study-change-routine]');if(edit){state.studyEditingRoutine=edit.dataset.studyChangeRoutine;closeScreens();response('Tell me what you’d like to change.',{context:'Your routines'});$('#composer').hidden=false;$('#message').focus();return;}
  if(e.target.closest('[data-keep-study-routine]')&&state.pendingRoutine)return storeSpokenRoutine({...state.pendingRoutine},null);
  if(e.target.closest('[data-study-edit-pending]')){closeScreens();$('#composer').hidden=false;$('#message').focus();}
});
document.addEventListener('input',e=>{if(e.target.id==='drawer-search')$('#drawer-topics').innerHTML=drawerRows(e.target.value);});
let studyPointer=null;
document.addEventListener('pointerdown',e=>{
  if(!isNewStudy()||!e.target.closest('#phone')||e.target.closest('button,a,input,select,textarea'))return;
  if(!drawerOpen&&(!e.target.closest('#app-body')||!canBrowseFrom(e.target)))return;
  studyPointer={x:e.clientX,y:e.clientY,id:e.pointerId};
});
document.addEventListener('pointerup',e=>{
  const start=studyPointer;studyPointer=null;if(!start||start.id!==e.pointerId)return;
  const dx=e.clientX-start.x,dy=e.clientY-start.y;
  if(Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.4)return;
  if(drawerOpen&&dx<0){closeTopicDrawer();return;}
  if(variant==='drawer'&&dx>0)return openTopicDrawer();
  if(variant==='across')browseTopic(dx<0?1:-1);
});
document.addEventListener('pointercancel',()=>{studyPointer=null;});
document.addEventListener('keydown',e=>{
  if(drawerOpen){
    if(e.key==='Escape'){e.preventDefault();closeTopicDrawer();$('#study-menu').focus();}
    if(e.key==='Tab'){
      const controls=Array.from($('#topics-drawer').querySelectorAll('button,input')).filter(x=>!x.disabled),first=controls[1],last=controls.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
    return;
  }
  if(variant==='across'&&['ArrowLeft','ArrowRight'].includes(e.key)&&!e.target.closest('input,textarea,select')&&(document.body.classList.contains('focus-mode')||e.target.closest('#phone'))){if(browseTopic(e.key==='ArrowRight'?1:-1))e.preventDefault();}
});
