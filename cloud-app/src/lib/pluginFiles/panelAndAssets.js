export const panelPhp = {
  name: 'class-panel.php',
  path: 'includes/',
  language: 'php',
  code: `<?php
if (!defined('ABSPATH')) {
    exit;
}

class FixPilot_Panel {

    public static function init() {
        add_action('admin_footer', [__CLASS__, 'render_panel']);
        add_action('admin_enqueue_scripts', [__CLASS__, 'enqueue_assets']);
    }

    public static function enqueue_assets() {
        wp_enqueue_style('fixpilot-panel', FIXPILOT_PLUGIN_URL . 'assets/css/panel.css', [], FIXPILOT_VERSION);
        wp_enqueue_script('fixpilot-panel', FIXPILOT_PLUGIN_URL . 'assets/js/panel.js', [], FIXPILOT_VERSION, true);
        wp_localize_script('fixpilot-panel', 'FixPilotConfig', [
            'api_key' => fixpilot_get_api_key(),
            'cloud_url' => fixpilot_get_cloud_url(),
            'fingerprint' => fixpilot_get_fingerprint(),
            'rest_url' => rest_url('fixpilot/v1/'),
            'nonce' => wp_create_nonce('wp_rest'),
            'site_url' => home_url(),
        ]);
    }

    public static function render_panel() {
        ?>
        <div id="fixpilot-panel" class="fixpilot-panel">
            <div class="fixpilot-panel-header">
                <div class="fixpilot-panel-title">
                    <img src="https://media.base44.com/images/public/6a42567182c58083937d0c43/7b98fd004_FixPilotIcon.png" alt="FixPilot" class="fixpilot-panel-logo-icon" />
                    <span class="fixpilot-logo">FixPilot</span>
                    <span class="fixpilot-status">AI Online</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <button class="fixpilot-history-btn" onclick="fixpilotOpenHistory()" title="Chat history">&#9776;</button>
                    <button class="fixpilot-close" onclick="fixpilotToggle()">&times;</button>
                </div>
            </div>
            <div class="fixpilot-messages" id="fixpilot-messages">
                <div class="fixpilot-msg-ai">Hi! I'm FixPilot AI. Describe a WordPress issue and I'll research the best fix, confirm it with you, then apply it safely.</div>
            </div>
            <div id="fixpilot-history" class="fixpilot-history" style="display:none;">
                <div class="fixpilot-history-header">
                    <span>Chat History</span>
                    <div style="display:flex;gap:6px;">
                        <button class="fixpilot-history-back" onclick="fixpilotStartNewChat()">+ New</button>
                        <button class="fixpilot-history-back" onclick="fixpilotCloseHistory()">Back</button>
                    </div>
                </div>
                <div id="fixpilot-history-list" class="fixpilot-history-list"></div>
            </div>
            <div class="fixpilot-input-area">
                <input type="file" id="fixpilot-image-input" accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json,.zip" style="display:none" onchange="fixpilotHandleFileSelect(this)" />
                <button class="fixpilot-upload-btn" onclick="document.getElementById('fixpilot-image-input').click()">+</button>
                <textarea id="fixpilot-input" rows="3" placeholder="Describe an issue... (Shift+Enter for new line)"></textarea>
                <button id="fixpilot-send" onclick="fixpilotSend()">Send</button>
            </div>
            <div id="fixpilot-image-previews" style="display:none;flex-wrap:wrap;gap:6px;padding:0 16px 8px;"></div>
        </div>
        <button id="fixpilot-toggle-btn" class="fixpilot-toggle-btn" onclick="fixpilotToggle()">
            <img src="https://media.base44.com/images/public/6a42567182c58083937d0c43/7b98fd004_FixPilotIcon.png" alt="FixPilot" class="fixpilot-toggle-icon" />
        </button>
        <?php
    }
}`
};

