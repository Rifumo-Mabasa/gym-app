 // ─── STATE ───────────────────────────────────────────────────────────────
 // Add this at the very top of your app.js
// Supabase client — set your credentials below or via environment
const SUPABASE_URL  = window.__SUPABASE_URL  || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY  = window.__SUPABASE_KEY  || 'YOUR_SUPABASE_ANON_KEY';
const _supabase = (typeof window !== 'undefined' && window.supabase)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null; // running without Supabase — localStorage fallback active

    let currentPremadeFilter = 'all';
    let premadeExpanded = false;
    let isMetric = true;

    // Three.js refs
    let scene, camera, renderer, threeControls;
    let muscleMeshes = {};
    let anatomyInitialized = false;

    // ─── UNIT TOGGLE (FIX: updateDisplayUnits was missing) ──────────────────

// ─── AUTH ────────────────────────────────────────────────────────────────────
async function signInWithGoogle() {
    if (!_supabase) {
        showToast('Supabase not configured — using local mode', 'error');
        return;
    }
    const { error } = await _supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) showToast('Sign in failed: ' + error.message, 'error');
}

async function signOut() {
    if (!_supabase) return;
    await _supabase.auth.signOut();
    updateAuthUI(null);
    showToast('Signed out');
}

function updateAuthUI(user) {
    const loginBtn   = document.getElementById('login-btn');
    const logoutBtn  = document.getElementById('logout-btn');
    const userDisplay = document.getElementById('user-display');
    const avatar      = document.getElementById('user-avatar');

    if (user) {
        if (loginBtn)    loginBtn.style.display = 'none';
        if (logoutBtn)   logoutBtn.style.display = 'inline-block';
        if (userDisplay) {
            userDisplay.style.display = 'inline-block';
            userDisplay.textContent   = user.user_metadata?.full_name || user.email;
        }
        if (avatar && user.user_metadata?.avatar_url) {
            avatar.src = user.user_metadata.avatar_url;
            avatar.style.display = 'inline-block';
        }
    } else {
        if (loginBtn)    loginBtn.style.display  = 'inline-block';
        if (logoutBtn)   logoutBtn.style.display = 'none';
        if (userDisplay) userDisplay.style.display = 'none';
        if (avatar)      avatar.style.display    = 'none';
    }
}

