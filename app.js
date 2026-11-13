// ========== 配置区 - 替换成你自己的Supabase信息 ==========
const SUPABASE_URL = 'https://ltgmhjoxomzagxohmsit.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tZ-zO7kOm_Cxyo6xkDtHDA_x0dMaVia';
const STORAGE_BUCKET = 'photos';
// =========================================================

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = localStorage.getItem('nickname') || '';

// 初始化
window.onload = function() {
  if (!currentUser) {
    document.getElementById('loginModal').style.display = 'flex';
  } else {
    initApp();
  }
  initNav();
};

// 保存昵称
function saveNickname() {
  const name = document.getElementById('nicknameInput').value.trim();
  if (!name) {
    alert('请输入昵称哦~');
    return;
  }
  currentUser = name;
  localStorage.setItem('nickname', name);
  document.getElementById('loginModal').style.display = 'none';
  initApp();
}

// 初始化应用
function initApp() {
  loadLoveDays();
  loadMessages();
  loadPhotos();
  loadDiaries();
  loadAnniversaries();
  
  // 实时订阅新消息
  subscribeMessages();
}

// 底部导航切换
function initNav() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      const pageName = item.dataset.page;
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + pageName).classList.add('active');
    });
  });
}

// ========== 恋爱天数 ==========
async function loadLoveDays() {
  const { data, error } = await supabase
    .from('settings')
    .select('love_start_date')
    .limit(1)
    .single();
  
  if (data) {
    const start = new Date(data.love_start_date);
    const now = new Date();
    const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
    document.getElementById('loveDays').textContent = diff;
  }
}

// ========== 留言板 ==========
async function loadMessages() {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true });
  
  const list = document.getElementById('messageList');
  list.innerHTML = '';
  
  data?.forEach(msg => {
    const div = document.createElement('div');
    div.className = 'message-item';
    div.innerHTML = `
      <div class="sender">${msg.sender}</div>
      <div>${msg.content}</div>
      <div class="time">${formatTime(msg.created_at)}</div>
    `;
    list.appendChild(div);
  });
  
  list.scrollTop = list.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content) return;
  
  await supabase.from('messages').insert({
    sender: currentUser,
    content: content
  });
  
  input.value = '';
  loadMessages();
}

function subscribeMessages() {
  supabase.channel('messages_channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
      loadMessages();
    })
    .subscribe();
}

// ========== 相册 ==========
async function loadPhotos() {
  const { data } = await supabase
    .from('photos')
    .select('*')
    .order('created_at', { ascending: false });
  
  const grid = document.getElementById('photoGrid');
  grid.innerHTML = '';
  
  data?.forEach(photo => {
    const div = document.createElement('div');
    div.className = 'photo-item';
    div.innerHTML = `
      <img src="${photo.image_url}" alt="${photo.caption || ''}">
      <span class="uploader-tag">${photo.uploader}</span>
    `;
    grid.appendChild(div);
  });
}

async function uploadPhoto() {
  const file = document.getElementById('photoInput').files[0];
  const caption = document.getElementById('photoCaption').value.trim();
  
  if (!file) return;
  
  const fileName = Date.now() + '_' + file.name;
  
  // 上传到存储
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file);
  
  if (error) {
    alert('上传失败: ' + error.message);
    return;
  }
  
  // 获取公开URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);
  
  // 保存到数据库
  await supabase.from('photos').insert({
    uploader: currentUser,
    image_url: urlData.publicUrl,
    caption: caption
  });
  
  document.getElementById('photoCaption').value = '';
  document.getElementById('photoInput').value = '';
  loadPhotos();
}

// ========== 日记 ==========
async function loadDiaries() {
  const { data } = await supabase
    .from('diaries')
    .select('*')
    .order('created_at', { ascending: false });
  
  const list = document.getElementById('diaryList');
  list.innerHTML = '';
  
  data?.forEach(diary => {
    const div = document.createElement('div');
    div.className = 'diary-item';
    div.innerHTML = `
      <div class="diary-header">
        <span>${diary.author}</span>
        <span>${formatDate(diary.diary_date)}</span>
      </div>
      <div class="diary-content">${diary.content.replace(/\n/g, '<br>')}</div>
    `;
    list.appendChild(div);
  });
}

async function saveDiary() {
  const content = document.getElementById('diaryInput').value.trim();
  if (!content) return;
  
  await supabase.from('diaries').insert({
    author: currentUser,
    content: content
  });
  
  document.getElementById('diaryInput').value = '';
  loadDiaries();
}

// ========== 纪念日 ==========
async function loadAnniversaries() {
  const { data } = await supabase
    .from('anniversaries')
    .select('*')
    .order('target_date', { ascending: true });
  
  const list = document.getElementById('anniList');
  list.innerHTML = '';
  
  data?.forEach(anni => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(anni.target_date);
    target.setHours(0,0,0,0);
    
    // 计算下一次纪念日
    const thisYear = new Date(today.getFullYear(), target.getMonth(), target.getDate());
    let nextDate = thisYear;
    if (thisYear < today) {
      nextDate = new Date(today.getFullYear() + 1, target.getMonth(), target.getDate());
    }
    
    const days = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
    const label = days === 0 ? '就是今天' : '还有 ' + days + ' 天';
    
    const div = document.createElement('div');
    div.className = 'anni-item';
    div.innerHTML = `
      <div class="anni-info">
        <div class="anni-title">${anni.title}</div>
        <div class="anni-date">${formatDate(anni.target_date)}</div>
      </div>
      <div class="anni-countdown">
        <div class="num">${days === 0 ? '🎉' : days}</div>
        <div class="label">${label}</div>
      </div>
    `;
    list.appendChild(div);
  });
}

async function addAnniversary() {
  const title = document.getElementById('anniTitle').value.trim();
  const date = document.getElementById('anniDate').value;
  
  if (!title || !date) {
    alert('请填写完整信息');
    return;
  }
  
  await supabase.from('anniversaries').insert({
    title: title,
    target_date: date
  });
  
  document.getElementById('anniTitle').value = '';
  document.getElementById('anniDate').value = '';
  loadAnniversaries();
}

// ========== 工具函数 ==========
function formatTime(timeStr) {
  const date = new Date(timeStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hour}:${minute}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}