export const panelCss = {
  name: 'panel.css',
  path: 'assets/css/',
  language: 'css',
  code: `#fixpilot-panel{position:fixed;top:0;right:-420px;width:400px;height:100vh;background:#1A1F2E;border-left:1px solid #30363D;z-index:100100;transition:right 0.3s ease;display:flex;flex-direction:column;font-family:-apple-system,system-ui,sans-serif}
#fixpilot-panel.open{right:0}
.fixpilot-panel-header{padding:16px;border-bottom:1px solid #30363D;display:flex;align-items:center;justify-content:space-between}
.fixpilot-panel-title{display:flex;align-items:center;gap:8px}
.fixpilot-logo{color:#fff;font-weight:700;font-size:16px}
.fixpilot-panel-logo-icon{width:20px;height:20px;max-width:20px;max-height:20px;border-radius:4px;object-fit:contain;flex-shrink:0}
.fixpilot-status{color:#00C9A7;font-size:11px;padding:2px 8px;background:rgba(0,201,167,0.1);border-radius:12px}
.fixpilot-close{background:none;border:none;color:#8B949E;font-size:20px;cursor:pointer}
.fixpilot-messages{flex:1;overflow-y:auto;padding:16px}
.fixpilot-msg-user{background:#00C9A7;color:#0D1117;padding:10px 14px;border-radius:12px 12px 4px 12px;margin-bottom:12px;margin-left:40px;font-size:13px}
.fixpilot-msg-ai{background:#161B22;color:#E6EDF3;padding:10px 14px;border:1px solid #30363D;border-radius:12px 12px 12px 4px;margin-bottom:12px;margin-right:40px;font-size:13px}
.fixpilot-fix-card{margin:8px 40px 12px 0;border:1px solid rgba(0,201,167,0.3);border-radius:8px;background:rgba(0,201,167,0.05);overflow:hidden}
.fixpilot-fix-card-header{padding:10px 14px;background:rgba(0,201,167,0.1);border-bottom:1px solid rgba(0,201,167,0.2);font-size:12px;font-weight:600;color:#00C9A7}
.fixpilot-fix-card-body{padding:10px 14px;font-size:12px;color:#8B949E}
.fixpilot-fix-actions{padding:10px 14px;display:flex;gap:8px}
.fixpilot-btn-confirm{background:#00C9A7;color:#0D1117;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer}
.fixpilot-btn-reject{background:transparent;color:#8B949E;border:1px solid #30363D;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer}
.fixpilot-input-area{padding:12px 16px;border-top:1px solid #30363D;display:flex;gap:8px;align-items:flex-end}
.fixpilot-upload-btn{background:#161B22;color:#00C9A7;border:1px solid #30363D;width:36px;height:36px;border-radius:8px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.fixpilot-upload-btn:hover{border-color:#00C9A7}
#fixpilot-input{flex:1;background:#0D1117;border:1px solid #30363D;border-radius:8px;padding:10px 14px;color:#E6EDF3;font-size:13px;outline:none;min-height:80px;max-height:200px;resize:vertical;font-family:inherit;line-height:1.4}
#fixpilot-input:focus{border-color:#00C9A7}
#fixpilot-send{background:#00C9A7;color:#0D1117;border:none;padding:10px 18px;border-radius:8px;font-weight:600;cursor:pointer}
.fixpilot-toggle-btn{position:fixed;top:50%;right:0;transform:translateY(-50%);background:#0D1117;border:1px solid #30363D;border-right:none;padding:4px;border-radius:8px 0 0 8px;cursor:pointer;z-index:100099;box-shadow:-2px 0 12px rgba(0,201,167,0.15);transition:all 0.2s ease}
.fixpilot-toggle-btn:hover{box-shadow:-2px 0 18px rgba(0,201,167,0.35)}
.fixpilot-toggle-icon{width:24px;height:24px;border-radius:4px;display:block}
.fixpilot-loading{display:inline-block;width:14px;height:14px;border:2px solid #30363D;border-top:2px solid #00C9A7;border-radius:50%;animation:fixpilot-spin 0.8s linear infinite}
@keyframes fixpilot-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
.fixpilot-btn-deepthink{background:#6B4FBB;color:#fff;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;margin-top:8px}
.fixpilot-history-btn{background:none;border:none;color:#8B949E;font-size:16px;cursor:pointer;padding:0 4px}
.fixpilot-history-btn:hover{color:#00C9A7}
.fixpilot-history{position:absolute;top:57px;left:0;right:0;bottom:60px;background:#1A1F2E;z-index:5;display:flex;flex-direction:column}
.fixpilot-history-header{padding:12px 16px;border-bottom:1px solid #30363D;display:flex;justify-content:space-between;align-items:center}
.fixpilot-history-header span{font-size:13px;font-weight:600;color:#E6EDF3}
.fixpilot-history-back{background:none;border:1px solid #30363D;color:#8B949E;padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer}
.fixpilot-history-back:hover{color:#E6EDF3;border-color:#00C9A7}
.fixpilot-history-list{flex:1;overflow-y:auto;padding:8px}
.fixpilot-history-item{padding:10px 12px;border:1px solid #30363D;border-radius:8px;margin-bottom:8px;cursor:pointer;background:#161B22}
.fixpilot-history-item:hover{border-color:#00C9A7}
.fixpilot-history-item-title{font-size:12px;color:#E6EDF3;font-weight:500;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fixpilot-history-item-date{font-size:10px;color:#8B949E}
.fixpilot-history-empty{text-align:center;padding:30px 16px;color:#8B949E;font-size:13px}
.fixpilot-file-chip{display:inline-flex;align-items:center;gap:6px;background:#161B22;border:1px solid #30363D;border-radius:6px;padding:4px 8px;font-size:11px;color:#E6EDF3}
.fixpilot-file-chip-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px}`
};

