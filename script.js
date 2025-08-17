// admin.js — modular compat version using compat SDK already loaded in HTML

// Firebase config (use your SDK)
const firebaseConfig = {
  apiKey: "AIzaSyChSY98ZLBYuyIKqzXqQxrJsO_X5nQA348",
  authDomain: "goalseer-3b711.firebaseapp.com",
  projectId: "goalseer-3b711",
  storageBucket: "goalseer-3b711.firebasestorage.app",
  messagingSenderId: "738240427316",
  appId: "1:738240427316:web:b67cf3b5248665e2dc2161",
  measurementId: "G-0HKV6Y5QFG"
};

// Initialize compat SDK
firebase.initializeApp(firebaseConfig);
try { firebase.analytics?.(); } catch(e){}
const db = firebase.firestore();
const FieldValue = firebase.firestore.FieldValue;

// DOM references
const freeForm = document.getElementById('freeForm');
const vipForm = document.getElementById('vipForm');
const freeList = document.getElementById('freeList');
const vipList = document.getElementById('vipList');
document.getElementById('year').textContent = new Date().getFullYear();
document.getElementById('clearFree').addEventListener('click', ()=> freeForm.reset());
document.getElementById('clearVip').addEventListener('click', ()=> vipForm.reset());

// ---- Publish daily free tips (3 docs) ----
freeForm.addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const m1 = document.getElementById('free1').value.trim();
  const s1 = document.getElementById('free1Status').value;
  const m2 = document.getElementById('free2').value.trim();
  const s2 = document.getElementById('free2Status').value;
  const m3 = document.getElementById('free3').value.trim();
  const s3 = document.getElementById('free3Status').value;

  const matches = [
    {match: m1, status: s1},
    {match: m2, status: s2},
    {match: m3, status: s3}
  ].filter(x => x.match);

  if(!matches.length){ alert('Enter at least one match'); return; }

  try{
    // Optionally remove today's previous entries (not implemented) — we append new docs
    const batch = db.batch();
    matches.forEach(m=>{
      const ref = db.collection('dailyFree').doc();
      batch.set(ref, { match: m.match, status: m.status, ts: FieldValue.serverTimestamp() });
    });
    await batch.commit();
    freeForm.reset();
    flash('Free tips published');
  }catch(err){
    console.error(err); alert('Failed to publish free tips');
  }
});

// ---- Add VIP tip ----
vipForm.addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const level = document.getElementById('vipLevel').value;
  const match = document.getElementById('vipMatch').value.trim();
  const odds = document.getElementById('vipOdds').value.trim();
  const status = document.getElementById('vipStatus').value;

  if(!match){ alert('Enter match'); return; }

  try{
    await db.collection('vipTips').add({
      level, match, odds, status, ts: FieldValue.serverTimestamp()
    });
    vipForm.reset();
    flash('VIP tip added');
  }catch(e){
    console.error(e); alert('Failed to add VIP tip');
  }
});

// ---- Render lists realtime with status select, edit & delete ----

// Helper: render status select element
function createStatusSelect(docId, ctx, currentStatus){
  const sel = document.createElement('select');
  sel.className = 'select-status';
  ['PENDING','WIN','LOSS'].forEach(s=>{
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    if(s === (currentStatus||'PENDING')) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', async (e)=>{
    const newStatus = e.target.value;
    try{
      const ref = ctx === 'free' ? db.collection('dailyFree').doc(docId) : db.collection('vipTips').doc(docId);
      await ref.update({ status: newStatus });
      flash('Status updated');
    }catch(err){ console.error(err); alert('Failed to update status'); }
  });
  return sel;
}

