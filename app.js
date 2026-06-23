// Gamified Task & Habit Tracker Client Logic

let state = {
  user: {
    level: 1,
    xp: 0,
    coins: 0,
    activePet: null,
    petHunger: 100
  },
  tasks: [],
  habits: [],
  categories: [
    { id: "cat-work", name: "Work", color: "#4f46e5", stat: "focus" },
    { id: "cat-health", name: "Health", color: "#16a34a", stat: "strength" },
    { id: "cat-study", name: "Study", color: "#2563eb", stat: "intelligence" },
    { id: "cat-personal", name: "Personal", color: "#d97706", stat: "agility" }
  ],
  history: []
};

// Cloud Sync Variables
let isCloudSynced = false;
let lastSyncTimestamp = null;

// UI Toggles & Form Elements
const tabTaskBtn = document.getElementById('tab-task-btn');
const tabHabitBtn = document.getElementById('tab-habit-btn');
const taskForm = document.getElementById('task-creator-form');
const habitForm = document.getElementById('habit-creator-form');

const taskCategorySelect = document.getElementById('task-category');
const habitCategorySelect = document.getElementById('habit-category');
const filterCategorySelect = document.getElementById('filter-category');
const filterPrioritySelect = document.getElementById('filter-priority');
const sortTasksSelect = document.getElementById('sort-tasks');
const deadlineInput = document.getElementById('task-deadline');

const habitsSection = document.getElementById('habits-section');
const tasksSection = document.getElementById('tasks-section');

// Edit Modals DOM Elements
const editTaskModal = document.getElementById('edit-task-modal');
const editTaskForm = document.getElementById('edit-task-form');
const editTaskId = document.getElementById('edit-task-id');
const editTaskTitle = document.getElementById('edit-task-title');
const editTaskDesc = document.getElementById('edit-task-desc');
const editTaskPriority = document.getElementById('edit-task-priority');
const editTaskCategory = document.getElementById('edit-task-category');
const editTaskDeadline = document.getElementById('edit-task-deadline');
const editTaskCancelBtn = document.getElementById('edit-task-cancel-btn');

const editHabitModal = document.getElementById('edit-habit-modal');
const editHabitForm = document.getElementById('edit-habit-form');
const editHabitId = document.getElementById('edit-habit-id');
const editHabitTitle = document.getElementById('edit-habit-title');
const editHabitCategory = document.getElementById('edit-habit-category');
const editHabitCancelBtn = document.getElementById('edit-habit-cancel-btn');

const categorySubmitBtn = document.getElementById('category-submit-btn');
let editingCategoryId = null;

// Rank Modal DOM Elements
const rankInfoBtn = document.getElementById('rank-info-btn');
const rankModal = document.getElementById('rank-modal');
const rankModalCloseBtn = document.getElementById('rank-modal-close-btn');
const rankModalXpNeeded = document.getElementById('rank-modal-xp-needed');
const rankModalCurrent = document.getElementById('rank-modal-current');
const rankModalNext = document.getElementById('rank-modal-next');
const rankModalLevelsProgress = document.getElementById('rank-modal-levels-progress');
const rankModalBarFill = document.getElementById('rank-modal-bar-fill');
const rankModalIcon = document.getElementById('rank-modal-icon');
const rankModalTitle = document.getElementById('rank-modal-title');
const rankModalText = document.getElementById('rank-modal-text');

// Collapsible Sidebar & View Navigation DOM Elements
const navSidebar = document.getElementById('nav-sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const navItems = document.querySelectorAll('.nav-item');
const viewPanels = document.querySelectorAll('.view-panel');

// Settings DOM Elements (now inside settings view panel)
const settingsRankCard = document.getElementById('settings-rank-card');
const resetAppBtn = document.getElementById('reset-app-btn');


// Tab Navigation
tabTaskBtn.addEventListener('click', () => {
  tabTaskBtn.classList.add('active');
  tabHabitBtn.classList.remove('active');
  taskForm.style.display = 'block';
  habitForm.style.display = 'none';
  tasksSection.style.display = 'block';
  habitsSection.style.display = 'none';
});

tabHabitBtn.addEventListener('click', () => {
  tabHabitBtn.classList.add('active');
  tabTaskBtn.classList.remove('active');
  habitForm.style.display = 'block';
  taskForm.style.display = 'none';
  habitsSection.style.display = 'block';
  tasksSection.style.display = 'none';
});

// Auto-open date picker on field click
if (deadlineInput) {
  deadlineInput.addEventListener('click', function () {
    try {
      this.showPicker();
    } catch (e) {
      console.warn('showPicker not supported:', e);
    }
  });
}

// Protocol helper
const IS_FILE_PROTOCOL = window.location.protocol === 'file:';

// Check and update Daily Login Streak
function checkLoginStreak() {
  const todayStr = getTodayString();
  const yesterdayStr = getYesterdayString();
  let changed = false;
  
  if (!state.user.loginStreak) {
    state.user.loginStreak = 1;
    state.user.lastLoginDate = todayStr;
    changed = true;
  } else {
    if (state.user.lastLoginDate === yesterdayStr) {
      state.user.loginStreak += 1;
      state.user.lastLoginDate = todayStr;
      if (state.user.petHunger !== undefined) {
        state.user.petHunger = Math.max(0, state.user.petHunger - 25);
      }
      changed = true;
    } else if (state.user.lastLoginDate !== todayStr) {
      // Streak broken if last login is older than yesterday
      state.user.loginStreak = 1;
      state.user.lastLoginDate = todayStr;
      if (state.user.petHunger !== undefined) {
        state.user.petHunger = 0;
      }
      changed = true;
    }
  }
  return changed;
}

// ==========================================
// Supabase Cloud Sync Functions
// ==========================================

function resetToDefaultState() {
  state = {
    user: {
      level: 1,
      xp: 0,
      coins: 0,
      activePet: null,
      petHunger: 100,
      obtainedPokemon: [],
      tasksCompletedForDrop: 0,
      nextDropRequirement: Math.floor(Math.random() * 20) + 1,
      inventory: {}
    },
    tasks: [],
    habits: [],
    categories: [
      { id: "cat-work", name: "Work", color: "#4f46e5", stat: "focus" },
      { id: "cat-health", name: "Health", color: "#16a34a", stat: "strength" },
      { id: "cat-study", name: "Study", color: "#2563eb", stat: "intelligence" },
      { id: "cat-personal", name: "Personal", color: "#d97706", stat: "agility" }
    ],
    history: []
  };
  localStorage.removeItem('gamified_todo_state');
}

function updateSyncTimeLabel(timestamp) {
  const syncTimeLabel = document.getElementById('sync-time-label');
  if (!syncTimeLabel) return;
  if (!timestamp) {
    syncTimeLabel.textContent = 'Last synced: Never';
    return;
  }
  try {
    const date = new Date(timestamp);
    syncTimeLabel.textContent = `Last synced: ${date.toLocaleTimeString()} (${date.toLocaleDateString()})`;
  } catch (e) {
    syncTimeLabel.textContent = `Last synced: ${timestamp}`;
  }
}

// Supabase Variables
let supabaseClient = null;
let supabaseUser = null;

function initSupabase() {
  const savedUrl = localStorage.getItem('supabase_url');
  const savedKey = localStorage.getItem('supabase_key');
  
  if (savedUrl && savedKey) {
    document.getElementById('supabase-url').value = savedUrl;
    document.getElementById('supabase-key').value = savedKey;
    if (typeof supabase !== 'undefined') {
      supabaseClient = supabase.createClient(savedUrl, savedKey);
      
      // Check session
      supabaseClient.auth.getSession().then(({ data: { session } }) => {
        updateSupabaseUser(session?.user || null);
        if (session?.user) {
          syncPullSupabase(true);
        }
      });

      // Listen to auth state changes
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        updateSupabaseUser(session?.user || null);
      });
    }
  }

  // Bind auth buttons click events
  const loginBtn = document.getElementById('sync-login-btn');
  const signupBtn = document.getElementById('sync-signup-btn');
  const logoutBtn = document.getElementById('sync-logout-btn');

  if (loginBtn) {
    loginBtn.addEventListener('click', () => handleSupabaseAuth('login'));
  }
  if (signupBtn) {
    signupBtn.addEventListener('click', () => handleSupabaseAuth('signup'));
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (supabaseClient) {
        await supabaseClient.auth.signOut();
        updateSupabaseUser(null);
        isCloudSynced = false;
        resetToDefaultState();
        render();
      }
    });
  }
}

async function handleSupabaseAuth(action) {
  const url = document.getElementById('supabase-url').value.trim();
  const key = document.getElementById('supabase-key').value.trim();
  const email = document.getElementById('supabase-email').value.trim();
  const password = document.getElementById('supabase-password').value.trim();
  const errorMsg = document.getElementById('sync-error-msg');
  
  if (!url || !key || !email || !password) {
    errorMsg.textContent = 'All fields are required.';
    errorMsg.style.display = 'block';
    return;
  }
  
  errorMsg.style.display = 'none';

  if (!supabaseClient) {
    supabaseClient = supabase.createClient(url, key);
    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_key', key);
  }

  try {
    let result;
    if (action === 'signup') {
      result = await supabaseClient.auth.signUp({ email, password });
    } else {
      result = await supabaseClient.auth.signInWithPassword({ email, password });
    }

    if (result.error) throw result.error;
    
    // Auth successful
    document.getElementById('supabase-password').value = '';
    syncPullSupabase(true);
    
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.style.display = 'block';
  }
}