export const panelJs = {
  name: 'panel.js',
  path: 'assets/js/',
  language: 'javascript',
  code: `function fixpilotToggle(){var panel=document.getElementById('fixpilot-panel');var btn=document.getElementById('fixpilot-toggle-btn');panel.classList.toggle('open');if(panel.classList.contains('open')){btn.style.display='none';}else{btn.style.display='block';}}
function fixpilotAddMessage(role,content){var messages=document.getElementById('fixpilot-messages');var div=document.createElement('div');div.className=role==='user'?'fixpilot-msg-user':'fixpilot-msg-ai';div.textContent=content;messages.appendChild(div);messages.scrollTop=messages.scrollHeight;}
function fixpilotAddFixCard(plan,hasQuota){var messages=document.getElementById('fixpilot-messages');var card=document.createElement('div');card.className='fixpilot-fix-card';var header=document.createElement('div');header.className='fixpilot-fix-card-header';header.textContent='Proposed Fix: '+(plan.description||'Unnamed fix');card.appendChild(header);var body=document.createElement('div');body.className='fixpilot-fix-card-body';body.textContent=plan.reasoning||'';card.appendChild(body);if(hasQuota){var actions=document.createElement('div');actions.className='fixpilot-fix-actions';var confirmBtn=document.createElement('button');confirmBtn.className='fixpilot-btn-confirm';confirmBtn.textContent='Confirm & Apply';confirmBtn.onclick=function(){fixpilotExecuteFix(plan,card);};actions.appendChild(confirmBtn);var rejectBtn=document.createElement('button');rejectBtn.className='fixpilot-btn-reject';rejectBtn.textContent='Reject';rejectBtn.onclick=function(){card.remove();fixpilotAddMessage('ai','Fix rejected. Let me know if you need a different approach.');};actions.appendChild(rejectBtn);card.appendChild(actions);}else{var upgrade=document.createElement('div');upgrade.className='fixpilot-fix-card-body';upgrade.style.color='#FF3E30';upgrade.textContent='Fix quota exhausted. Upgrade your plan to apply this fix.';card.appendChild(upgrade);}messages.appendChild(card);messages.scrollTop=messages.scrollHeight;}
var fixpilotSessionId=null;var fixpilotUploadedFiles=[];
function fixpilotRenderFilePreviews(){var container=document.getElementById('fixpilot-image-previews');if(!container)return;container.innerHTML='';fixpilotUploadedFiles.forEach(function(f,idx){var wrapper=document.createElement('div');wrapper.style.cssText='position:relative;display:inline-block;margin-right:6px;';if(f.isImage){var img=document.createElement('img');img.src=f.url;img.style.cssText='width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #30363D;';wrapper.appendChild(img);}else{var chip=document.createElement('div');chip.className='fixpilot-file-chip';chip.innerHTML='<span style="font-size:14px">&#128206;</span><span class="fixpilot-file-chip-name">'+fixpilotEscape(f.name||'file')+'</span>';wrapper.appendChild(chip);}var removeBtn=document.createElement('button');removeBtn.innerHTML='&times;';removeBtn.style.cssText='position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#FF3E30;color:#fff;border:none;font-size:12px;cursor:pointer;line-height:1;';removeBtn.onclick=function(){fixpilotUploadedFiles.splice(idx,1);fixpilotRenderFilePreviews();};wrapper.appendChild(removeBtn);container.appendChild(wrapper);});container.style.display=fixpilotUploadedFiles.length>0?'flex':'none';}
async function fixpilotHandleFileSelect(input){if(!input.files||!input.files[0])return;var file=input.files[0];input.value='';var messages=document.getElementById('fixpilot-messages');var loading=document.createElement('div');loading.className='fixpilot-msg-ai';loading.innerHTML='<span class="fixpilot-loading"></span> Uploading file...';messages.appendChild(loading);var uploaded=await fixpilotUploadFile(file);loading.remove();if(uploaded&&uploaded.url){fixpilotUploadedFiles.push({url:uploaded.url,name:uploaded.name||file.name,isImage:!!uploaded.isImage});fixpilotRenderFilePreviews();}else{fixpilotAddMessage('ai','File upload failed. Please try again.');}}
async function fixpilotUploadFile(file){var formData=new FormData();formData.append('file',file);try{var response=await fetch(FixPilotConfig.rest_url+'upload-media',{method:'POST',headers:{'x-fixpilot-key':FixPilotConfig.api_key,'X-WP-Nonce':FixPilotConfig.nonce,},body:formData,});var data=await response.json();if(data.success&&data.url){return {url:data.url,name:data.file_name||file.name,isImage:!!data.is_image};}return null;}catch(err){return null;}}
async function fixpilotSend(){var input=document.getElementById('fixpilot-input');var msg=input.value.trim();if(!msg&&fixpilotUploadedFiles.length===0)return;if(!msg)msg='Please analyze the attached image(s).';fixpilotAddMessage('user',msg);input.value='';await fixpilotEnsureSession(msg);fixpilotSaveMessage('user',msg);var messages=document.getElementById('fixpilot-messages');var loading=document.createElement('div');loading.className='fixpilot-msg-ai';loading.innerHTML='<span class="fixpilot-loading"></span> Researching...';messages.appendChild(loading);try{var response=await fetch(FixPilotConfig.cloud_url+'/functions/aiFixOrchestrator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'research',message:msg,site_context:await fixpilotGetContext(),domain_fingerprint:FixPilotConfig.fingerprint,site_url:FixPilotConfig.site_url,file_urls:fixpilotUploadedFiles.length>0?fixpilotUploadedFiles.map(function(f){return f.url;}):undefined,}),});var data=await response.json();loading.remove();fixpilotUploadedFiles=[];fixpilotRenderFilePreviews();if(data.error){fixpilotAddMessage('ai','Error: '+data.error);return;}fixpilotSaveMessage('assistant',data.content||data.error||'',data.fix_plan?JSON.stringify(data.fix_plan):'');if(data.tier||data.fixes_used!==undefined){fixpilotAddMessage('ai','Plan: '+(data.tier||'free')+' | Fixes used: '+(data.fixes_used||0)+' / '+(data.fixes_limit||3)+(data.has_quota?'':' — quota exhausted, upgrade required.'));}if(data.response_type==='fix_proposal'&&data.fix_plan){fixpilotAddMessage('ai',data.content);fixpilotAddFixCard(data.fix_plan,data.has_quota);}else{fixpilotAddMessage('ai',data.content||'I could not process that request.');}}catch(err){loading.remove();fixpilotAddMessage('ai','Error: '+err.message);}}
async function fixpilotExecuteFix(plan){var fixId='fix_'+Date.now();var messages=document.getElementById('fixpilot-messages');var loading=document.createElement('div');loading.className='fixpilot-msg-ai';loading.innerHTML='<span class="fixpilot-loading"></span> Applying fix...';messages.appendChild(loading);messages.scrollTop=messages.scrollHeight;try{var response=await fetch(FixPilotConfig.rest_url+'apply',{method:'POST',headers:{'Content-Type':'application/json','x-fixpilot-key':FixPilotConfig.api_key,'X-WP-Nonce':FixPilotConfig.nonce,},body:JSON.stringify({fix_id:fixId,fix_description:plan.description,json_instruction:{changes:plan.changes},}),});var data=await response.json();loading.remove();if(data.success){fixpilotAddMessage('ai','Fix applied locally. Logging to cloud and running verification...');try{var cloudResponse=await fetch(FixPilotConfig.cloud_url+'/functions/aiFixOrchestrator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'execute_fix',domain_fingerprint:FixPilotConfig.fingerprint,fix_description:plan.description,fix_category:plan.category||'other',json_instruction:JSON.stringify({changes:plan.changes}),before_state:JSON.stringify(data.before_state||{}),verification_plan:JSON.stringify(plan.verification_plan||[]),}),});var cloudData=await cloudResponse.json();if(cloudData.success){var remaining=cloudData.remaining_fixes!==undefined?cloudData.remaining_fixes:'N/A';fixpilotAddMessage('ai','Fix applied and logged. Verifying...');try{var verifyResp=await fetch(FixPilotConfig.cloud_url+'/functions/aiFixOrchestrator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify_fix',fix_id:cloudData.fix_id}),});var verifyData=await verifyResp.json();if(verifyData.verification_status==='passed'){fixpilotAddMessage('ai','✓ Verification passed — the fix is confirmed live on your site. Remaining fixes: '+remaining);}else if(verifyData.verification_status==='failed'){fixpilotAddMessage('ai','⚠ Verification failed — the fix may not have taken effect. Caching could be delaying it, or the fix needs adjustment.');var dtCard=document.createElement('div');dtCard.className='fixpilot-fix-card';dtCard.innerHTML='<div class="fixpilot-fix-card-header">Deep Think Available</div><div class="fixpilot-fix-card-body">Not satisfied? Deep Think analyzes your site\\'s actual theme code for a more precise fix (2 credits).</div>';var dtBtn=document.createElement('button');dtBtn.className='fixpilot-btn-confirm';dtBtn.textContent='Deep Think (2 credits)';dtBtn.onclick=function(){dtCard.remove();fixpilotDeepThink(plan.description,JSON.stringify(plan));};dtCard.appendChild(dtBtn);messages.appendChild(dtCard);messages.scrollTop=messages.scrollHeight;}else{fixpilotAddMessage('ai','Verification: '+verifyData.verification_status+'. Remaining fixes: '+remaining);}}catch(vErr){fixpilotAddMessage('ai','Fix applied. Verification could not run: '+vErr.message+'. Remaining fixes: '+remaining);}}else{fixpilotAddMessage('ai','Fix applied locally, but cloud logging failed: '+(cloudData.error||'Unknown error'));}}catch(cloudErr){fixpilotAddMessage('ai','Fix applied locally, but cloud logging failed: '+cloudErr.message);}}else{fixpilotAddMessage('ai','Failed to apply fix: '+(data.message||'Unknown error'));}}catch(err){if(loading.parentNode)loading.remove();fixpilotAddMessage('ai','Error applying fix: '+err.message);}}
async function fixpilotDeepThink(originalMessage,previousFix){var messages=document.getElementById('fixpilot-messages');var loading=document.createElement('div');loading.className='fixpilot-msg-ai';loading.innerHTML='<span class="fixpilot-loading"></span> Deep Think: analyzing site code structure...';messages.appendChild(loading);messages.scrollTop=messages.scrollHeight;try{var themeCode={};try{var tcResponse=await fetch(FixPilotConfig.rest_url+'theme-code',{headers:{'x-fixpilot-key':FixPilotConfig.api_key,'X-WP-Nonce':FixPilotConfig.nonce,},});themeCode=await tcResponse.json();}catch(e){}var response=await fetch(FixPilotConfig.cloud_url+'/functions/aiFixOrchestrator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'deep_think',message:originalMessage,site_context:await fixpilotGetContext(),domain_fingerprint:FixPilotConfig.fingerprint,theme_code:themeCode.files||{},previous_fix:previousFix||'',}),});var data=await response.json();loading.remove();if(data.error){fixpilotAddMessage('ai','Deep Think error: '+data.error);return;}if(data.response_type==='fix_proposal'&&data.fix_plan){fixpilotAddMessage('ai',data.content);fixpilotAddFixCard(data.fix_plan,data.has_quota);}else{fixpilotAddMessage('ai',data.content||'Deep analysis complete.');}}catch(err){loading.remove();fixpilotAddMessage('ai','Deep Think error: '+err.message);}}
async function fixpilotGetContext(){try{var response=await fetch(FixPilotConfig.rest_url+'context',{headers:{'x-fixpilot-key':FixPilotConfig.api_key,'X-WP-Nonce':FixPilotConfig.nonce,},});return await response.json();}catch(err){return{wp_version:'unknown',active_plugins:[]};}}
function fixpilotEscape(text){if(!text)return'';var d=document.createElement('div');d.textContent=text;return d.innerHTML;}
async function fixpilotEnsureSession(title){if(fixpilotSessionId)return fixpilotSessionId;try{var r=await fetch(FixPilotConfig.cloud_url+'/functions/aiFixOrchestrator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start_session',domain_fingerprint:FixPilotConfig.fingerprint,title:title||'New conversation'})});var d=await r.json();if(d.session_id){fixpilotSessionId=d.session_id;}}catch(e){}return fixpilotSessionId;}
async function fixpilotSaveMessage(role,content,fixProposal){if(!fixpilotSessionId)return;try{await fetch(FixPilotConfig.cloud_url+'/functions/aiFixOrchestrator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add_session_message',session_id:fixpilotSessionId,role:role,content:content,fix_proposal:fixProposal||''})});}catch(e){}}
async function fixpilotOpenHistory(){var h=document.getElementById('fixpilot-history');if(!h)return;h.style.display='flex';var list=document.getElementById('fixpilot-history-list');list.innerHTML='<div class="fixpilot-history-empty">Loading history...</div>';try{var r=await fetch(FixPilotConfig.cloud_url+'/functions/aiFixOrchestrator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'list_sessions',domain_fingerprint:FixPilotConfig.fingerprint})});var d=await r.json();var sessions=d.sessions||[];if(!sessions.length){list.innerHTML='<div class="fixpilot-history-empty">No previous conversations yet.</div>';return;}list.innerHTML='';sessions.forEach(function(s){var item=document.createElement('div');item.className='fixpilot-history-item';var date=s.created_date?new Date(s.created_date).toLocaleString():'';item.innerHTML='<div class="fixpilot-history-item-title">'+fixpilotEscape(s.title||'Conversation')+'</div><div class="fixpilot-history-item-date">'+date+'</div>';item.onclick=function(){fixpilotLoadSession(s.id,s.title);};list.appendChild(item);});}catch(e){list.innerHTML='<div class="fixpilot-history-empty">Failed to load history.</div>';}}
function fixpilotCloseHistory(){var h=document.getElementById('fixpilot-history');if(h)h.style.display='none';}
function fixpilotStartNewChat(){fixpilotCloseHistory();fixpilotSessionId=null;var messages=document.getElementById('fixpilot-messages');messages.innerHTML='<div class="fixpilot-msg-ai">Started a new conversation. Describe a WordPress issue and I will help.</div>';}
async function fixpilotLoadSession(id,title){fixpilotCloseHistory();fixpilotSessionId=id;var messages=document.getElementById('fixpilot-messages');messages.innerHTML='<div class="fixpilot-msg-ai">Loading conversation...</div>';try{var r=await fetch(FixPilotConfig.cloud_url+'/functions/aiFixOrchestrator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'get_session_messages',session_id:id})});var d=await r.json();messages.innerHTML='';var msgs=d.messages||[];if(!msgs.length){fixpilotAddMessage('ai','This conversation is empty.');return;}msgs.forEach(function(m){if(m.role==='user'){fixpilotAddMessage('user',m.content);}else{fixpilotAddMessage('ai',m.content);if(m.fix_proposal){try{var plan=JSON.parse(m.fix_proposal);fixpilotAddFixCard(plan,true);}catch(e){}}}});}catch(e){messages.innerHTML='';fixpilotAddMessage('ai','Failed to load conversation.');}}
document.addEventListener('DOMContentLoaded',function(){var input=document.getElementById('fixpilot-input');if(input){input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();fixpilotSend();}});}});`
};