// Realtime free tips
db.collection('dailyFree').orderBy('ts','desc').onSnapshot(snapshot=>{
  freeList.innerHTML = '';
  if(snapshot.empty){ freeList.innerHTML = '<div class="tip">No free tips yet.</div>'; return; }
  snapshot.forEach(docSnap=>{
    const d = docSnap.data(); const id = docSnap.id;
    const row = document.createElement('div'); row.className = 'tip';
    const left = document.createElement('div'); left.className='meta';
    left.innerHTML = `<strong>${escape(d.match)}</strong>`;
    const right = document.createElement('div'); right.style.display='flex'; right.style.gap='8px'; right.style.alignItems='center';

    // status select
    right.appendChild(createStatusSelect(id, 'free', d.status));

    // edit button
    const editBtn = document.createElement('button'); editBtn.textContent='Edit';
    editBtn.addEventListener('click', async ()=> {
      const newMatch = prompt('Edit match', d.match || '');
      if(newMatch === null) return;
      const newStatus = prompt('Status (PENDING / WIN / LOSS)', d.status || 'PENDING');
      if(newStatus === null) return;
      try{
        await db.collection('dailyFree').doc(id).update({ match: newMatch.trim(), status: newStatus.trim().toUpperCase() });
        flash('Free tip updated');
      }catch(err){ console.error(err); alert('Update failed'); }
    });
    right.appendChild(editBtn);

    // delete button
    const delBtn = document.createElement('button'); delBtn.textContent='Delete';
    delBtn.addEventListener('click', async ()=>{
      if(!confirm('Delete this free tip?')) return;
      try{ await db.collection('dailyFree').doc(id).delete(); flash('Deleted'); } catch(err){ console.error(err); alert('Delete failed'); }
    });
    right.appendChild(delBtn);

    row.appendChild(left); row.appendChild(right);
    freeList.appendChild(row);
  });
});

// Realtime vip tips
db.collection('vipTips').orderBy('ts','desc').onSnapshot(snapshot=>{
  vipList.innerHTML = '';
  if(snapshot.empty){ vipList.innerHTML = '<div class="tip">No VIP tips yet.</div>'; return; }
  snapshot.forEach(docSnap=>{
    const d = docSnap.data(); const id = docSnap.id;
    const row = document.createElement('div'); row.className = 'tip';
    const left = document.createElement('div'); left.className='meta';
    left.innerHTML = `<strong>[${escape(d.level||'')}] ${escape(d.match||'')}</strong>${d.odds?` • ${escape(d.odds)}`:''}`;
    const right = document.createElement('div'); right.style.display='flex'; right.style.gap='8px'; right.style.alignItems='center';

    right.appendChild(createStatusSelect(id, 'vip', d.status));

    const editBtn = document.createElement('button'); editBtn.textContent='Edit';
    editBtn.addEventListener('click', async ()=> {
      const newLevel = prompt('Level (vip1 / vip2 / vip3)', d.level || 'vip1');
      if(newLevel === null) return;
      const newMatch = prompt('Match', d.match || '');
      if(newMatch === null) return;
      const newOdds = prompt('Odds (optional)', d.odds || '');
      if(newOdds === null) return;
      const newStatus = prompt('Status (PENDING / WIN / LOSS)', d.status || 'PENDING');
      if(newStatus === null) return;
      try{
        await db.collection('vipTips').doc(id).update({
          level: newLevel.trim(), match: newMatch.trim(), odds: newOdds.trim(), status: newStatus.trim().toUpperCase()
        });
        flash('VIP tip updated');
      }catch(err){ console.error(err); alert('Update failed'); }
    });
    right.appendChild(editBtn);

    const delBtn = document.createElement('button'); delBtn.textContent='Delete';
    delBtn.addEventListener('click', async ()=>{
      if(!confirm('Delete this VIP tip?')) return;
      try{ await db.collection('vipTips').doc(id).delete(); flash('Deleted'); } catch(err){ console.error(err); alert('Delete failed'); }
    });
    right.appendChild(delBtn);

    row.appendChild(left); row.appendChild(right);
    vipList.appendChild(row);
  });
});

// helpers
function escape(s){ return (s||'').toString().replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function flash(msg){
  const n = document.createElement('div');
  n.textContent = msg; n.style.position='fixed'; n.style.right='18px'; n.style.bottom='18px';
  n.style.padding='10px 14px'; n.style.background='rgba(0,0,0,0.8)'; n.style.color='white'; n.style.borderRadius='10px';
  document.body.appendChild(n); setTimeout(()=>n.remove(),2200);
}
