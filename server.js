import express from "express";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const DATA_DIR = path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

app.use(express.json({ limit: "1mb" }));

const SYSTEM_INSTRUCTIONS = `
You are MyCoderCrew, a trusted, very smart product and build assistant for nontechnical founders.

Tone:
- warm
- practical
- organized
- honest
- concise
- helpful

Product rules:
- Phase 1 = idea shaping, feasibility, improvements, mockup direction, folder structure
- Phase 2 = milestones, estimated dates, and payment pace options
- When useful, mention strengths, weaknesses, risks, or unanswered questions
- If something should be a clear decision, be direct
- If the user is brainstorming, help generate and refine ideas
- Keep the response useful, not fluffy
- If helpful, label the outcome as:
  - agreed principle
  - brainstorm possibility
  - unresolved decision
`.trim();

const HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MyCoderCrew</title>
  <style>
    :root{
      --bg:#f6f8fc;
      --panel:#ffffff;
      --panel2:#f9fbff;
      --line:#dbe3ef;
      --text:#132033;
      --muted:#64748b;
      --brand:#3b82f6;
      --brand2:#2563eb;
      --shadow:0 12px 30px rgba(20,32,51,.08);
      --radius:18px;
    }
    body.dark{
      --bg:#0b1220;
      --panel:#111a2b;
      --panel2:#0f1728;
      --line:#233046;
      --text:#e5eefc;
      --muted:#9fb0c8;
      --shadow:0 12px 30px rgba(0,0,0,.25);
      --brand:#60a5fa;
      --brand2:#3b82f6;
    }
    *{box-sizing:border-box}
    html,body{height:100%}
    body{
      margin:0;
      font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      color:var(--text);
      background:
        radial-gradient(circle at top left, rgba(59,130,246,.10), transparent 30%),
        radial-gradient(circle at top right, rgba(37,99,235,.08), transparent 25%),
        var(--bg);
    }
    .app{display:grid; grid-template-rows:74px 1fr; height:100vh}
    .topbar{
      display:flex; align-items:center; justify-content:space-between; gap:16px;
      padding:14px 20px; border-bottom:1px solid var(--line);
      background:rgba(255,255,255,.7); backdrop-filter: blur(14px);
    }
    body.dark .topbar{background:rgba(11,18,32,.72)}
    .brand{display:flex; align-items:center; gap:12px}
    .mark{
      width:40px; height:40px; border-radius:14px;
      background:linear-gradient(135deg,var(--brand),var(--brand2));
      display:grid; place-items:center; color:#fff; font-weight:800;
      box-shadow:0 10px 20px rgba(37,99,235,.28)
    }
    .brand h1{margin:0;font-size:18px}
    .brand p{margin:2px 0 0;font-size:12px;color:var(--muted)}
    .top-actions{display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end}
    .btn{
      border:1px solid var(--line); background:var(--panel);
      color:var(--text); border-radius:999px; padding:10px 14px;
      cursor:pointer; font-size:14px; transition:.15s;
    }
    .btn:hover{transform:translateY(-1px); box-shadow:var(--shadow)}
    .btn.primary{background:linear-gradient(135deg,var(--brand),var(--brand2)); color:#fff; border-color:transparent}
    .btn.soft{background:var(--panel2)}
    .info{
      display:inline-flex; align-items:center; justify-content:center;
      width:18px; height:18px; margin-left:6px;
      border-radius:50%; border:1px solid var(--line); color:var(--brand2);
      background:#fff; font-size:12px; font-weight:700; cursor:pointer;
    }
    body.dark .info{background:#0f1728}
    .main{
      display:grid;
      grid-template-columns: 280px 1fr 320px;
      gap:16px;
      padding:16px;
      min-height:0;
    }
    .panel{
      background:rgba(255,255,255,.88); backdrop-filter: blur(14px);
      border:1px solid var(--line); border-radius:var(--radius); box-shadow:var(--shadow);
      min-height:0; overflow:hidden;
    }
    body.dark .panel{background:rgba(17,26,43,.88)}
    .ph{
      display:flex; align-items:center; justify-content:space-between; gap:10px;
      padding:14px 16px; border-bottom:1px solid var(--line);
    }
    .ph h2{margin:0;font-size:15px}
    .ph small{display:block; color:var(--muted); font-size:12px; margin-top:2px}
    .pb{padding:14px 16px; overflow:auto; height:100%}

    .stack{display:flex; flex-direction:column; gap:10px}
    .item{
      display:flex; align-items:center; justify-content:space-between; gap:10px;
      padding:11px 12px; border:1px solid var(--line); border-radius:14px; background:var(--panel);
    }
    .item:hover{border-color:color-mix(in srgb, var(--line), var(--brand) 20%)}
    .item .name{display:flex; align-items:center; gap:10px; min-width:0}
    .folder,.doc{
      width:18px; height:18px; border-radius:5px; flex:0 0 auto;
      box-shadow: inset 0 -2px 0 rgba(0,0,0,.08);
    }
    .folder{background:linear-gradient(135deg,#fbbf24,#f59e0b)}
    .doc{background:linear-gradient(135deg,#93c5fd,#60a5fa)}
    .title{white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:14px}
    .tag{
      font-size:11px; padding:5px 8px; border-radius:999px; border:1px solid var(--line);
      background:var(--panel2); color:#334155; white-space:nowrap;
    }
    .tag.ok{background:#ecfdf5; border-color:#bbf7d0; color:#166534}
    .tag.warn{background:#fff8e7; border-color:#fde68a; color:#a16207}
    .tag.info{background:#eff6ff; border-color:#bfdbfe; color:#1d4ed8}
    body.dark .tag.ok{background:rgba(22,101,52,.2); border-color:rgba(187,247,208,.18); color:#8be0a6}
    body.dark .tag.warn{background:rgba(161,98,7,.2); border-color:rgba(253,230,138,.18); color:#f6c66a}
    body.dark .tag.info{background:rgba(29,78,216,.2); border-color:rgba(191,219,254,.18); color:#b8d6ff}

    .center{
      display:grid; grid-template-rows:auto auto 1fr auto; min-width:0; min-height:0;
    }
    .meta{
      display:flex; gap:10px; flex-wrap:wrap; padding:14px 16px 0;
    }
    .pill{
      display:inline-flex; align-items:center; gap:8px;
      padding:8px 12px; border:1px solid var(--line); border-radius:999px;
      background:var(--panel); font-size:12px;
    }
    .threadbar{
      display:flex; gap:8px; flex-wrap:wrap; padding:12px 16px 0;
    }
    .thread{
      border:1px solid var(--line); background:var(--panel);
      color:var(--text); border-radius:999px; padding:8px 12px; font-size:12px; cursor:pointer;
    }
    .thread.active{background:linear-gradient(135deg,var(--brand),var(--brand2)); color:#fff; border-color:transparent}
    .chat{
      margin:14px 16px 0; border:1px solid var(--line); border-radius:18px;
      background:linear-gradient(180deg, var(--panel), var(--panel2));
      min-height:320px; max-height:72vh; resize:vertical; overflow:hidden; display:flex; flex-direction:column;
    }
    .chathead{
      display:flex; align-items:center; justify-content:space-between; gap:10px;
      padding:12px 14px; border-bottom:1px solid var(--line); background:var(--panel);
    }
    .chathead .left{display:flex; align-items:center; gap:10px}
    .chathead strong{font-size:14px}
    .chatbody{padding:14px; overflow:auto; display:flex; flex-direction:column; gap:12px; flex:1}
    .bubble{
      max-width:82%; border:1px solid var(--line); border-radius:16px; padding:12px 14px;
      background:var(--panel); box-shadow:0 4px 14px rgba(20,32,51,.04);
    }
    .bubble.user{margin-left:auto; background:color-mix(in srgb, var(--brand) 8%, var(--panel))}
    .bubble.system{max-width:100%; opacity:.95; background:color-mix(in srgb, var(--brand) 4%, var(--panel))}
    .bubble .top{display:flex; justify-content:space-between; gap:10px; font-size:12px; color:var(--muted); margin-bottom:6px}
    .bubble .txt{font-size:14px; line-height:1.55; white-space:pre-wrap}
    .acts{display:flex; gap:8px; flex-wrap:wrap; margin-top:10px}
    .mini{
      border:1px solid var(--line); background:var(--panel); color:var(--text);
      border-radius:999px; padding:7px 10px; font-size:12px; cursor:pointer;
    }
    .composer{
      display:flex; gap:10px; align-items:flex-end; padding:14px 16px 16px;
      border-top:1px solid var(--line); background:var(--panel);
    }
    .composer textarea{
      flex:1; min-height:58px; max-height:160px; resize:vertical;
      border:1px solid var(--line); border-radius:14px; background:var(--panel);
      color:var(--text); font-family:inherit; font-size:14px; padding:12px 13px; outline:none;
    }
    .composer textarea:focus{border-color:color-mix(in srgb, var(--brand) 55%, var(--line)); box-shadow:0 0 0 4px rgba(59,130,246,.10)}
    .composer button{min-width:110px}
    .section{margin-top:16px}
    .section h3{margin:0 0 10px; font-size:13px}
    .library,.crew{display:grid; gap:10px}
    .library-item,.crew-card{
      border:1px solid var(--line); border-radius:14px; padding:12px; background:var(--panel);
    }
    .library-item{display:flex; align-items:flex-start; justify-content:space-between; gap:12px}
    .library-item strong{display:block; font-size:13px; margin-bottom:4px}
    .library-item span,.crew-card span{display:block; font-size:12px; color:var(--muted); line-height:1.45}
    .crew{grid-template-columns:repeat(2,minmax(0,1fr))}
    .crew-card .name{font-weight:700; margin-bottom:4px; font-size:13px}
    .small{font-size:12px;color:var(--muted)}
    .modal{
      position:fixed; inset:0; background:rgba(3,7,18,.45); display:none;
      align-items:center; justify-content:center; padding:20px; z-index:50;
    }
    .modal.show{display:flex}
    .modalbox{
      width:min(560px, 100%); background:var(--panel); border:1px solid var(--line);
      border-radius:20px; box-shadow:var(--shadow); padding:18px;
    }
    .modalbox h4{margin:0 0 8px}
    .modalbox p{margin:0; color:var(--muted); line-height:1.55}
    .modalbox .row{display:flex; justify-content:flex-end; margin-top:16px}
    @media (max-width: 1240px){
      .main{grid-template-columns: 260px 1fr; grid-template-rows:auto auto}
      .right{grid-column:1/-1}
    }
    @media (max-width: 900px){
      .main{grid-template-columns:1fr}
      .crew{grid-template-columns:1fr}
      .topbar{flex-direction:column; align-items:flex-start}
      .top-actions{justify-content:flex-start}
      .chat{max-height:none}
    }
  </style>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <div class="mark">CC</div>
        <div>
          <h1>MyCoderCrew</h1>
          <p>Organized AI software building for nontechnical founders</p>
        </div>
      </div>

      <div class="top-actions">
        <div id="projectPills"></div>
        <button class="btn soft" id="newChatBtn">New Chat <span class="info info-icon" data-info="Start a new conversation thread inside the same project.">i</span></button>
        <button class="btn soft" id="newProjectBtn">New Project <span class="info info-icon" data-info="Create a separate workspace for a different idea.">i</span></button>
        <button class="btn soft" id="themeBtn">Light Mode</button>
        <button class="btn primary">Get Started</button>
      </div>
    </header>

    <main class="main">
      <aside class="panel left">
        <div class="ph">
          <div><h2>Project Files</h2><small>Organized folder tree</small></div>
          <span class="info info-icon" data-info="This is the proposed file tree for the current project.">i</span>
        </div>
        <div class="pb stack" id="fileTree"></div>
      </aside>

      <section class="panel center">
        <div class="meta" id="projectMeta"></div>
        <div class="threadbar" id="threadBar"></div>

        <div class="chat">
          <div class="chathead">
            <div class="left">
              <strong id="chatTitle">Conversation</strong>
              <span class="info info-icon" data-info="Use the chat to shape the idea, save good outputs, and move prompts between projects.">i</span>
            </div>
            <div class="small">Resizable chat area</div>
          </div>
          <div class="chatbody" id="chatBody"></div>
          <div class="composer">
            <textarea id="messageInput" placeholder="Ask MyCoderCrew to refine the idea, generate a mockup, or create a build plan..."></textarea>
            <button class="btn primary" id="sendBtn">Send</button>
          </div>
        </div>
      </section>

      <aside class="panel right">
        <div class="ph">
          <div><h2>Needs Approval</h2><small>Open decisions and next steps</small></div>
          <span class="info info-icon" data-info="This panel shows the decisions waiting on the user.">i</span>
        </div>
        <div class="pb">
          <div class="stack" id="approvals"></div>

          <div class="section">
            <h3>Library</h3>
            <div class="library" id="library"></div>
          </div>

          <div class="section">
            <h3>Uploads</h3>
            <div class="library" id="uploads"></div>
          </div>

          <div class="section">
            <h3>Meet the Crew</h3>
            <div class="crew">
              <div class="crew-card"><div class="name">Commander</div><span>Keeps scope under control and moves the project forward.</span></div>
              <div class="crew-card"><div class="name">Architect</div><span>Shapes the structure, file tree, and screen flow.</span></div>
              <div class="crew-card"><div class="name">Tester</div><span>Verifies the work and confirms milestone readiness.</span></div>
              <div class="crew-card"><div class="name">Finisher</div><span>Cleans up and prepares the final delivery package.</span></div>
            </div>
          </div>
        </div>
      </aside>
    </main>
  </div>

  <div class="modal" id="modal">
    <div class="modalbox">
      <h4 id="modalTitle">Info</h4>
      <p id="modalText"></p>
      <div class="row"><button class="btn" id="modalClose">Close</button></div>
    </div>
  </div>

<script>
let appState = null;
let activeProjectId = null;
let activeThreadId = null;

const $ = (sel) => document.querySelector(sel);

function esc(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function fmtDate(iso){
  try{
    return new Date(iso).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  }catch{
    return '';
  }
}

function currentProject(){
  if(!appState?.projects?.length) return null;
  return appState.projects.find(p => p.id === activeProjectId) || appState.projects[0];
}

function currentThread(){
  const project = currentProject();
  if(!project?.threads?.length) return null;
  return project.threads.find(t => t.id === activeThreadId) || project.threads[0];
}

function syncSelection(){
  if(!appState) return;
  if(!appState.projects?.length) return;
  if(!activeProjectId || !appState.projects.some(p => p.id === activeProjectId)){
    activeProjectId = appState.activeProjectId || appState.projects[0].id;
  }
  const project = currentProject();
  if(project && (!activeThreadId || !project.threads.some(t => t.id === activeThreadId))){
    activeThreadId = project.activeThreadId || project.threads[0].id;
  }
}

function openModal(title, text){
  $('#modalTitle').textContent = title;
  $('#modalText').textContent = text;
  $('#modal').classList.add('show');
}

function closeModal(){
  $('#modal').classList.remove('show');
}

async function api(url, method='GET', body=null){
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if(body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if(!res.ok){
    const text = await res.text();
    throw new Error(text || 'Request failed');
  }
  return res.json();
}

function themeFromStorage(){
  return localStorage.getItem('mycodercrew-theme') || 'light';
}

function applyTheme(){
  const theme = themeFromStorage();
  document.body.classList.toggle('dark', theme === 'dark');
  $('#themeBtn').textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
}

function render(){
  syncSelection();
  renderProjects();
  renderMeta();
  renderThreads();
  renderTree();
  renderChat();
  renderApprovals();
  renderLibrary();
  renderUploads();
}

function renderProjects(){
  const el = $('#projectPills');
  el.innerHTML = appState.projects.map(p => {
    const active = p.id === activeProjectId ? 'active' : '';
    return '<button class="thread ' + active + '" data-project="' + p.id + '">' + esc(p.name) + '</button>';
  }).join('');
}

function renderMeta(){
  const p = currentProject();
  $('#projectMeta').innerHTML = [
    '<div class="pill">Project: <strong>' + esc(p.name) + '</strong></div>',
    '<div class="pill">Phase: <strong>' + esc(p.phase) + '</strong></div>',
    '<div class="pill">Status: <strong>' + esc(p.status) + '</strong></div>'
  ].join('');
}

function renderThreads(){
  const project = currentProject();
  $('#threadBar').innerHTML = project.threads.map(t => {
    const active = t.id === activeThreadId ? 'active' : '';
    return '<button class="thread ' + active + '" data-thread="' + t.id + '">' + esc(t.name) + '</button>';
  }).join('');
  $('#chatTitle').textContent = currentThread()?.name || 'Conversation';
}

function bubbleActions(message){
  if(message.role === 'system') return '';
  return '<div class="acts">' +
    '<button class="mini" data-save="' + message.id + '">Save to library</button>' +
    '<button class="mini" data-move="' + message.id + '">Move</button>' +
  '</div>';
}

function renderChat(){
  const thread = currentThread();
  if(!thread){
    $('#chatBody').innerHTML = '';
    return;
  }
  $('#chatBody').innerHTML = thread.messages.map(m => {
    const cls = m.role === 'user' ? 'user' : (m.role === 'system' ? 'system' : 'assistant');
    return (
      '<div class="bubble ' + cls + '">' +
        '<div class="top"><span>' + esc(m.speaker || m.role) + '</span><span>' + esc(fmtDate(m.createdAt)) + '</span></div>' +
        '<div class="txt">' + esc(m.text).replaceAll('\\n','<br>') + '</div>' +
        bubbleActions(m) +
      '</div>'
    );
  }).join('');
  $('#chatBody').scrollTop = $('#chatBody').scrollHeight;
}

function renderTree(){
  const project = currentProject();
  $('#fileTree').innerHTML = project.files.map(f => {
    const icon = f.type === 'folder' ? '<div class="folder"></div>' : '<div class="doc"></div>';
    return (
      '<div class="item">' +
        '<div class="name">' + icon + '<span class="title">' + esc(f.name) + '</span></div>' +
        '<span class="tag ' + (f.locked ? 'warn' : 'ok') + '">' + esc(f.locked ? 'locked' : 'open') + '</span>' +
      '</div>'
    );
  }).join('');
}

function renderApprovals(){
  const project = currentProject();
  $('#approvals').innerHTML = project.approvals.map(a => {
    return (
      '<div class="item">' +
        '<div>' +
          '<div><strong>' + esc(a.title) + '</strong></div>' +
          '<div class="small" style="margin-top:5px">' + esc(a.detail) + '</div>' +
        '</div>' +
        '<button class="tag ' + (a.done ? 'ok' : 'warn') + '" data-approval="' + a.id + '">' + esc(a.done ? 'done' : 'needs review') + '</button>' +
      '</div>'
    );
  }).join('');
}

function renderLibrary(){
  const project = currentProject();
  if(!project.library.length){
    $('#library').innerHTML = '<div class="small">Nothing saved yet.</div>';
    return;
  }
  $('#library').innerHTML = project.library.map(item => {
    return (
      '<div class="library-item">' +
        '<div>' +
          '<strong>' + esc(item.title) + '</strong>' +
          '<span>' + esc(item.content) + '</span>' +
        '</div>' +
        '<button class="mini" data-openlib="' + item.id + '">Open</button>' +
      '</div>'
    );
  }).join('');
}

function renderUploads(){
  const project = currentProject();
  $('#uploads').innerHTML = project.uploads.map(item => {
    return (
      '<div class="library-item">' +
        '<div>' +
          '<strong>' + esc(item.title) + '</strong>' +
          '<span>' + esc(item.detail) + '</span>' +
        '</div>' +
        '<button class="mini" data-openupload="' + item.id + '">Open</button>' +
      '</div>'
    );
  }).join('');
}

async function loadState(){
  appState = await api('/api/state');
  syncSelection();
  applyTheme();
  render();
}

async function sendMessage(){
  const input = $('#messageInput');
  const text = input.value.trim();
  if(!text) return;
  input.value = '';
  const project = currentProject();
  const thread = currentThread();
  await api('/api/projects/' + project.id + '/chat', 'POST', { threadId: thread.id, message: text });
  await loadState();
}

async function newProject(){
  const name = prompt('Name the new project:', 'New Project');
  if(!name) return;
  const result = await api('/api/projects', 'POST', { name });
  appState = result.state;
  activeProjectId = result.activeProjectId;
  activeThreadId = result.activeThreadId;
  await loadState();
}

async function newChat(){
  const project = currentProject();
  const name = prompt('Name the new chat thread:', 'Brainstorm');
  if(!name) return;
  const result = await api('/api/projects/' + project.id + '/threads', 'POST', { name });
  appState = result.state;
  activeProjectId = result.activeProjectId;
  activeThreadId = result.activeThreadId;
  await loadState();
}

async function saveToLibrary(messageId){
  const project = currentProject();
  const thread = currentThread();
  const msg = thread.messages.find(m => m.id === messageId);
  if(!msg) return;
  const title = prompt('Library title:', msg.text.slice(0, 42));
  if(!title) return;
  await api('/api/projects/' + project.id + '/library', 'POST', {
    threadId: thread.id,
    messageId,
    title,
    content: msg.text
  });
  await loadState();
}

async function moveMessage(messageId){
  const sourceProject = currentProject();
  const targetName = prompt('Type the destination project name exactly:');
  if(!targetName) return;
  const targetProject = appState.projects.find(p => p.name.toLowerCase() === targetName.toLowerCase().trim());
  if(!targetProject){
    alert('Project not found.');
    return;
  }
  await api('/api/projects/' + sourceProject.id + '/messages/' + messageId + '/move', 'POST', {
    targetProjectId: targetProject.id,
    targetThreadId: targetProject.activeThreadId || targetProject.threads[0].id
  });
  await loadState();
}

function openLibraryItem(itemId){
  const p = currentProject();
  const item = p.library.find(x => x.id === itemId);
  if(!item) return;
  openModal(item.title, item.content);
}

function openUploadItem(itemId){
  const p = currentProject();
  const item = p.uploads.find(x => x.id === itemId);
  if(!item) return;
  openModal(item.title, item.detail);
}

function toggleTheme(){
  const next = themeFromStorage() === 'dark' ? 'light' : 'dark';
  localStorage.setItem('mycodercrew-theme', next);
  applyTheme();
}

document.addEventListener('click', async (e) => {
  const info = e.target.closest('.info-icon');
  if(info){
    e.stopPropagation();
    openModal('Info', info.dataset.info || 'Help text');
    return;
  }

  const projectBtn = e.target.closest('[data-project]');
  if(projectBtn){
    activeProjectId = projectBtn.dataset.project;
    const p = appState.projects.find(x => x.id === activeProjectId);
    activeThreadId = p.activeThreadId || p.threads[0].id;
    await api('/api/projects/' + activeProjectId + '/select', 'POST');
    await loadState();
    return;
  }

  const threadBtn = e.target.closest('[data-thread]');
  if(threadBtn){
    activeThreadId = threadBtn.dataset.thread;
    await api('/api/projects/' + activeProjectId + '/threads/' + activeThreadId + '/select', 'POST');
    await loadState();
    return;
  }

  const saveBtn = e.target.closest('[data-save]');
  if(saveBtn){
    await saveToLibrary(saveBtn.dataset.save);
    return;
  }

  const moveBtn = e.target.closest('[data-move]');
  if(moveBtn){
    await moveMessage(moveBtn.dataset.move);
    return;
  }

  const approvalBtn = e.target.closest('[data-approval]');
  if(approvalBtn){
    await api('/api/projects/' + activeProjectId + '/approvals/' + approvalBtn.dataset.approval + '/toggle', 'POST');
    await loadState();
    return;
  }

  const openLibBtn = e.target.closest('[data-openlib]');
  if(openLibBtn){
    openLibraryItem(openLibBtn.dataset.openlib);
    return;
  }

  const openUploadBtn = e.target.closest('[data-openupload]');
  if(openUploadBtn){
    openUploadItem(openUploadBtn.dataset.openupload);
    return;
  }
});

$('#newProjectBtn').addEventListener('click', newProject);
$('#newChatBtn').addEventListener('click', newChat);
$('#themeBtn').addEventListener('click', toggleTheme);
$('#sendBtn').addEventListener('click', sendMessage);
$('#modalClose').addEventListener('click', closeModal);
$('#modal').addEventListener('click', (e) => { if(e.target.id === 'modal') closeModal(); });
$('#messageInput').addEventListener('keydown', (e) => {
  if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
    sendMessage();
  }
});

loadState().catch(err => {
  openModal('Startup error', String(err.message || err));
});
</script>
</body>
</html>`;

function now() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}_${randomUUID()}`;
}

function makeDefaultFiles() {
  return [
    { id: uid("file"), name: "/coder-crew-app", type: "folder", locked: false },
    { id: uid("file"), name: "/phase-1-idea", type: "folder", locked: false },
    { id: uid("file"), name: "folder-structure.md", type: "file", locked: false },
    { id: uid("file"), name: "mockup-homepage.png", type: "file", locked: false },
    { id: uid("file"), name: "/phase-2-build", type: "folder", locked: true },
    { id: uid("file"), name: "milestone-plan.md", type: "file", locked: true },
    { id: uid("file"), name: "deliverables.zip", type: "file", locked: true }
  ];
}

function makeDefaultApprovals() {
  return [
    {
      id: uid("approval"),
      title: "Approve folder structure",
      detail: "Confirm the Phase 1 file tree before the next build step.",
      done: false
    },
    {
      id: uid("approval"),
      title: "Pick mockup style",
      detail: "Light mode is the default, with dark mode available as an option.",
      done: true
    },
    {
      id: uid("approval"),
      title: "Choose pace option",
      detail: "Select slower payments or faster payoff for the same total project price.",
      done: false
    }
  ];
}

function makeDefaultLibrary() {
  return [
    {
      id: uid("lib"),
      title: "Marketing slogan",
      content: "Your Idea. Our Crew. Working Software.",
      sourceThreadId: null,
      sourceMessageId: null,
      createdAt: now()
    },
    {
      id: uid("lib"),
      title: "Saved note",
      content: "Phase 1 output = folder structure + visual mockup.",
      sourceThreadId: null,
      sourceMessageId: null,
      createdAt: now()
    }
  ];
}

function makeDefaultUploads() {
  return [
    {
      id: uid("upload"),
      title: "Screenshot upload",
      detail: "Reference UI from another app."
    },
    {
      id: uid("upload"),
      title: "ZIP import",
      detail: "Existing project files preserved and organized."
    }
  ];
}

function makeThread(name) {
  const threadId = uid("thread");
  return {
    id: threadId,
    name,
    messages: [
      {
        id: uid("msg"),
        role: "assistant",
        speaker: "Commander",
        text: "Your project looks promising, and my research suggests it has real potential. If you’d like to move forward, I can create a build plan with milestones, estimated completion dates, and payment pace options.",
        createdAt: now()
      }
    ]
  };
}

function makeProject(name) {
  const firstThread = makeThread("Idea Shaping");
  return {
    id: uid("proj"),
    name,
    phase: "Phase 1: Idea Shaping",
    status: "Promising",
    activeThreadId: firstThread.id,
    threads: [firstThread],
    files: makeDefaultFiles(),
    approvals: makeDefaultApprovals(),
    library: makeDefaultLibrary(),
    uploads: makeDefaultUploads(),
    createdAt: now(),
    updatedAt: now()
  };
}

function makeDefaultState() {
  const project = makeProject("Launch SaaS MVP");
  return {
    version: 1,
    theme: "light",
    activeProjectId: project.id,
    projects: [project]
  };
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadState() {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed?.projects?.length) throw new Error("Invalid state");
    return parsed;
  } catch {
    const fresh = makeDefaultState();
    await saveState(fresh);
    return fresh;
  }
}

async function saveState(nextState) {
  await ensureDataDir();
  await fs.writeFile(STATE_FILE, JSON.stringify(nextState, null, 2), "utf8");
}

let state = await loadState();

function sanitizeState() {
  return state;
}

function getProject(projectId) {
  return state.projects.find((p) => p.id === projectId);
}

function getThread(project, threadId) {
  return project?.threads.find((t) => t.id === threadId);
}

function findMessage(project, messageId) {
  for (const thread of project.threads) {
    const message = thread.messages.find((m) => m.id === messageId);
    if (message) return { thread, message };
  }
  return null;
}

function buildResponsesInput(thread) {
  return thread.messages
    .slice(-12)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.text
    }));
}

function extractOutputText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }
  const parts = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") parts.push(content.text);
      if (typeof content?.output_text === "string") parts.push(content.output_text);
    }
  }
  return parts.join("\n").trim();
}

function fallbackReply(message) {
  const lower = String(message || "").toLowerCase();
  if (lower.includes("mockup")) return "That’s a strong direction. I’d keep the mockup light, clean, and easy to scan, then use the file tree to show exactly what will be built.";
  if (lower.includes("milestone")) return "A milestone plan works best when each milestone ends with something visible, testable, and easy to approve.";
  if (lower.includes("folder")) return "The folder structure should stay simple and predictable: idea, mockups, build, tests, docs, and handoff.";
  return "That’s a solid step forward. I’d keep it organized, save the useful output to the library, and turn the strongest idea into the next concrete artifact.";
}

app.get("/api/state", (req, res) => {
  res.json(sanitizeState());
});

app.post("/api/projects", async (req, res) => {
  const name = String(req.body?.name || "").trim() || "New Project";
  const project = makeProject(name);
  state.projects.unshift(project);
  state.activeProjectId = project.id;
  await saveState(state);
  res.json({
    ok: true,
    state: sanitizeState(),
    activeProjectId: project.id,
    activeThreadId: project.activeThreadId
  });
});

app.post("/api/projects/:projectId/select", async (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });
  state.activeProjectId = project.id;
  await saveState(state);
  res.json({ ok: true, state: sanitizeState() });
});

app.post("/api/projects/:projectId/threads", async (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const name = String(req.body?.name || "").trim() || `Chat ${project.threads.length + 1}`;
  const thread = makeThread(name);
  project.threads.unshift(thread);
  project.activeThreadId = thread.id;
  project.updatedAt = now();
  state.activeProjectId = project.id;
  await saveState(state);
  res.json({
    ok: true,
    state: sanitizeState(),
    activeProjectId: project.id,
    activeThreadId: thread.id
  });
});

app.post("/api/projects/:projectId/threads/:threadId/select", async (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });
  const thread = getThread(project, req.params.threadId);
  if (!thread) return res.status(404).json({ error: "Thread not found" });
  project.activeThreadId = thread.id;
  state.activeProjectId = project.id;
  await saveState(state);
  res.json({ ok: true, state: sanitizeState() });
});

app.post("/api/projects/:projectId/chat", async (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const threadId = String(req.body?.threadId || project.activeThreadId || "").trim();
  const message = String(req.body?.message || "").trim();
  const thread = getThread(project, threadId);

  if (!thread) return res.status(404).json({ error: "Thread not found" });
  if (!message) return res.status(400).json({ error: "Message required" });

  thread.messages.push({
    id: uid("msg"),
    role: "user",
    speaker: "You",
    text: message,
    createdAt: now()
  });

  let answer = "";
  if (client) {
    try {
      const response = await client.responses.create({
        model: MODEL,
        instructions: SYSTEM_INSTRUCTIONS,
        input: buildResponsesInput(thread)
      });
      answer = extractOutputText(response);
    } catch (err) {
      answer = fallbackReply(message);
    }
  } else {
    answer = "OpenAI is not configured yet on the server. Add OPENAI_API_KEY in the environment and the crew will answer here.";
  }

  if (!answer) answer = fallbackReply(message);

  thread.messages.push({
    id: uid("msg"),
    role: "assistant",
    speaker: "Commander",
    text: answer,
    createdAt: now()
  });

  project.updatedAt = now();
  state.activeProjectId = project.id;
  await saveState(state);
  res.json({ ok: true, state: sanitizeState() });
});

app.post("/api/projects/:projectId/library", async (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const threadId = String(req.body?.threadId || "").trim();
  const messageId = String(req.body?.messageId || "").trim();
  const title = String(req.body?.title || "").trim() || "Saved note";
  const content = String(req.body?.content || "").trim();

  if (!content) return res.status(400).json({ error: "content required" });

  project.library.unshift({
    id: uid("lib"),
    title,
    content,
    sourceThreadId: threadId || null,
    sourceMessageId: messageId || null,
    createdAt: now()
  });

  project.updatedAt = now();
  await saveState(state);
  res.json({ ok: true, state: sanitizeState() });
});

app.post("/api/projects/:projectId/messages/:messageId/move", async (req, res) => {
  const sourceProject = getProject(req.params.projectId);
  if (!sourceProject) return res.status(404).json({ error: "Project not found" });

  const targetProject = getProject(String(req.body?.targetProjectId || "").trim());
  if (!targetProject) return res.status(404).json({ error: "Target project not found" });

  const targetThread = getThread(targetProject, String(req.body?.targetThreadId || "").trim()) || targetProject.threads[0];
  if (!targetThread) return res.status(404).json({ error: "Target thread not found" });

  const hit = findMessage(sourceProject, req.params.messageId);
  if (!hit) return res.status(404).json({ error: "Message not found" });

  const movedText = hit.message.text;
  targetThread.messages.push({
    id: uid("msg"),
    role: "system",
    speaker: "System",
    text: `Moved from ${sourceProject.name} / ${hit.thread.name}:\n${movedText}`,
    createdAt: now()
  });

  targetProject.updatedAt = now();
  await saveState(state);
  res.json({ ok: true, state: sanitizeState() });
});

app.post("/api/projects/:projectId/approvals/:approvalId/toggle", async (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const approval = project.approvals.find((a) => a.id === req.params.approvalId);
  if (!approval) return res.status(404).json({ error: "Approval not found" });

  approval.done = !approval.done;
  project.updatedAt = now();
  await saveState(state);
  res.json({ ok: true, state: sanitizeState() });
});

app.get("/", (req, res) => {
  res.type("html").send(HTML);
});

app.listen(PORT, () => {
  console.log(`MyCoderCrew running on http://localhost:${PORT}`);
});