export const adminDashboardCss = {
  name: 'admin-dashboard.css',
  path: 'assets/css/',
  language: 'css',
  code: `.fixpilot-admin-wrap{max-width:920px;margin:20px 20px 40px 0;background:#0D1117;border:1px solid #30363D;border-radius:10px;font-family:-apple-system,system-ui,'Inter',sans-serif;color:#E6EDF3;overflow:hidden}
.fixpilot-admin-banner{width:100%;overflow:hidden;background:#0D1117;border-bottom:1px solid #30363D}
.fixpilot-admin-banner-img{width:100%;max-height:48px;object-fit:cover;object-position:left center;display:block}
.fixpilot-admin-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;background:#161B22;border-bottom:1px solid #30363D}
.fixpilot-admin-logo{font-size:20px;font-weight:700;color:#00C9A7;letter-spacing:-0.5px;display:flex;align-items:center;gap:8px}
.fixpilot-admin-logo-icon{width:28px;height:28px;border-radius:6px}
.fixpilot-admin-tagline{font-size:12px;color:#8B949E;margin-top:2px}
.fixpilot-status-badge{font-size:12px;font-weight:600;padding:4px 10px;border-radius:12px}
.fixpilot-status-connected{color:#00C9A7;background:rgba(0,201,167,0.1)}
.fixpilot-status-pending{color:#F0B429;background:rgba(240,180,41,0.1)}
.fixpilot-admin-tabs{display:flex;border-bottom:1px solid #30363D;background:#161B22}
.fixpilot-tab{padding:12px 20px;background:transparent;border:none;color:#8B949E;font-size:13px;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;font-family:inherit}
.fixpilot-tab:hover{color:#E6EDF3;background:rgba(255,255,255,0.03)}
.fixpilot-tab.active{color:#00C9A7;border-bottom-color:#00C9A7}
.fixpilot-tab-content{display:none;padding:24px}
.fixpilot-tab-content.active{display:block}
.fixpilot-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.fixpilot-stat-card{background:#161B22;border:1px solid #30363D;border-radius:8px;padding:16px}
.fixpilot-stat-label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#8B949E;margin-bottom:6px}
.fixpilot-stat-value{font-size:18px;font-weight:700;color:#E6EDF3}
.fixpilot-stat-plan{color:#00C9A7;text-transform:capitalize}
.fixpilot-stat-email{font-size:13px;word-break:break-all}
.fixpilot-stat-bar{height:4px;background:#30363D;border-radius:2px;margin-top:8px;overflow:hidden}
.fixpilot-stat-bar-fill{height:100%;background:#00C9A7;border-radius:2px;transition:width .3s ease}
.fixpilot-info-section{margin-bottom:24px}
.fixpilot-section-title{font-size:13px;font-weight:600;color:#E6EDF3;margin-bottom:12px}
.fixpilot-info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.fixpilot-info-item{background:#161B22;border:1px solid #30363D;border-radius:8px;padding:12px 16px;display:flex;flex-direction:column;gap:4px}
.fixpilot-info-label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#8B949E}
.fixpilot-info-value{font-size:13px;color:#E6EDF3;font-weight:500}
.fixpilot-cta-section{background:#161B22;border:1px solid #30363D;border-radius:8px;padding:20px;text-align:center}
.fixpilot-cta-note{font-size:12px;color:#8B949E;margin-top:8px}
.fixpilot-btn{display:inline-block;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all .2s;text-decoration:none}
.fixpilot-btn-primary{background:#00C9A7;color:#0D1117}
.fixpilot-btn-primary:hover{background:#00B89A}
.fixpilot-btn-secondary{background:transparent;color:#8B949E;border:1px solid #30363D}
.fixpilot-btn-secondary:hover{color:#E6EDF3;border-color:#484F58}
.fixpilot-btn:disabled{opacity:.5;cursor:not-allowed}
.fixpilot-plans-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.fixpilot-plan-card{background:#161B22;border:1px solid #30363D;border-radius:8px;padding:20px;display:flex;flex-direction:column;position:relative}
.fixpilot-plan-card.popular{border-color:rgba(0,201,167,0.4);box-shadow:0 0 20px -5px rgba(0,201,167,0.2)}
.fixpilot-plan-badge{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#00C9A7;color:#0D1117;font-size:10px;font-weight:700;padding:2px 10px;border-radius:10px}
.fixpilot-plan-name{font-size:14px;font-weight:700;color:#E6EDF3}
.fixpilot-plan-price{font-size:28px;font-weight:700;color:#E6EDF3;margin-top:4px}
.fixpilot-plan-period{font-size:12px;color:#8B949E;font-weight:400}
.fixpilot-plan-fixes{font-size:12px;color:#00C9A7;font-weight:600;margin-top:4px}
.fixpilot-plan-features{list-style:none;padding:0;margin:16px 0 0;flex:1}
.fixpilot-plan-features li{font-size:12px;color:#8B949E;padding:4px 0;display:flex;align-items:start;gap:6px}
.fixpilot-plan-features li::before{content:'\\2713';color:#00C9A7;font-weight:700;flex-shrink:0}
.fixpilot-plan-btn{margin-top:16px;width:100%;text-align:center}
.fixpilot-history-list{display:flex;flex-direction:column;gap:12px}
.fixpilot-history-item{background:#161B22;border:1px solid #30363D;border-radius:8px;padding:16px}
.fixpilot-history-item-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:12px}
.fixpilot-history-item-desc{font-size:14px;font-weight:600;color:#E6EDF3;flex:1}
.fixpilot-history-item-meta{display:flex;gap:8px;align-items:center;flex-shrink:0}
.fixpilot-history-badge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:4px;text-transform:uppercase}
.fixpilot-history-badge.applied{color:#00C9A7;background:rgba(0,201,167,0.1)}
.fixpilot-history-badge.reverted{color:#F0B429;background:rgba(240,180,41,0.1)}
.fixpilot-history-badge.failed{color:#FF3E30;background:rgba(255,62,48,0.1)}
.fixpilot-history-badge.passed{color:#00C9A7;background:rgba(0,201,167,0.05)}
.fixpilot-history-badge.pending{color:#8B949E;background:rgba(139,144,158,0.1)}
.fixpilot-history-badge.manual{color:#8B949E;background:rgba(139,144,158,0.1)}
.fixpilot-history-badge.skipped{color:#8B949E;background:rgba(139,144,158,0.1)}
.fixpilot-history-item-date{font-size:11px;color:#8B949E;margin-top:4px}
.fixpilot-history-empty{text-align:center;padding:40px;color:#8B949E;font-size:14px}
.fixpilot-settings-form{max-width:600px}
.fixpilot-settings-form .form-table{border-collapse:collapse}
.fixpilot-settings-form .form-table th{color:#8B949E;font-weight:500;padding:12px 0;text-align:left;width:180px;vertical-align:top}
.fixpilot-settings-form .form-table td{padding:12px 0}
.fixpilot-input{width:100%;max-width:400px;background:#0D1117;border:1px solid #30363D;border-radius:6px;padding:8px 12px;color:#E6EDF3;font-size:13px;font-family:inherit}
.fixpilot-input:focus{outline:none;border-color:#00C9A7}
.fixpilot-input-help{font-size:12px;color:#8B949E;margin-top:4px}
.fixpilot-code{display:inline-block;background:#0D1117;border:1px solid #30363D;border-radius:4px;padding:4px 8px;font-size:12px;font-family:'JetBrains Mono',monospace;color:#00C9A7;word-break:break-all}
.fixpilot-notice{padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:13px;display:flex;align-items:center;gap:8px}
.fixpilot-notice-success{background:rgba(0,201,167,0.1);border:1px solid rgba(0,201,167,0.3);color:#00C9A7}
.fixpilot-notice-warning{background:rgba(240,180,41,0.1);border:1px solid rgba(240,180,41,0.3);color:#F0B429}
.fixpilot-notice-error{background:rgba(255,62,48,0.1);border:1px solid rgba(255,62,48,0.3);color:#FF3E30}
.fixpilot-loading-text{text-align:center;padding:40px;color:#8B949E;font-size:14px}
.fixpilot-spinner{display:inline-block;width:14px;height:14px;border:2px solid #30363D;border-top:2px solid #00C9A7;border-radius:50%;animation:fixpilot-spin .8s linear infinite;vertical-align:middle;margin-right:6px}
@keyframes fixpilot-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
@media(max-width:782px){.fixpilot-stats-grid{grid-template-columns:repeat(2,1fr)}.fixpilot-plans-grid{grid-template-columns:1fr}.fixpilot-info-grid{grid-template-columns:1fr}}
.fixpilot-learning-card{background:#161B22;border:1px solid #30363D;border-radius:8px;padding:16px;margin-bottom:24px;transition:opacity .3s}
.fixpilot-learning-header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.fixpilot-learning-icon{font-size:22px;line-height:1}
.fixpilot-learning-title{font-size:14px;font-weight:600;color:#E6EDF3}
.fixpilot-learning-step{font-size:12px;color:#8B949E;margin-top:2px}
.fixpilot-learning-bar{height:8px;background:#30363D;border-radius:4px;overflow:hidden}
.fixpilot-learning-bar-fill{height:100%;background:linear-gradient(90deg,#00C9A7,#6B4FBB);border-radius:4px;transition:width .5s ease;background-size:200% 100%;animation:fixpilot-learn-shimmer 2s linear infinite}
@keyframes fixpilot-learn-shimmer{0%{background-position:0% 0}100%{background-position:-200% 0}}
.fixpilot-learning-meta{font-size:11px;color:#8B949E;margin-top:8px}
.fixpilot-learning-eta{font-size:11px;color:#00C9A7;margin-top:4px;font-weight:500}
.fixpilot-learning-complete .fixpilot-learning-bar-fill{background:#00C9A7;animation:none}
.fixpilot-learning-complete .fixpilot-learning-icon{color:#00C9A7}`
};

