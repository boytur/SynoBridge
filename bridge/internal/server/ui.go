package server

func GetDashboardHTML() string {
	return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SynoBridge Desktop Setup</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <script>
        // Suppress Tailwind production warning
        window.tailwind = { config: { } };
    </script>
    <style>
        body { font-family: 'Inter', sans-serif; background: #0f172a; color: #f1f5f9; }
        .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); }
    </style>
</head>
<body class="flex items-center justify-center min-h-screen p-4">
    <div class="glass max-w-lg w-full rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-500">
        <div class="flex items-center gap-4 mb-8">
            <div class="p-3 rounded-2xl bg-blue-600/20 text-blue-400">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12l4-4m-4 4l4 4"></path></svg>
            </div>
            <div>
                <h1 class="text-2xl font-bold">SynoBridge Setup</h1>
                <p class="text-slate-400 text-sm">Convert any folder into a Network Share</p>
            </div>
        </div>

        <div class="space-y-6">
            <div class="space-y-2">
                <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">Local Folder Path</label>
                <div class="relative">
                    <div class="flex gap-2">
                        <input id="path" type="text" placeholder="e.g. /home/user/Documents" oninput="handlePathInput(this.value)"
                               class="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all">
                        <button onclick="toggleBrowser()" class="bg-slate-800 hover:bg-slate-700 px-4 rounded-xl border border-slate-700 transition-colors">
                            Browse
                        </button>
                    </div>
                    <!-- Auto-complete Dropdown -->
                    <div id="autocomplete" class="hidden absolute left-0 right-0 top-full mt-2 glass rounded-xl max-h-60 overflow-y-auto border-slate-700 z-50 shadow-2xl">
                        <div id="autocomplete-content" class="p-2 space-y-1"></div>
                    </div>
                </div>
                <div id="browser" class="hidden mt-2 glass rounded-xl max-h-48 overflow-y-auto border-slate-700 animate-in slide-in-from-top-2 duration-200">
                    <div id="browser-content" class="p-2 space-y-1"></div>
                </div>
            </div>

            <div class="space-y-2">
                <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">Share Name</label>
                <input id="name" type="text" placeholder="e.g. MySharedVideos" 
                       class="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all">
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                    <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">Username</label>
                    <input id="user" type="text" placeholder="e.g. admin" 
                           class="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all">
                </div>
                <div class="space-y-2">
                    <label class="text-xs font-semibold uppercase tracking-wider text-slate-500">Password</label>
                    <input id="pass" type="password" placeholder="••••••••" 
                           class="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all">
                </div>
            </div>

            <button onclick="setupShare()" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-900/20 transition-all transform active:scale-95">
                Create Secure Share
            </button>
        </div>

        <div id="status" class="mt-6 text-center text-sm font-medium"></div>

        <!-- Log Console -->
        <div id="log-container" class="mt-8 hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Deployment Logs</span>
                <span class="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
            </div>
            <div id="logs" class="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 font-mono text-[11px] text-slate-300 h-40 overflow-y-auto space-y-1 shadow-inner">
                <!-- Live logs will stream here -->
            </div>
        </div>
    </div>

    <script>
        let currentPath = '';

        // Start listening to logs immediately
        const logSource = new EventSource('/api/logs');
        logSource.onmessage = (e) => {
            const logs = document.getElementById('logs');
            const container = document.getElementById('log-container');
            container.classList.remove('hidden');
            
            const div = document.createElement('div');
            div.className = "border-l-2 border-blue-500/30 pl-2 py-0.5 animate-in slide-in-from-left-1 duration-200";
            div.innerHTML = '<span class="text-slate-500 mr-2">[' + new Date().toLocaleTimeString() + ']</span>' + e.data;
            logs.appendChild(div);
            logs.scrollTop = logs.scrollHeight;
        };

        let autocompleteTimeout;
        async function handlePathInput(val) {
            clearTimeout(autocompleteTimeout);
            const dropdown = document.getElementById('autocomplete');
            if (!val || val.length < 2) {
                dropdown.classList.add('hidden');
                return;
            }
            autocompleteTimeout = setTimeout(async () => {
                const parts = val.split(/[/\\]/);
                const lastPart = parts.pop();
                const parentPath = parts.join('/') || (val.startsWith('/') ? '/' : 'C:\\');
                try {
                    const res = await fetch('/api/browse?path=' + encodeURIComponent(parentPath));
                    if (!res.ok) throw new Error();
                    const dirs = await res.json();
                    const filtered = dirs.filter(d => d.name.toLowerCase().startsWith(lastPart.toLowerCase()));
                    if (filtered.length > 0) {
                        renderAutocomplete(filtered, parentPath);
                        dropdown.classList.remove('hidden');
                    } else {
                        dropdown.classList.add('hidden');
                    }
                } catch (e) {
                    dropdown.classList.add('hidden');
                }
            }, 300);
        }

        function renderAutocomplete(dirs, parent) {
            const content = document.getElementById('autocomplete-content');
            content.innerHTML = '';
            dirs.forEach(d => {
                const div = document.createElement('div');
                div.className = "flex items-center gap-2 p-2 hover:bg-blue-600/20 rounded-lg cursor-pointer text-sm transition-colors";
                div.innerHTML = '<svg class="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path></svg>' + d.name;
                div.onclick = () => {
                    document.getElementById('path').value = d.path;
                    document.getElementById('autocomplete').classList.add('hidden');
                };
                content.appendChild(div);
            });
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.relative')) {
                document.getElementById('autocomplete').classList.add('hidden');
            }
        });

        async function toggleBrowser() {
            const browser = document.getElementById('browser');
            browser.classList.toggle('hidden');
            if (!browser.classList.contains('hidden')) {
                loadFolders(document.getElementById('path').value || '');
            }
        }

        async function loadFolders(path) {
            const content = document.getElementById('browser-content');
            content.innerHTML = '<div class="text-xs text-slate-500 p-2 italic">Loading...</div>';
            
            try {
                const res = await fetch('/api/browse?path=' + encodeURIComponent(path));
                if (!res.ok) throw new Error("Access Denied");
                const dirs = await res.json();
                
                content.innerHTML = '';
                
                // Add parent link
                if (path && path !== '/' && path !== 'C:\\') {
                    const parent = path.split(/[/\\]/).slice(0, -1).join('/') || '/';
                    addEntry(".. (Back)", parent, true);
                }

                dirs.forEach(d => addEntry(d.name, d.path));
                
                if (dirs.length === 0) {
                    content.innerHTML = '<div class="text-xs text-slate-500 p-2 italic">No folders found</div>';
                }
            } catch (e) {
                content.innerHTML = '<div class="text-xs text-red-500 p-2">Error: ' + e.message + '</div>';
            }
        }

        function addEntry(name, path, isParent = false) {
            const div = document.createElement('div');
            div.className = "flex items-center justify-between p-2 hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors text-sm group";
            div.innerHTML = 
                '<div class="flex items-center gap-2 overflow-hidden">' +
                    '<svg class="w-4 h-4 text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path></svg>' +
                    '<span class="truncate">' + name + '</span>' +
                '</div>' +
                '<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">' +
                    '<button onclick="event.stopPropagation(); selectPath(\'' + path.replace(/\\/g, '\\\\') + '\')" class="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-[10px] font-bold rounded hover:bg-blue-600 hover:text-white">SELECT</button>' +
                '</div>';
            div.onclick = () => loadFolders(path);
            document.getElementById('browser-content').appendChild(div);
        }

        function selectPath(path) {
            document.getElementById('path').value = path;
            document.getElementById('browser').classList.add('hidden');
        }

        async function setupShare() {
            const path = document.getElementById('path').value;
            const name = document.getElementById('name').value;
            const user = document.getElementById('user').value;
            const pass = document.getElementById('pass').value;
            const status = document.getElementById('status');

            if(!path || !name || !user || !pass) {
                status.innerText = "❌ Please fill in all fields";
                status.className = "mt-6 text-center text-sm font-medium text-red-400";
                return;
            }

            status.innerText = "⏳ Configuring secure share...";
            status.className = "mt-6 text-center text-sm font-medium text-blue-400";

            try {
                const res = await fetch('/api/share', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path, name, user, pass })
                });
                const data = await res.json();
                if(data.success) {
                    const connectUrl = 'http://localhost:5173/connect?bridge=' + encodeURIComponent('http://localhost:8888');

                    status.innerHTML = 
                        '<div class="space-y-4">' +
                            '<div class="text-green-400 font-bold text-lg">✅ Share Created Successfully!</div>' +
                            '<a href="' + connectUrl + '" class="inline-block bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-green-900/20">' +
                                '🚀 Open & Connect in SynoBridge' +
                            '</a>' +
                        '</div>';
                    status.className = "mt-6 text-center";
                } else {
                    status.innerText = "❌ Error: " + data.error;
                    status.className = "mt-6 text-center text-sm font-medium text-red-400";
                }
            } catch (e) {
                status.innerText = "❌ Failed to connect to agent";
                status.className = "mt-6 text-center text-sm font-medium text-red-400";
            }
        }

        // Polling for Handshake Success
        setInterval(async () => {
            try {
                const res = await fetch('/api/success');
                const data = await res.json();
                if (data.success) {
                    const container = document.querySelector('.glass');
                    container.innerHTML = 
                        '<div class="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-12 rounded-3xl text-center space-y-6 animate-in zoom-in duration-500 shadow-2xl shadow-green-500/10">' +
                            '<div class="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border-4 border-green-500/50">' +
                                '<svg class="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
                                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>' +
                                '</svg>' +
                            '</div>' +
                            '<h1 class="text-4xl font-black text-white tracking-tight">Bridge Active!</h1>' +
                            '<p class="text-slate-400 text-lg">Your folder is now securely linked to SynoBridge.</p>' +
                            '<div class="pt-6">' +
                                '<div class="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 rounded-full border border-green-500/20 font-medium">' +
                                    '<span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>' +
                                    'Linked & Streaming' +
                                '</div>' +
                            '</div>' +
                        '</div>';
                }
            } catch (e) {}
        }, 1000);
    </script>
</body>
</html>
`
}