function updateSupabaseUser(user) {
  supabaseUser = user;
  const loggedOutState = document.getElementById('sync-logged-out-state');
  const loggedInState = document.getElementById('sync-logged-in-state');
  const emailDisplay = document.getElementById('sync-email-display');

  if (user) {
    if (loggedOutState) loggedOutState.style.display = 'none';
    if (loggedInState) loggedInState.style.display = 'flex';
    if (emailDisplay) emailDisplay.textContent = user.email;
  } else {
    if (loggedOutState) loggedOutState.style.display = 'flex';
    if (loggedInState) loggedInState.style.display = 'none';
    if (emailDisplay) emailDisplay.textContent = '';
    lastSyncTimestamp = null;
    updateSyncTimeLabel(null);
  }
}

async function syncPushSupabase() {
  if (!supabaseClient || !supabaseUser) return;
  if (!isCloudSynced) {
    console.log('[Gamification] Postponed push: Cloud state has not been pulled yet.');
    return;
  }
  try {
    const timestamp = new Date().toISOString();
    const { error } = await supabaseClient
      .from('user_progress')
      .upsert({ 
        id: supabaseUser.id, 
        data: state, 
        updated_at: timestamp 
      });
      
    if (error) throw error;
    
    lastSyncTimestamp = timestamp;
    updateSyncTimeLabel(lastSyncTimestamp);
    console.log('[Gamification] Successfully pushed data to Supabase.');
  } catch (err) {
    console.error('[Gamification] Supabase push failed:', err);
    alert('Cloud Sync Push Failed: ' + err.message);
  }
}

async function syncPullSupabase(forceRender = false) {
  if (!supabaseClient || !supabaseUser) return;
  try {
    const { data, error } = await supabaseClient
      .from('user_progress')
      .select('data, updated_at')
      .eq('id', supabaseUser.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - blob is empty
        console.log('[Gamification] Supabase is empty. Pushing current state.');
        isCloudSynced = true; 
        await syncPushSupabase();
      } else {
        throw error;
      }
    } else if (data) {
      const cloudTime = new Date(data.updated_at).getTime();
      const lastLocalTime = lastSyncTimestamp ? new Date(lastSyncTimestamp).getTime() : 0;
      
      isCloudSynced = true; 
      
      if (cloudTime > lastLocalTime || forceRender) {
        console.log('[Gamification] Cloud state is newer. Syncing with local state.');
        state = data.data;
        lastSyncTimestamp = data.updated_at;
        localStorage.setItem('gamified_todo_state', JSON.stringify(state));
        updateSyncTimeLabel(lastSyncTimestamp);
        render();
      }
    }
  } catch (err) {
    console.error('[Gamification] Supabase pull failed:', err);
    alert('Cloud Sync Pull Error: ' + err.message);
  }
}

// Load DB Data from Server or LocalStorage
async function loadData() {
  loadFromLocalStorage();
  
  // Initialize Supabase Widget and login status
  initSupabase();

  // Removed local Node server communication to ensure Netlify Blobs is the only cloud truth
  
  // Migration: ensure all habits have days array
  if (state.habits) {
    state.habits.forEach(habit => {
      if (!habit.days) {
        habit.days = [1, 2, 3, 4, 5, 6, 0];
      }
    });
  }
  
  // Pokemon drop state migration
  if (!state.user.obtainedPokemon) {
    state.user.obtainedPokemon = [];
    state.user.tasksCompletedForDrop = 0;
    state.user.nextDropRequirement = Math.floor(Math.random() * 20) + 1;
  }
  
  // Pet system migration
  if (state.user.coins === undefined) {
    state.user.coins = 0;
    state.user.activePet = null;
    state.user.petHunger = 100;
  }
  if (!state.user.inventory) {
    state.user.inventory = {};
  }
  // Cleanup old stats
  if (state.user.stats) {
    delete state.user.stats;
  }
  
  // Update login streak and run background checks immediately on startup
  const streakChanged = checkLoginStreak();
  if (streakChanged) {
    await saveData();
  }
  await performTickChecks();
  initSidebarAndRouting();
  if (!streakChanged) {
    render();
  }
}

function loadFromLocalStorage() {
  const localData = localStorage.getItem('gamified_todo_state');
  if (localData) {
    try {
      state = JSON.parse(localData);
      console.log('[Gamification] State parsed from LocalStorage.');
    } catch (e) {
      console.error('[Gamification] Failed to parse state from LocalStorage:', e);
    }
  } else {
    console.log('[Gamification] No local storage state found, using default pre-populated state.');
  }
}

// Sync DB Data with Server and LocalStorage
async function saveData() {
  // Always save to LocalStorage as a local backup/direct source of truth
  try {
    localStorage.setItem('gamified_todo_state', JSON.stringify(state));
  } catch (err) {
    console.error('[Gamification] Failed to write to LocalStorage:', err);
  }

  // Render UI immediately
  render();

  // Push to Supabase if logged in
  if (supabaseUser) {
    await syncPushSupabase();
  }
  
  // Cloud push is handled above. Removed local node server push.
}

// Calculate title based on Level
function getUserTitle(level) {
  const tier = getTier(level);
  switch (tier) {
    case 'Bronze': return 'Bronze Gladiator';
    case 'Silver': return 'Silver Ranger';
    case 'Gold': return 'Golden Knight';
    case 'Ruby': return 'Ruby Sorcerer';
    case 'Sapphire': return 'Sapphire Templar';
    case 'Emerald': return 'Emerald Sentinel';
    case 'Diamond': return 'Diamond Warlord';
    case 'Platinum': return 'Platinum Champion';
    case 'Obsidian': return 'Obsidian Archmage';
    case 'Grandmaster': return 'Grandmaster Legend';
    default: return 'Quest Adventurer';
  }
}

function getTier(level) {
  if (level < 5) return 'Bronze';
  if (level < 10) return 'Silver';
  if (level < 15) return 'Gold';
  if (level < 20) return 'Ruby';
  if (level < 25) return 'Sapphire';
  if (level < 30) return 'Emerald';
  if (level < 35) return 'Diamond';
  if (level < 40) return 'Platinum';
  if (level < 45) return 'Obsidian';
  return 'Grandmaster';
}

function getTierModifiers(tier) {
  switch (tier) {
    case 'Bronze': return { gain: 1.0, loss: 1.0 };
    case 'Silver': return { gain: 1.1, loss: 1.1 };
    case 'Gold': return { gain: 1.2, loss: 1.2 };
    case 'Ruby': return { gain: 1.3, loss: 1.3 };
    case 'Sapphire': return { gain: 1.4, loss: 1.4 };
    case 'Emerald': return { gain: 1.5, loss: 1.5 };
    case 'Diamond': return { gain: 1.6, loss: 1.7 };
    case 'Platinum': return { gain: 1.7, loss: 1.9 };
    case 'Obsidian': return { gain: 1.8, loss: 2.1 };
    case 'Grandmaster': return { gain: 2.0, loss: 2.5 };
    default: return { gain: 1.0, loss: 1.0 };
  }
}

function getTierSVG(tier) {
  let color = '#cd7f32';
  let symbol = '🛡️';
  switch (tier) {
    case 'Bronze': color = '#cd7f32'; symbol = '🛡️'; break;
    case 'Silver': color = '#bdc3c7'; symbol = '⚔️'; break;
    case 'Gold': color = '#f1c40f'; symbol = '👑'; break;
    case 'Ruby': color = '#e74c3c'; symbol = '💎'; break;
    case 'Sapphire': color = '#2980b9'; symbol = '🌀'; break;
    case 'Emerald': color = '#2ecc71'; symbol = '🍃'; break;
    case 'Diamond': color = '#9b59b6'; symbol = '✨'; break;
    case 'Platinum': color = '#7f8c8d'; symbol = '🏆'; break;
    case 'Obsidian': color = '#2c3e50'; symbol = '🔥'; break;
    case 'Grandmaster': color = '#8e44ad'; symbol = '🪐'; break;
  }
  return `
    <svg viewBox="0 0 100 100" style="width: 100%; height: 100%;">
      <defs>
        <radialGradient id="grad-${tier}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.95"/>
        </radialGradient>
      </defs>
      <circle cx="50%" cy="50%" r="42" fill="url(#grad-${tier})" stroke="${color}" stroke-width="4" />
      <text x="50%" y="54" font-size="34" text-anchor="middle" dominant-baseline="middle">${symbol}</text>
    </svg>
  `;
}

function updateAvatar(tier) {
  const avatarContainer = document.querySelector('.avatar');
  if (!avatarContainer) return;

  const imgPath = `avatars/${tier.toLowerCase()}.png`;
  
  avatarContainer.innerHTML = `
    <img src="${imgPath}" alt="${tier} Avatar" 
         style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;" 
         onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
    <div class="svg-avatar-fallback" style="display: none; width: 100%; height: 100%;">${getTierSVG(tier)}</div>
  `;
}

// Render All UI Elements
function render() {
  renderProfile();
  renderPet();
  renderShop();
  renderBag();
  renderCategorySelectors();
  renderCategoriesConfig();
  renderHabitsList();
  renderTasksBoard();
  renderQuestLog();
  renderSettings();
}

// Render Profile Panel
function renderProfile() {
  const tier = getTier(state.user.level);
  document.getElementById('user-level-badge').innerText = `LVL ${state.user.level}`;
  document.getElementById('user-name-display').innerText = 'Adventurer';
  document.getElementById('user-title-display').innerText = `${tier} - ${getUserTitle(state.user.level)}`;

  updateAvatar(tier);

  // EXP bar calculations
  const nextLevelXP = state.user.level * 200;
  const xpPercentage = Math.min(100, (state.user.xp / nextLevelXP) * 100);
  
  document.getElementById('xp-numbers-display').innerText = `${state.user.xp} / ${nextLevelXP} XP`;
  document.getElementById('xp-bar-fill').style.width = `${xpPercentage}%`;

  // Stats removed
}