// ─── TOAST NOTIFICATION ──────────────────────────────────────────────────────
function showToast(msg, type = '') {
    let el = document.getElementById('toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'show' + (type ? ' ' + type : '');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.className = ''; }, 2800);
}

    function toggleUnits() {
        isMetric = !isMetric;
        document.getElementById('unitLabel').textContent = isMetric ? 'kg' : 'lbs';
        updateDisplayUnits();
    }

    function convertWeight(valueKg) {
        return isMetric ? valueKg : +(valueKg * 2.2046).toFixed(1);
    }

    function unitLabel() { return isMetric ? 'kg' : 'lbs'; }

    // FIX: updateDisplayUnits now properly re-renders dashboard stats with correct unit
    function updateDisplayUnits() {
        const history = JSON.parse(localStorage.getItem('completedWorkouts')) || [];
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const lastWeek = history.filter(s => s.timestamp > oneWeekAgo);
        const totalAllTime = history.reduce((sum, s) => sum + getSessionVolume(s.exercises), 0);
        const totalWeekly = lastWeek.reduce((sum, s) => sum + getSessionVolume(s.exercises), 0);
        document.getElementById('weeklyVolume').innerText = `${convertWeight(totalWeekly).toLocaleString()} ${unitLabel()}`;
        document.getElementById('totalVolume').innerText = `${convertWeight(totalAllTime).toLocaleString()} ${unitLabel()}`;
    }

    // ─── EXERCISE DIRECTORIES ────────────────────────────────────────────────
    const gymDirectory = {
        "Shoulders": ["Overhead Barbell Press","Dumbbell Lateral Raises","Bent-Over Dumbbell Rear Delt Flyes","Push Press","Dumbbell Arnold Press","Cable Lateral Raises","Face Pulls","Front Dumbbell Raises","Upright Rows","Pike Push-Ups"],
        "Chest": ["Flat Barbell Bench Press","Incline Dumbbell Press","Decline Bench Press","Chest Dips","Flat Dumbbell Flyes","Cable Crossover / Cable Flyes","Push-Ups","Incline Barbell Bench Press","Pec Deck Machine","Dumbbell Pullovers"],
        "Arms": ["Barbell Biceps Curls","Triceps Overhead Extensions","Dumbbell Hammer Curls","Triceps Rope Pushdowns","Incline Dumbbell Curls","Close-Grip Bench Press","Concentration Curls","Skull Crushers","Preacher Curls","Diamond Push-Ups"],
        "Back": ["Pull-Ups / Chin-Ups","Barbell Rows","Lat Pulldowns","Single-Arm Dumbbell Rows","Seated Cable Rows","Deadlifts","T-Bar Rows","Hyperextensions","Straight-Arm Pulldowns","Chest-Supported Dumbbell Rows"],
        "Core": ["Hanging Knee / Leg Raises","Planks","Ab Wheel Rollouts","Russian Twists","Cable Crunches","Bicycle Crunches","Decline Sit-Ups","Bird-Dog","Deadbugs","Side Planks"],
        "Glutes": ["Barbell Hip Thrusts","Glute Bridges","Bulgarian Split Squats","Sumo Deadlifts","Cable Kickbacks","Walking Lunges","Step-Ups","Deficit Reverse Lunges","Seated Hip Abductions","Frog Pumps"],
        "Quadriceps": ["Barbell Back Squats","Front Squats","Leg Press","Leg Extensions","Hack Squats","Goblet Squats","Sissy Squats","Smith Machine Squats","Cyclist Squats","Box Squats"],
        "Hamstrings": ["Romanian Deadlifts (RDLs)","Lying Leg Curls","Seated Leg Curls","Glute-Ham Raises (GHR)","Swiss Ball Leg Curls","Single-Leg Romanian Deadlifts","Nordic Hamstring Curls","Kettlebell Swings","Good Mornings","Sliding Leg Curls"],
        "Calves": ["Standing Calf Raises","Seated Calf Raises","Leg Press Calf Raises","Donkey Calf Raises","Smith Machine Calf Raises","Single-Leg Bodyweight Calf Raises","Farmer's Walk on Toes","Jump Rope","Tibialis Raises","Sled Pushes on Toes"]
    };

    const homeDirectory = {
        "Shoulders": ["Pike Push-Ups","Overhead Press (Dumbbell/Backpack)","Lateral Raises (Water Bottles/DB)","Resistance Band Face Pulls","Rear Delt Flyes","Decline Pike Push-Ups","Front Dumbbell Raises","Prone Y-T-W Raises","Handstand Hold","Crab Walk"],
        "Chest": ["Standard Push-Ups","Incline Push-Ups","Decline Push-Ups","Chair/Couch Dips","Floor Dumbbell Press","Floor Dumbbell Flyes","Resistance Band Chest Press","Diamond Push-Ups","Deficit Push-Ups","Isometric Chest Squeeze"],
        "Arms": ["Bicep Curls (DB/Backpack)","Hammer Curls","Overhead Triceps Extension","Triceps Kickbacks","Resistance Band Curls","Bench/Chair Dips","Towel Bicep Curls","Diamond Push-Ups (Knees)","Pike Diamond Push-Ups","Reverse Wrist Curls"],
        "Back": ["Doorframe/Table Rows","Bedsheet Door-Anchor Pull-Ups","Single-Arm Rows (DB/Jug)","Resistance Band Seated Rows","Supermans","Reverse Iron Cross","Backpack Bent-Over Rows","Prone Swimmers","Band Lat Pulldowns","Good Mornings"],
        "Core": ["Forearm Planks","Bicycle Crunches","Russian Twists","Deadbugs","Lying Leg Raises","Side Planks","Mountain Climbers","Bird-Dog","Flutter Kicks","Hollow Body Hold"],
        "Glutes": ["Glute Bridges","Single-Leg Glute Bridges","Bulgarian Split Squats","Walking Lunges","Deficit Reverse Lunges","Fire Hydrants","Glute Kickbacks","Frog Pumps","Resistance Band Crab Walks","Couch Step-Ups"],
        "Quadriceps": ["Air Squats","Heels-Elevated Goblet Squats","Forward Lunges","Wall Sits","Sissy Squats","Step-Ups","Jump Squats","Pistol Squat Progressions","Pulse Squats","Walking Hindu Squats"],
        "Hamstrings": ["Romanian Deadlifts (RDLs)","Single-Leg RDLs","Sliding Leg Curls","Couch Single-Leg Hamstring Bridges","Nordic Hamstring Curls","Band Good Mornings","Floor Hamstring Walkouts","Kettlebell/DB Swings","Prone Band Leg Curls","B-Stance RDLs"],
        "Calves": ["Single-Leg Calf Raises","Staircase Calf Raises","Seated Weighted Calf Raises","Shadow Jumping","Farmer's Walk on Toes","Pogo Hops","Squat Hold Calf Raises","Tibialis Raises","Angled Calf Raises","Explosive Calf Hops"]
    };

    const premadePrograms = [
        { title: "Gym Push A: Heavy Chest Focus", category: "gym", exercises: [{ name:"Flat Barbell Bench Press",sets:4,reps:8,weight:60 },{ name:"Overhead Barbell Press",sets:3,reps:8,weight:40 },{ name:"Incline Dumbbell Press",sets:3,reps:10,weight:22 },{ name:"Dumbbell Lateral Raises",sets:4,reps:12,weight:10 },{ name:"Triceps Rope Pushdowns",sets:3,reps:12,weight:20 }] },
        { title: "Gym Push B: Shoulder & Upper Chest", category: "gym", exercises: [{ name:"Push Press",sets:4,reps:6,weight:50 },{ name:"Incline Barbell Bench Press",sets:3,reps:8,weight:50 },{ name:"Dumbbell Arnold Press",sets:3,reps:10,weight:16 },{ name:"Cable Crossover / Cable Flyes",sets:3,reps:15,weight:15 },{ name:"Close-Grip Bench Press",sets:3,reps:10,weight:45 }] },
        { title: "Gym Push C: Hypertrophy & Isolation", category: "gym", exercises: [{ name:"Decline Bench Press",sets:3,reps:10,weight:55 },{ name:"Chest Dips",sets:3,reps:10,weight:0 },{ name:"Pec Deck Machine",sets:3,reps:12,weight:40 },{ name:"Cable Lateral Raises",sets:4,reps:15,weight:7 },{ name:"Skull Crushers",sets:3,reps:12,weight:25 }] },
        { title: "Gym Pull A: Vertical & Horizontal", category: "gym", exercises: [{ name:"Pull-Ups / Chin-Ups",sets:4,reps:8,weight:0 },{ name:"Barbell Rows",sets:4,reps:8,weight:60 },{ name:"Lat Pulldowns",sets:3,reps:10,weight:50 },{ name:"Seated Cable Rows",sets:3,reps:12,weight:45 },{ name:"Barbell Biceps Curls",sets:3,reps:10,weight:25 }] },
        { title: "Gym Legs A: Quad Dominant", category: "gym", exercises: [{ name:"Barbell Back Squats",sets:4,reps:6,weight:80 },{ name:"Leg Press",sets:3,reps:10,weight:100 },{ name:"Leg Extensions",sets:3,reps:12,weight:40 },{ name:"Romanian Deadlifts (RDLs)",sets:3,reps:10,weight:60 },{ name:"Standing Calf Raises",sets:4,reps:15,weight:40 }] },
        { title: "Gym Total Body: Power Framework", category: "gym", exercises: [{ name:"Barbell Back Squats",sets:3,reps:8,weight:70 },{ name:"Flat Barbell Bench Press",sets:3,reps:8,weight:60 },{ name:"Pull-Ups / Chin-Ups",sets:3,reps:8,weight:0 },{ name:"Overhead Barbell Press",sets:3,reps:10,weight:35 },{ name:"Hanging Knee / Leg Raises",sets:3,reps:12,weight:0 }] },
        { title: "Home Push A: Bodyweight Foundation", category: "home", exercises: [{ name:"Standard Push-Ups",sets:4,reps:15,weight:0 },{ name:"Pike Push-Ups",sets:3,reps:8,weight:0 },{ name:"Chair/Couch Dips",sets:3,reps:12,weight:0 },{ name:"Lateral Raises (Water Bottles/DB)",sets:4,reps:15,weight:5 },{ name:"Diamond Push-Ups (Knees)",sets:3,reps:10,weight:0 }] },
        { title: "Home Push B: Progressive Angles", category: "home", exercises: [{ name:"Decline Push-Ups",sets:3,reps:12,weight:0 },{ name:"Overhead Press (Dumbbell/Backpack)",sets:3,reps:10,weight:15 },{ name:"Incline Push-Ups",sets:3,reps:15,weight:0 },{ name:"Front Dumbbell Raises",sets:3,reps:12,weight:8 },{ name:"Triceps Kickbacks",sets:3,reps:12,weight:6 }] },
        { title: "Home Pull A: Bodyweight Back", category: "home", exercises: [{ name:"Doorframe/Table Rows",sets:4,reps:10,weight:0 },{ name:"Supermans",sets:3,reps:15,weight:0 },{ name:"Single-Arm Rows (DB/Jug)",sets:3,reps:12,weight:12 },{ name:"Resistance Band Seated Rows",sets:3,reps:15,weight:0 },{ name:"Bicep Curls (DB/Backpack)",sets:3,reps:12,weight:12 }] },
        { title: "Home Legs A: Unilateral Focus", category: "home", exercises: [{ name:"Bulgarian Split Squats",sets:3,reps:10,weight:0 },{ name:"Glute Bridges",sets:4,reps:20,weight:0 },{ name:"Air Squats",sets:4,reps:20,weight:0 },{ name:"Romanian Deadlifts (RDLs)",sets:3,reps:12,weight:15 },{ name:"Single-Leg Calf Raises",sets:3,reps:15,weight:0 }] },
        { title: "Cardio: Pure Conditioning", category: "cardio", exercises: [{ name:"Jump Rope",sets:5,reps:3,weight:0 },{ name:"Mountain Climbers",sets:4,reps:1,weight:0 },{ name:"Pogo Hops",sets:3,reps:1,weight:0 }] },
        { title: "Cardio: Quick Home HIIT", category: "cardio", exercises: [{ name:"Shadow Jumping",sets:4,reps:5,weight:0 },{ name:"Jump Squats",sets:4,reps:1,weight:0 },{ name:"Explosive Calf Hops",sets:3,reps:1,weight:0 }] },
        { title: "Cardio: Power Endurance Matrix", category: "cardio", exercises: [{ name:"Sled Pushes on Toes",sets:5,reps:2,weight:40 },{ name:"Kettlebell Swings",sets:4,reps:2,weight:16 },{ name:"Mountain Climbers",sets:4,reps:1,weight:0 }] }
    ];

    // ─── HELPERS ─────────────────────────────────────────────────────────────
    function findMuscleGroup(exerciseName) {
        for (const [group, list] of Object.entries(gymDirectory)) {
            if (list.includes(exerciseName)) return group;
        }
        for (const [group, list] of Object.entries(homeDirectory)) {
            if (list.includes(exerciseName)) return group;
        }
        const lower = exerciseName.toLowerCase();
        if (lower.includes("squat")) return "Quadriceps";
        if (lower.includes("push") || lower.includes("press") || lower.includes("fly")) return "Chest";
        if (lower.includes("curl")) return "Arms";
        if (lower.includes("row") || lower.includes("pull") || lower.includes("deadlift")) return "Back";
        if (lower.includes("plank") || lower.includes("crunch") || lower.includes("ab")) return "Core";
        if (lower.includes("lunge") || lower.includes("glute")) return "Glutes";
        if (lower.includes("calf") || lower.includes("calf")) return "Calves";
        return null;
    }

    function getRoutineIcon(title) {
        const lower = title.toLowerCase();
        if (lower.includes('home')) return '🏠';
        if (lower.includes('gym')) return '🏋️';
        if (lower.includes('cardio')) return '🏃';
        if (lower.includes('glute')) return '💪';
        if (lower.includes('arm')) return '💪';
        if (lower.includes('leg') || lower.includes('quad') || lower.includes('ham')) return '🦵';
        if (lower.includes('pull') || lower.includes('back')) return '🎯';
        if (lower.includes('push') || lower.includes('chest')) return '🔥';
        return '⚡';
    }

    function getSessionVolume(exercises) {
        return exercises.reduce((total, ex) => total + (Number(ex.weight) * Number(ex.sets) * Number(ex.reps)), 0);
    }

    // ─── PAGE NAVIGATION (FIX: removed btn-tracker assumption; handles tracker separately) ─
    function showPage(pageName) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        // Only update nav highlight for real nav pages
        const navMap = { home: 'btn-home', creator: 'btn-creator', selector: 'btn-selector', guide: 'btn-guide', quicklog: 'btn-quicklog' };
        document.querySelectorAll('.toggle-btn').forEach(b => {
            if (!b.id.includes('units')) b.classList.remove('active-nav');
        });
        const pageEl = document.getElementById('page-' + pageName);
        if (pageEl) pageEl.classList.add('active');
        if (navMap[pageName]) {
            const btn = document.getElementById(navMap[pageName]);
            if (btn) btn.classList.add('active-nav');
        }

        if (pageName === 'home') updateDashboard();
        if (pageName === 'selector') { renderPremadeButtons(); renderSavedPrograms(); }
        if (pageName === 'quicklog') { initQLPage(); }
    }

    // ─── DASHBOARD ────────────────────────────────────────────────────────────
    function updateDashboard() {
        const history = JSON.parse(localStorage.getItem('completedWorkouts')) || [];
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const lastWeek = history.filter(s => s.timestamp > oneWeekAgo);
        const totalAllTime = history.reduce((sum, s) => sum + getSessionVolume(s.exercises), 0);
        const totalWeekly = lastWeek.reduce((sum, s) => sum + getSessionVolume(s.exercises), 0);

        // Empty state
        const emptyEl = document.getElementById('dashEmptyState');
        if (emptyEl) emptyEl.style.display = history.length === 0 ? 'block' : 'none';

        document.getElementById('weeklyVolume').innerText = history.length === 0 ? '—' : `${convertWeight(totalWeekly).toLocaleString()} ${unitLabel()}`;
        document.getElementById('totalVolume').innerText = history.length === 0 ? '—' : `${convertWeight(totalAllTime).toLocaleString()} ${unitLabel()}`;

        const weeklyMetrics = { Mon:0, Tue:0, Wed:0, Thu:0, Fri:0, Sat:0, Sun:0 };
        lastWeek.forEach(s => {
            if (weeklyMetrics.hasOwnProperty(s.dayOfWeek)) {
                weeklyMetrics[s.dayOfWeek] += getSessionVolume(s.exercises);
            }
        });
        drawChart(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => weeklyMetrics[d]));

        updateStreakAndConsistency(history);
        init3DAnatomyEngine();
        calculate3DMuscleHeatmapValues();
    }

    function updateStreakAndConsistency(history) {
        // Build set of workout dates (YYYY-MM-DD)
        const workoutDays = new Set(history.map(s => {
            const d = new Date(s.timestamp);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }));

        // Streak: count consecutive days ending today
        let streak = 0;
        let checkDate = new Date();
        while (true) {
            const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth()+1).padStart(2,'0')}-${String(checkDate.getDate()).padStart(2,'0')}`;
            if (workoutDays.has(key)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else break;
        }
        document.getElementById('streakCount').textContent = streak;

        // 28-day consistency dots
        const dotsEl = document.getElementById('consistencyDots');
        if (dotsEl) {
            dotsEl.innerHTML = '';
            const today = new Date();
            today.setHours(0,0,0,0);
            for (let i = 27; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                const dot = document.createElement('div');
                dot.className = 'consistency-dot';
                if (i === 0) dot.classList.add('today');
                else if (workoutDays.has(key)) dot.classList.add('done');
                dot.title = key;
                dotsEl.appendChild(dot);
            }
        }

        // Month workouts count
        const now = new Date();
        const monthCount = history.filter(s => {
            const d = new Date(s.timestamp);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;
        const el = document.getElementById('monthWorkoutCount');
        if (el) el.textContent = monthCount;
    }

    function drawChart(data) {
        const canvas = document.getElementById('weeklyProgressionChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        const maxVal = Math.max(...data, 1);
        const barWidth = 60, gap = 35, startX = 60;
        const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

        // Grid lines
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = H - 40 - (i / 4) * 150;
            ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W - 10, y); ctx.stroke();
            ctx.fillStyle = '#94a3b8';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(convertWeight(Math.round((i / 4) * maxVal)), 36, y + 4);
        }

        data.forEach((val, i) => {
            const barHeight = (val / maxVal) * 150;
            const x = startX + i * (barWidth + gap);
            const y = H - barHeight - 40;
            const isActive = val > 0;

            ctx.fillStyle = isActive ? '#3b82f6' : '#1e3a5f';
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(x, y, barWidth, barHeight, 4) : ctx.rect(x, y, barWidth, barHeight);
            ctx.fill();

            if (val > 0) {
                ctx.fillStyle = '#f8fafc';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`${convertWeight(val)}${unitLabel()}`, x + barWidth/2, y - 6);
            }

            ctx.fillStyle = '#94a3b8';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(days[i], x + barWidth/2, H - 15);
        });
    }

    // ─── 52-WEEK STATS MODAL (FIX: modal instead of broken page nav) ─────────
    function showStatsModal() {
        document.getElementById('statsModal').classList.add('open');
        drawYearlyChart();
    }

    function closeStatsModal() {
        document.getElementById('statsModal').classList.remove('open');
    }

    // FIX: getVolumeDataForLast52Weeks was missing — now implemented
    function getVolumeDataForLast52Weeks() {
        const history = JSON.parse(localStorage.getItem('completedWorkouts')) || [];
        const now = Date.now();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const weeks = Array(52).fill(0);
        history.forEach(s => {
            const weeksAgo = Math.floor((now - s.timestamp) / weekMs);
            if (weeksAgo >= 0 && weeksAgo < 52) {
                weeks[51 - weeksAgo] += getSessionVolume(s.exercises);
            }
        });
        return weeks;
    }

    function drawYearlyChart() {
        const canvas = document.getElementById('yearlyChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const data = getVolumeDataForLast52Weeks();
        const W = canvas.offsetWidth || 740;
        canvas.width = W;
        const H = 400;
        canvas.height = H;
        ctx.clearRect(0, 0, W, H);

        const maxVal = Math.max(...data, 1);
        const barW = Math.floor((W - 60) / 52);

        // Grid
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = H - 40 - (i / 4) * (H - 60);
            ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W - 10, y); ctx.stroke();
            ctx.fillStyle = '#94a3b8';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(convertWeight(Math.round((i / 4) * maxVal)), 36, y + 4);
        }

        data.forEach((val, i) => {
            const bh = (val / maxVal) * (H - 60);
            const x = 40 + i * barW;
            const y = H - 40 - bh;
            ctx.fillStyle = val > 0 ? '#3b82f6' : '#1e3a5f';
            ctx.fillRect(x, y, barW - 1, bh);
        });

        // X axis labels every 4 weeks
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < 52; i += 4) {
            ctx.fillText(`W${i + 1}`, 40 + i * barW + barW / 2, H - 10);
        }
    }

    // ─── 3D ANATOMY ENGINE ───────────────────────────────────────────────────
    function init3DAnatomyEngine() {
        const container = document.getElementById('anatomy-canvas-container');
        if (!container || anatomyInitialized) return;
        anatomyInitialized = true;

        scene = new THREE.Scene();
        scene.background = new THREE.Color('#0b0f19');

        camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(0, 2, 7);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        // FIX: OrbitControls is on THREE.OrbitControls in r134
        threeControls = new THREE.OrbitControls(camera, renderer.domElement);
        threeControls.enableDamping = true;
        threeControls.dampingFactor = 0.05;
        threeControls.minDistance = 3;
        threeControls.maxDistance = 15;
        threeControls.enablePan = false;

        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const d1 = new THREE.DirectionalLight(0xffffff, 0.8);
        d1.position.set(0, 4, 5); scene.add(d1);
        const d2 = new THREE.DirectionalLight(0xffffff, 0.5);
        d2.position.set(0, 2, -5); scene.add(d2);

        buildProceduralAnatomyModel();

        (function animate() {
            requestAnimationFrame(animate);
            threeControls.update();
            renderer.render(scene, camera);
        })();

        window.addEventListener('resize', () => {
            if (!container) return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        });
    }

    function buildProceduralAnatomyModel() {
        const defaultColor = new THREE.Color('#334155');
        const createZone = (geo, pos, name) => {
            const mat = new THREE.MeshStandardMaterial({ color: defaultColor, roughness: 0.4, metalness: 0.2, flatShading: true });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(...pos);
            scene.add(mesh);
            if (!muscleMeshes[name]) muscleMeshes[name] = [];
            muscleMeshes[name].push(mesh);
        };
        // Head
        createZone(new THREE.SphereGeometry(0.35, 16, 16), [0, 3.8, 0], "Head");
        // Torso / Core
        createZone(new THREE.CylinderGeometry(0.6, 0.4, 1.4, 16), [0, 2.6, 0], "Core");
        // Chest
        createZone(new THREE.BoxGeometry(0.28, 0.4, 0.22), [-0.22, 2.9, 0.4], "Chest");
        createZone(new THREE.BoxGeometry(0.28, 0.4, 0.22), [0.22, 2.9, 0.4], "Chest");
        // Back / Lats
        createZone(new THREE.BoxGeometry(0.25, 0.6, 0.2), [-0.25, 2.7, -0.3], "Back");
        createZone(new THREE.BoxGeometry(0.25, 0.6, 0.2), [0.25, 2.7, -0.3], "Back");
        // Shoulders
        createZone(new THREE.SphereGeometry(0.22, 16, 16), [-0.75, 3.1, 0], "Shoulders");
        createZone(new THREE.SphereGeometry(0.22, 16, 16), [0.75, 3.1, 0], "Shoulders");
        // Upper Arms
        createZone(new THREE.CylinderGeometry(0.14, 0.12, 0.7, 16), [-0.85, 2.5, 0], "Arms");
        createZone(new THREE.CylinderGeometry(0.14, 0.12, 0.7, 16), [0.85, 2.5, 0], "Arms");
        // Lower Arms
        createZone(new THREE.CylinderGeometry(0.11, 0.09, 0.6, 16), [-0.85, 1.8, 0], "Arms");
        createZone(new THREE.CylinderGeometry(0.11, 0.09, 0.6, 16), [0.85, 1.8, 0], "Arms");
        // Glutes
        createZone(new THREE.SphereGeometry(0.32, 16, 16), [-0.22, 1.75, -0.25], "Glutes");
        createZone(new THREE.SphereGeometry(0.32, 16, 16), [0.22, 1.75, -0.25], "Glutes");
        // Quads
        createZone(new THREE.CylinderGeometry(0.22, 0.16, 0.9, 16), [-0.28, 1.2, 0.1], "Quadriceps");
        createZone(new THREE.CylinderGeometry(0.22, 0.16, 0.9, 16), [0.28, 1.2, 0.1], "Quadriceps");
        // Hamstrings
        createZone(new THREE.CylinderGeometry(0.2, 0.15, 0.9, 16), [-0.28, 1.2, -0.15], "Hamstrings");
        createZone(new THREE.CylinderGeometry(0.2, 0.15, 0.9, 16), [0.28, 1.2, -0.15], "Hamstrings");
        // Calves
        createZone(new THREE.CylinderGeometry(0.15, 0.09, 0.8, 16), [-0.28, 0.35, 0], "Calves");
        createZone(new THREE.CylinderGeometry(0.15, 0.09, 0.8, 16), [0.28, 0.35, 0], "Calves");
    }

    function calculate3DMuscleHeatmapValues() {
        const history = JSON.parse(localStorage.getItem('completedWorkouts')) || [];
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const lastWeek = history.filter(s => s.timestamp > oneWeekAgo);

        const volumeTracker = { Shoulders:0, Chest:0, Arms:0, Back:0, Core:0, Glutes:0, Quadriceps:0, Hamstrings:0, Calves:0 };
        lastWeek.forEach(session => {
            session.exercises.forEach(ex => {
                const grp = findMuscleGroup(ex.name);
                if (grp && volumeTracker.hasOwnProperty(grp)) {
                    volumeTracker[grp] += (Number(ex.weight) * Number(ex.sets) * Number(ex.reps));
                }
            });
        });

        for (const [groupName, meshes] of Object.entries(muscleMeshes)) {
            if (!meshes) continue;
            const vol = volumeTracker[groupName] || 0;
            let hex = '#334155';
            if (vol > 0 && vol <= 1500) hex = '#ca8a04';
            else if (vol > 1500) hex = '#ef4444';
            meshes.forEach(mesh => {
                mesh.material.color.set(hex);
                mesh.material.emissive.set(vol > 0 ? hex : '#000000');
                mesh.material.emissiveIntensity = vol > 1500 ? 0.3 : vol > 0 ? 0.15 : 0;
            });
        }
    }

    // ─── ROUTINE BROWSER ─────────────────────────────────────────────────────
    function filterPremade(type) {
        currentPremadeFilter = type;
        premadeExpanded = false;
        document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active-filter'));
        document.getElementById('filter-' + type).classList.add('active-filter');
        renderPremadeButtons();
    }

    function renderPremadeButtons() {
        const container = document.getElementById('premadeButtonsGrid');
        const toggleContainer = document.getElementById('premadeToggleContainer');
        if (!container) return;

        let filtered = premadePrograms;
        if (currentPremadeFilter !== 'all') {
            filtered = premadePrograms.filter(p => p.category === currentPremadeFilter);
        }

        const limit = 4;
        const total = filtered.length;
        const display = (!premadeExpanded && total > limit) ? filtered.slice(0, limit) : filtered;

        container.innerHTML = display.map(prog => {
            const idx = premadePrograms.indexOf(prog);
            const catClass = `routine-card-${prog.category || 'gym'}`;
            const badgeClass = `badge-${prog.category || 'gym'}`;
            const badgeLabel = (prog.category || 'gym').toUpperCase();
            return `<div class="routine-card-layout ${catClass}" onclick="loadActiveWorkoutWorkspace(${idx}, 'premade')">
                <div class="routine-meta-info">
                    <span class="routine-badge ${badgeClass}">${badgeLabel}</span>
                    <h4 class="routine-card-title">${prog.title}</h4>
                    <span class="routine-exercise-count">${prog.exercises.length} Exercises</span>
                </div>
                <div class="routine-icon-display">${getRoutineIcon(prog.title)}</div>
            </div>`;
        }).join('');

        toggleContainer.innerHTML = total > limit ? `<button class="action-btn" style="background:#475569;margin-top:5px;" onclick="premadeExpanded=!premadeExpanded;renderPremadeButtons()">
            ${premadeExpanded ? 'Show Less ▲' : `Show All ${total} ▼`}
        </button>` : '';
    }

    function renderSavedPrograms() {
        const container = document.getElementById('savedProgramsGrid');
        if (!container) return;
        const stored = JSON.parse(localStorage.getItem('myWorkouts')) || [];
        if (stored.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted);grid-column:span 2;">No personal routines saved yet. Use Create Program to build one!</p>`;
            return;
        }
        container.innerHTML = stored.map((prog, index) => `
            <div style="position:relative;">
                <div class="routine-card-layout" style="background:#e2e8f0;" onclick="loadActiveWorkoutWorkspace(${index}, 'custom')">
                    <div class="routine-meta-info">
                        <h4 class="routine-card-title">${prog.title}</h4>
                        <span class="routine-exercise-count">${prog.exercises.length} Exercises</span>
                    </div>
                    <div class="routine-icon-display">${getRoutineIcon(prog.title)}</div>
                </div>
                <button onclick="deleteCustomWorkout(${index})" style="position:absolute;top:8px;right:8px;background:#ef4444;color:#fff;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;">✕</button>
            </div>
        `).join('');
    }

    function deleteCustomWorkout(index) {
        if (!confirm('Delete this routine?')) return;
        const stored = JSON.parse(localStorage.getItem('myWorkouts')) || [];
        stored.splice(index, 1);
        localStorage.setItem('myWorkouts', JSON.stringify(stored));
        renderSavedPrograms();
    }

    // ─── WORKOUT TRACKER ──────────────────────────────────────────────────────
