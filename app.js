// --- CONFIGURATION ---
// Replace these with your actual IDs from Google and EmailJS
const CLIENT_ID = '242836404042-q24h5h9hr3p580dbve5hgcpu7eminmcu.apps.googleusercontent.com';
const EMAILJS_PUBLIC_KEY = 'bOGD3izt9TkU0Z4NU'; 
const EMAILJS_SERVICE_ID = 'service_6ixkxxx';
const EMAILJS_TEMPLATE_ID = 'template_9zj0jsp';

let birthdays = JSON.parse(localStorage.getItem('birthdays')) || [];
let tokenClient;
let accessToken = localStorage.getItem('google_access_token');

// --- INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('today-date').innerText = new Date().toDateString();
    emailjs.init(EMAILJS_PUBLIC_KEY);
    
    // Setup Google Auth Client
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        callback: (tokenResponse) => {
            if (tokenResponse.access_token) {
                accessToken = tokenResponse.access_token;
                localStorage.setItem('google_access_token', accessToken);
                updateStatus(true);
                syncExistingToGoogle();
            }
        },
    });

    if (accessToken) updateStatus(true);
    renderBirthdays();
});

function updateStatus(isConnected) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    dot.className = isConnected ? 'dot-green' : 'dot-red';
    text.innerText = isConnected ? 'Google Calendar: Linked' : 'Google Calendar: Disconnected';
}

// --- CORE LOGIC ---
async function addBirthday() {
    const name = document.getElementById('nameInput').value.trim();
    const date = document.getElementById('dateInput').value;
    if (!name || !date) return alert("Please enter a name and date!");

    let newBday = { 
        id: Date.now().toString(), 
        name, 
        date, 
        calendarEventId: null 
    };

    // If user is logged into Google, create the 6 AM event immediately
    if (accessToken) {
        const eventId = await createGoogleEvent(newBday);
        newBday.calendarEventId = eventId;
    }

    birthdays.push(newBday);
    saveAndRender();
    
    document.getElementById('nameInput').value = '';
    document.getElementById('dateInput').value = '';
}

function calculateDays(dateStr) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const parts = dateStr.split('-');
    let next = new Date(today.getFullYear(), parts[1]-1, parts[2]);
    if (next < today) next.setFullYear(today.getFullYear() + 1);
    return Math.ceil((next - today) / (1000 * 60 * 60 * 24)) % 365;
}

function renderBirthdays() {
    const list = document.getElementById('birthdayList');
    list.innerHTML = '';
    const today = new Date();

    // Sort: Soonest birthdays first
    birthdays.sort((a,b) => calculateDays(a.date) - calculateDays(b.date));

    birthdays.forEach(b => {
        const daysLeft = calculateDays(b.date);
        const bParts = b.date.split('-');
        const isToday = (today.getMonth() + 1 == bParts[1] && today.getDate() == bParts[2]);

        const li = document.createElement('li');
        if (isToday) {
            li.classList.add('is-today');
            triggerEmail(b.name);
        }

        li.innerHTML = `
            <div>
                <strong>${b.name}</strong> 
                <span class="days-badge">${daysLeft === 0 ? 'Today! 🎂' : daysLeft + ' days left'}</span>
                <br><small>${b.date}</small>
            </div>
            <button onclick="deleteBirthday('${b.id}')" style="background:none; cursor:pointer;">❌</button>
        `;
        list.appendChild(li);
    });
}

// --- GOOGLE CALENDAR ACTIONS ---
async function createGoogleEvent(b) {
    const event = {
        'summary': `${b.name}'s Birthday 🎂`,
        'start': { 'date': b.date },
        'end': { 'date': b.date },
        'recurrence': ['RRULE:FREQ=YEARLY'],
        'reminders': {
            'useDefault': false,
            'overrides': [
                // -360 minutes triggers exactly at 6:00 AM on the day of the event
                { 'method': 'popup', 'minutes': -360 } 
            ]
        }
    };

    try {
        const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
        const data = await res.json();
        return data.id;
    } catch (e) { return null; }
}

async function deleteBirthday(id) {
    const b = birthdays.find(item => item.id === id);
    if (accessToken && b.calendarEventId) {
        // Remove from Google Calendar too
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${b.calendarEventId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
    }
    birthdays = birthdays.filter(item => item.id !== id);
    saveAndRender();
}

function handleSync() {
    tokenClient.requestAccessToken({prompt: accessToken ? '' : 'select_account'});
}

function saveAndRender() {
    localStorage.setItem('birthdays', JSON.stringify(birthdays));
    renderBirthdays();
}

function triggerEmail(name) {
    const key = `sent_${name}_${new Date().toDateString()}`;
    if (localStorage.getItem(key)) return;

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        name: name,
        message: `It is ${name}'s birthday! A 6 AM alarm has been set on your linked Google Calendar.`
    }).then(() => localStorage.setItem(key, "true"));
}

function testEmail() {
    triggerEmail("Test User");
    alert("Test sent! Check your inbox.");
}