// Populate Category dropdown lists and filters
function renderCategorySelectors() {
  const currentTaskVal = taskCategorySelect.value;
  const currentHabitVal = habitCategorySelect.value;
  const currentFilterVal = filterCategorySelect.value;
  const currentEditTaskVal = editTaskCategory.value;
  const currentEditHabitVal = editHabitCategory.value;

  // Clear options
  taskCategorySelect.innerHTML = '';
  habitCategorySelect.innerHTML = '';
  editTaskCategory.innerHTML = '';
  editHabitCategory.innerHTML = '';
  filterCategorySelect.innerHTML = '<option value="all">All Categories</option>';

  state.categories.forEach(cat => {
    // Task selector
    const optTask = document.createElement('option');
    optTask.value = cat.id;
    optTask.innerText = `${getStatEmoji(cat.stat)} ${cat.name}`;
    taskCategorySelect.appendChild(optTask);

    // Habit selector
    const optHabit = document.createElement('option');
    optHabit.value = cat.id;
    optHabit.innerText = `${getStatEmoji(cat.stat)} ${cat.name}`;
    habitCategorySelect.appendChild(optHabit);

    // Edit Task selector
    const optEditTask = document.createElement('option');
    optEditTask.value = cat.id;
    optEditTask.innerText = `${getStatEmoji(cat.stat)} ${cat.name}`;
    editTaskCategory.appendChild(optEditTask);

    // Edit Habit selector
    const optEditHabit = document.createElement('option');
    optEditHabit.value = cat.id;
    optEditHabit.innerText = `${getStatEmoji(cat.stat)} ${cat.name}`;
    editHabitCategory.appendChild(optEditHabit);

    // Filter selector
    const optFilter = document.createElement('option');
    optFilter.value = cat.id;
    optFilter.innerText = `${getStatEmoji(cat.stat)} ${cat.name}`;
    filterCategorySelect.appendChild(optFilter);
  });

  // Restore selections if valid
  if (Array.from(taskCategorySelect.options).some(o => o.value === currentTaskVal)) taskCategorySelect.value = currentTaskVal;
  if (Array.from(habitCategorySelect.options).some(o => o.value === currentHabitVal)) habitCategorySelect.value = currentHabitVal;
  if (Array.from(filterCategorySelect.options).some(o => o.value === currentFilterVal)) filterCategorySelect.value = currentFilterVal;
  if (Array.from(editTaskCategory.options).some(o => o.value === currentEditTaskVal)) editTaskCategory.value = currentEditTaskVal;
  if (Array.from(editHabitCategory.options).some(o => o.value === currentEditHabitVal)) editHabitCategory.value = currentEditHabitVal;
}

function getStatEmoji(stat) {
  switch (stat) {
    case 'strength': return '💪';
    case 'agility': return '🏃';
    case 'focus': return '🎯';
    case 'intelligence': return '🧠';
    default: return '🏷️';
  }
}

// Render Categories Config Panel
function renderCategoriesConfig() {
  const container = document.getElementById('categories-list');
  container.innerHTML = '';

  if (state.categories.length === 0) {
    container.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted); text-align:center;">No custom categories.</div>';
    return;
  }

  state.categories.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'category-config-item';
    
    const nameWrap = document.createElement('div');
    nameWrap.className = 'category-name-wrap';
    
    const dot = document.createElement('span');
    dot.className = 'color-dot';
    dot.style.backgroundColor = cat.color;

    const label = document.createElement('span');
    label.innerText = `${cat.name}`;

    nameWrap.appendChild(dot);
    nameWrap.appendChild(label);
    
    const actionsWrap = document.createElement('div');
    actionsWrap.style.display = 'flex';
    actionsWrap.style.gap = '0.25rem';

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.innerText = '✏️';
    editBtn.className = 'btn-action';
    editBtn.style.padding = '2px 6px';
    editBtn.style.fontSize = '10px';
    editBtn.style.borderRadius = '4px';
    editBtn.style.cursor = 'pointer';
    editBtn.onclick = () => startEditCategory(cat.id);

    const delBtn = document.createElement('button');
    delBtn.innerText = '×';
    delBtn.className = 'btn-delete';
    delBtn.style.padding = '0px 6px';
    delBtn.style.fontSize = '10px';
    delBtn.style.borderRadius = '4px';
    delBtn.style.cursor = 'pointer';
    delBtn.onclick = () => deleteCategory(cat.id);

    actionsWrap.appendChild(editBtn);
    actionsWrap.appendChild(delBtn);

    item.appendChild(nameWrap);
    item.appendChild(actionsWrap);
    container.appendChild(item);
  });
}

// Render Activity Log (History)
function renderQuestLog() {
  const feed = document.getElementById('history-feed');
  feed.innerHTML = '';

  if (state.history.length === 0) {
    feed.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; margin-top: 1rem;">No activities recorded yet.</div>';
    return;
  }

  // Show latest history first
  [...state.history].reverse().forEach(item => {
    const card = document.createElement('div');
    const xp = item.xpChange || 0;
    
    let statusClass = 'xp-neutral';
    if (xp > 0) statusClass = 'xp-gain';
    else if (xp < 0) statusClass = 'xp-loss';
    
    card.className = `history-item ${statusClass}`;

    const desc = document.createElement('span');
    desc.className = 'history-desc';
    desc.innerText = item.description;

    const change = document.createElement('span');
    change.className = 'history-xp-change';
    if (xp !== 0) {
      change.innerText = `${xp > 0 ? '+' : ''}${xp} XP`;
    } else {
      change.innerText = '';
    }

    const time = document.createElement('span');
    time.className = 'history-time';
    time.innerText = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    card.appendChild(desc);
    card.appendChild(change);
    card.appendChild(time);
    feed.appendChild(card);
  });
}

// Render Habits
function renderHabitsList() {
  const container = document.getElementById('habits-container');
  container.innerHTML = '';

  if (state.habits.length === 0) {
    container.innerHTML = '<div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 1rem 0;">No active habits. Inscribe one to start!</div>';
    return;
  }

  const todayStr = getTodayString();
  const todayDayOfWeek = new Date().getDay(); // 0 is Sunday, 1 is Monday...

  // Filter habits to show only those scheduled for today
  const todayHabits = state.habits.filter(habit => {
    return habit.days && habit.days.includes(todayDayOfWeek);
  });

  if (todayHabits.length === 0) {
    container.innerHTML = '<div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 1.5rem 0;">Rest Day! No habits scheduled for today. 💤</div>';
    return;
  }

  todayHabits.forEach(habit => {
    const isCompletedToday = habit.lastCompletedDate === todayStr;
    const isScheduledToday = habit.days && habit.days.includes(todayDayOfWeek);
    const cat = state.categories.find(c => c.id === habit.categoryId);
    const catColor = cat ? cat.color : 'var(--primary)';
    const catName = cat ? cat.name : 'Unknown';

    const card = document.createElement('div');
    card.className = 'habit-card';

    const info = document.createElement('div');
    info.className = 'habit-info';

    const name = document.createElement('div');
    name.className = 'habit-name';
    name.innerText = habit.title;

    const meta = document.createElement('div');
    meta.className = 'habit-meta';

    const badge = document.createElement('span');
    badge.className = 'category-badge';
    badge.style.backgroundColor = `${catColor}22`;
    badge.style.color = catColor;
    badge.style.border = `1px solid ${catColor}44`;
    badge.innerText = catName;

    const streak = document.createElement('span');
    streak.className = 'habit-streak';
    
    let streakText = `🔥 ${habit.streak} Streak`;
    if (!isScheduledToday) {
      streakText += ' (Rest)';
    }
    streak.innerHTML = streakText;

    meta.appendChild(badge);
    meta.appendChild(streak);
    info.appendChild(name);
    info.appendChild(meta);

    // Days representation row
    const daysRow = document.createElement('div');
    daysRow.className = 'habit-days-row';
    daysRow.innerHTML = '<span class="habit-days-label">Schedule:</span>';
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (let i = 0; i < 7; i++) {
      const dayIdx = (i + 1) % 7; // Mon=1, Tue=2 ... Sun=0
      const isActive = habit.days && habit.days.includes(dayIdx);
      const dayDot = document.createElement('span');
      dayDot.className = `habit-day-dot ${isActive ? 'active' : ''}`;
      dayDot.innerText = dayLabels[dayIdx];
      daysRow.appendChild(dayDot);
    }
    info.appendChild(daysRow);

    const actions = document.createElement('div');
    actions.className = 'habit-actions';

    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-action btn-delete';
    delBtn.innerText = 'Delete';
    delBtn.onclick = () => deleteHabit(habit.id);

    // Edit Button
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-action btn-edit';
    editBtn.innerText = '✏️ Edit';
    editBtn.onclick = () => openEditHabit(habit.id);

    // Checkbox Button
    const checkBtn = document.createElement('button');
    
    if (isCompletedToday) {
      checkBtn.className = 'btn-action btn-complete checked';
      checkBtn.innerText = '✓ Checked';
      checkBtn.disabled = true;
    } else if (!isScheduledToday) {
      checkBtn.className = 'btn-action';
      checkBtn.innerText = '💤 Rest';
      checkBtn.disabled = true;
      checkBtn.style.opacity = '0.4';
      checkBtn.style.cursor = 'not-allowed';
      checkBtn.title = 'Not scheduled for today';
    } else {
      checkBtn.className = 'btn-action btn-complete';
      checkBtn.innerText = '⏰ Check In';
      checkBtn.disabled = false;
      checkBtn.style.opacity = '1';
      checkBtn.style.cursor = 'pointer';
      checkBtn.onclick = () => checkInHabit(habit.id);
    }

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    actions.appendChild(checkBtn);
    card.appendChild(info);
    card.appendChild(actions);

    container.appendChild(card);
  });
}