function loadActiveWorkoutWorkspace(index, categoryType) {
    let program;
    if (categoryType === 'premade') {
        program = premadePrograms[index];
    } else {
        const stored = JSON.parse(localStorage.getItem('myWorkouts')) || [];
        program = stored[index];
    }
    if (!program) return;

    document.getElementById('trackerWorkoutTitle').innerText = program.title;
    const container = document.getElementById('activeWorkoutExercisesContainer');
    container.innerHTML = '';

    const history = JSON.parse(localStorage.getItem('completedWorkouts')) || [];

    program.exercises.forEach(ex => {
        // Find last session that has this exercise
        let prevData = null;
        for (let i = history.length - 1; i >= 0; i--) {
            const found = history[i].exercises.find(e => e.name === ex.name);
            if (found) { prevData = found; break; }
        }

        const prevBadge = prevData
            ? `<div class="prev-session-badge">📊 Last: ${convertWeight(prevData.weight)}${unitLabel()} × ${prevData.reps} reps × ${prevData.sets} sets</div>`
            : `<div class="prev-session-badge" style="opacity:0.5;">📊 No previous data for this exercise</div>`;

        const card = document.createElement('div');
        card.className = 'tracker-card';
        card.dataset.exerciseName = ex.name;
        card.innerHTML = `
            <div class="tracker-exercise-header">${ex.name}</div>
            ${prevBadge}
            <div class="tracker-inputs-grid">
                <div class="input-unit-wrapper">
                    <label>Sets</label>
                    <input type="number" class="track-sets" value="${ex.sets}" min="1">
                </div>
                <div class="input-unit-wrapper">
                    <label>Reps</label>
                    <input type="number" class="track-reps" value="${ex.reps}" min="0">
                </div>
                <div class="input-unit-wrapper">
                    <label>Weight (${unitLabel()})</label>
                    <input type="number" class="track-weight" value="${convertWeight(ex.weight)}" min="0" step="0.5">
                </div>
            </div>
            <button class="set-done-btn" onclick="onSetDone(this)">✓ Set Done — Start Rest</button>`;
        container.appendChild(card);
    });

    // Navigate to tracker
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.toggle-btn').forEach(b => {
        if (!b.id.includes('units')) b.classList.remove('active-nav');
    });
    document.getElementById('page-tracker').classList.add('active');
}