export const adminDashboardJs = {
  name: 'admin-dashboard.js',
  path: 'assets/js/',
  language: 'javascript',
  code: `var FIXPILOT_PLANS=[{tier:'free',name:'Free',price:0,fixes:3,features:['3 lifetime fixes','CSS & design fixes','Plugin settings','Community support']},{tier:'starter',name:'Starter',price:25,fixes:10,features:['10 fixes per month','All fix types','Fix history & rollback','Email support']},{tier:'pro',name:'Pro',price:50,fixes:25,features:['25 fixes per month','Priority AI research','Knowledge base recipes','Priority support'],popular:true},{tier:'business',name:'Business',price:100,fixes:60,features:['60 fixes per month','Dedicated AI model','Team access','Slack support channel']}];
document.addEventListener('DOMContentLoaded',function(){fixpilotInitDashboard();});
var FIXPILOT_LEARNING_POLL=null;
function fixpilotInitDashboard(){var data=window.FixPilotAdmin||{};var params=new URLSearchParams(window.location.search);var status=params.get('status');if(status==='success'){fixpilotShowNotice('Payment successful! Your subscription is now active.','success');}else if(status==='cancelled'){fixpilotShowNotice('Checkout was cancelled. No changes were made.','warning');}fixpilotRenderPlans(data);if(data.cloud_url&&data.fingerprint){fixpilotFetchStatus(data);fixpilotFetchLearningStatus(data);if(FIXPILOT_LEARNING_POLL){clearInterval(FIXPILOT_LEARNING_POLL);}FIXPILOT_LEARNING_POLL=setInterval(function(){fixpilotFetchLearningStatus(data);},4000);}else{var el=document.getElementById('fixpilot-history-content');if(el)el.innerHTML='<div class="fixpilot-history-empty">Waiting for auto-registration to complete...</div>';}}
async function fixpilotFetchLearningStatus(data){try{var response=await fetch(data.cloud_url+'/functions/aiFixOrchestrator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'get_learning_status',domain_fingerprint:data.fingerprint,domain_id:data.domain_id||''})});var result=await response.json();if(!result||result.error){return;}if(result.domain_found===false&&data.fingerprint&&!window._fixpilotReRegistering){window._fixpilotReRegistering=true;fixpilotShowNotice('Domain missing — reconnecting to FixPilot cloud...','warning');fixpilotReRegister(data);return;}var card=document.getElementById('fixpilot-learning-card');if(!card){return;}card.style.display='block';var bar=document.getElementById('fixpilot-learning-bar');var step=document.getElementById('fixpilot-learning-step');var meta=document.getElementById('fixpilot-learning-meta');var eta=document.getElementById('fixpilot-learning-eta');var pct=result.progress_pct||0;if(bar){bar.style.width=pct+'%';}if(step){step.textContent=result.current_step||'Learning...';}if(meta){meta.textContent=(result.mapped_plugins||0)+' of '+(result.total_plugins||0)+' plugins mapped';}if(eta){if(result.learning_complete||pct>=100){eta.style.display='none';}else{var secs=result.estimated_seconds_remaining||0;var mm=Math.floor(secs/60);var ss=secs%60;eta.style.display='block';eta.textContent='Estimated time remaining: '+(mm>0?mm+'m ':'')+ss+'s';}}if(result.learning_complete){card.classList.add('fixpilot-learning-complete');if(FIXPILOT_LEARNING_POLL){clearInterval(FIXPILOT_LEARNING_POLL);FIXPILOT_LEARNING_POLL=null;}}}catch(err){}}
function fixpilotSwitchTab(tab){var tabs=document.querySelectorAll('.fixpilot-tab');var contents=document.querySelectorAll('.fixpilot-tab-content');tabs.forEach(function(t){t.classList.remove('active');});contents.forEach(function(c){c.classList.remove('active');});var activeTab=document.querySelector('.fixpilot-tab[onclick*="'+tab+'"]');var activeContent=document.getElementById('fixpilot-tab-'+tab);if(activeTab)activeTab.classList.add('active');if(activeContent)activeContent.classList.add('active');}
async function fixpilotFetchStatus(data){try{var response=await fetch(data.cloud_url+'/functions/aiFixOrchestrator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'get_domain_status',domain_fingerprint:data.fingerprint,domain_id:data.domain_id||''})});var result=await response.json();if(result.error){if(result.error.indexOf('not found')!==-1&&data.fingerprint&&!window._fixpilotReRegistering){window._fixpilotReRegistering=true;fixpilotShowNotice('Domain missing — reconnecting to FixPilot cloud...','warning');fixpilotReRegister(data);return;}fixpilotShowNotice('Connection error: '+result.error,'error');return;}fixpilotRenderStatus(result);fixpilotRenderHistory(result.recent_fixes||[]);fixpilotRenderPlans(data,result.subscription_tier,result.subscription_status);}catch(err){fixpilotShowNotice('Failed to connect to cloud: '+err.message,'error');}}
async function fixpilotReRegister(data){try{var response=await fetch(data.cloud_url+'/functions/aiFixOrchestrator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'register_domain',domain_fingerprint:data.fingerprint,site_url:data.site_url,admin_email:data.admin_email,site_name:data.site_name||'',wp_version:data.wp_version||'',php_version:data.php_version||'',active_theme:data.active_theme||'',active_plugins:data.active_plugins||[],api_key:data.api_key||''})});var result=await response.json();window._fixpilotReRegistering=false;if(result.domain_id){window.FixPilotAdmin.domain_id=result.domain_id;data.domain_id=result.domain_id;fixpilotShowNotice('Reconnected to FixPilot cloud! Learning about your site...','success');fixpilotFetchStatus(data);fixpilotFetchLearningStatus(data);if(FIXPILOT_LEARNING_POLL)clearInterval(FIXPILOT_LEARNING_POLL);FIXPILOT_LEARNING_POLL=setInterval(function(){fixpilotFetchLearningStatus(data);},4000);}else{fixpilotShowNotice('Reconnection failed: '+(result.error||'Unknown error'),'error');}}catch(err){window._fixpilotReRegistering=false;fixpilotShowNotice('Reconnection failed: '+err.message,'error');}}
function fixpilotRenderStatus(data){var planEl=document.getElementById('fixpilot-stat-plan');var fixesEl=document.getElementById('fixpilot-stat-fixes');var subEl=document.getElementById('fixpilot-stat-sub');var barEl=document.getElementById('fixpilot-stat-bar');if(planEl)planEl.textContent=data.subscription_tier||'free';if(fixesEl)fixesEl.textContent=(data.fix_count_used||0)+' / '+(data.fix_count_limit||3);if(subEl){var subStatus=data.subscription_status||'none';subEl.textContent=subStatus;subEl.style.color=subStatus==='active'?'#00C9A7':'#8B949E';}if(barEl){var used=data.fix_count_used||0;var limit=data.fix_count_limit||3;var pct=Math.min((used/limit)*100,100);barEl.style.width=pct+'%';barEl.style.background=pct>=100?'#FF3E30':'#00C9A7';}}
function fixpilotRenderHistory(fixes){var container=document.getElementById('fixpilot-history-content');if(!container)return;if(!fixes||fixes.length===0){container.innerHTML='<div class="fixpilot-history-empty">No fixes applied yet. Use the AI chat panel to get started.</div>';return;}var html='<div class="fixpilot-history-list">';fixes.forEach(function(fix){var date=fix.created_date?new Date(fix.created_date).toLocaleString():'';var category=fix.fix_category||'other';var status=fix.status||'applied';var verStatus=fix.verification_status||'pending';html+='<div class="fixpilot-history-item">';html+='<div class="fixpilot-history-item-header">';html+='<span class="fixpilot-history-item-desc">'+fixpilotEscape(fix.fix_description)+'</span>';html+='<div class="fixpilot-history-item-meta">';html+='<span class="fixpilot-history-badge '+status+'">'+status+'</span>';if(verStatus&&verStatus!=='pending'){html+='<span class="fixpilot-history-badge '+verStatus+'">'+verStatus+'</span>';}html+='</div>';html+='</div>';html+='<div class="fixpilot-history-item-date">'+date+' &middot; '+category+'</div>';html+='</div>';});html+='</div>';container.innerHTML=html;}
function fixpilotRenderPlans(data,currentTier,subStatus){var container=document.getElementById('fixpilot-plans-content');if(!container)return;currentTier=currentTier||(data.registered?'free':null);var html='<div class="fixpilot-plans-grid">';FIXPILOT_PLANS.forEach(function(plan){var isCurrent=currentTier===plan.tier;var popularBadge=plan.popular?'<span class="fixpilot-plan-badge">POPULAR</span>':'';html+='<div class="fixpilot-plan-card'+(plan.popular?' popular':'')+'">';html+=popularBadge;html+='<div class="fixpilot-plan-name">'+plan.name+'</div>';html+='<div class="fixpilot-plan-price">$'+plan.price+'<span class="fixpilot-plan-period">/mo</span></div>';html+='<div class="fixpilot-plan-fixes">'+plan.fixes+' fixes'+(plan.tier==='free'?' (lifetime)':' per month')+'</div>';html+='<ul class="fixpilot-plan-features">';plan.features.forEach(function(f){html+='<li>'+f+'</li>';});html+='</ul>';if(isCurrent){html+='<button class="fixpilot-btn fixpilot-btn-secondary fixpilot-plan-btn" disabled>Current Plan</button>';}else if(plan.tier==='free'){html+='<button class="fixpilot-btn fixpilot-btn-secondary fixpilot-plan-btn" disabled>Default</button>';}else{html+='<button class="fixpilot-btn fixpilot-btn-primary fixpilot-plan-btn" onclick="fixpilotUpgrade(\\''+plan.tier+'\\')" data-tier="'+plan.tier+'">Upgrade to '+plan.name+'</button>';}html+='</div>';});html+='</div>';html+='<div style="margin-top:16px;padding:16px;background:#161B22;border:1px solid #30363D;border-radius:8px;"><p style="font-size:12px;color:#8B949E;margin:0;"><strong style="color:#E6EDF3;">Free tier policy:</strong> 3 lifetime fixes per domain. Domain fingerprinting prevents re-installation to reset the free trial. Unused monthly fixes do not roll over.</p></div>';container.innerHTML=html;}
async function fixpilotUpgrade(tier){var data=window.FixPilotAdmin||{};if(!data.domain_id){fixpilotShowNotice('Your site is still connecting to the FixPilot cloud. Please wait a moment and refresh.','warning');return;}var btn=document.querySelector('[data-tier="'+tier+'"]');if(btn){btn.disabled=true;btn.innerHTML='<span class="fixpilot-spinner"></span> Redirecting...';}try{var returnUrl=window.location.href.split('&status=')[0].split('?status=')[0];var response=await fetch(data.cloud_url+'/functions/stripeCheckout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain_id:data.domain_id,tier:tier,return_url:returnUrl})});var result=await response.json();if(result.url){window.location.href=result.url;}else{fixpilotShowNotice('Failed to create checkout session: '+(result.error||'Unknown error'),'error');if(btn){btn.disabled=false;btn.textContent='Upgrade';}}}catch(err){fixpilotShowNotice('Checkout error: '+err.message,'error');if(btn){btn.disabled=false;btn.textContent='Upgrade';}}}
function fixpilotShowNotice(message,type){var area=document.getElementById('fixpilot-notice-area');if(!area)return;area.innerHTML='<div class="fixpilot-notice fixpilot-notice-'+(type||'success')+'">'+message+'</div>';setTimeout(function(){area.innerHTML='';},8000);}
function fixpilotEscape(text){if(!text)return'';var div=document.createElement('div');div.textContent=text;return div.innerHTML;}`
};