// Render Tasks Board
function renderTasksBoard() {
  const activeList = document.getElementById('active-tasks-list');
  const completedList = document.getElementById('completed-tasks-list');

  activeList.innerHTML = '';
  completedList.innerHTML = '';

  const filterCategory = filterCategorySelect.value;
  const filterPriority = filterPrioritySelect.value;
  const sortBy = sortTasksSelect.value;

  let activeCount = 0;
  let completedCount = 0;

  const getPriorityWeight = (p) => {
    if (p === 'high') return 3;
    if (p === 'medium') return 2;
    if (p === 'low') return 1;
    return 0;
  };

  const filteredTasks = state.tasks.filter(task => {
    if (filterCategory !== 'all' && task.categoryId !== filterCategory) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    return true;
  });

  filteredTasks.sort((a, b) => {
    if (sortBy === 'deadline-asc') {
      return new Date(a.deadline) - new Date(b.deadline);
    } else if (sortBy === 'deadline-desc') {
      return new Date(b.deadline) - new Date(a.deadline);
    } else if (sortBy === 'priority-desc') {
      return getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
    } else if (sortBy === 'priority-asc') {
      return getPriorityWeight(a.priority) - getPriorityWeight(b.priority);
    } else if (sortBy === 'created-desc') {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    } else if (sortBy === 'created-asc') {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    }
    return 0;
  });

  filteredTasks.forEach(task => {
    const cat = state.categories.find(c => c.id === task.categoryId);
    const catColor = cat ? cat.color : 'var(--primary)';
    const catName = cat ? cat.name : 'Unknown';

    const card = document.createElement('div');
    card.className = 'task-card';

    // Header
    const header = document.createElement('div');
    header.className = 'task-header';

    const title = document.createElement('span');
    title.className = 'task-title';
    title.innerText = task.title;

    const priTag = document.createElement('span');
    priTag.className = `priority-tag ${task.priority}`;
    priTag.innerText = task.priority;

    header.appendChild(title);
    header.appendChild(priTag);
    card.appendChild(header);

    // Description
    if (task.description) {
      const desc = document.createElement('p');
      desc.className = 'task-description';
      desc.innerText = task.description;
      card.appendChild(desc);
    }

    // Meta (Deadline & Category)
    const meta = document.createElement('div');
    meta.className = 'task-meta';

    const badge = document.createElement('span');
    badge.className = 'category-badge';
    badge.style.backgroundColor = `${catColor}22`;
    badge.style.color = catColor;
    badge.style.border = `1px solid ${catColor}44`;
    badge.innerText = catName;
    meta.appendChild(badge);

    const deadlineInfo = document.createElement('div');
    deadlineInfo.className = 'task-deadline';
    
    const dlDate = new Date(task.deadline);
    const now = new Date();

    if (task.status === 'completed') {
      deadlineInfo.innerText = `Done at: ${new Date(task.completedAt).toLocaleDateString()} ${new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      if (task.completedLate) {
        deadlineInfo.classList.add('overdue-completed');
        deadlineInfo.innerText += ' (Late)';
      }
    } else {
      deadlineInfo.innerText = `Due: ${dlDate.toLocaleDateString()} ${dlDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      if (dlDate < now) {
        deadlineInfo.classList.add('overdue');
        deadlineInfo.innerText += ' [OVERDUE]';
      }
    }
    meta.appendChild(deadlineInfo);
    card.appendChild(meta);

    if (task.status === 'active') {
      // Footer actions
      const footer = document.createElement('div');
      footer.className = 'task-footer-actions';

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-action btn-delete';
      delBtn.innerText = 'Delete';
      delBtn.onclick = () => deleteTask(task.id);
      footer.appendChild(delBtn);

      const editBtn = document.createElement('button');
      editBtn.className = 'btn-action btn-edit';
      editBtn.innerText = '✏️ Edit';
      editBtn.style.marginRight = 'auto';
      editBtn.onclick = () => openEditTask(task.id);
      footer.appendChild(editBtn);

      const compBtn = document.createElement('button');
      compBtn.className = 'btn-action btn-complete';
      compBtn.innerText = 'Complete Quest';
      compBtn.onclick = () => completeTask(task.id);
      footer.appendChild(compBtn);

      card.appendChild(footer);
      activeList.appendChild(card);
      activeCount++;
    } else {
      completedList.appendChild(card);
      completedCount++;
    }
  });

  document.getElementById('active-tasks-count').innerText = activeCount;
  document.getElementById('completed-tasks-count').innerText = completedCount;
}

// Category logic
document.getElementById('category-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('category-name-input');
  const colorInput = document.getElementById('category-color-input');

  if (editingCategoryId) {
    // Update existing
    const cat = state.categories.find(c => c.id === editingCategoryId);
    if (cat) {
      cat.name = nameInput.value.trim();
      cat.color = colorInput.value;
      logActivity(`Edited Category: "${cat.name}"`);
    }
    editingCategoryId = null;
    categorySubmitBtn.innerText = '+';
    categorySubmitBtn.style.backgroundColor = '';
    categorySubmitBtn.style.color = '';
    categorySubmitBtn.style.borderColor = '';
  } else {
    // Add new
    const newCat = {
      id: `cat-${Date.now()}`,
      name: nameInput.value.trim(),
      color: colorInput.value
    };
    state.categories.push(newCat);
    logActivity(`Added Category: "${newCat.name}"`);
  }
  
  nameInput.value = '';
  await saveData();
});

async function deleteCategory(id) {
  const cat = state.categories.find(c => c.id === id);
  if (cat) {
    logActivity(`Deleted Category: "${cat.name}"`);
  }
  // Disallow deleting base category if it's the last one
  state.categories = state.categories.filter(c => c.id !== id);
  await saveData();
}

// Create Task
taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-desc').value.trim();
  const priority = document.getElementById('task-priority').value;
  const categoryId = taskCategorySelect.value;
  const deadline = document.getElementById('task-deadline').value;

  if (!categoryId) {
    alert('Please create at least one category before quest creation.');
    return;
  }

  const newTask = {
    id: `task-${Date.now()}`,
    title,
    description,
    priority,
    categoryId,
    deadline,
    status: 'active',
    penalized: false,
    createdAt: new Date().toISOString()
  };

  state.tasks.push(newTask);
  logActivity(`Added Quest: "${newTask.title}"`);
  taskForm.reset();
  
  // Restore selected tab and tab displays
  tabTaskBtn.classList.add('active');
  tabHabitBtn.classList.remove('active');
  taskForm.style.display = 'block';
  habitForm.style.display = 'none';
  tasksSection.style.display = 'block';
  habitsSection.style.display = 'none';

  await saveData();
});

// Create Habit
habitForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('habit-title').value.trim();
  const categoryId = habitCategorySelect.value;

  if (!categoryId) {
    alert('Please create a category first before adding habits.');
    return;
  }

  const activePills = document.querySelectorAll('#habit-days-selector .day-pill.active');
  const days = Array.from(activePills).map(p => parseInt(p.getAttribute('data-day')));
  if (days.length === 0) {
    alert('Please select at least one scheduled day for this ritual.');
    return;
  }

  const newHabit = {
    id: `habit-${Date.now()}`,
    title,
    categoryId,
    streak: 0,
    days,
    lastCompletedDate: null,
    lastPenalizedDate: null
  };

  state.habits.push(newHabit);
  logActivity(`Added Habit: "${newHabit.title}"`);
  habitForm.reset();
  // Reset selector pills to all active
  document.querySelectorAll('#habit-days-selector .day-pill').forEach(pill => pill.classList.add('active'));

  tabHabitBtn.classList.add('active');
  tabTaskBtn.classList.remove('active');
  habitForm.style.display = 'block';
  taskForm.style.display = 'none';
  habitsSection.style.display = 'block';
  tasksSection.style.display = 'none';

  await saveData();
});

// Complete Task
async function completeTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task || task.status === 'completed') return;

  const now = new Date();
  const deadline = new Date(task.deadline);
  const isOverdue = deadline < now;

  let xpEarned = 0;
  const multiplier = getPriorityMultiplier(task.priority);

  if (isOverdue) {
    // Completed late: Flat 20 XP reward. No multiplier.
    xpEarned = 20;
    task.completedLate = true;
  } else {
    // Completed on time: 100 base * Multiplier
    xpEarned = Math.round(100 * multiplier);
    task.completedLate = false;
  }

  // Adjust User XP and Coins
  const coinsEarned = Math.round(10 * multiplier);
  if (state.user.coins === undefined) state.user.coins = 0;
  state.user.coins += coinsEarned;

  adjustXP(xpEarned, `Completed Quest: "${task.title}" (Earned ${coinsEarned}🪙)`);
  
  task.status = 'completed';
  task.completedAt = now.toISOString();

  // Trigger confetti celebration!
  startConfetti();
  
  handlePokemonDrop();

  await saveData();
}

// Delete Task
async function deleteTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    logActivity(`Deleted Quest: "${task.title}"`);
  }
  state.tasks = state.tasks.filter(t => t.id !== id);
  await saveData();
}

// Habit Streak XP Multipliers
function getStreakMultiplier(streak) {
  if (streak < 10) return 1.0;
  if (streak < 25) return 1.1;
  if (streak < 50) return 1.2;
  if (streak < 100) return 1.3;
  if (streak < 150) return 1.4;
  return parseFloat((1.5 + Math.floor((streak - 150) / 100) * 0.1).toFixed(1));
}