async function commitCompletedWorkoutSession() {
    const title = document.getElementById('trackerWorkoutTitle').innerText;
    const daySelected = document.getElementById('logTargetDay').value;
    const cards = document.querySelectorAll('.tracker-card');

    const loggedExercises = Array.from(cards).map(card => {
        const weightInput = Number(card.querySelector('.track-weight').value) || 0;
        return {
            name: card.dataset.exerciseName || card.querySelector('.tracker-exercise-header').innerText,
            sets: Number(card.querySelector('.track-sets').value) || 0,
            reps: Number(card.querySelector('.track-reps').value) || 0,
            // Always store in kg internally
            weight: isMetric ? weightInput : +(weightInput / 2.2046).toFixed(2)
        };
    });

    const completedSession = { 
        title, 
        dayOfWeek: daySelected, 
        exercises: loggedExercises, 
        timestamp: Date.now() 
    };

    // Spinner + button feedback
    showToast('Saving workout…');

    try {
        // Save locally
        const history = JSON.parse(localStorage.getItem('completedWorkouts')) || [];
        history.push(completedSession);
        localStorage.setItem('completedWorkouts', JSON.stringify(history));

        // Save remotely (Supabase)
        const { data, error } = await supabase
            .from('workouts')
            .insert([completedSession]);

        if (error) throw error;

        // Success feedback
        const btn = document.querySelector('#page-tracker .action-btn');
        btn.textContent = '✓ Session Logged!';
        btn.style.background = '#059669';
        setTimeout(() => { showPage('home'); }, 800);

    } catch (err) {
        console.error("Submission error:", err);
        alert("Error saving workout.");
    } finally {
    showToast('✓ Session logged!', 'success');
    }
} // ← end of commitCompletedWorkoutSession (was missing)


    // ─── PROGRAM CREATOR ─────────────────────────────────────────────────────
    function resetBuilderList() {
        document.getElementById('newExerciseList').innerHTML = '';
        addExerciseRowWithSelect();
    }

    function addExerciseRowWithSelect() {
        const container = document.getElementById('newExerciseList');
        const mode = document.getElementById('locationMode').value;
        const dir = mode === 'home' ? homeDirectory : gymDirectory;

        const div = document.createElement('div');
        div.className = 'exercise-row';

        let opts = '';
        for (const grp in dir) {
            opts += `<optgroup label="${grp}">`;
            dir[grp].forEach(n => { opts += `<option value="${n}">${n}</option>`; });
            opts += `</optgroup>`;
        }

        div.innerHTML = `
            <select class="ex-select">${opts}</select>
            <input type="number" class="ex-sets" placeholder="Sets" min="1" value="4">
            <input type="number" class="ex-reps" placeholder="Reps" min="1" value="10">
            <input type="number" class="ex-weight" placeholder="Weight (${unitLabel()})" min="0" value="60" step="0.5">
            <button class="remove-ex-btn" onclick="this.closest('.exercise-row').remove()">✕</button>
        `;
        container.appendChild(div);
    }

    function saveCustomWorkout() {
        const title = document.getElementById('newWorkoutTitle').value.trim();
        if (!title) { alert('Please enter a program title.'); return; }
        const rows = document.querySelectorAll('.exercise-row');
        if (rows.length === 0) { alert('Add at least one exercise.'); return; }

        const exercises = Array.from(rows).map(row => {
            const sel = row.querySelector('.ex-select');
            const txt = row.querySelector('.ex-custom-name');
            return {
            name: sel ? sel.value : (txt ? txt.value.trim() || 'Custom Exercise' : 'Custom Exercise'),
            sets: Number(row.querySelector('.ex-sets').value) || 0,
            reps: Number(row.querySelector('.ex-reps').value) || 0,
            weight: isMetric
                ? Number(row.querySelector('.ex-weight').value) || 0
                : +((Number(row.querySelector('.ex-weight').value) || 0) / 2.2046).toFixed(2)
            };
        });

        const stored = JSON.parse(localStorage.getItem('myWorkouts')) || [];
        stored.push({ title, exercises, timestamp: Date.now() });
        localStorage.setItem('myWorkouts', JSON.stringify(stored));

        document.getElementById('newWorkoutTitle').value = '';
        document.getElementById('newExerciseList').innerHTML = '';
        showPage('selector');
    }


    // ─── OTHER EXERCISE ROW (custom text input) ───────────────────────────────
    function addCustomExerciseRow() {
        const container = document.getElementById('newExerciseList');
        const div = document.createElement('div');
        div.className = 'exercise-row';
        div.innerHTML = `
            <input type="text" class="ex-custom-name" placeholder="Exercise name (e.g., Cable Pull-Through)" style="flex:1;min-width:0;">
            <input type="number" class="ex-sets" placeholder="Sets" min="1" value="3">
            <input type="number" class="ex-reps" placeholder="Reps" min="1" value="12">
            <input type="number" class="ex-weight" placeholder="Weight (${unitLabel()})" min="0" value="0" step="0.5">
            <button class="remove-ex-btn" onclick="this.closest('.exercise-row').remove()">✕</button>
        `;
        container.appendChild(div);
        div.querySelector('.ex-custom-name').focus();
    }

    // ─── EXERCISE GUIDE DATA ──────────────────────────────────────────────────
    const exerciseGuideData = {
        // CHEST
        "Flat Barbell Bench Press": {
            primary: "Chest (Pectoralis Major)", equipment: "Barbell, Bench", difficulty: 2,
            steps: ["Lie flat on the bench, feet flat on floor, back naturally arched.", "Grip the bar slightly wider than shoulder-width.", "Unrack and lower the bar slowly to mid-chest (3-4 sec).", "Pause briefly, then press explosively back to full extension.", "Keep shoulder blades retracted and chest up throughout."],
            tips: ["Don't bounce the bar off your chest — control the eccentric.", "Keep your wrists stacked over your elbows at the bottom.", "Drive your feet into the floor for leg drive.", "Squeeze the bar like you're trying to bend it inward."],
            animation: "benchPress"
        },
        "Incline Dumbbell Press": {
            primary: "Upper Chest, Front Deltoids", equipment: "Dumbbells, Incline Bench (30-45°)", difficulty: 2,
            steps: ["Set bench to 30-45° incline. Sit with dumbbells on thighs.", "Kick dumbbells up and press to shoulder height, palms forward.", "Lower slowly until elbows are at 90° or slightly below.", "Press back up, rotating slightly inward at the top.", "Maintain a slight arch in the lower back."],
            tips: ["Don't set the incline too steep — it shifts load to shoulders.", "Control the descent — 3 seconds down.", "Don't lock elbows out completely at the top."],
            animation: "inclinePress"
        },
        "Push-Ups": {
            primary: "Chest, Triceps, Front Deltoids", equipment: "Bodyweight", difficulty: 1,
            steps: ["Start in a plank position, hands slightly wider than shoulders.", "Keep the body in a straight line from head to heels.", "Lower your chest to the floor, elbows at ~45° angle.", "Push back up to full arm extension.", "Engage core throughout — don't let hips sag."],
            tips: ["Squeeze glutes and abs for a rigid torso.", "Think 'push the floor away' not 'push yourself up'.", "Increase difficulty: elevate feet. Decrease: elevate hands."],
            animation: "pushUp"
        },
        // BACK
        "Pull-Ups / Chin-Ups": {
            primary: "Latissimus Dorsi, Biceps", equipment: "Pull-up Bar", difficulty: 3,
            steps: ["Hang from bar with an overhand (pull-up) or underhand (chin-up) grip.", "Depress your shoulder blades first, before bending elbows.", "Pull your chest toward the bar, leading with your elbows.", "Get chin above bar level at the top.", "Lower under full control to dead hang."],
            tips: ["Don't kip or swing — pure strength reps only.", "Think 'elbows to your back pockets'.", "Full dead hang at the bottom for full ROM."],
            animation: "pullUp"
        },
        "Barbell Rows": {
            primary: "Lats, Mid-Back, Rear Deltoids, Biceps", equipment: "Barbell", difficulty: 3,
            steps: ["Hinge at hips until torso is roughly 45° or parallel to floor.", "Grip bar just outside shoulder-width, arms hanging straight.", "Pull the bar toward your lower sternum/upper abdomen.", "Squeeze shoulder blades together at the top.", "Lower with control. Maintain neutral spine throughout."],
            tips: ["Don't use momentum — control the weight.", "Think 'elbows back' not 'weight up'.", "Brace your core like a deadlift."],
            animation: "barbellRow"
        },
        "Deadlifts": {
            primary: "Hamstrings, Glutes, Lower Back, Traps", equipment: "Barbell", difficulty: 3,
            steps: ["Stand with bar over mid-foot, feet hip-width apart.", "Hinge and grip just outside legs, mixed or double overhand.", "Brace core, squeeze lats, create tension before lift.", "Drive the floor away — hips and shoulders rise together.", "Lock out at top: hips forward, shoulders back, glutes squeezed."],
            tips: ["Bar must stay close — it should scrape your shins.", "Don't jerk the weight off the floor — build tension first.", "Hinge, don't squat. Bar path is straight up."],
            animation: "deadlift"
        },
        // SHOULDERS
        "Overhead Barbell Press": {
            primary: "Anterior & Medial Deltoids, Triceps", equipment: "Barbell", difficulty: 2,
            steps: ["Hold bar at collar-bone height, grip just outside shoulders.", "Brace core, glutes tight, slight lean back (not excessive).", "Press straight up — head moves back slightly to let bar pass.", "Lockout at top, arms fully extended, bar over your ears.", "Lower with control to starting position."],
            tips: ["Never press in front of your face — go straight overhead.", "Full lockout at the top activates upper traps.", "Don't excessively arch your lower back."],
            animation: "ohp"
        },
        "Dumbbell Lateral Raises": {
            primary: "Medial (Side) Deltoids", equipment: "Dumbbells", difficulty: 1,
            steps: ["Stand with dumbbells at sides, slight bend in elbows.", "Raise arms out to the sides in an arc.", "Stop when arms are parallel to the floor (90°).", "Lead with elbows, not wrists — pinky slightly higher.", "Lower slowly (3 sec) with full control."],
            tips: ["Don't shrug your shoulders — keep them depressed.", "The slower the negative, the more effective.", "Use lighter weight than you think — quality over quantity."],
            animation: "lateralRaise"
        },
        // ARMS
        "Barbell Biceps Curls": {
            primary: "Biceps Brachii", equipment: "Barbell or EZ Bar", difficulty: 1,
            steps: ["Stand with barbell, underhand grip at hip-width.", "Pin elbows to sides — they don't move.", "Curl the bar up to shoulder height with control.", "Squeeze the bicep hard at the top.", "Lower slowly (3 sec) to full extension."],
            tips: ["Don't swing your body — isolate the bicep.", "Full extension at the bottom for full ROM.", "Squeeze at the top for an extra 0.5s."],
            animation: "bicepCurl"
        },
        "Skull Crushers": {
            primary: "Triceps (Long Head)", equipment: "EZ Bar or Dumbbells, Bench", difficulty: 2,
            steps: ["Lie on bench, press weight to full arm extension over chest.", "Keeping upper arms fixed and vertical, bend elbows.", "Lower weight toward forehead or just behind the head.", "Pause, then press back to lockout using triceps only.", "Keep upper arms completely still throughout."],
            tips: ["Don't let elbows flare out wide.", "The long head is best stretched behind the head.", "Control the descent — this is an injury-prone exercise."],
            animation: "skullCrusher"
        },
        // LEGS
        "Barbell Back Squats": {
            primary: "Quadriceps, Glutes, Hamstrings", equipment: "Barbell, Squat Rack", difficulty: 3,
            steps: ["Set bar on upper traps (high bar) or rear delts (low bar).", "Feet shoulder-width apart, toes pointed 15-30° outward.", "Brace core, hinge and squat — knees track over toes.", "Break parallel — crease of hip below top of knee.", "Drive through heels to stand, squeeze glutes at top."],
            tips: ["Knees out — don't let them cave inward (valgus).", "Keep chest up and spine neutral.", "Breathe in on the way down, out on the way up."],
            animation: "squat"
        },
        "Romanian Deadlifts (RDLs)": {
            primary: "Hamstrings, Glutes", equipment: "Barbell or Dumbbells", difficulty: 2,
            steps: ["Hold bar at hip level, feet hip-width, slight knee bend.", "Push hips back, lowering bar along the legs.", "Feel a deep stretch in the hamstrings — go to mid-shin.", "Drive hips forward to stand, squeezing glutes at top.", "Keep the bar close to your body throughout."],
            tips: ["It's a hip hinge — not a squat, not a deadlift.", "Keep a neutral spine — don't round the lower back.", "The stretch sensation in your hamstrings is the signal to stop."],
            animation: "rdl"
        },
        "Bulgarian Split Squats": {
            primary: "Quadriceps, Glutes", equipment: "Bench, Dumbbells (optional)", difficulty: 2,
            steps: ["Stand 2 feet in front of a bench, rear foot elevated on it.", "Lower rear knee toward the floor in a controlled descent.", "Front knee tracks over front foot — don't let it cave in.", "Drive through front heel to return to standing.", "Keep torso upright or slight forward lean."],
            tips: ["Position matters — too close = knee over toe stress. Too far = hip flexor stretch.", "Go slow — 3 seconds down.", "Front foot is the working leg — focus there."],
            animation: "splitSquat"
        },
        // CORE
        "Planks": {
            primary: "Core (Transverse Abdominis, Obliques)", equipment: "Bodyweight", difficulty: 1,
            steps: ["Start on forearms, elbows under shoulders.", "Lift hips — body in a straight line from head to heels.", "Squeeze glutes, brace abs hard.", "Breathe normally, hold position.", "Don't let hips sag or pike up."],
            tips: ["Quality over duration — 30 sec tight > 2 min sagging.", "Posterior pelvic tilt slightly to engage lower abs more.", "Push forearms into the floor to engage serratus anterior."],
            animation: "plank"
        },
        "Ab Wheel Rollouts": {
            primary: "Core (Rectus Abdominis, Anti-Extension)", equipment: "Ab Wheel", difficulty: 3,
            steps: ["Kneel on the floor with ab wheel directly under shoulders.", "Brace core hard — imagine bracing for a punch.", "Roll forward slowly, extending as far as possible without hips sagging.", "Use abs (not hip flexors) to pull yourself back.", "Keep hips at the same height throughout."],
            tips: ["This is an anti-extension movement — resist the arch.", "Start with partial rollouts if full extension is too hard.", "Round your back slightly to better target the rectus."],
            animation: "abWheel"
        },
        // GLUTES
        "Barbell Hip Thrusts": {
            primary: "Glutes (Gluteus Maximus)", equipment: "Barbell, Bench", difficulty: 2,
            steps: ["Sit with upper back against a bench, bar over hips.", "Feet flat, shoulder-width apart, knees at 90° when up.", "Drive hips up by squeezing glutes — not lower back.", "At top: torso parallel to floor, shin vertical.", "Lower slowly and repeat — don't rest at the bottom."],
            tips: ["Use a pad on the bar — your hips will thank you.", "Drive through the heels, not the toes.", "At the top, tuck your chin to maintain alignment."],
            animation: "hipThrust"
        },
        // CALVES
        "Standing Calf Raises": {
            primary: "Gastrocnemius, Soleus", equipment: "Machine or Step", difficulty: 1,
            steps: ["Stand on the edge of a step or calf raise machine.", "Lower heels as far below the step as possible (deep stretch).", "Drive up on toes to full contraction.", "Pause and squeeze hard at the top for 1 second.", "Lower slowly back to full stretch."],
            tips: ["Full range of motion — don't do partial reps.", "3 positions: toes forward, in, out — for different heads.", "Calves respond well to high reps (15-25) and frequent training."],
            animation: "calfRaise"
        },
        // HOME
        "Standard Push-Ups": {
            primary: "Chest, Triceps, Front Deltoids", equipment: "Bodyweight", difficulty: 1,
            steps: ["Hands slightly wider than shoulder-width, fingers forward.", "Body in a rigid straight line from head to heels.", "Lower chest to floor, elbows track at ~45° to body.", "Pause briefly at the bottom.", "Push back up to full arm extension."],
            tips: ["Engage core — don't let the hips sag.", "Think 'push the ground away'.", "Scale: kneel for easier, elevate feet for harder."],
            animation: "pushUp"
        },
        "Air Squats": {
            primary: "Quadriceps, Glutes", equipment: "Bodyweight", difficulty: 1,
            steps: ["Feet shoulder-width, toes slightly out.", "Arms out front for balance as you descend.", "Break parallel — hips crease below knees.", "Keep chest up, knees tracking over toes.", "Drive through heels to stand, squeeze glutes at top."],
            tips: ["Push your knees out as you descend.", "Keep heels flat on the floor throughout.", "Build control before adding speed."],
            animation: "squat"
        },
        "Glute Bridges": {
            primary: "Glutes, Hamstrings", equipment: "Bodyweight", difficulty: 1,
            steps: ["Lie on your back, knees bent, feet flat and hip-width apart.", "Drive heels into the floor and push hips up.", "Squeeze glutes hard at the top — body in a straight line.", "Hold 1-2 seconds, then lower with control.", "Don't arch your lower back — use your glutes."],
            tips: ["Drive through heels, not your toes.", "Brace your core to protect the lower back.", "Add a resistance band above the knees for more glute activation."],
            animation: "hipThrust"
        },
    };

    // ─── GUIDE 3D ENGINE ──────────────────────────────────────────────────────
    let guideScene, guideCamera, guideRenderer, guideOrbit;
    let guideAnimationId = null;
    let guideAnimPaused = false;
    let guideAnimTime = 0;
    let guideStickFigure = null;
    let currentAnimType = null;

    function buildGuideStickFigure() {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3b82f6'), roughness: 0.3, metalness: 0.3 });
        const highlight = new THREE.MeshStandardMaterial({ color: new THREE.Color('#ef4444'), roughness: 0.3, metalness: 0.3, emissive: new THREE.Color('#ef4444'), emissiveIntensity: 0.3 });

        // Helper: sphere at position
        const sphere = (r, x, y, z, m) => {
            const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), (m || mat));
            s.position.set(x, y, z);
            group.add(s);
            return s;
        };
        // Helper: cylinder between two points
        const rod = (from, to, r, m) => {
            const dir = new THREE.Vector3().subVectors(to, from);
            const len = dir.length();
            const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), (m || mat));
            const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
            cyl.position.copy(mid);
            cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
            group.add(cyl);
            return cyl;
        };

        const joints = {
            head:    new THREE.Vector3(0, 2.1, 0),
            neck:    new THREE.Vector3(0, 1.8, 0),
            lShoulder: new THREE.Vector3(-0.45, 1.65, 0),
            rShoulder: new THREE.Vector3(0.45, 1.65, 0),
            lElbow:  new THREE.Vector3(-0.45, 1.1, 0),
            rElbow:  new THREE.Vector3(0.45, 1.1, 0),
            lHand:   new THREE.Vector3(-0.45, 0.55, 0),
            rHand:   new THREE.Vector3(0.45, 0.55, 0),
            hips:    new THREE.Vector3(0, 1.0, 0),
            lHip:    new THREE.Vector3(-0.22, 0.95, 0),
            rHip:    new THREE.Vector3(0.22, 0.95, 0),
            lKnee:   new THREE.Vector3(-0.22, 0.4, 0),
            rKnee:   new THREE.Vector3(0.22, 0.4, 0),
            lFoot:   new THREE.Vector3(-0.22, -0.2, 0),
            rFoot:   new THREE.Vector3(0.22, -0.2, 0),
        };

        group.userData.joints = joints;

        sphere(0.16, 0, 2.1, 0); // head
        rod(joints.neck, joints.hips, 0.065); // spine
        rod(joints.lShoulder, joints.rShoulder, 0.045); // collarbone

        const lUpperArm = rod(joints.lShoulder, joints.lElbow, 0.045);
        const rUpperArm = rod(joints.rShoulder, joints.rElbow, 0.045);
        const lLowerArm = rod(joints.lElbow, joints.lHand, 0.038);
        const rLowerArm = rod(joints.rElbow, joints.rHand, 0.038);
        const lUpperLeg = rod(joints.lHip, joints.lKnee, 0.055);
        const rUpperLeg = rod(joints.rHip, joints.rKnee, 0.055);
        const lLowerLeg = rod(joints.lKnee, joints.lFoot, 0.045);
        const rLowerLeg = rod(joints.rKnee, joints.rFoot, 0.045);

        group.userData.limbs = { lUpperArm, rUpperArm, lLowerArm, rLowerArm, lUpperLeg, rUpperLeg, lLowerLeg, rLowerLeg };
        return group;
    }

    function initGuide3D() {
        const container = document.getElementById('guide3DContainer');
        if (!container) return;

        // Clean up previous session
        if (guideRenderer) {
            if (guideAnimationId) cancelAnimationFrame(guideAnimationId);
            container.innerHTML = '';
        }

        guideScene = new THREE.Scene();
        guideScene.background = new THREE.Color('#060d1a');

        guideCamera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
        guideCamera.position.set(0, 1.2, 4.5);

        guideRenderer = new THREE.WebGLRenderer({ antialias: true });
        guideRenderer.setSize(container.clientWidth, container.clientHeight);
        guideRenderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(guideRenderer.domElement);

        guideOrbit = new THREE.OrbitControls(guideCamera, guideRenderer.domElement);
        guideOrbit.enableDamping = true;
        guideOrbit.target.set(0, 1.1, 0);
        guideOrbit.enablePan = false;

        // Lighting
        guideScene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const dl = new THREE.DirectionalLight(0xffffff, 0.9);
        dl.position.set(2, 5, 3);
        guideScene.add(dl);
        const dl2 = new THREE.DirectionalLight(0x88aaff, 0.4);
        dl2.position.set(-2, 2, -3);
        guideScene.add(dl2);

        // Ground grid
        const grid = new THREE.GridHelper(6, 12, '#1e3a5f', '#1e3a5f');
        grid.position.y = -0.22;
        guideScene.add(grid);

        // Build stick figure
        guideStickFigure = buildGuideStickFigure();
        guideScene.add(guideStickFigure);

        guideAnimTime = 0;
        guideAnimPaused = false;
        document.getElementById('animToggleLabel').textContent = '⏸ Pause';
    }

    const animationDrivers = {
        squat: (t, fig) => {
            const phase = (Math.sin(t) + 1) / 2; // 0=top, 1=bottom
            const squatY = phase * -0.7;
            fig.position.y = squatY;
            const label = phase < 0.3 ? 'Standing — Hips Back & Down' : phase < 0.7 ? 'Descending — Break Parallel' : 'Bottom Position — Drive Up';
            document.getElementById('guidePhaseLabel').textContent = label;
        },
        benchPress: (t, fig) => {
            const phase = (Math.sin(t) + 1) / 2;
            fig.rotation.z = Math.PI / 2;
            fig.position.x = -phase * 0.2;
            fig.position.y = -0.4;
            const label = phase < 0.3 ? 'Bar at Chest — Controlled Descent' : phase > 0.7 ? 'Full Lockout — Bar Over Shoulders' : 'Pressing Up Explosively';
            document.getElementById('guidePhaseLabel').textContent = label;
        },
        deadlift: (t, fig) => {
            const phase = (Math.sin(t) + 1) / 2;
            const hipHinge = phase * 0.7;
            fig.rotation.x = hipHinge * 0.6;
            fig.position.y = -hipHinge * 0.4;
            const label = phase < 0.3 ? 'Setup — Bar Over Mid-Foot, Hinge' : phase > 0.7 ? 'Lockout — Hips Forward, Shoulders Back' : 'Driving Floor Away — Hip & Shoulder Rise Together';
            document.getElementById('guidePhaseLabel').textContent = label;
        },
        pullUp: (t, fig) => {
            const phase = (Math.sin(t) + 1) / 2;
            fig.position.y = phase * 0.9 - 0.5;
            const label = phase < 0.3 ? 'Dead Hang — Shoulder Blades Down' : phase > 0.7 ? 'Chin Over Bar — Chest to Bar' : 'Pulling — Elbows to Back Pockets';
            document.getElementById('guidePhaseLabel').textContent = label;
        },
        pushUp: (t, fig) => {
            const phase = (Math.sin(t) + 1) / 2;
            fig.rotation.x = Math.PI / 2;
            fig.position.y = -0.6 + phase * 0.35;
            const label = phase < 0.3 ? 'Lowering — Chest to Floor' : phase > 0.7 ? 'Full Extension — Arms Locked' : 'Pushing the Floor Away';
            document.getElementById('guidePhaseLabel').textContent = label;
        },
        barbellRow: (t, fig) => {
            const phase = (Math.sin(t) + 1) / 2;
            fig.rotation.x = 0.55;
            fig.position.y = -0.35 + phase * 0.25;
            const label = phase < 0.3 ? 'Start — Hinge at Hips, Bar Hanging' : phase > 0.7 ? 'Row — Bar to Lower Sternum' : 'Squeezing Shoulder Blades Together';
            document.getElementById('guidePhaseLabel').textContent = label;
        },
        ohp: (t, fig) => {
            const phase = (Math.sin(t) + 1) / 2;
            fig.position.y = phase * 0.15;
            const label = phase < 0.3 ? 'Bar at Collar Bone — Core Braced' : phase > 0.7 ? 'Full Lockout Overhead — Arms Extended' : 'Pressing Up — Head Back Slightly';
            document.getElementById('guidePhaseLabel').textContent = label;
        },
        bicepCurl: (t, fig) => {
            const phase = (Math.sin(t) + 1) / 2;
            fig.rotation.x = -phase * 0.3;
            const label = phase < 0.3 ? 'Bottom — Full Extension, Elbows Pinned' : phase > 0.7 ? 'Top — Squeeze Bicep Hard' : 'Curling Up — Elbows Stay Fixed';
            document.getElementById('guidePhaseLabel').textContent = label;
        },
        lateralRaise: (t, fig) => {
            const phase = (Math.sin(t) + 1) / 2;
            fig.rotation.z = phase * 0.1;
            const label = phase < 0.3 ? 'Start — Arms at Sides, Slight Elbow Bend' : phase > 0.7 ? 'Top — Arms Parallel to Floor' : 'Raising — Lead with Elbows, Pinky Up';
            document.getElementById('guidePhaseLabel').textContent = label;
        },
        hipThrust: (t, fig) => {
            const phase = (Math.sin(t) + 1) / 2;
            fig.rotation.x = Math.PI / 2;
            fig.position.y = -0.3 + phase * 0.5;
            const label = phase < 0.3 ? 'Bottom — Upper Back on Bench' : phase > 0.7 ? 'Top — Hips Parallel, Glutes Squeezed' : 'Driving Hips Up Through the Heels';
            document.getElementById('guidePhaseLabel').textContent = label;
        },
        rdl: (t, fig) => {
            const phase = (Math.sin(t) + 1) / 2;
            fig.rotation.x = phase * 0.75;
            fig.position.y = -phase * 0.35;
            const label = phase < 0.3 ? 'Standing — Slight Knee Bend' : phase > 0.7 ? 'Bottom — Hamstring Stretch, Neutral Spine' : 'Hinging at Hips — Bar Close to Legs';
            document.getElementById('guidePhaseLabel').textContent = label;
        },
        skullCrusher: (t, fig) => {
            const phase = (Math.sin(t) + 1) / 2;
            fig.rotation.x = Math.PI / 2;
            fig.position.y = -0.4;
            fig.position.z = phase * 0.2;
            const label = phase < 0.3 ? 'Top — Arms Extended, Upper Arms Fixed' : phase > 0.7 ? 'Bottom — Weight to Forehead/Behind Head' : 'Extending — Triceps Only';
            document.getElementById('guidePhaseLabel').textContent = label;
        },
        splitSquat: (t, fig) => {
            const phase = (Math.sin(t) + 1) / 2;
            fig.position.y = -phase * 0.6;
            fig.rotation.x = phase * 0.15;
            const label = phase < 0.3 ? 'Standing — Rear Foot Elevated' : phase > 0.7 ? 'Bottom — Rear Knee Near Floor' : 'Descending — Front Knee Over Toes';
            document.getElementById('guidePhaseLabel').textContent = label;
        },
        plank: (t, fig) => {
            fig.rotation.x = Math.PI / 2;
            fig.position.y = -0.55;
            const breathe = Math.sin(t * 2) * 0.02;
            fig.position.z = breathe;
            document.getElementById('guidePhaseLabel').textContent = 'Hold — Body Rigid, Core Braced, Breathe Normally';
        },
        calfRaise: (t, fig) => {
            const phase = (Math.sin(t) + 1) / 2;
            fig.position.y = phase * 0.25;
            const label = phase < 0.3 ? 'Bottom — Full Heel Drop (Stretch)' : phase > 0.7 ? 'Top — Full Extension, Squeeze Calves' : 'Rising on Toes';
            document.getElementById('guidePhaseLabel').textContent = label;
        },
        inclinePress: (t, fig) => {
            const phase = (Math.sin(t) + 1) / 2;
            fig.rotation.x = Math.PI / 2 - 0.55;
            fig.position.y = -0.2 + phase * 0.2;
            const label = phase < 0.3 ? 'Bottom — Dumbbells at Upper Chest' : phase > 0.7 ? 'Top — Arms Extended, Slight Inward Rotation' : 'Pressing — Drive Upward and Inward';
            document.getElementById('guidePhaseLabel').textContent = label;
        },
        abWheel: (t, fig) => {
            const phase = (Math.sin(t) + 1) / 2;
            fig.rotation.x = Math.PI / 2 + phase * 0.5;
            fig.position.y = -0.5;
            const label = phase < 0.3 ? 'Start — Kneeling, Core Braced Hard' : phase > 0.7 ? 'Extended — Hold Without Hips Sagging' : 'Rolling Out — Resist the Arch';
            document.getElementById('guidePhaseLabel').textContent = label;
        },
    };

    function runGuideAnimation() {
        if (!guideScene || !guideCamera || !guideRenderer || !guideStickFigure) return;
        guideAnimationId = requestAnimationFrame(runGuideAnimation);
        guideOrbit.update();

        if (!guideAnimPaused && currentAnimType) {
            guideAnimTime += 0.025;
            const driver = animationDrivers[currentAnimType];
            if (driver) driver(guideAnimTime, guideStickFigure);
        }

        guideRenderer.render(guideScene, guideCamera);
    }

    function toggleGuideAnimation() {
        guideAnimPaused = !guideAnimPaused;
        document.getElementById('animToggleLabel').textContent = guideAnimPaused ? '▶ Resume' : '⏸ Pause';
    }

    function resetGuideCamera() {
        if (guideCamera && guideOrbit) {
            guideCamera.position.set(0, 1.2, 4.5);
            guideOrbit.target.set(0, 1.1, 0);
            guideOrbit.update();
        }
    }

    // ─── GUIDE PAGE LOGIC ─────────────────────────────────────────────────────
    function buildGuideCategoryList() {
        const mode = document.getElementById('guideLocationMode').value;
        const dir = mode === 'home' ? homeDirectory : gymDirectory;
        const catSel = document.getElementById('guideCategorySelect');
        catSel.innerHTML = '<option value="">— Select Muscle Group —</option>';
        Object.keys(dir).forEach(grp => {
            catSel.innerHTML += `<option value="${grp}">${grp}</option>`;
        });
        document.getElementById('guideExerciseSelect').innerHTML = '<option value="">— Select Exercise —</option>';
        document.getElementById('guideContent').style.display = 'none';
        document.getElementById('guidePlaceholder').style.display = 'block';
    }

    function populateGuideExercises() {
        const mode = document.getElementById('guideLocationMode').value;
        const dir = mode === 'home' ? homeDirectory : gymDirectory;
        const cat = document.getElementById('guideCategorySelect').value;
        const exSel = document.getElementById('guideExerciseSelect');
        exSel.innerHTML = '<option value="">— Select Exercise —</option>';
        if (cat && dir[cat]) {
            dir[cat].forEach(ex => {
                exSel.innerHTML += `<option value="${ex}">${ex}</option>`;
            });
        }
    }

    function loadExerciseGuide() {
        const exName = document.getElementById('guideExerciseSelect').value;
        if (!exName) return;

        const data = exerciseGuideData[exName];

        document.getElementById('guideContent').style.display = 'block';
        document.getElementById('guidePlaceholder').style.display = 'none';

        document.getElementById('guideExName').textContent = exName;

        if (data) {
            document.getElementById('guidePrimary').textContent = data.primary;
            document.getElementById('guideEquipment').textContent = data.equipment;

            // Difficulty stars
            const stars = '⭐'.repeat(data.difficulty) + '☆'.repeat(3 - data.difficulty);
            const labels = ['', 'Beginner', 'Intermediate', 'Advanced'];
            document.getElementById('guideDifficulty').innerHTML = `<span style="font-size:16px;">${stars}</span> <span style="font-size:13px;color:var(--text-muted);">${labels[data.difficulty]}</span>`;

            document.getElementById('guideSteps').innerHTML = data.steps.map(s => `<li>${s}</li>`).join('');
            document.getElementById('guideTips').innerHTML = data.tips.map(t => `<li>${t}</li>`).join('');

            currentAnimType = data.animation;
        } else {
            // Generic fallback for exercises without guide data
            const cat = document.getElementById('guideCategorySelect').value;
            document.getElementById('guidePrimary').textContent = cat || 'Compound Movement';
            document.getElementById('guideEquipment').textContent = 'See exercise name';
            document.getElementById('guideDifficulty').innerHTML = '<span style="font-size:16px;">⭐⭐☆</span> <span style="font-size:13px;color:var(--text-muted);">Intermediate</span>';
            document.getElementById('guideSteps').innerHTML = [
                'Set up your equipment and positioning.',
                'Maintain a neutral spine throughout the movement.',
                'Control the eccentric (lowering) phase — take 3 seconds.',
                'Apply force through the concentric (lifting) phase.',
                'Complete full range of motion on each rep.'
            ].map(s => `<li>${s}</li>`).join('');
            document.getElementById('guideTips').innerHTML = [
                'Warm up the joint before loading it heavy.',
                'Film yourself to check form from the side.',
                'Start light — learn the pattern before adding weight.'
            ].map(t => `<li>${t}</li>`).join('');
            currentAnimType = 'squat'; // generic animation
        }

        // Init/reset the 3D scene
        if (guideAnimationId) cancelAnimationFrame(guideAnimationId);
        guideStickFigure = null;

        // Small delay so DOM finishes rendering the container
        setTimeout(() => {
            initGuide3D();
            runGuideAnimation();
        }, 50);
    }

    // Initialize guide dropdowns on page load
    window.addEventListener('load', () => {
        buildGuideCategoryList();
    });


    // ─── REST TIMER ──────────────────────────────────────────────────────────
    let restTimerInterval = null;
    let restSecondsLeft = 0;

    function showRestTimerBar() {
        const bar = document.getElementById('restTimerBar');
        if (bar) bar.classList.add('visible');
        startRest(60);
    }

    function startRest(seconds) {
        clearInterval(restTimerInterval);
        restSecondsLeft = seconds;
        // Update active preset button
        document.querySelectorAll('.rest-preset-btn').forEach(b => b.classList.remove('active'));
        const map = {30:0, 60:1, 90:2, 120:3, 180:4};
        const btns = document.querySelectorAll('.rest-preset-btn');
        if (map[seconds] !== undefined && btns[map[seconds]]) btns[map[seconds]].classList.add('active');
        updateRestDisplay();
        restTimerInterval = setInterval(() => {
            restSecondsLeft--;
            updateRestDisplay();
            if (restSecondsLeft <= 0) {
                clearInterval(restTimerInterval);
                // Flash finish
                const disp = document.getElementById('restTimerDisplay');
                if (disp) { disp.textContent = 'GO!'; disp.classList.add('urgent'); }
                setTimeout(() => stopRestTimer(), 2000);
            }
        }, 1000);
    }

    function updateRestDisplay() {
        const disp = document.getElementById('restTimerDisplay');
        if (!disp) return;
        const m = Math.floor(restSecondsLeft / 60);
        const s = restSecondsLeft % 60;
        disp.textContent = `${m}:${String(s).padStart(2,'0')}`;
        disp.classList.toggle('urgent', restSecondsLeft <= 10 && restSecondsLeft > 0);
    }

    function stopRestTimer() {
        clearInterval(restTimerInterval);
        const bar = document.getElementById('restTimerBar');
        if (bar) bar.classList.remove('visible');
        const disp = document.getElementById('restTimerDisplay');
        if (disp) { disp.textContent = '1:30'; disp.classList.remove('urgent'); }
    }

    function onSetDone(btn) {
        btn.textContent = '✓ Done!';
        btn.style.background = '#10b981';
        btn.style.color = '#fff';
        btn.disabled = true;
        showRestTimerBar();
    }

    // ─── QUICK LOG PAGE ────────────────────────────────────────────────────────
    let qlSession = []; // array of { name, sets, reps, weight, day }

    function initQLPage() {
        const catSel = document.getElementById('qlCategory');
        if (!catSel || catSel.options.length > 1) return;
        catSel.innerHTML = '<option value="">— Select —</option>';
        Object.keys(gymDirectory).forEach(g => {
            catSel.innerHTML += `<option value="${g}">${g}</option>`;
        });
        // Set default day to today
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const todayDay = days[new Date().getDay()];
        const daySel = document.getElementById('qlDay');
        if (daySel) {
            Array.from(daySel.options).forEach(opt => {
                if (opt.value === todayDay) opt.selected = true;
            });
        }
        renderQLSession();
    }

    function populateQLExercises() {
        const cat = document.getElementById('qlCategory').value;
        const exSel = document.getElementById('qlExercise');
        exSel.innerHTML = '<option value="">— Select exercise —</option>';
        if (cat && gymDirectory[cat]) {
            gymDirectory[cat].forEach(ex => {
                exSel.innerHTML += `<option value="${ex}">${ex}</option>`;
            });
        }
    }

    function quickLogAddExercise() {
        const exSel = document.getElementById('qlExercise').value;
        const custom = document.getElementById('qlCustomName').value.trim();
        const name = custom || exSel;
        if (!name) { alert('Please select or type an exercise name.'); return; }

        const sets = Number(document.getElementById('qlSets').value) || 3;
        const reps = Number(document.getElementById('qlReps').value) || 10;
        const weightRaw = Number(document.getElementById('qlWeight').value) || 0;
        const weight = isMetric ? weightRaw : +(weightRaw / 2.2046).toFixed(2);
        const day = document.getElementById('qlDay').value;

        qlSession.push({ name, sets, reps, weight, day });

        // Reset inputs
        document.getElementById('qlExercise').value = '';
        document.getElementById('qlCustomName').value = '';
        document.getElementById('qlSets').value = '3';
        document.getElementById('qlReps').value = '10';
        document.getElementById('qlWeight').value = '0';

        renderQLSession();
    }

    function renderQLSession() {
        const list = document.getElementById('qlSessionList');
        const actions = document.getElementById('qlActions');
        if (!list) return;
        if (qlSession.length === 0) {
            list.innerHTML = '';
            if (actions) actions.style.display = 'none';
            return;
        }
        if (actions) actions.style.display = 'flex';
        list.innerHTML = qlSession.map((ex, i) => `
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <span style="font-weight:700;color:#fff;">${ex.name}</span>
                    <span style="font-size:12px;color:var(--text-muted);margin-left:10px;">${ex.sets} sets × ${ex.reps} reps @ ${convertWeight(ex.weight)}${unitLabel()}</span>
                    <span style="font-size:11px;color:var(--text-muted);margin-left:8px;">${ex.day}</span>
                </div>
                <button onclick="qlSession.splice(${i},1);renderQLSession();" style="background:transparent;border:none;color:#ef4444;cursor:pointer;font-size:16px;">✕</button>
            </div>
        `).join('');
    }

    function clearQLSession() {
        qlSession = [];
        renderQLSession();
    }

    function commitQLSession() {
        if (qlSession.length === 0) { alert('Add at least one exercise.'); return; }
        const day = qlSession[0].day;
        const session = {
            title: 'Quick Log',
            dayOfWeek: day,
            exercises: qlSession.map(ex => ({ name: ex.name, sets: ex.sets, reps: ex.reps, weight: ex.weight })),
            timestamp: Date.now()
        };
        const history = JSON.parse(localStorage.getItem('completedWorkouts')) || [];
        history.push(session);
        localStorage.setItem('completedWorkouts', JSON.stringify(history));
        qlSession = [];
        renderQLSession();
        // Success feedback
        const btn = document.querySelector('#page-quicklog .action-btn[onclick*="commitQLSession"]');
        if (btn) { btn.textContent = '✓ Logged!'; btn.style.background = '#059669'; }
        setTimeout(() => { showPage('home'); }, 700);
    }


    // ─── 52-WEEK STATS: PERIOD TOGGLE ────────────────────────────────────────
    let statsPeriod = 'volume'; // 'volume' | 'frequency'

    function setStatsPeriod(mode) {
        statsPeriod = mode;
        document.querySelectorAll('.stats-period-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('period' + mode.charAt(0).toUpperCase() + mode.slice(1)).classList.add('active');
        drawYearlyChart();
    }

    function showStatsModal() {
        document.getElementById('statsModal').classList.add('open');
        statsPeriod = 'volume';
        document.querySelectorAll('.stats-period-btn').forEach(b => b.classList.remove('active'));
        const pvBtn = document.getElementById('periodVolume');
        if (pvBtn) pvBtn.classList.add('active');
        setTimeout(() => { drawYearlyChart(); }, 80);
    }

    function closeStatsModal() {
        document.getElementById('statsModal').classList.remove('open');
    }

    // ─── 52-WEEK CHART: bars + moving average + tooltips ─────────────────────
    function get52WeekData() {
        const history = JSON.parse(localStorage.getItem('completedWorkouts')) || [];
        const now = Date.now();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        // Each week: { volume, frequency, startDate }
        const weeks = Array.from({length: 52}, (_, i) => ({
            volume: 0,
            frequency: 0,
            startDate: new Date(now - (51 - i) * weekMs)
        }));
        history.forEach(s => {
            const weeksAgo = Math.floor((now - s.timestamp) / weekMs);
            if (weeksAgo >= 0 && weeksAgo < 52) {
                const idx = 51 - weeksAgo;
                weeks[idx].volume += getSessionVolume(s.exercises);
                weeks[idx].frequency++;
            }
        });
        return weeks;
    }

    function computeMovingAvg(data, window) {
        return data.map((_, i) => {
            const slice = data.slice(Math.max(0, i - window + 1), i + 1).filter(v => v > 0);
            return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
        });
    }

    function formatWeekLabel(date) {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}`;
    }

    function drawYearlyChart() {
        const canvas = document.getElementById('yearlyChart');
        if (!canvas) return;

        const weeks = get52WeekData();
        const rawData = statsPeriod === 'volume'
            ? weeks.map(w => convertWeight(w.volume))
            : weeks.map(w => w.frequency);

        const movAvg = computeMovingAvg(rawData, 4);

        const W = canvas.parentElement.clientWidth - 2 || 740;
        canvas.width = W;
        canvas.height = 320;
        const ctx = canvas.getContext('2d');
        const H = 320;
        const pad = { top: 20, right: 16, bottom: 40, left: 50 };
        const chartW = W - pad.left - pad.right;
        const chartH = H - pad.top - pad.bottom;

        ctx.clearRect(0, 0, W, H);

        const maxVal = Math.max(...rawData, ...movAvg, 1);
        const barW = chartW / 52;

        // Grid lines
        ctx.strokeStyle = '#1e3a5f';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + chartH - (i / 4) * chartH;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
            ctx.fillStyle = '#64748b';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            const val = Math.round((i / 4) * maxVal);
            ctx.fillText(statsPeriod === 'volume' ? `${val}${unitLabel()}` : `${val}`, pad.left - 4, y + 4);
        }
        ctx.setLineDash([]);

        // Month labels on x-axis
        ctx.fillStyle = '#475569';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        let lastMonth = -1;
        weeks.forEach((w, i) => {
            const m = w.startDate.getMonth();
            if (m !== lastMonth) {
                const x = pad.left + i * barW + barW / 2;
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                ctx.fillText(months[m], x, H - 8);
                lastMonth = m;
            }
        });

        // Bars
        rawData.forEach((val, i) => {
            const bh = (val / maxVal) * chartH;
            const x = pad.left + i * barW;
            const y = pad.top + chartH - bh;
            ctx.fillStyle = val > 0 ? (statsPeriod === 'volume' ? '#3b82f6' : '#10b981') : '#1e3a5f44';
            if (ctx.roundRect) {
                ctx.beginPath(); ctx.roundRect(x + 1, y, barW - 2, bh, 2); ctx.fill();
            } else {
                ctx.fillRect(x + 1, y, barW - 2, bh);
            }
        });

        // Moving average line
        ctx.beginPath();
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        movAvg.forEach((val, i) => {
            const x = pad.left + i * barW + barW / 2;
            const y = pad.top + chartH - (val / maxVal) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Store chart metadata for tooltip
        canvas._chartMeta = { weeks, rawData, movAvg, pad, chartW, chartH, barW, maxVal, W, H };

        // Attach hover listener (once)
        if (!canvas._tooltipBound) {
            canvas._tooltipBound = true;
            canvas.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const meta = canvas._chartMeta;
                if (!meta) return;
                const i = Math.floor((mx - meta.pad.left) / meta.barW);
                const box = document.getElementById('statsTooltipBox');
                if (i >= 0 && i < 52) {
                    const w = meta.weeks[i];
                    const val = meta.rawData[i];
                    const avg = meta.movAvg[i];
                    const label = statsPeriod === 'volume'
                        ? `${val.toLocaleString()} ${unitLabel()}`
                        : `${val} session${val !== 1 ? 's' : ''}`;
                    const avgLabel = statsPeriod === 'volume'
                        ? `Trend: ${Math.round(avg).toLocaleString()} ${unitLabel()}`
                        : `Trend: ${avg.toFixed(1)} sessions`;
                    if (box) {
                        box.style.display = 'flex';
                        box.style.flexDirection = 'column';
                        box.innerHTML = `<strong style="color:#fff;">Wk of ${formatWeekLabel(w.startDate)}</strong><span>${statsPeriod === 'volume' ? 'Volume' : 'Frequency'}: ${label}</span><span style="color:#f97316;">${avgLabel}</span>`;
                    }
                } else {
                    if (box) box.style.display = 'none';
                }
            });
            canvas.addEventListener('mouseleave', () => {
                const box = document.getElementById('statsTooltipBox');
                if (box) box.style.display = 'none';
            });
        }
    }

    // ─── e1RM CHART ───────────────────────────────────────────────────────────
    function calc_e1RM(weight, reps) {
        if (reps <= 0) return 0;
        return weight * (1 + reps / 30);
    }

    function drawE1RMChart() {
        const exercise = document.getElementById('e1rmExerciseSelect').value;
        const canvas = document.getElementById('e1rmChart');
        if (!canvas || !exercise) return;

        const history = JSON.parse(localStorage.getItem('completedWorkouts')) || [];
        const now = Date.now();
        const weekMs = 7 * 24 * 60 * 60 * 1000;

        // Build weekly best e1RM
        const weeks = Array.from({length: 52}, (_, i) => ({
            e1rm: 0,
            startDate: new Date(now - (51 - i) * weekMs)
        }));
        history.forEach(s => {
            const weeksAgo = Math.floor((now - s.timestamp) / weekMs);
            if (weeksAgo < 0 || weeksAgo >= 52) return;
            const idx = 51 - weeksAgo;
            s.exercises.forEach(ex => {
                if (ex.name === exercise && Number(ex.reps) > 0) {
                    const e = calc_e1RM(Number(ex.weight), Number(ex.reps));
                    if (e > weeks[idx].e1rm) weeks[idx].e1rm = e;
                }
            });
        });

        const rawData = weeks.map(w => convertWeight(w.e1rm));
        const movAvg = computeMovingAvg(rawData.filter((_, i) => rawData[i] > 0).map(v => v), 4);
        // Rebuild movAvg on full 52-week array
        const movAvgFull = computeMovingAvg(rawData, 4);

        const W = canvas.parentElement.clientWidth - 2 || 740;
        canvas.width = W;
        canvas.height = 220;
        const H = 220;
        const ctx = canvas.getContext('2d');
        const pad = { top: 16, right: 16, bottom: 36, left: 50 };
        const chartW = W - pad.left - pad.right;
        const chartH = H - pad.top - pad.bottom;

        ctx.clearRect(0, 0, W, H);

        const nonZero = rawData.filter(v => v > 0);
        if (nonZero.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No data logged yet for this exercise.', W / 2, H / 2);
            return;
        }

        const maxVal = Math.max(...rawData, 1);
        const minVal = Math.min(...nonZero) * 0.9;
        const range = maxVal - minVal || 1;

        // Grid
        ctx.strokeStyle = '#1e3a5f';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        for (let i = 0; i <= 3; i++) {
            const y = pad.top + chartH - (i / 3) * chartH;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
            ctx.fillStyle = '#64748b';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            const val = Math.round(minVal + (i / 3) * range);
            ctx.fillText(`${val}${unitLabel()}`, pad.left - 4, y + 4);
        }
        ctx.setLineDash([]);

        const barW = chartW / 52;

        // Dots + line for e1RM
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        let first = true;
        rawData.forEach((val, i) => {
            if (val <= 0) return;
            const x = pad.left + i * barW + barW / 2;
            const y = pad.top + chartH - ((val - minVal) / range) * chartH;
            if (first) { ctx.moveTo(x, y); first = false; }
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Dots
        rawData.forEach((val, i) => {
            if (val <= 0) return;
            const x = pad.left + i * barW + barW / 2;
            const y = pad.top + chartH - ((val - minVal) / range) * chartH;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#3b82f6';
            ctx.fill();
        });

        // Trend line (4-week moving avg)
        ctx.beginPath();
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        first = true;
        movAvgFull.forEach((val, i) => {
            if (val <= 0) return;
            const x = pad.left + i * barW + barW / 2;
            const y = pad.top + chartH - ((val - minVal) / range) * chartH;
            if (first) { ctx.moveTo(x, y); first = false; }
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // Month labels
        ctx.fillStyle = '#475569';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        let lastMonth = -1;
        weeks.forEach((w, i) => {
            const m = w.startDate.getMonth();
            if (m !== lastMonth) {
                const x = pad.left + i * barW + barW / 2;
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                ctx.fillText(months[m], x, H - 6);
                lastMonth = m;
            }
        });

        canvas._e1rmMeta = { weeks, rawData, movAvgFull, pad, barW, chartH, minVal, range };

        if (!canvas._tooltipBound) {
            canvas._tooltipBound = true;
            canvas.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const meta = canvas._e1rmMeta;
                if (!meta) return;
                const i = Math.floor((mx - meta.pad.left) / meta.barW);
                const box = document.getElementById('e1rmTooltipBox');
                if (i >= 0 && i < 52 && meta.rawData[i] > 0) {
                    const e1rm = meta.rawData[i];
                    box.textContent = `Week of ${formatWeekLabel(meta.weeks[i].startDate)}: Est. 1RM = ${e1rm.toFixed(1)} ${unitLabel()}`;
                    box.style.color = '#93c5fd';
                } else if (box) {
                    box.textContent = 'Hover over a data point to see your estimated 1RM for that week.';
                    box.style.color = '';
                }
            });
        }
    }

    // ─── PROGRESS MODAL ───────────────────────────────────────────────────────
    function openProgressModal() {
        const modal = document.getElementById('progressModal');
        if (!modal) return;
        modal.classList.add('open');
        // Populate category select
        const catSel = document.getElementById('progressCatSelect');
        if (catSel && catSel.options.length <= 1) {
            Object.keys(gymDirectory).forEach(g => {
                catSel.innerHTML += `<option value="${g}">${g}</option>`;
            });
        }
        drawProgressChart();
    }

    function populateProgressExercises() {
        const cat = document.getElementById('progressCatSelect').value;
        const exSel = document.getElementById('progressExSelect');
        exSel.innerHTML = '<option value="">— Exercise —</option>';
        if (cat && gymDirectory[cat]) {
            gymDirectory[cat].forEach(ex => exSel.innerHTML += `<option value="${ex}">${ex}</option>`);
        }
    }

    function drawProgressChart() {
        const exercise = document.getElementById('progressExSelect').value;
        const canvas = document.getElementById('progressChart');
        if (!canvas || !exercise) {
            if (canvas) {
                const ctx = canvas.getContext('2d');
                const W = canvas.parentElement.clientWidth - 2 || 700;
                canvas.width = W; canvas.height = 260;
                ctx.clearRect(0, 0, W, 260);
                ctx.fillStyle = '#475569'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText('Select a muscle group and exercise above.', W / 2, 130);
            }
            return;
        }

        const history = JSON.parse(localStorage.getItem('completedWorkouts')) || [];
        const now = Date.now();
        const weekMs = 7 * 24 * 60 * 60 * 1000;

        const weeks = Array.from({length: 52}, (_, i) => ({
            bestScore: 0, // weight × reps (best set)
            startDate: new Date(now - (51 - i) * weekMs)
        }));

        history.forEach(s => {
            const weeksAgo = Math.floor((now - s.timestamp) / weekMs);
            if (weeksAgo < 0 || weeksAgo >= 52) return;
            const idx = 51 - weeksAgo;
            s.exercises.forEach(ex => {
                if (ex.name === exercise) {
                    const score = convertWeight(Number(ex.weight)) * Number(ex.reps);
                    if (score > weeks[idx].bestScore) weeks[idx].bestScore = score;
                }
            });
        });

        const rawData = weeks.map(w => w.bestScore);
        const movAvgFull = computeMovingAvg(rawData, 4);

        const W = canvas.parentElement.clientWidth - 2 || 700;
        canvas.width = W; canvas.height = 260;
        const H = 260;
        const ctx = canvas.getContext('2d');
        const pad = { top: 16, right: 16, bottom: 36, left: 54 };
        const chartW = W - pad.left - pad.right;
        const chartH = H - pad.top - pad.bottom;

        ctx.clearRect(0, 0, W, H);

        const nonZero = rawData.filter(v => v > 0);
        if (nonZero.length === 0) {
            ctx.fillStyle = '#64748b'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('No logged data for this exercise yet.', W / 2, H / 2);
            return;
        }

        const maxVal = Math.max(...rawData, 1);
        const minVal = Math.min(...nonZero) * 0.88;
        const range = maxVal - minVal || 1;
        const barW = chartW / 52;

        // Grid
        ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + chartH - (i / 4) * chartH;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
            ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
            ctx.fillText(Math.round(minVal + (i / 4) * range), pad.left - 4, y + 4);
        }
        ctx.setLineDash([]);

        // Bars (best set score)
        rawData.forEach((val, i) => {
            if (val <= 0) return;
            const bh = ((val - minVal) / range) * chartH;
            const x = pad.left + i * barW + 1;
            const y = pad.top + chartH - bh;
            ctx.fillStyle = '#10b981aa';
            ctx.fillRect(x, y, barW - 2, bh);
        });

        // Trend line
        ctx.beginPath(); ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2.5; ctx.setLineDash([6,3]);
        let first = true;
        movAvgFull.forEach((val, i) => {
            if (val <= 0) return;
            const x = pad.left + i * barW + barW / 2;
            const y = pad.top + chartH - ((val - minVal) / range) * chartH;
            if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
        });
        ctx.stroke(); ctx.setLineDash([]);

        // Dots
        rawData.forEach((val, i) => {
            if (val <= 0) return;
            const x = pad.left + i * barW + barW / 2;
            const y = pad.top + chartH - ((val - minVal) / range) * chartH;
            ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = '#10b981'; ctx.fill();
        });

        // Month labels
        ctx.fillStyle = '#475569'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        let lastMonth = -1;
        weeks.forEach((w, i) => {
            const m = w.startDate.getMonth();
            if (m !== lastMonth) {
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                ctx.fillText(months[m], pad.left + i * barW + barW / 2, H - 6);
                lastMonth = m;
            }
        });

        canvas._progressMeta = { weeks, rawData, movAvgFull, pad, barW, chartH, minVal, range };

        if (!canvas._tooltipBound) {
            canvas._tooltipBound = true;
            canvas.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const meta = canvas._progressMeta;
                if (!meta) return;
                const i = Math.floor((mx - meta.pad.left) / meta.barW);
                const box = document.getElementById('progressTooltipBox');
                if (i >= 0 && i < 52 && meta.rawData[i] > 0) {
                    box.textContent = `Week of ${formatWeekLabel(meta.weeks[i].startDate)}: Best set score = ${meta.rawData[i].toFixed(0)} (weight × reps)`;
                    box.style.color = '#6ee7b7';
                } else if (box) {
                    box.textContent = 'Hover over bars to see your best set performance that week.';
                    box.style.color = '';
                }
            });
        }
    }

    // ─── ACTIVITY CALENDAR ────────────────────────────────────────────────────
    function buildActivityCalendar(history) {
        const container = document.getElementById('activityCalendar');
        if (!container) return;

        const today = new Date(); today.setHours(0,0,0,0);
        const WEEKS = 28; // 28 weeks = ~7 months
        const DAYS = 7;

        // Map date-key → array of sessions
        const sessionsByDay = {};
        history.forEach(s => {
            const d = new Date(s.timestamp);
            d.setHours(0,0,0,0);
            const key = d.toISOString().slice(0, 10);
            if (!sessionsByDay[key]) sessionsByDay[key] = [];
            sessionsByDay[key].push(s);
        });

        // Build grid: WEEKS columns × 7 rows (Mon at top)
        // Start from Monday 28 weeks ago
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) - (WEEKS - 1) * 7);

        // Create grid div
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:32px repeat(' + WEEKS + ',1fr);gap:2px;overflow-x:auto;padding-bottom:4px;';

        // Row labels
        const dayNames = ['','Mon','','Wed','','Fri','','Sun'];
        // Header row: empty + month labels
        // We'll render row by row: for each day of week (0=Mon..6=Sun)
        for (let dow = 0; dow < DAYS; dow++) {
            // Day label cell
            const label = document.createElement('div');
            label.style.cssText = 'font-size:9px;color:#64748b;font-weight:600;text-align:right;padding-right:4px;display:flex;align-items:center;justify-content:flex-end;height:16px;';
            label.textContent = ['M','','W','','F','','S'][dow] || '';
            grid.appendChild(label);

            for (let w = 0; w < WEEKS; w++) {
                const d = new Date(startDate);
                d.setDate(startDate.getDate() + w * 7 + dow);
                const key = d.toISOString().slice(0, 10);
                const sessions = sessionsByDay[key] || [];

                const cell = document.createElement('div');
                cell.style.cssText = 'border-radius:2px;aspect-ratio:1;cursor:pointer;transition:transform 0.1s;position:relative;min-width:10px;';

                // Determine color
                const isToday = d.getTime() === today.getTime();
                const isFuture = d > today;

                if (isFuture) {
                    cell.style.background = 'transparent';
                } else if (sessions.length === 0) {
                    cell.style.background = '#1e3a5f22';
                    cell.style.border = '1px solid #33415511';
                } else {
                    // Determine dominant category
                    const cats = sessions.map(s => {
                        const t = (s.title || '').toLowerCase();
                        if (t.includes('cardio')) return 'cardio';
                        if (t.includes('home') || s.exercises?.some(e => homeDirectory && Object.values(homeDirectory).flat().includes(e.name))) return 'home';
                        return 'gym';
                    });
                    const catCount = {};
                    cats.forEach(c => catCount[c] = (catCount[c] || 0) + 1);
                    const dominant = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0][0];
                    const catColors = { gym: '#3b82f6', home: '#10b981', cardio: '#f97316' };
                    cell.style.background = catColors[dominant] || '#3b82f6';
                }

                if (isToday) cell.style.outline = '2px solid #f97316';

                // Tooltip on hover
                if (sessions.length > 0) {
                    cell.addEventListener('mouseenter', (e) => {
                        const popover = document.getElementById('calendarPopover');
                        if (!popover) return;
                        const totalVol = sessions.reduce((sum, s) => sum + getSessionVolume(s.exercises), 0);
                        const titles = sessions.map(s => s.title).join('<br>');
                        popover.innerHTML = `<strong>${d.toDateString()}</strong><br>${titles}<br><span style="color:#94a3b8;">${convertWeight(totalVol).toLocaleString()} ${unitLabel()} volume</span>`;
                        const rect = e.target.getBoundingClientRect();
                        const containerRect = container.getBoundingClientRect();
                        popover.style.display = 'block';
                        popover.style.left = (rect.left - containerRect.left) + 'px';
                        popover.style.top = (rect.top - containerRect.top + 20) + 'px';
                    });
                    cell.addEventListener('mouseleave', () => {
                        const popover = document.getElementById('calendarPopover');
                        if (popover) popover.style.display = 'none';
                    });
                }

                grid.appendChild(cell);
            }
        }

        container.innerHTML = '';
        container.appendChild(grid);
    }

    // ─── RECENT ACTIVITY LIST ─────────────────────────────────────────────────
    function buildRecentActivityList(history) {
        const container = document.getElementById('recentActivityList');
        if (!container) return;

        const recent = [...history].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

        if (recent.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">No sessions logged yet.</p>';
            return;
        }

        container.innerHTML = recent.map((session, idx) => {
            const vol = convertWeight(getSessionVolume(session.exercises));
            const date = new Date(session.timestamp);
            const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            const catColor = (session.title || '').toLowerCase().includes('cardio') ? '#f97316'
                : (session.title || '').toLowerCase().includes('home') ? '#10b981' : '#3b82f6';

            const exRows = session.exercises.map(ex => `
                <div class="activity-ex-item">
                    <span style="color:var(--text-main);">${ex.name}</span>
                    <span style="color:var(--text-muted);">${ex.sets}×${ex.reps} @ ${convertWeight(ex.weight)}${unitLabel()}</span>
                </div>`).join('');

            return `
            <div class="activity-row">
                <div class="activity-row-header" onclick="toggleActivityDetail(${idx})">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:4px;height:36px;border-radius:2px;background:${catColor};flex-shrink:0;"></div>
                        <div>
                            <div style="font-weight:700;color:#fff;font-size:14px;">${session.title || 'Workout'}</div>
                            <div style="font-size:12px;color:var(--text-muted);">${dateStr} · ${session.exercises.length} exercises</div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:700;color:var(--accent);font-size:15px;">${vol.toLocaleString()} ${unitLabel()}</div>
                        <div style="font-size:10px;color:var(--text-muted);">▼ expand</div>
                    </div>
                </div>
                <div class="activity-row-detail" id="actDetail_${idx}">
                    ${exRows}
                    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
                        <button class="progress-btn" onclick="openProgressFromSession('${session.exercises[0]?.name || ''}')">📈 Track Progress</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    function toggleActivityDetail(idx) {
        const el = document.getElementById(`actDetail_${idx}`);
        if (el) el.classList.toggle('open');
    }

    function openProgressFromSession(exerciseName) {
        openProgressModal();
        // Try to auto-select the exercise
        if (!exerciseName) return;
        setTimeout(() => {
            // Find what category it's in
            for (const [cat, list] of Object.entries(gymDirectory)) {
                if (list.includes(exerciseName)) {
                    const catSel = document.getElementById('progressCatSelect');
                    if (catSel) { catSel.value = cat; populateProgressExercises(); }
                    const exSel = document.getElementById('progressExSelect');
                    if (exSel) { exSel.value = exerciseName; drawProgressChart(); }
                    return;
                }
            }
        }, 100);
    }

    // updateDashboard is defined above and already calls buildActivityCalendar + buildRecentActivityList


    // ─── INIT ─────────────────────────────────────────────────────────────────
    window.onload = function () {
        addExerciseRowWithSelect();
        updateDashboard();
    };