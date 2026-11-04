'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const modes = {
  voice: {caption:'01 / Just talk — one relevant thought, with room to respond.', observation:'A quiet, centered response. Ask for detail, open the topic, or switch to A conversation when you want the history.'},
  thread: {caption:'02 / A conversation — speak, skim, or pick up where you left off.', observation:'The conversation is the memory. Test whether visible history helps you regain context without becoming another feed.'},
  brief: {caption:'03 / The quiet brief — a little orientation before you talk.', observation:'A small amount of structure can reassure. Test whether the glance adds confidence or simply delays the conversation.'},
  feed: {caption:'08 / Topic feed — the latest thought, with its topic.', observation:'Swipe up or down between topics, or use the arrows. History opens the full discussion. Mention another piece of work to bring a new topic to the front.'}
};
const scenarios = {
  morning: {context:'Halcyon · proposal', start:'Morning. Leo’s proposal is the one thing I’d clear first. I’ve drafted it. Want the short version?', note:'The proposal is overdue. A call is at 10. Another decision can wait until this afternoon.', title:'One thing to clear first.', brief:'Leo is waiting on the proposal you promised. I’ve drafted it, ready to review.', bottom:'10:00 · Rachel & Tom\nThis afternoon · Server funds decision', prompts:['Why that first?','Give me the short version','Show me the proposal','What else needs me?']},
  change: {context:'Northwind · your next call', start:'Rachel moved your call to 10:30. That gives you half an hour back. Your prep is ready whenever you want it.', note:'You already know the agenda. Only the time has changed. The assistant should tell you the difference.', title:'Half an hour back.', brief:'Rachel moved your call to 10:30. Same agenda. Your prep is ready.', bottom:'10:30 · Rachel & Tom\nNo other changes need you', prompts:['What changed?','Prep me for the call','Show my day','Remind me before the call']},
  continuity: {context:'Halcyon · Leo’s proposal', start:'Your one-page proposal is ready. We can pick it up, or talk through something else.', note:'Switch to hiring, discuss the role, then say “Back to Leo.” Each discussion keeps its own context.', title:'Pick up where you left off.', brief:'Leo’s proposal is one page now. A small pilot first, with scope still to agree.', bottom:'Halcyon · Proposal ready\nNorthwind · Hiring, when you’re ready', prompts:["Let’s talk about hiring",'A product designer','I also need to plan the team offsite','Back to Leo','Show my chat history','Show my topics']},
  quiet: {context:'All caught up', start:'Nothing needs you right now. Dana still owes you the data room list. I’m keeping track; you don’t need to chase it today.', note:'No new decision is needed. Waiting on someone else should not become a task for you.', title:'You’re clear for now.', brief:'Nothing needs a decision. I’m keeping an eye on the things you’re waiting for.', bottom:'Waiting on Dana · Data room list\nNext check · Tomorrow morning', prompts:['What am I waiting on?','Don’t remind me unless it’s late','Show my day','Why nothing today?']}
};
let state, audio=false, speaking=false, listening=false, recognition=null, speechGeneration=0;
const params=new URLSearchParams(location.search);
let mode=Object.hasOwn(modes,params.get('mode'))?params.get('mode'):'voice';
let scenario=Object.hasOwn(scenarios,params.get('scenario'))?params.get('scenario'):'morning';
let variant=Object.hasOwn(STUDIES,params.get('variant'))?params.get('variant'):'classic';
if(params.get('app')==='1')document.body.classList.add('focus-mode');
const screens=[];
const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
function reset(){
  closeTopicDrawer();stopMedia(); closeScreens(); state={history:[],text:scenarios[scenario].start,context:scenarios[scenario].context,started:false,proposal:'ready',shortened:false,approval:false,draft:"Hi Leo, here’s the proposal I promised, based on the terms we discussed.",reminder:null,quietRule:false,artifact:null,lastAction:null};
  initializeTopics();
  if(scenario==='continuity'){state.shortened=true;state.history.push({who:'user',text:'Make the proposal one page. A small pilot first.',topic:'leo',seeded:true},{who:'assistant',text:'One page, same proposed scope. Commercial terms are still open.',topic:'leo',seeded:true});}
  state.history.push({who:'assistant',text:state.text,topic:state.currentTopic,at:Date.now()});touchTopic(state.currentTopic);render();saveSession();
}
function stopSpeech(){speechGeneration++;if('speechSynthesis' in window)window.speechSynthesis.cancel();speaking=false;}
function stopMedia(){stopSpeech();if(recognition){recognition.abort();recognition=null;}listening=false;}
function say(text){
  stopSpeech(); if(!audio)return;
  if(!('speechSynthesis' in window)){audio=false;renderControls('Spoken replies unavailable here. Captions stay on.');return;}
  const generation=speechGeneration;
  const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.97;
  u.onstart=()=>{if(generation!==speechGeneration)return;speaking=true;renderControls();};
  u.onend=()=>{if(generation!==speechGeneration)return;speaking=false;renderControls();};
  u.onerror=()=>{if(generation!==speechGeneration)return;speaking=false;renderControls('Audio unavailable. You can read or type.');};
  window.speechSynthesis.speak(u);
}
function response(text,{context=state.context,artifact=null,action=null}={}){
  state.text=text;state.context=context;state.artifact=artifact;state.lastAction=action;
  const topic=/^Your (?:topics|routines)/.test(context)?null:state.currentTopic;
  state.history.push({who:'assistant',text,artifact,action,topic,at:Date.now()});if(topic)touchTopic(topic);render();saveSession();say(text);
}
function renderControls(message){
  $('#voice-status').textContent=message||(listening?'Listening… tap to stop':speaking?'Speaking… tap to interrupt':audio?'Spoken replies on':'Spoken replies off');
  $('#talk-label').textContent=listening?'Stop listening':speaking?'Interrupt':state.started?'Talk to Harness':'Let’s talk';
  $('#audio-toggle').setAttribute('aria-pressed',String(audio));
  $('#audio-icon').setAttribute('href',audio?'#icon-volume':'#icon-muted');
  $('#audio-toggle').setAttribute('aria-label',audio?'Mute spoken replies':'Enable spoken replies');
  renderStudyChrome();
  const presence=$('.presence');if(presence){presence.classList.toggle('speaking',speaking);presence.classList.toggle('listening',listening);}
}
function artifactLink(kind){return `<button class="${mode==='thread'?'thread-artifact':'inline-link'}" data-artifact="${kind}">${icon('file')}<span>${kind==='prep'?'Open call prep':'Open proposal'}</span>${icon('next')}</button>`;}
function receipt(){return state.reminder?`<div class="receipt">${esc(state.reminder)}<br><button data-command="Cancel that reminder">Undo reminder</button> · <button id="advance-reminder">Jump to reminder</button></div>`:state.quietRule?'<div class="receipt">I’ll only surface Dana’s list if it’s late.<br><button data-command="Undo that preference">Undo preference</button></div>':'';}
function render(){
  ensureStudyState();
  $('#phone').dataset.mode=mode;
  document.querySelectorAll('button[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(variant==='classic'&&b.dataset.mode===mode)));
  document.querySelectorAll('[data-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scenario===scenario)));
  $('#preview-caption').textContent=isNewStudy()?STUDIES[variant].caption:modes[mode].caption;$('#observation').textContent=isNewStudy()?STUDIES[variant].observation:modes[mode].observation;
  $('#focus-link').href=`?app=1&mode=${mode}&scenario=${scenario}&variant=${variant}`;
  $('#scenario-note').textContent=scenarios[scenario].note;
  const proposalMoment=['morning','continuity'].includes(scenario);
  const prompts=state.approval?['Read it back','Make it warmer','Review before sending','Cancel that']:isNewStudy()?STUDIES[variant].prompts:scenarios[scenario].prompts;
  $('#prompts').innerHTML=prompts.map(p=>`<button class="prompt" data-command="${esc(p)}">${esc(p)}</button>`).join('');
  const body=$('#app-body');
  if(mode==='thread'){
    const activeTopic=/^Your (?:routines|topics)/.test(state.context)?null:state.currentTopic;
    const history=state.history.filter(m=>m.topic===activeTopic);
    body.innerHTML=topicHeader(true)+'<div class="conversation-log">'+(history.length?history:[latestTopicMessage(state.currentTopic)]).map(m=>`<div class="thread-msg ${m.who}">${m.who==='assistant'?'<span class="thread-who">Harness</span>':''}${esc(m.text)}${m.originalText?`<details class="original-utterance"><summary>From a longer message</summary><p>${esc(m.originalText)}</p></details>`:''}${m.artifact?artifactLink(m.artifact):''}${m.action==='review'&&state.approval?'<button class="approval-inline" data-open="approval">Review draft ↗</button>':''}</div>`).join('')+'</div>';
    const log=$('.conversation-log');log.scrollTop=log.scrollHeight;
  }else if(isNewStudy()){
    body.innerHTML=studyVoiceHTML();
  }else if(mode==='brief'&&!state.started){
    const s=scenarios[scenario];
    body.innerHTML=`<div class="brief-view"><p class="brief-date">Wednesday, November 4</p><h2>${s.title}</h2><p>${s.brief}</p><div class="brief-focus"><span class="eyebrow">${proposalMoment?'MY SUGGESTION':scenario==='change'?'WHAT CHANGED':'IN THE BACKGROUND'}</span><p>${proposalMoment?'Let’s get Leo’s proposal off your mind.':scenario==='change'?'Take the time back. I’ll get you ready before the call.':'Dana’s list is on my radar. It can wait until tomorrow.'}</p>${proposalMoment?artifactLink('proposal'):scenario==='change'?artifactLink('prep'):''}</div><div class="brief-bottom">${s.bottom.split('\n').map(esc).join('<br>')}</div></div>`;
  }else if(mode==='voice'){
    body.innerHTML=`<div class="voice-view"><div class="presence" aria-hidden="true"><img src="assets/symbol-plum.svg" alt=""></div><button class="context-line context-button" ${/^Your routines/.test(state.context)?'data-context-tab="routines"':/^Your topics/.test(state.context)?'data-context-tab="topics"':`data-topic="${esc(state.currentTopic)}"`}>${esc(state.context)} ${icon('next')}</button><p class="spoken-text ${state.text.length>185?'long':''}" aria-live="polite">${esc(state.text)}</p>${state.artifact?artifactLink(state.artifact):''}${state.lastAction==='review'?'<button class="approval-inline" data-open="approval">Review draft ↗</button>':''}${receipt()}</div>`;
  }else{
    body.innerHTML=`${topicHeader()}<div class="latest-message"><p class="latest-label">Latest from Harness</p><div class="latest-copy"><p class="spoken-text ${state.text.length>185?'long':''}" aria-live="polite">${esc(state.text)}</p>${state.artifact?artifactLink(state.artifact):''}${state.lastAction==='review'?'<button class="approval-inline" data-open="approval">Review draft ↗</button>':''}${receipt()}</div></div>${topicPager()}`;

  }
  body.classList.toggle('is-feed',mode==='feed'||mode==='voice'&&isNewStudy()||mode==='brief'&&state.started);
  body.classList.toggle('feed-scrolls',mode!=='thread'&&!!$('.latest-copy')&&$('.latest-copy').scrollHeight>$('.latest-copy').clientHeight+2);
  renderControls();
}
function submit(raw,{originalText=null}={}){
  let text=raw.trim();if(!text)return;
  const aside=text.match(/\b(?:oh[, ]+)?i also (?:need|want|have) to\s+/i);
  if(aside&&aside.index>0){const prefix=text.slice(0,aside.index).replace(/[,.!\s]+$/,'');if(prefix)submit(prefix,{originalText:raw.trim()});originalText=raw.trim();text=text.slice(aside.index);}
  stopMedia();closeScreens();state.started=true;
  const t=text.toLowerCase().replace(/[’]/g,"'");
  const topic=inferTopic(t);if(topic){useTopic(topic);state.context=`${state.topics[topic].company} · ${state.topics[topic].title}`;}
  state.history.push({who:'user',text,topic:/routine|standing instruction|show.*topics|whenever|anytime|every time/.test(t)?null:state.currentTopic,at:Date.now(),...(originalText?{originalText}: {})});
  if(handleStudyIntent(t,text)||handleOrganization(t,text))return;
  if(/cancel.*remind|undo.*remind/.test(t)){state.reminder=null;return response('Canceled. I won’t remind you about that.');}
  if(/undo.*preference/.test(t)){state.quietRule=false;return response('Undone. I’ll use the previous reminder preference.');}
  if(/cancel|never mind|nevermind/.test(t)){state.approval=false;return response('Left as a draft. Nothing sent.');}
  if(/stop|pause|be quiet/.test(t)){return response('Of course. I’m here when you need me.');}
  if(/repeat|say that again/.test(t)){const prev=state.history.slice(0,-1).filter(m=>m.who==='assistant').at(-1);return response(prev.text,{artifact:prev.artifact,action:prev.action});}
  if(/read it|read.*back/.test(t)&&state.approval)return response(`To Leo, on Telegram: “${state.draft}” With the ${state.shortened?'one-page':'two-page'} proposal attached. Review it when you’re ready.`,{action:'review'});
  if(/warmer/.test(t)&&state.approval){state.draft="Hi Leo, thanks for your patience. Here’s the proposal I promised, based on the terms we discussed. Looking forward to your thoughts.";return response('I’ve made it warmer. The revised draft is ready for your review.',{action:'review'});}
  if(/send|approve|review before/.test(t)&&!(/already|i have|i've|i did/.test(t))){
    if(state.currentTopic!=='leo')return response('We haven’t prepared a message for this topic yet. Tell me what you’d like it to say.');
    if(!['morning','continuity'].includes(scenario))return response('There isn’t a message prepared in this moment. You can ask about your day or the call.');
    if(state.proposal==='sent'||state.proposal==='done')return response('That proposal is already recorded as sent. I’m waiting on Leo.');
    state.approval=true;response('I have the draft ready for Leo on Telegram, with the proposal attached. Review the exact message before sending.',{action:'review'});return;
  }
  if(/already (sent|did|done)|i('ve| have) sent|mark.*done/.test(t)){state.proposal='done';state.approval=false;state.reminder=null;return response('Got it. I’ve recorded that you sent it. I’m waiting on Leo now. Your 10 o’clock call is next.',{context:'Halcyon · waiting on Leo'});}
  if(/don't.*remind|only.*late/.test(t)){state.quietRule=true;return response('Okay. I’ll only bring it up if it’s late. You can undo that preference.',{context:'Your preferences'});}
  if(/remind|later|after (the |my )?call/.test(t)){
    if(scenario==='change'){state.reminder='Demo reminder · 10:20, before Rachel & Tom';return response('I’ve set a demo reminder for 10:20, ten minutes before the call. Your prep will be there.',{context:'Northwind · reminder set'});}
    state.reminder='Demo reminder · 10:45, after your call';return response('I’ll bring it back at 10:45, after your call. It stays open until then.',{context:'Halcyon · set aside for now'});
  }
  if(/source|how do you know|what.*based|evidence/.test(t)){response(scenario==='change'?'Rachel’s message says 10:30. Your calendar still says 10, so the new time needs confirming there. I haven’t changed your calendar.':scenario==='quiet'?'Dana said she’d have the list to you Thursday. That makes tomorrow the right time to check, rather than today.':'Your October 19 message says you’d send Leo the proposal. I haven’t found a send in the selected chat. You may have sent it somewhere else.');openSources();return;}
  if(/why|what changed/.test(t)){
    if(scenario==='quiet')return response('Dana owns the next step, and her list isn’t due until tomorrow. There’s nothing for you to do today.');
    if(scenario==='change')return response('Just the time: 10:30 instead of 10. Same people, same agenda. Your calendar still shows 10; I haven’t edited it.',{artifact:'prep'});
    return response(state.proposal==='ready'?'You promised it on October 19, and I haven’t seen it sent in the selected chat. The other decision can wait until this afternoon.':'The proposal is waiting on Leo now. Your call is the next thing that needs you.');
  }
  if(/short|one page|shorten|make it (simpler|brief)/.test(t)){
    if(/one page|shorten/.test(t)){state.shortened=true;state.approval=false;return response('One page now. Same proposed scope, with the detail trimmed. It’s ready to review.',{artifact:'proposal'});}
    if(['morning','continuity'].includes(scenario))return response('A small pilot first. Agree on scope, name one owner on each side, then decide whether to expand. No new commercial terms.',{artifact:'proposal'});
    return response(scenario==='change'?'The call is 30 minutes later. Everything else is the same.':'You’re clear. Dana has the next step.');
  }
  if(/proposal|document|open.*draft/.test(t)){response('Here’s the proposal. We can shorten it or prepare a message for Leo.',{artifact:'proposal'});openProposal();return;}
  if(/prep|rachel|call/.test(t)){return response('Rachel and Tom need a decision on the pilot’s scope. My suggestion: agree on one owner per team and a small first milestone. Leave the expansion decision for later.',{context:'Northwind · call prep',artifact:'prep'});}
  if(/waiting|owe me|dana/.test(t)){return response(`Dana owes you the data room list tomorrow.${state.proposal==='sent'||state.proposal==='done'?' Leo also owes you a reply to the proposal.':''} Neither needs a chase today.`,{context:'Waiting on others'});}
  if(/show.*day|full.*list|show.*everything|at a glance/.test(t)){response('Here’s your day at a glance. We can go through any of it together.');openDay();return;}
  if(/what else|next|other|rest|priorit/.test(t)){return response(`Your ${scenario==='change'?'10:30':'10 o’clock'} call with Rachel and Tom is next. Prep is ready. The server funds decision can wait until this afternoon.`,{context:'The rest of your day',artifact:'prep'});}
  if(/start|morning|hello|hi$|brief me/.test(t))return response(scenarios[scenario].start);
  response('This prototype has a few scripted paths. Try “show my topics,” “let’s talk about hiring,” “back to Leo,” or ask me to draft replies whenever you’re mentioned in Telegram.');
}
function openScreen(kicker,title,html,options={}){
  stopMedia();
  if(screens.length)screens.at(-1).scroll=$('#screen-scroll').scrollTop;
  if(!options.topic){if(/proposal/i.test(title))options.topic='leo';else if(/Rachel.*Tom/.test(title))options.topic='call';}
  screens.push({kicker,title,html,scroll:0,...options});
  renderScreen();
}
function renderScreen(){
  const screen=screens.at(-1);
  $('#phone').classList.toggle('is-detail',!!screen);
  $('#detail-screen').hidden=!screen;
  if(!screen)return;
  $('#screen-kicker').textContent=screen.kicker.replace(' · FICTIONAL DEMO','').replace(' · DEMO','');
  $('#screen-section').textContent=screen.kicker.startsWith('YOUR CONTEXT')?'Your context':screen.kicker.startsWith('TOPIC')?'Topic':screen.kicker.startsWith('ROUTINE')?'Routine':screen.kicker.startsWith('SAVED')?'Saved work':screen.kicker.startsWith('REVIEW')?'Review message':screen.kicker.startsWith('EVIDENCE')?'Sources':screen.kicker.startsWith('NORTHWIND')?'Call prep':screen.kicker.startsWith('OPTIONAL')?'Voice input':screen.kicker.startsWith('DESIGN')?'Design notes':'Your day';
  $('#screen-content').innerHTML=`<h2 id="screen-title" tabindex="-1">${esc(screen.title)}</h2>${typeof screen.html==='function'?screen.html():screen.html}`;
  if($('#draft-editor'))$('#draft-editor').value=state.draft;
  $('#screen-scroll').scrollTop=screen.scroll;
  $('#screen-title').focus({preventScroll:true});
  $('#screen-talk').hidden=screen.kicker.startsWith('OPTIONAL');
}
function closeScreens(){screens.length=0;renderScreen();}
function goBack(){
  stopMedia();screens.pop();renderScreen();
  if(!screens.length)$('#talk-button').focus({preventScroll:true});
}
function openProposal(){
  openScreen('SAVED WORK · FICTIONAL DEMO','Halcyon partnership proposal',`<div class="document"><p class="doc-meta">Draft · ${state.shortened?'1 page':'2 pages'} · prepared for Leo Brandt</p><h3>A focused first step.</h3><p>Start with a small, jointly owned pilot. Confirm the scope before making broader commitments.</p><h3>Proposed approach</h3><p>Choose one use case. Name one owner from each team. Agree on a first milestone and review the results together before expanding.</p>${state.shortened?'':'<h3>How we would work</h3><p>Keep delivery updates in the existing conversation. Raise scope changes explicitly, so neither team assumes additional work has been agreed.</p>'}<h3>Open decisions</h3><p>The pilot scope, owners and milestone date still need agreement. This draft adds no pricing or commercial commitment.</p></div><div class="mic-buttons"><button class="primary" data-command="Make it one page">Make it one page</button><button class="text-link" data-command="Prepare to send it">Prepare message ${icon('next')}</button></div>`);
}
function openPrep(){openScreen('NORTHWIND · FICTIONAL DEMO','Before Rachel & Tom',`<p class="eyebrow">${scenario==='change'?'10:30 · CHANGED FROM 10:00':'10:00'} / TODAY</p><h3>The decision</h3><p>How small can the first pilot be while still telling both teams whether to continue?</p><h3>My suggestion</h3><p>One use case. One owner on each side. Agree on a first milestone before discussing expansion.</p><h3>Ask them</h3><p>“Who owns delivery on your side, and what result would make this pilot useful?”</p>`);}
function openSources(){openTopicSources(state.currentTopic);}
function openDay(){
  const done=['sent','done'].includes(state.proposal);
  openScreen('WEDNESDAY, NOVEMBER 4 · DEMO','Your day, at a glance',`${scenario!=='quiet'?`<div class="sheet-row"><small>HALCYON / ${done?'WAITING ON LEO':state.reminder?'SET ASIDE UNTIL 10:45':'NEEDS YOU'}</small><strong>Proposal to Leo</strong><small>${done?'You’ve recorded it as sent.':state.reminder?'Still open. A demo reminder is set.':'Draft ready · promised October 19'}</small><button data-artifact="proposal">Open proposal ${icon('next')}</button></div><div class="sheet-row"><small>NORTHWIND / ${scenario==='change'?'10:30 · CALENDAR STILL SAYS 10:00':'10:00'}</small><strong>Rachel & Tom</strong><small>Prep ready · agree on pilot scope</small><button data-artifact="prep">Open prep ${icon('next')}</button></div><div class="sheet-row"><small>BRIGHTLINE / THIS AFTERNOON</small><strong>Server funds decision</strong><small>Timing needs your decision. Amount is not confirmed.</small></div>`:''}<div class="sheet-row"><small>WAITING ON DANA / DUE TOMORROW</small><strong>Data room list</strong><small>Dana has the next action. No chase needed today.</small></div>`);
}
function openApproval(){if(!state.approval)return;
  openScreen('REVIEW EXACT ACTION · DEMO','Ready for your review',`<div class="approval-meta">To <strong>Leo Brandt</strong> · Telegram<br>Attachment · Halcyon proposal · ${state.shortened?'1 page':'2 pages'}</div><label for="draft-editor"><p>Message</p></label><textarea class="draft-editor" id="draft-editor">${esc(state.draft)}</textarea><button class="text-link" data-artifact="proposal">Review attachment ${icon('next')}</button><p class="screen-disclaimer">Demo only. Nothing will be sent.</p><div class="mic-buttons"><button class="primary" id="simulate-send">Simulate sending</button><button class="text-link" data-command="Cancel that">Keep as draft</button></div>`);
}
function openMic(){
  const supported=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
  openScreen('OPTIONAL VOICE INPUT','Speak, or stay with text.',`<p>${supported?'Live dictation uses your browser’s speech recognition. Depending on the browser, audio may be processed by its speech service. Only the recognized text is used in this scripted demo.':'Live speech recognition isn’t available in this browser. You can type any of the demo phrases, or click a suggested line.'}</p><p>No recording is stored by this prototype. It only listens after you start, and stops after each turn. No microphone access is needed for the scripted examples.</p><div class="mic-buttons">${supported?'<button class="primary" id="start-mic">Start microphone</button>':''}<button class="text-link" id="use-keyboard">Use keyboard</button></div>`);
}
function startMic(){
  closeScreens();stopMedia();audio=true;
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return;
  recognition=new SR();const rec=recognition;rec.lang='en-US';rec.continuous=false;rec.interimResults=false;
  rec.onstart=()=>{listening=true;renderControls();};
  rec.onresult=e=>{const text=e.results[0][0].transcript;listening=false;recognition=null;submit(text);};
  rec.onerror=e=>{listening=false;recognition=null;renderControls(e.error==='not-allowed'?'Microphone unavailable. Type or use a suggested line.':'I didn’t catch that. You can try again or type.');};
  rec.onend=()=>{listening=false;if(recognition===rec)recognition=null;renderControls();};
  try{rec.start();}catch{recognition=null;renderControls('Microphone unavailable. You can type instead.');}
}
function openNotes(){openScreen('DESIGN NOTES','The assistant carries the structure.',`<p>These studies explore how much the owner needs to see while talking with an assistant. Conversation carries the interaction; visual work appears when useful.</p><h3>01 / Just talk · recommended starting point</h3><p>One relevant thought, one question, with a persistent caption. Best for being on the move. Test whether people still feel oriented when the backlog is hidden.</p><h3>02 / A conversation</h3><p>Same assistant, with a visible transcript. Best for resuming a discussion and switching between speaking and typing. Risk: a long feed can bring back the reading burden.</p><h3>03 / The quiet brief</h3><p>A few lines orient you before the first spoken turn. Best for checking in silently. Once you reply, it becomes a voice session. Risk: extra information can become a second task list.</p><h3>What the assistant remembers</h3><p>What has been discussed in this session, whether you’ve recorded a send, what is waiting on someone else, and corrections to the plan. “What changed?” gives only the difference. “Why?” reveals context. No inference about your mental state is claimed.</p><h3>Keep the useful visuals</h3><p>Documents, call prep, sources and a day view open on request. They support the conversation. Draft review preserves an explicit exact-action gate.</p><h3>Useful next test</h3><p>Try each direction with the same scenario, without looking at the screen. Can you say what matters, explain why, correct a mistake and postpone something? Then ask to see a document. Compare confidence, effort and missed context.</p><p class="notice">Scripted interaction study. No AI model, accounts, background monitoring, actual reminders or real sending. Each reviewer’s demo state stays in their own browser. Resetting a moment clears it. Browser dictation is optional and may use a browser speech service.</p>`);}
document.addEventListener('click',e=>{
  const command=e.target.closest('[data-command]');if(command){if(screens.at(-1)?.topic)useTopic(screens.at(-1).topic);if(screens.length)closeScreens();submit(command.dataset.command);return;}
  const m=e.target.closest('button[data-mode]');if(m){stopMedia();closeTopicDrawer();closeScreens();if(m.dataset.mode==='thread'&&mode!=='thread')state.latestMode=mode;variant='classic';mode=m.dataset.mode;if(mode!=='thread')state.latestMode=mode;render();saveSession();return;}
  const s=e.target.closest('[data-scenario]');if(s){scenario=s.dataset.scenario;reset();return;}
  const artifact=e.target.closest('[data-artifact]');if(artifact){artifact.dataset.artifact==='prep'?openPrep():openProposal();return;}
  if(e.target.closest('[data-open="approval"]'))return openApproval();
  if(e.target.closest('#start-mic'))return startMic();
  if(e.target.closest('#use-keyboard')){closeScreens();$('#composer').hidden=false;$('#message').focus();return;}
  if(e.target.closest('#advance-reminder')){
    state.reminder=null;state.started=true;
    return response(scenario==='change'?'Your call is in ten minutes. You already know the agenda. The one decision is the pilot scope. Want the talking points?':'You asked me to bring Leo’s proposal back after your call. The draft is ready. Want to review it now?',{context:scenario==='change'?'Northwind · 10:20 · demo time':'Halcyon · 10:45 · demo time',artifact:scenario==='change'?'prep':'proposal'});
  }
  if(e.target.closest('#simulate-send')){
    if(!state.approval)return;
    useTopic('leo');state.draft=$('#draft-editor').value;state.proposal='sent';state.approval=false;state.reminder=null;closeScreens();state.started=true;
    response('Demo send complete. The proposal is now waiting on Leo. Nothing was actually sent. Your 10 o’clock call is next.',{context:'Halcyon · waiting on Leo'});
  }
});
document.addEventListener('input',e=>{if(e.target.id==='draft-editor'){state.draft=e.target.value;saveSession();}});
$('#talk-button').addEventListener('click',()=>{
  if(speaking){stopSpeech();renderControls('Paused. You can talk or type.');return;}
  if(listening){stopMedia();renderControls();return;}
  if(!state.started){state.started=true;render();say(state.text);if(!audio)openMic();}
  else openMic();
});
$('#audio-toggle').addEventListener('click',()=>{audio=!audio;if(audio)say(state.text);else stopSpeech();renderControls();});
$('#type-toggle').addEventListener('click',()=>{stopMedia();$('#composer').hidden=!$('#composer').hidden;if(!$('#composer').hidden)$('#message').focus();renderControls();});
$('#composer').addEventListener('submit',e=>{e.preventDefault();const val=$('#message').value;$('#message').value='';submit(val);});
$('#screen-back').addEventListener('click',goBack);
$('#return-to-chat').addEventListener('click',()=>{closeScreens();$('#talk-button').focus();});
$('#screen-talk').addEventListener('click',()=>{if(screens.at(-1)?.topic)useTopic(screens.at(-1).topic);openMic();});
$('#screen-type').addEventListener('click',()=>{if(screens.at(-1)?.topic)useTopic(screens.at(-1).topic);closeScreens();$('#composer').hidden=false;$('#message').focus();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&screens.length){e.preventDefault();goBack();}});
$('#open-day').addEventListener('click',()=>isNewStudy()?openStudyOverview():openDay());
$('#open-topics').addEventListener('click',()=>isNewStudy()?(variant==='drawer'?openTopicDrawer():openStudyOverview('topics')):openTopics());
$('#open-notes').addEventListener('click',openNotes);$('#reset').addEventListener('click',reset);
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMedia();renderControls();}});
window.addEventListener('pagehide',stopMedia);
startSession();