// Find last scheduled date going back up to 7 days
function getLastScheduledDateStr(daysArray, beforeDate) {
  if (!daysArray || daysArray.length === 0) return null;
  let d = new Date(beforeDate);
  for (let i = 1; i <= 7; i++) {
    d.setDate(d.getDate() - 1);
    let dayOfWeek = d.getDay();
    if (daysArray.includes(dayOfWeek)) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  return null;
}

// Complete Habit Check-in
async function checkInHabit(id) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;

  const todayStr = getTodayString();
  if (habit.lastCompletedDate === todayStr) return; // Already checked in today

  // Streak logic based on scheduled days
  const lastScheduledDateStr = getLastScheduledDateStr(habit.days, new Date());
  if (lastScheduledDateStr && habit.lastCompletedDate === lastScheduledDateStr) {
    habit.streak += 1;
  } else {
    habit.streak = 1;
  }

  // Multiplicative Habit reward: base 30 XP * Streak Multiplier
  const streakMult = getStreakMultiplier(habit.streak);
  const xpEarned = Math.round(30 * streakMult);

  // Award Coins based on streak
  const coinsEarned = Math.round(10 * streakMult);
  if (state.user.coins === undefined) state.user.coins = 0;
  state.user.coins += coinsEarned;

  adjustXP(xpEarned, `Performed Habit: "${habit.title}" (Earned ${coinsEarned}🪙, Streak 🔥 ${habit.streak})`);
  
  habit.lastCompletedDate = todayStr;

  startConfetti();
  
  handlePokemonDrop();
  
  await saveData();
}

// Delete Habit
async function deleteHabit(id) {
  const habit = state.habits.find(h => h.id === id);
  if (habit) {
    logActivity(`Deleted Habit: "${habit.title}"`);
  }
  state.habits = state.habits.filter(h => h.id !== id);
  await saveData();
}

// Log an activity into the history feed
function logActivity(description, xpChange = 0) {
  state.history.push({
    timestamp: new Date().toISOString(),
    description,
    xpChange
  });

  // Limit history length to 50 logs
  if (state.history.length > 50) {
    state.history.shift();
  }
}

// XP Adjustments and Level Up System
function adjustXP(amount, reason) {
  const tier = getTier(state.user.level);
  const modifiers = getTierModifiers(tier);
  let finalAmount = amount;

  let modifierText = '';
  if (amount > 0) {
    finalAmount = Math.round(amount * modifiers.gain);
    if (modifiers.gain !== 1.0) {
      modifierText = ` [x${modifiers.gain} Tier Bonus]`;
    }
  } else if (amount < 0) {
    finalAmount = Math.round(amount * modifiers.loss);
    if (modifiers.loss !== 1.0) {
      modifierText = ` [x${modifiers.loss} Tier Penalty]`;
    }
  }

  state.user.xp += finalAmount;
  
  // Cap XP at 0 minimum
  if (state.user.xp < 0) {
    state.user.xp = 0;
  }

  // Level Up Check
  let levelsGained = 0;
  let nextLevelXP = state.user.level * 200;
  
  while (state.user.xp >= nextLevelXP) {
    state.user.xp -= nextLevelXP;
    state.user.level += 1;
    levelsGained++;
    nextLevelXP = state.user.level * 200;
  }

  // Record history
  logActivity(reason + modifierText, finalAmount);

  if (levelsGained > 0) {
    // Buff user stats on level up
    state.user.stats.strength += levelsGained;
    state.user.stats.agility += levelsGained;
    state.user.stats.focus += levelsGained;
    state.user.stats.intelligence += levelsGained;

    triggerLevelUpModal(state.user.level, levelsGained);
  }
}

// Display Level Up Popup UI
function triggerLevelUpModal(newLevel, points) {
  document.getElementById('popup-new-level').innerText = newLevel;
  document.getElementById('popup-stat-strength').innerText = `+${points}`;
  document.getElementById('popup-stat-agility').innerText = `+${points}`;
  document.getElementById('popup-stat-focus').innerText = `+${points}`;
  document.getElementById('popup-stat-intelligence').innerText = `+${points}`;
  
  document.getElementById('levelup-overlay').classList.add('active');
  startConfetti();
}

// Close Modal
document.getElementById('levelup-close-btn').addEventListener('click', () => {
  document.getElementById('levelup-overlay').classList.remove('active');
});

// Priority Multiplier translation
function getPriorityMultiplier(priority) {
  switch (priority) {
    case 'high': return 2.0;
    case 'medium': return 1.5;
    case 'low':
    default: return 1.0;
  }
}

// Time calculation helpers
function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Scheduler Tick Check: runs every 60 seconds (or immediately on load)
async function performTickChecks() {
  const now = new Date();
  let changed = false;

  // 1. Check for expired task deadlines (apply penalty if not already done)
  state.tasks.forEach(task => {
    if (task.status === 'active' && !task.penalized) {
      const deadline = new Date(task.deadline);
      if (deadline < now) {
        task.penalized = true;
        const multiplier = getPriorityMultiplier(task.priority);
        const penalty = Math.round(-50 * multiplier);
        
        adjustXP(penalty, `Missed Deadline Penalty: "${task.title}"`);
        changed = true;
      }
    }
  });

  // 2. Check for habits missed on their last scheduled day
  state.habits.forEach(habit => {
    const lastScheduledDateStr = getLastScheduledDateStr(habit.days, new Date());
    if (lastScheduledDateStr) {
      const notCompletedOnTime = !habit.lastCompletedDate || habit.lastCompletedDate < lastScheduledDateStr;
      const notPenalizedYet = !habit.lastPenalizedDate || habit.lastPenalizedDate < lastScheduledDateStr;
      
      if (notCompletedOnTime && notPenalizedYet) {
        if (habit.streak > 0 || habit.lastCompletedDate !== null) {
          habit.streak = 0;
          adjustXP(-20, `Missed Habit Penalty: "${habit.title}"`);
          habit.lastPenalizedDate = lastScheduledDateStr;
          changed = true;
        }
      }
    }
  });

  if (changed) {
    await saveData();
  }
}

// Set up periodic tick checks every 60 seconds
setInterval(performTickChecks, 60000);

// Filter Event Listeners
filterCategorySelect.addEventListener('change', renderTasksBoard);
filterPrioritySelect.addEventListener('change', renderTasksBoard);
sortTasksSelect.addEventListener('change', renderTasksBoard);


// --- CUSTOM HTML5 CANVAS CONFETTI ENGINE ---
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');

let confettiActive = false;
let confettiParticles = [];
const particleCount = 120;
const colors = ['#6c5ce7', '#ff7675', '#ffa502', '#1e90ff', '#2ed573', '#ffd32a'];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class ConfettiParticle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * -canvas.height - 20;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 10 - 5;
    this.speedY = Math.random() * 5 + 4;
    this.speedX = Math.random() * 4 - 2;
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.width = Math.random() * 8 + 6;
    this.height = Math.random() * 12 + 8;
  }

  update() {
    this.y += this.speedY;
    this.x += this.speedX;
    this.rotation += this.rotationSpeed;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
    ctx.restore();
  }
}

function startConfetti() {
  if (confettiActive) return;
  confettiActive = true;
  confettiParticles = [];
  
  for (let i = 0; i < particleCount; i++) {
    confettiParticles.push(new ConfettiParticle());
  }

  animateConfetti();
  
  // Stop spawning/running confetti after 4 seconds
  setTimeout(() => {
    confettiActive = false;
  }, 4000);
}

function animateConfetti() {
  if (!confettiActive && confettiParticles.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = confettiParticles.length - 1; i >= 0; i--) {
    const p = confettiParticles[i];
    p.update();
    p.draw();

    // Remove particles out of bounds when animation is winding down
    if (p.y > canvas.height) {
      if (confettiActive) {
        // Respawn at top
        confettiParticles[i] = new ConfettiParticle();
      } else {
        // Delete particle
        confettiParticles.splice(i, 1);
      }
    }
  }

  requestAnimationFrame(animateConfetti);
}


// --- INLINE CATEGORY EDITING ---
function startEditCategory(id) {
  const cat = state.categories.find(c => c.id === id);
  if (!cat) return;

  editingCategoryId = cat.id;
  document.getElementById('category-name-input').value = cat.name;
  document.getElementById('category-color-input').value = cat.color;

  categorySubmitBtn.innerText = 'Save';
  categorySubmitBtn.style.backgroundColor = 'var(--success)';
  categorySubmitBtn.style.color = '#fff';
  categorySubmitBtn.style.borderColor = 'var(--success)';
}

// --- TASK EDITING MODAL TRIGGERS ---
function openEditTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  editTaskId.value = task.id;
  editTaskTitle.value = task.title;
  editTaskDesc.value = task.description || '';
  editTaskPriority.value = task.priority;
  editTaskCategory.value = task.categoryId;
  editTaskDeadline.value = task.deadline;

  editTaskModal.classList.add('active');
}

editTaskCancelBtn.addEventListener('click', () => {
  editTaskModal.classList.remove('active');
  editTaskForm.reset();
});

editTaskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = editTaskId.value;
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    task.title = editTaskTitle.value.trim();
    task.description = editTaskDesc.value.trim();
    task.priority = editTaskPriority.value;
    task.categoryId = editTaskCategory.value;
    task.deadline = editTaskDeadline.value;
    logActivity(`Edited Quest: "${task.title}"`);
  }
  
  editTaskModal.classList.remove('active');
  editTaskForm.reset();
  await saveData();
});

