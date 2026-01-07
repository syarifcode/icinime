const API_BASE = "https://api.sansekai.my.id/api"; 

const app = {
    // --- UTILS ---
    getQuery: (name) => new URLSearchParams(window.location.search).get(name),

    fetchData: async (endpoint) => {
        try {
            const res = await fetch(`${API_BASE}${endpoint}`);
            return await res.json();
        } catch (err) {
            console.error("API Error:", err);
            return null;
        }
    },

    // --- RENDERING KARTU (Grid Aesthetic) ---
    renderCards: (data, containerId) => {
        const container = document.getElementById(containerId);
        container.innerHTML = "";
        
        if (!data || data.length === 0) {
            container.innerHTML = "<p style='grid-column: 1/-1; text-align:center;'>Data tidak ditemukan.</p>";
            return;
        }

        data.forEach(anime => {
            // Bersihkan slug
            let slug = anime.url ? anime.url.replace(/\/$/, "") : "";
            // Handle struktur beda (Search vs Latest)
            let title = anime.judul || anime.title;
            let cover = anime.cover || anime.poster;
            let label = anime.lastup || anime.score || (anime.type ? anime.type : "Anime");
            
            // Format angka episode jika ada
            if(label.includes('Episode')) label = label.replace('Episode', 'Ep');

            const card = `
                <div class="card" onclick="window.location.href='detail.html?id=${slug}'">
                    <img src="${cover}" alt="${title}" loading="lazy">
                    <div class="card-badge">${label}</div>
                    <div class="card-overlay">
                        <div class="card-title">${title}</div>
                    </div>
                </div>
            `;
            container.innerHTML += card;
        });
    },

    // --- HOME (Pagination) ---
    initHome: async () => {
        const page = parseInt(app.getQuery('page')) || 1;
        document.getElementById('currPage').innerText = page;
        
        const container = document.getElementById('animeList');
        container.innerHTML = '<div class="loading">Memuat Anime...</div>';

        const data = await app.fetchData(`/anime/latest?page=${page}`);
        app.renderCards(data, 'animeList');

        // Setup Buttons
        document.getElementById('prevBtn').onclick = () => {
            if(page > 1) window.location.href = `index.html?page=${page - 1}`;
        };
        document.getElementById('nextBtn').onclick = () => {
            window.location.href = `index.html?page=${page + 1}`;
        };
    },

    // --- MOVIES ---
    initMovies: async () => {
        const container = document.getElementById('movieList');
        container.innerHTML = '<div class="loading">Memuat Movies...</div>';
        const data = await app.fetchData('/anime/movie');
        app.renderCards(data, 'movieList');
    },

    // --- SEARCH ---
    initSearch: async () => {
        const query = app.getQuery('q');
        const container = document.getElementById('searchList');
        document.getElementById('searchKeyword').innerText = query;
        
        if(!query) return;
        
        container.innerHTML = '<div class="loading">Mencari...</div>';
        const json = await app.fetchData(`/anime/search?query=${query}`);
        
        if (json && json.data && json.data[0] && json.data[0].result) {
            app.renderCards(json.data[0].result, 'searchList');
        } else {
            container.innerHTML = "<p style='text-align:center; margin-top:20px;'>Tidak ditemukan.</p>";
        }
    },

    // --- DETAIL ---
    initDetail: async () => {
        const id = app.getQuery('id');
        if(!id) return;

        const dataRes = await app.fetchData(`/anime/detail?urlId=${id}`);
        if (!dataRes || !dataRes.data || dataRes.data.length === 0) return;
        
        const anime = dataRes.data[0];

        // Render Info
        document.getElementById('bannerImg').src = anime.cover;
        document.getElementById('posterImg').src = anime.cover;
        document.getElementById('animeTitle').innerText = anime.judul;
        document.getElementById('animeMeta').innerText = `${anime.status} • ${anime.rating} • ${anime.published}`;
        document.getElementById('animeSynops').innerText = anime.sinopsis;

        // Render Episode
        const epContainer = document.getElementById('episodeGrid');
        if(anime.chapter && anime.chapter.length > 0) {
            anime.chapter.forEach(ep => {
                // Pass title & cover to watch page for History
                const encodedTitle = encodeURIComponent(anime.judul);
                const encodedCover = encodeURIComponent(anime.cover);
                
                const btn = `
                    <a href="watch.html?id=${ep.url}&ch=${ep.ch}&title=${encodedTitle}&cover=${encodedCover}" class="ep-item">
                        Ep ${ep.ch}
                    </a>`;
                epContainer.innerHTML += btn;
            });
        }
    },

    // --- WATCH (Player & History) ---
    initWatch: async () => {
        const id = app.getQuery('id');
        const ch = app.getQuery('ch');
        const title = decodeURIComponent(app.getQuery('title') || "Anime");
        const cover = decodeURIComponent(app.getQuery('cover') || "");

        if(!id) return;

        // Set Info
        document.getElementById('playingTitle').innerText = title;
        document.getElementById('playingEp').innerText = `Episode ${ch}`;

        // Save History (Local Storage)
        app.saveHistory({ id, ch, title, cover, date: new Date().toLocaleDateString() });

        // Fetch Video
        const container = document.getElementById('videoFrame');
        container.innerHTML = '<div class="loading">Mengambil Stream...</div>';
        
        // Default call (biasanya 720p dulu)
        const json = await app.fetchData(`/anime/getvideo?chapterUrlId=${id}&reso=720p`);

        if(json && json.data && json.data[0] && json.data[0].stream) {
            const streams = json.data[0].stream;
            app.renderPlayer(streams);
        } else {
            container.innerHTML = '<p class="loading">Video tidak tersedia :(</p>';
        }
    },

    renderPlayer: (streams) => {
        const container = document.getElementById('videoFrame');
        const btnContainer = document.getElementById('resoButtons');
        btnContainer.innerHTML = "";

        // Fungsi ganti source
        window.changeSource = (link, reso) => {
            const isMp4 = link.includes('.mp4');
            if(isMp4) {
                container.innerHTML = `<video controls autoplay width="100%" height="100%" src="${link}"></video>`;
            } else {
                container.innerHTML = `<iframe src="${link}" allowfullscreen></iframe>`;
            }
            
            // Update tombol active
            document.querySelectorAll('.reso-btn').forEach(b => b.classList.remove('active'));
            const activeBtn = document.getElementById(`btn-${reso}`);
            if(activeBtn) activeBtn.classList.add('active');
        };

        // Buat Tombol Resolusi
        streams.forEach((s, index) => {
            const btn = document.createElement('button');
            btn.className = 'reso-btn';
            btn.id = `btn-${s.reso}`;
            btn.innerText = s.reso;
            btn.onclick = () => window.changeSource(s.link, s.reso);
            btnContainer.appendChild(btn);

            // Auto play resolusi pertama (atau 720p jika ada)
            if(index === 0) window.changeSource(s.link, s.reso);
        });
    },

    // --- HISTORY SYSTEM ---
    saveHistory: (item) => {
        let history = JSON.parse(localStorage.getItem('icinime_history')) || [];
        // Hapus duplikat (supaya episode terbaru naik ke atas)
        history = history.filter(h => h.id !== item.id);
        history.unshift(item); // Tambah ke awal
        localStorage.setItem('icinime_history', JSON.stringify(history));
    },

    initHistory: () => {
        const container = document.getElementById('historyList');
        const history = JSON.parse(localStorage.getItem('icinime_history')) || [];

        if(history.length === 0) {
            container.innerHTML = '<p style="text-align:center; margin-top:20px; color:#666;">Belum ada riwayat nonton.</p>';
            return;
        }

        history.forEach(item => {
            // Encode ulang untuk link
            const t = encodeURIComponent(item.title);
            const c = encodeURIComponent(item.cover);
            
            const html = `
                <a href="watch.html?id=${item.id}&ch=${item.ch}&title=${t}&cover=${c}" class="history-item">
                    <img src="${item.cover}" alt="poster">
                    <div class="history-info">
                        <div>${item.title}</div>
                        <span>Episode ${item.ch}</span> <br>
                        <span style="font-size:10px; color:#555;">${item.date}</span>
                    </div>
                </a>
            `;
            container.innerHTML += html;
        });
    }
};

// Search Toggle
const searchBtn = document.querySelector('.search-btn');
const searchOverlay = document.querySelector('.search-overlay');
const searchInput = document.querySelector('.search-input');

if(searchBtn) {
    searchBtn.onclick = () => {
        if(searchOverlay.style.display === 'block') {
            searchOverlay.style.display = 'none';
        } else {
            searchOverlay.style.display = 'block';
            searchInput.focus();
        }
    };
}

if(searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') window.location.href = `index.html?q=${e.target.value}&search=true`;
    });
}

// Global Search Check on Index
if(window.location.search.includes('search=true')) {
    const q = new URLSearchParams(window.location.search).get('q');
    // Jika ada parameter q di index, kita ubah tampilan jadi search result
    if(q && document.getElementById('sectionTitle')) {
        document.getElementById('sectionTitle').innerText = `Hasil Cari: ${q}`;
        document.getElementById('animeList').id = 'searchList'; // Hack swap ID
        app.initSearch();
    }
}
