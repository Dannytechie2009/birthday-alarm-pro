// --- CONFIGURATION ---
const CLIENT_ID = '242836404042-q24h5h9hr3p580dbve5hgcpu7eminmcu.apps.googleusercontent.com';
let accessToken = localStorage.getItem('google_access_token');
let tokenClient;

// --- INITIALIZE APP ---
document.addEventListener('DOMContentLoaded', () => {
    // Show current date
    document.getElementById('today-date').innerText = new Date().toDateString();

    // Initialize Google Identity Services (GIS)
    // This is the modern way to handle Google Auth
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        callback: (tokenResponse) => {
            if (tokenResponse.access_token) {
                accessToken = tokenResponse.access_token;
                localStorage.setItem('google_access_token', accessToken);
                updateStatusUI(true);
                console.log("Google Account Linked Successfully");
            }
        },
    });

    // Auto-detect if we already have a token
    if (accessToken) {
        updateStatusUI(true);
    }
    renderList();
});

// --- GOOGLE AUTH HANDLER ---
function handleAuth() {
    // Request access token with 'select_account' to allow user to switch if needed
    // This also helps bypass the "Testing" expiration issues
    tokenClient.requestAccessToken({ prompt: 'select_account' });
}

// --- CORE FUNCTION: ADD & SET ALARM ---
async function addAndForget() {
    const nameInput = document.getElementById('nameInput');
    const dateInput = document.getElementById('dateInput');
    const name = nameInput.value.trim();
    const date = dateInput.value;

    if (!accessToken) {
        alert("Action Required: Please click 'Link Google Account' first.");
        return;
    }

    if (!name || !date) {
        alert("Please provide both a name and a date.");
        return;
    }

    // Define the Google Calendar Event
    const event = {
        'summary': `${name}'s Birthday 🎂`,
        'description': 'Automatic reminder set by Birthday Tracker Pro',
        'start': { 'date': date }, // All-day event
        'end': { 'date': date },
        'recurrence': ['RRULE:FREQ=YEARLY'], // Make it repeat every year
        'reminders': {
            'useDefault': false,
            'overrides': [
                // In Google Calendar API for All-Day events:
                // -360 minutes from the start of the day (00:00) = 06:00 AM on that day.
                { 'method': 'popup', 'minutes': -360 } 
            ]
        }
    };

    try {
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
        });

        if (response.status === 401) {
            // Token has expired or been revoked
            accessToken = null;
            localStorage.removeItem('google_access_token');
            updateStatusUI(false);
            alert("Session expired. Please click 'Link Google Account' again to reconnect.");
        } else if (response.ok) {
            saveToLocal(name, date);
            alert(`Set! A 6 AM alarm for ${name} has been added to your phone's calendar.`);
            renderList();
            nameInput.value = '';
            dateInput.value = '';
        } else {
            const errorData = await response.json();
            console.error("Google API Error:", errorData);
            alert("Could not set alarm. Make sure your Google Console is set to 'Production' mode.");
        }
    } catch (err) {
        console.error("Network Error:", err);
        alert("Connection failed. Check your internet.");
    }
}

// --- UI & STORAGE HELPERS ---
function updateStatusUI(isLinked) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const btn = document.getElementById('linkBtn');

    if (isLinked) {
        dot.className = 'dot-green';
        text.innerText = 'Linked to Phone';
        btn.innerText = '🔄 Switch Google Account';
    } else {
        dot.className = 'dot-red';
        text.innerText = 'Not Linked to Phone';
        btn.innerText = '🔗 Link Google Account';
    }
}

function saveToLocal(name, date) {
    let bdays = JSON.parse(localStorage.getItem('saved_bdays')) || [];
    bdays.push({ name, date, id: Date.now() });
    localStorage.setItem('saved_bdays', JSON.stringify(bdays));
}

function renderList() {
    const list = JSON.parse(localStorage.getItem('saved_bdays')) || [];
    const ul = document.getElementById('bdayList');
    
    if (list.length === 0) {
        ul.innerHTML = '<li style="border:none; color:gray;">No alarms set yet.</li>';
        return;
    }

    ul.innerHTML = list.map(b => `
        <li>
            <div>
                <strong>${b.name}</strong><br>
                <small>6 AM Alarm: ${b.date}</small>
            </div>
        </li>
    `).join('');
}