// --- HABIT EDITING MODAL TRIGGERS ---
function openEditHabit(id) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;

  editHabitId.value = habit.id;
  editHabitTitle.value = habit.title;
  editHabitCategory.value = habit.categoryId;

  // Set active pills based on habit days
  document.querySelectorAll('#edit-habit-days-selector .day-pill').forEach(pill => {
    const d = parseInt(pill.getAttribute('data-day'));
    if (habit.days && habit.days.includes(d)) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  editHabitModal.classList.add('active');
}

editHabitCancelBtn.addEventListener('click', () => {
  editHabitModal.classList.remove('active');
  editHabitForm.reset();
  document.querySelectorAll('#edit-habit-days-selector .day-pill').forEach(pill => pill.classList.add('active'));
});

editHabitForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = editHabitId.value;
  const habit = state.habits.find(h => h.id === id);
  
  const editActivePills = document.querySelectorAll('#edit-habit-days-selector .day-pill.active');
  const days = Array.from(editActivePills).map(p => parseInt(p.getAttribute('data-day')));
  if (days.length === 0) {
    alert('Please select at least one scheduled day for this habit.');
    return;
  }

  if (habit) {
    habit.title = editHabitTitle.value.trim();
    habit.categoryId = editHabitCategory.value;
    habit.days = days;
    logActivity(`Edited Habit: "${habit.title}"`);
  }

  editHabitModal.classList.remove('active');
  editHabitForm.reset();
  document.querySelectorAll('#edit-habit-days-selector .day-pill').forEach(pill => pill.classList.add('active'));
  await saveData();
});

// --- RANK PROGRESSION MODAL ---
function getNextTierLevel(currentLevel) {
  if (currentLevel >= 45) return 45; // Maxed out
  if (currentLevel >= 40) return 45;
  if (currentLevel >= 35) return 40;
  if (currentLevel >= 30) return 35;
  if (currentLevel >= 25) return 30;
  if (currentLevel >= 20) return 25;
  if (currentLevel >= 15) return 20;
  if (currentLevel >= 10) return 15;
  if (currentLevel >= 5) return 10;
  return 5;
}

function getXPToNextRank() {
  const currentLevel = state.user.level;
  const currentXP = state.user.xp;
  const currentTier = getTier(currentLevel);
  
  if (currentTier === 'Grandmaster') {
    return 0; // Max Rank reached
  }
  
  const nextTierLevel = getNextTierLevel(currentLevel);
  
  let totalNeeded = (currentLevel * 200) - currentXP;
  for (let l = currentLevel + 1; l < nextTierLevel; l++) {
    totalNeeded += l * 200;
  }
  return totalNeeded;
}

function getRankMilestoneProgress() {
  const currentLevel = state.user.level;
  const currentTier = getTier(currentLevel);
  if (currentTier === 'Grandmaster') return { current: 5, target: 5, percent: 100 };
  
  const nextTierLevel = getNextTierLevel(currentLevel);
  const startTierLevel = nextTierLevel - 5;
  
  const levelsInCurrentTier = currentLevel - startTierLevel;
  const percent = Math.min(100, Math.round((levelsInCurrentTier / 5) * 100));
  
  return {
    current: levelsInCurrentTier,
    target: 5,
    percent: percent
  };
}

function getRankEmoji(tier) {
  switch (tier) {
    case 'Bronze': return '🛡️';
    case 'Silver': return '⚔️';
    case 'Gold': return '👑';
    case 'Ruby': return '💎';
    case 'Sapphire': return '🌀';
    case 'Emerald': return '🍃';
    case 'Diamond': return '✨';
    case 'Platinum': return '🏆';
    case 'Obsidian': return '🔥';
    case 'Grandmaster': return '🪐';
    default: return '🛡️';
  }
}

// Calculate user cumulative XP from level 1
function getUserCumulativeXP(level, xp) {
  let total = xp;
  for (let i = 1; i < level; i++) {
    total += i * 200;
  }
  return total;
}

// Calculate target rank cumulative XP threshold from level 1
function getRankThresholdCumulativeXP(targetLevel) {
  let total = 0;
  for (let i = 1; i < targetLevel; i++) {
    total += i * 200;
  }
  return total;
}

// Rank Progression Modal Details
rankInfoBtn.addEventListener('click', () => {
  const currentLevel = state.user.level;
  const currentXP = state.user.xp;
  const currentTier = getTier(currentLevel);
  
  if (currentTier === 'Grandmaster') {
    rankModalIcon.innerText = getRankEmoji('Grandmaster');
    rankModalTitle.innerText = 'Max Rank Reached';
    
    const userCumXP = getUserCumulativeXP(currentLevel, currentXP);
    
    rankModalText.innerHTML = `
      <div style="text-align: center; margin-bottom: 1.5rem; font-size: 1rem;">
        You are a legendary <strong>Grandmaster</strong>! You have reached the pinnacle of rank progression.
      </div>
      <div class="rank-details-grid">
        <div class="rank-detail-item">
          <span class="rank-detail-label">Current Rank</span>
          <span class="rank-detail-value" style="color: var(--primary);">${currentTier}</span>
        </div>
        <div class="rank-detail-item">
          <span class="rank-detail-label">Current Level</span>
          <span class="rank-detail-value">LVL ${currentLevel}</span>
        </div>
        <div class="rank-detail-item">
          <span class="rank-detail-label">Current Level EXP</span>
          <span class="rank-detail-value">${currentXP} XP (Max)</span>
        </div>
        <div class="rank-detail-item">
          <span class="rank-detail-label">Total Accumulated EXP</span>
          <span class="rank-detail-value">${userCumXP.toLocaleString()} XP</span>
        </div>
      </div>
    `;
    rankModalLevelsProgress.innerText = 'Max Level Achieved';
    rankModalBarFill.style.width = '100%';
  } else {
    const nextTierLevel = getNextTierLevel(currentLevel);
    const nextTier = getTier(nextTierLevel);
    const xpNeeded = getXPToNextRank();
    const progress = getRankMilestoneProgress();
    
    const userCumXP = getUserCumulativeXP(currentLevel, currentXP);
    const nextRankThresholdCumXP = getRankThresholdCumulativeXP(nextTierLevel);
    
    rankModalIcon.innerText = getRankEmoji(nextTier);
    rankModalTitle.innerText = `${nextTier} Rank Progression`;
    
    rankModalText.innerHTML = `
      <div class="rank-details-grid">
        <div class="rank-detail-item">
          <span class="rank-detail-label">Current Rank</span>
          <span class="rank-detail-value" style="color: var(--primary);">${currentTier}</span>
        </div>
        <div class="rank-detail-item">
          <span class="rank-detail-label">Next Rank</span>
          <span class="rank-detail-value" style="color: var(--xp-color);">${nextTier}</span>
        </div>
        <div class="rank-detail-item">
          <span class="rank-detail-label">Current Level & EXP</span>
          <span class="rank-detail-value">LVL ${currentLevel} (${currentXP} / ${currentLevel * 200} XP)</span>
        </div>
        <div class="rank-detail-item">
          <span class="rank-detail-label">Total EXP Earned</span>
          <span class="rank-detail-value">${userCumXP.toLocaleString()} XP</span>
        </div>
        <div class="rank-detail-item">
          <span class="rank-detail-label">Next Rank Unlocks At</span>
          <span class="rank-detail-value">${nextRankThresholdCumXP.toLocaleString()} Total XP</span>
        </div>
        <div class="rank-detail-item">
          <span class="rank-detail-label">Remaining EXP Needed</span>
          <span class="rank-detail-value" style="color: var(--success);">${xpNeeded.toLocaleString()} XP</span>
        </div>
      </div>
    `;
    
    rankModalLevelsProgress.innerText = `Level ${currentLevel} / ${nextTierLevel}`;
    rankModalBarFill.style.width = `${progress.percent}%`;
  }
  
  rankModal.classList.add('active');
});

rankModalCloseBtn.addEventListener('click', () => {
  rankModal.classList.remove('active');
});

// Render Settings Drawer Values
function renderSettings() {
  // 2. Rank display
  const rankDisplay = document.getElementById('settings-rank-display');
  if (rankDisplay) {
    const currentLevel = state.user.level;
    const currentTier = getTier(currentLevel);
    rankDisplay.innerHTML = `
      <span style="font-size: 1.25rem;">${getRankEmoji(currentTier)}</span>
      <span>${currentTier} (LVL ${currentLevel})</span>
    `;
  }

  // 3. Completed quests count
  const completedCount = state.tasks.filter(t => t.status === 'completed').length;
  const completedDisplay = document.getElementById('settings-completed-quests-display');
  if (completedDisplay) {
    completedDisplay.innerText = completedCount;
  }

  // 4. Pending quests count
  const pendingCount = state.tasks.filter(t => t.status === 'active').length;
  const pendingDisplay = document.getElementById('settings-pending-quests-display');
  if (pendingDisplay) {
    pendingDisplay.innerText = pendingCount;
  }
  // Always ensure dark theme class is removed
  document.body.classList.remove('dark-theme');
}