export const readmeTxt = {
  name: 'readme.txt',
  path: '/',
  language: 'text',
  code: `=== FixPilot ===
Contributors: fixpilot
Tags: ai, wordpress fix, css, debugging, assistant
Requires at least: 5.8
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.4.1
License: GPLv2 or later

AI-powered WordPress assistant that researches, confirms, and applies fixes with rollback support.

== Description ==

FixPilot embeds an AI chat panel in your WordPress admin. Ask it any question about your site, and it will:
- Research the best fix using WordPress.org docs and plugin/theme vendor documentation
- Present a plain-English plan for your confirmation
- Apply the fix safely via structured JSON instructions
- Snapshot the before-state for one-click rollback
- Learn from every fix to build a collective knowledge base

= Pricing =
* Free: 3 lifetime fixes per domain
* Starter: $25/mo for 10 fixes
* Pro: $50/mo for 25 fixes
* Business: $100/mo for 60 fixes

== Installation ==

1. Upload the fixpilot folder to /wp-content/plugins/
2. Activate the plugin through the 'Plugins' menu in WordPress
3. The plugin auto-connects to the FixPilot cloud on first load — no configuration needed
4. Click the FixPilot icon tab on the right side of wp-admin to open the AI panel
5. Start chatting with FixPilot AI

== Frequently Asked Questions ==

= Is it safe? =
Yes. Every fix requires your explicit confirmation. Before-state snapshots are stored locally for rollback.

= What can the AI fix? =
CSS/design adjustments, plugin settings, content edits, wp_options changes, and more.

= How does domain fingerprinting work? =
We hash your domain URL + server IP + install ID to prevent free trial abuse via reinstallation.`
};