// --- COLLAPSIBLE NAVIGATION SIDEBAR & ROUTING SYSTEM ---
function initSidebarAndRouting() {
  // Sidebar Collapse State Persistence
  const sidebarCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
  if (sidebarCollapsed && navSidebar) {
    navSidebar.classList.add('collapsed');
  }

  // Active View State Persistence (default is dashboard)
  let hash = window.location.hash.replace('#', '');
  
  // If the hash is a Netlify Identity token, do not route to it!
  const isNetlifyToken = hash.startsWith('confirmation_token=') || 
                         hash.startsWith('invite_token=') || 
                         hash.startsWith('recovery_token=') || 
                         hash.startsWith('access_token=') || 
                         hash.startsWith('error=');
                         
  if (isNetlifyToken) {
    hash = ''; // Clear it so we fallback to saved view or dashboard
  }

  const savedView = hash || localStorage.getItem('active_view') || 'dashboard';
  switchView(savedView);

  // Listen for hash changes to support browser navigation (back/forward)
  window.addEventListener('hashchange', () => {
    const currentHash = window.location.hash.replace('#', '');
    const isNetlifyTokenChange = currentHash.startsWith('confirmation_token=') || 
                                 currentHash.startsWith('invite_token=') || 
                                 currentHash.startsWith('recovery_token=') || 
                                 currentHash.startsWith('access_token=') || 
                                 currentHash.startsWith('error=');
    if (currentHash && !isNetlifyTokenChange) {
      switchView(currentHash);
    } else if (!currentHash) {
      // If hash was cleared (e.g. by Netlify Identity widget), go to saved view
      const savedView = localStorage.getItem('active_view') || 'dashboard';
      switchView(savedView);
    }
  });

  // Set up Event Listeners
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', () => {
      const isCollapsed = navSidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebar_collapsed', isCollapsed ? 'true' : 'false');
    });
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      navSidebar.classList.add('active');
      sidebarBackdrop.classList.add('active');
    });
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => {
      navSidebar.classList.remove('active');
      sidebarBackdrop.classList.remove('active');
    });
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      switchView(view);
      
      // Close sidebar drawer on mobile
      navSidebar.classList.remove('active');
      sidebarBackdrop.classList.remove('active');
    });
  });

}

function switchView(viewName) {
  // Save current active view (only if it is a valid view, not a token)
  const isNetlifyToken = viewName.startsWith('confirmation_token=') || 
                         viewName.startsWith('invite_token=') || 
                         viewName.startsWith('recovery_token=') || 
                         viewName.startsWith('access_token=') || 
                         viewName.startsWith('error=');
  if (isNetlifyToken) return;

  localStorage.setItem('active_view', viewName);
  
  // Sync the URL hash (only if we're not inside a Netlify token redirect)
  const currentHash = window.location.hash.replace('#', '');
  const isCurrentHashToken = currentHash.startsWith('confirmation_token=') || 
                             currentHash.startsWith('invite_token=') || 
                             currentHash.startsWith('recovery_token=') || 
                             currentHash.startsWith('access_token=') || 
                             currentHash.startsWith('error=');
  if (!isCurrentHashToken && window.location.hash !== `#${viewName}`) {
    window.location.hash = viewName;
  }

  // Toggle active class on menu items
  navItems.forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Toggle active class on view panels
  viewPanels.forEach(panel => {
    if (panel.id === `view-${viewName}`) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });

  // Trigger UI renders
  render();
}

// Settings Rank Card click -> open Rank progression modal
if (settingsRankCard) {
  settingsRankCard.addEventListener('click', () => {
    rankInfoBtn.click();
  });
}

// Reset Database to clean slate
if (resetAppBtn) {
  resetAppBtn.addEventListener('click', async () => {
    const confirmed = confirm("Are you absolutely sure you want to reset all your progress, quests, rituals, categories, and statistics? This will restore the app to a clean slate and cannot be undone.");
    if (!confirmed) return;
    
    state = {
      user: {
        level: 1,
        xp: 0,
        stats: {
          strength: 10,
          agility: 10,
          focus: 10,
          intelligence: 10
        },
        loginStreak: 1,
        lastLoginDate: getTodayString(),
        obtainedPokemon: [],
        tasksCompletedForDrop: 0,
        nextDropRequirement: Math.floor(Math.random() * 20) + 1
      },
      tasks: [],
      habits: [],
      categories: [
        { id: "cat-work", name: "Work", color: "#4f46e5", stat: "focus" },
        { id: "cat-health", name: "Health", color: "#16a34a", stat: "strength" },
        { id: "cat-study", name: "Study", color: "#2563eb", stat: "intelligence" },
        { id: "cat-personal", name: "Personal", color: "#d97706", stat: "agility" }
      ],
      history: [],
      theme: 'light'
    };
    
    localStorage.removeItem('active_view');
    await saveData();
    
    alert("Database has been reset to a clean slate!");
    window.location.reload();
  });
}

// Toggle habit days selectors (delegated)
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('day-pill')) {
    e.target.classList.toggle('active');
  }
});

// Start App on Page Load
window.onload = () => {
  loadData();
  renderPokedex();

  // Periodic check/sync every 30 seconds
  setInterval(() => {
    if (supabaseUser) {
      syncPullSupabase();
    }
  }, 30000);
};

// Render Pokedex
function renderPokedex() {
  const grid = document.getElementById('pokedex-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  if (typeof pokemonSprites === 'undefined') return;

  const filterSelect = document.getElementById('pokedex-filter-select');
  const filterVal = filterSelect ? filterSelect.value : 'all';

  const sortedSprites = [...pokemonSprites].sort((a, b) => {
    const numA = parseInt(a.match(/^(\d+)/)?.[1] || 0);
    const numB = parseInt(b.match(/^(\d+)/)?.[1] || 0);
    if (numA === numB) return a.localeCompare(b);
    return numA - numB;
  });

  const obtainedSet = new Set(state.user.obtainedPokemon || []);

  const filteredSprites = sortedSprites.filter(sprite => {
    if (filterVal === 'obtained') return obtainedSet.has(sprite);
    if (filterVal === 'unobtained') return !obtainedSet.has(sprite);
    return true; // all
  });

  filteredSprites.forEach(sprite => {
    const isObtained = obtainedSet.has(sprite);
    const spriteItem = document.createElement('div');
    spriteItem.style.background = 'rgba(255, 255, 255, 0.05)';
    spriteItem.style.border = '1px solid rgba(0,0,0,0.05)';
    spriteItem.style.borderRadius = '8px';
    spriteItem.style.padding = '0.5rem';
    spriteItem.style.display = 'flex';
    spriteItem.style.flexDirection = 'column';
    spriteItem.style.alignItems = 'center';
    spriteItem.style.justifyContent = 'center';
    spriteItem.style.transition = 'transform 0.2s, box-shadow 0.2s';
    
    // Add hover effects using JS since we're creating this dynamically
    spriteItem.addEventListener('mouseenter', () => {
      spriteItem.style.transform = 'translateY(-2px) scale(1.05)';
      spriteItem.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      spriteItem.style.background = 'var(--primary-glow)';
    });
    spriteItem.addEventListener('mouseleave', () => {
      spriteItem.style.transform = 'none';
      spriteItem.style.boxShadow = 'none';
      spriteItem.style.background = 'rgba(255, 255, 255, 0.05)';
    });

    const img = document.createElement('img');
    img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${sprite}`;
    img.alt = sprite;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '80px';
    img.style.objectFit = 'contain';
    img.loading = 'lazy'; // Lazy loading for performance

    const label = document.createElement('span');
    label.style.fontSize = '0.75rem';
    label.style.color = 'var(--text-muted)';
    label.style.marginTop = '0.5rem';
    label.style.fontWeight = '600';

    if (!isObtained) {
      img.style.filter = 'brightness(0) drop-shadow(0 0 2px rgba(0,0,0,0.5))';
      img.style.opacity = '0.4';
      label.innerText = '???';
    } else {
      label.innerText = sprite.split('.')[0];
      
      const petBtn = document.createElement('button');
      petBtn.innerText = 'Set as Pet';
      petBtn.className = 'btn-action';
      petBtn.style.marginTop = '0.5rem';
      petBtn.style.padding = '0.2rem 0.5rem';
      petBtn.style.fontSize = '0.7rem';
      petBtn.onclick = async () => {
        state.user.activePet = sprite;
        if (state.user.petHunger === undefined) state.user.petHunger = 100;
        await saveData();
        alert(`${sprite.split('.')[0]} is now your pet!`);
      };
      spriteItem.appendChild(img);
      spriteItem.appendChild(label);
      spriteItem.appendChild(petBtn);
      grid.appendChild(spriteItem);
      return; // Early return because we appended manually
    }

    spriteItem.appendChild(img);
    spriteItem.appendChild(label);
    grid.appendChild(spriteItem);
  });
}

function renderPet() {
  const displayArea = document.getElementById('pet-display-area');
  const petControls = document.getElementById('pet-controls');
  const coinDisplay = document.getElementById('coin-balance-display');
  const hungerText = document.getElementById('pet-hunger-text');
  const hungerBar = document.getElementById('pet-hunger-bar');
  const inventoryGrid = document.getElementById('inventory-grid');
  
  if (state.user.coins === undefined) state.user.coins = 0;
  if (coinDisplay) {
    coinDisplay.innerText = `${state.user.coins} 🪙`;
  }

  if (displayArea && petControls) {
    if (state.user.activePet) {
      displayArea.innerHTML = `<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${state.user.activePet}" alt="Pet" style="max-height: 100px; animation: bounce 2s infinite ease-in-out;">`;
      petControls.style.display = 'block';
      
      const hunger = state.user.petHunger !== undefined ? state.user.petHunger : 100;
      if (hungerText) hungerText.innerText = `${hunger}%`;
      if (hungerBar) {
        hungerBar.style.width = `${hunger}%`;
        // Change color based on hunger
        if (hunger > 60) hungerBar.style.background = 'linear-gradient(90deg, #00b894, #55efc4)';
        else if (hunger > 30) hungerBar.style.background = 'linear-gradient(90deg, #fdcb6e, #ffeaa7)';
        else hungerBar.style.background = 'linear-gradient(90deg, #ff7675, #d63031)';
      }
      
      // Render inventory berries
      if (inventoryGrid) {
        inventoryGrid.innerHTML = '';
        if (!state.user.inventory) state.user.inventory = {};
        let hasBerries = false;
        
        // pokemonBerries comes from berries.js
        if (typeof pokemonBerries !== 'undefined') {
          pokemonBerries.forEach(berry => {
            const qty = state.user.inventory[berry.id] || 0;
            if (qty > 0) {
              hasBerries = true;
              const berryBtn = document.createElement('button');
              berryBtn.className = 'btn-action';
              berryBtn.style.padding = '0.5rem';
              berryBtn.style.display = 'flex';
              berryBtn.style.flexDirection = 'column';
              berryBtn.style.alignItems = 'center';
              berryBtn.style.minWidth = '60px';
              
              berryBtn.innerHTML = `
                <img src="pokemon-berries/${berry.file}" alt="${berry.name}" style="height: 32px; margin-bottom: 4px;">
                <span style="font-size: 0.7rem; font-weight: bold;">x${qty}</span>
              `;
              
              berryBtn.onclick = () => feedBerry(berry);
              inventoryGrid.appendChild(berryBtn);
            }
          });
        }
        
        if (!hasBerries) {
          inventoryGrid.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">No berries in inventory. Buy some from the shop!</span>`;
        }
      }
      
    } else {
      displayArea.innerHTML = `<span style="color: var(--text-muted); font-size: 0.9rem;">Select a Pet from the Pokedex!</span>`;
      petControls.style.display = 'none';
    }
  }
}

async function feedBerry(berry) {
  if (state.user.petHunger === undefined) state.user.petHunger = 100;
  if (state.user.petHunger >= 100) {
    alert("Your pet is already full!");
    return;
  }
  
  if (!state.user.inventory[berry.id] || state.user.inventory[berry.id] <= 0) {
    return;
  }
  
  // Consume
  state.user.inventory[berry.id]--;
  state.user.petHunger = Math.min(100, state.user.petHunger + berry.hungerRestored);
  
  await saveData();
  
  // Animation feedback
  const img = document.querySelector('#pet-display-area img');
  if (img) {
    img.style.transform = 'scale(1.3)';
    setTimeout(() => { img.style.transform = ''; }, 200);
  }
}

function renderBag() {
  const bagGrid = document.getElementById('bag-grid');
  if (!bagGrid) return;
  
  bagGrid.innerHTML = '';
  if (!state.user.inventory) state.user.inventory = {};
  
  if (typeof pokemonBerries === 'undefined') return;
  
  let hasItems = false;
  
  // Sort berries by rarity then alphabetically just for nice display
  const ownedBerries = pokemonBerries.filter(b => state.user.inventory[b.id] > 0);
  
  ownedBerries.forEach(berry => {
    hasItems = true;
    const qty = state.user.inventory[berry.id];
    
    const card = document.createElement('div');
    card.style.background = 'rgba(255,255,255,0.05)';
    card.style.border = '1px solid rgba(0,0,0,0.05)';
    card.style.borderRadius = '8px';
    card.style.padding = '1rem';
    card.style.textAlign = 'center';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';
    
    card.innerHTML = `
      <div style="position: relative; display: inline-block;">
        <img src="pokemon-berries/${berry.file}" alt="${berry.name}" style="height: 64px; margin-bottom: 0.5rem; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15));">
        <div style="position: absolute; bottom: 0; right: -10px; background: var(--primary); color: white; border-radius: 50%; width: 24px; height: 24px; font-size: 0.75rem; font-weight: bold; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
          ${qty}
        </div>
      </div>
      <div style="font-weight: bold; font-size: 1rem; margin-top: 0.5rem; margin-bottom: 0.2rem;">${berry.name}</div>
      <div style="font-size: 0.8rem; color: ${berry.rarity === 'Mythical' ? '#e17055' : berry.rarity === 'Rare' ? '#0984e3' : 'var(--text-muted)'}; margin-bottom: 0.5rem;">${berry.rarity}</div>
      <div style="font-size: 0.8rem; color: var(--text-main); background: rgba(0,0,0,0.05); padding: 0.2rem 0.5rem; border-radius: 4px;">Restores ${berry.hungerRestored}% Hunger</div>
    `;
    
    bagGrid.appendChild(card);
  });
  
  if (!hasItems) {
    bagGrid.innerHTML = `<div style="grid-column: 1 / -1; padding: 3rem; color: var(--text-muted);">Your bag is empty! Buy some berries from the Shop.</div>`;
  }
}

function renderShop() {
  const shopContainer = document.getElementById('shop-container');
  const shopBalance = document.getElementById('shop-coin-balance');
  if (!shopContainer) return;
  
  if (state.user.coins === undefined) state.user.coins = 0;
  if (shopBalance) shopBalance.innerText = `${state.user.coins} 🪙`;
  
  shopContainer.innerHTML = '';
  
  if (typeof pokemonBerries === 'undefined') {
    shopContainer.innerHTML = 'Shop data is loading...';
    return;
  }
  
  const rarities = ['Common', 'Rare', 'Mythical'];
  
  rarities.forEach(rarity => {
    // Filter and sort by cost ascending
    const tierBerries = pokemonBerries
      .filter(b => b.rarity === rarity)
      .sort((a, b) => a.cost - b.cost);
      
    if (tierBerries.length === 0) return;
    
    const section = document.createElement('div');
    
    const header = document.createElement('h3');
    header.innerText = `${rarity} Berries`;
    header.style.marginBottom = '1rem';
    header.style.color = rarity === 'Mythical' ? '#e17055' : rarity === 'Rare' ? '#0984e3' : 'var(--text-main)';
    header.style.borderBottom = '1px solid rgba(0,0,0,0.1)';
    header.style.paddingBottom = '0.5rem';
    section.appendChild(header);
    
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
    grid.style.gap = '1rem';
    
    tierBerries.forEach(berry => {
      const card = document.createElement('div');
      card.style.background = 'rgba(255,255,255,0.5)';
      card.style.border = '1px solid rgba(0,0,0,0.05)';
      card.style.borderRadius = '8px';
      card.style.padding = '1rem';
      card.style.textAlign = 'center';
      
      card.innerHTML = `
        <img src="pokemon-berries/${berry.file}" alt="${berry.name}" style="height: 48px; margin-bottom: 0.5rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">
        <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.2rem;">${berry.name}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem;">+${berry.hungerRestored}% Hunger</div>
        <div style="font-weight: bold; color: #f1c40f; margin-bottom: 0.5rem;">${berry.cost} 🪙</div>
      `;
      
      const buyBtn = document.createElement('button');
      buyBtn.className = 'btn-action';
      buyBtn.innerText = 'Buy';
      buyBtn.style.width = '100%';
      buyBtn.style.padding = '0.4rem';
      buyBtn.onclick = () => buyBerry(berry);
      
      card.appendChild(buyBtn);
      grid.appendChild(card);
    });
    
    section.appendChild(grid);
    shopContainer.appendChild(section);
  });
}

async function buyBerry(berry) {
  if (state.user.coins === undefined) state.user.coins = 0;
  if (state.user.coins < berry.cost) {
    alert("Not enough coins!");
    return;
  }
  
  if (!state.user.inventory) state.user.inventory = {};
  
  state.user.coins -= berry.cost;
  state.user.inventory[berry.id] = (state.user.inventory[berry.id] || 0) + 1;
  
  await saveData();
  renderShop(); // Refresh shop balance
}

function handlePokemonDrop() {
  if (!state.user.obtainedPokemon) {
    state.user.obtainedPokemon = [];
    state.user.tasksCompletedForDrop = 0;
    state.user.nextDropRequirement = Math.floor(Math.random() * 20) + 1;
  }
  
  state.user.tasksCompletedForDrop++;
  
  if (state.user.tasksCompletedForDrop >= state.user.nextDropRequirement) {
    // Attempt drop
    if (typeof pokemonSprites !== 'undefined') {
      const obtainedSet = new Set(state.user.obtainedPokemon);
      const unobtained = pokemonSprites.filter(s => !obtainedSet.has(s));
      
      if (unobtained.length > 0) {
        const randomIndex = Math.floor(Math.random() * unobtained.length);
        const unlockedSprite = unobtained[randomIndex];
        state.user.obtainedPokemon.push(unlockedSprite);
        showPokemonUnlockModal(unlockedSprite);
      }
    }
    
    // Reset drop tracking
    state.user.tasksCompletedForDrop = 0;
    state.user.nextDropRequirement = Math.floor(Math.random() * 20) + 1;
  }
  
  // Re-render Pokedex to reflect the drop if it's currently open or just to keep it fresh
  if (document.getElementById('view-pokedex').classList.contains('active')) {
    renderPokedex();
  } else {
    // Render later but schedule it
    renderPokedex();
  }
}

function showPokemonUnlockModal(spriteFileName) {
  const modal = document.getElementById('pokemon-unlock-overlay');
  const imgElement = document.getElementById('pokemon-unlock-img');
  const nameElement = document.getElementById('pokemon-unlock-name');
  
  if (modal && imgElement && nameElement) {
    imgElement.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${spriteFileName}`;
    const pokemonNumber = spriteFileName.split('.')[0];
    nameElement.innerText = `Pokemon number ${pokemonNumber} is obtained!!`;
    modal.classList.add('active');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('pokemon-unlock-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('pokemon-unlock-overlay').classList.remove('active');
    });
  }

  const pokedexFilterSelect = document.getElementById('pokedex-filter-select');
  if (pokedexFilterSelect) {
    pokedexFilterSelect.addEventListener('change', () => {
      renderPokedex();
    });
  }

  // Feed pet delegation removed
});

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('ServiceWorker registration successful');
    }).catch(err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}
