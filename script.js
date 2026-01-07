const API_BASE = "https://api.sansekai.my.id/api"; 

const app = {
    state: {
        page: 1, // Halaman Home pagination
        searchQuery: ""
    },

    // --- ROUTER SYSTEM ---
    init: () => {
        // Cek URL saat pertama kali load
        app.handleRouting();
        
        // Listener tombol back browser
        window.addEventListener('popstate', app.handleRouting);

        // Listener Search Enter
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                app.navigate('search', { q: e.target.value });
                app.toggleSearch(); // tutup overlay
            }
        });
    },

    // Fungsi ganti halaman (Push State)
    navigate: (view, params = {}) => {
        const url = new URL(window.location);
        url.searchParams.set('page', view);
        
        // Set parameter tambahan (id, q, dll)
        Object.keys(params).forEach(key => url.searchParams.set(key, params[key]));
        
        // Bersihkan parameter yang tidak perlu
        if(view !== 'detail' && view !== 'watch') url.searchParams.delete('id');
        if(view !== 'watch') { 
            url.searchParams.delete('ch'); 
            url.searchParams.delete('title'); 
            url.searchParams.delete('cover'); 
        }

        window.history.pushState({}, '', url);
        app.handleRouting();
    },

    // Logic Router (Menentukan view mana yang aktif)
    handleRouting: () => {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('page') || 'home';
        
        // Sembunyikan semua section
        document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
        // Reset nav active
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

        // Aktifkan view target
        const targetView = document.getElementById(`view-${view}`);
        if(targetView) targetView.classList.add('active');

        // Navigasi Bawah Active State
        if(['home','movie','history'].includes(view)) {
            document.getElementById(`nav-${view}`).classList.add('active');
        }

        // Jalankan logika per halaman
        if (view === 'home') app.loadHome();
        else if (view === 'movie') app.loadMovies();
        else if (view === 'history') app.loadHistory();
        else if (view === 'search') app.loadSearch(params.get('q'));
        else if (view === 'detail') app.loadDetail(params.get('id'));
        else if (view === 'watch') app.loadWatch(params);
        
        // Scroll ke atas setiap ganti halaman
        window.scrollTo(0, 0);
    },

    // --- DATA FETCHING ---
    fetchData: async (endpoint) => {
        try {
            const res = await fetch(`${API_BASE}${endpoint}`);
            return await res.json();
        } catch (err) {
            console.error(err);
            return null;
        }
    },

    // --- RENDER CARD HELPER ---
    renderCards: (data, containerId) => {
        const container = document.getElementById(containerId);
        container.innerHTML = "";
        
        if (!data || data.length === 0) {
            container.innerHTML = "<p style='grid-column: 1/-1; text-align:center;'>Data tidak ditemukan.</p>";
            return;
        }

        data.forEach(anime => {
            let slug = anime.url ? anime.url.replace(/\/$/, "") : "";
            let title = anime.judul || anime.title;
            let cover = anime.cover || anime.poster;
            let label = anime.lastup || anime.score || "Anime";
            if(label.includes('Episode')) label = label.replace('Episode', 'Ep');

            // PENTING: onclick memanggil app.navigate
            const card = document.createElement('div');
            card.className = 'card';
            card.onclick = () => app.navigate('detail', { id: slug });
            card.innerHTML = `
                <img src="${cover}" alt="${title}" loading="lazy">
                <div class="card-badge">${label}</div>
                <div class="card-overlay"><div class="card-title">${title}</div></div>
            `;
            container.appendChild(card);
        });
    },

    // --- PAGE LOGICS ---
    
    // 1. HOME
    loadHome: async () => {
        const container = document.getElementById('homeList');
        if(container.childElementCount > 0 && app.state.page === parseInt(document.getElementById('currPage').innerText)) return; // Cache sederhana

        container.innerHTML = '<div class="loading">Memuat Anime...</div>';
        const data = await app.fetchData(`/anime/latest?page=${app.state.page}`);
        app.renderCards(data, 'homeList');
        document.getElementById('currPage').innerText = app.state.page;
    },

    changePage: (dir) => {
        const newPage = app.state.page + dir;
        if(newPage > 0) {
            app.state.page = newPage;
            app.loadHome();
        }
    },

    // 2. MOVIES
    loadMovies: async () => {
        const container = document.getElementById('movieList');
        if(container.childElementCount > 0) return; 

        container.innerHTML = '<div class="loading">Memuat Movies...</div>';
        const data = await app.fetchData('/anime/movie');
        app.renderCards(data, 'movieList');
    },

    // 3. HISTORY
    loadHistory: () => {
        const container = document.getElementById('historyList');
        const history = JSON.parse(localStorage.getItem('icinime_history')) || [];
        container.innerHTML = "";

        if(history.length === 0) {
            container.innerHTML = '<p style="text-align:center; margin-top:20px; color:#666;">Belum ada riwayat.</p>';
            return;
        }

        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.onclick = () => app.navigate('watch', { 
                id: item.id, ch: item.ch, title: item.title, cover: item.cover 
            });
            div.innerHTML = `
                <img src="${item.cover}" alt="poster">
                <div class="history-info">
                    <div>${item.title}</div>
                    <span>Episode ${item.ch}</span> <br>
                    <span style="font-size:10px; color:#555;">${item.date}</span>
                </div>
            `;
            container.appendChild(div);
        });
    },

    // 4. SEARCH
    loadSearch: async (query) => {
        if(!query) return;
        document.getElementById('searchTitle').innerText = `Hasil Cari: "${query}"`;
        const container = document.getElementById('searchList');
        container.innerHTML = '<div class="loading">Mencari...</div>';
        
        const json = await app.fetchData(`/anime/search?query=${query}`);
        if (json && json.data && json.data[0] && json.data[0].result) {
            app.renderCards(json.data[0].result, 'searchList');
        } else {
            container.innerHTML = "<p style='text-align:center;'>Tidak ditemukan.</p>";
        }
    },

    // 5. DETAIL
    loadDetail: async (id) => {
        if(!id) return;
        
        // Reset UI dulu
        document.getElementById('detailTitle').innerText = "Loading...";
        document.getElementById('episodeGrid').innerHTML = "";
        
        const dataRes = await app.fetchData(`/anime/detail?urlId=${id}`);
        if (!dataRes || !dataRes.data || dataRes.data.length === 0) return;
        
        const anime = dataRes.data[0];
        document.getElementById('detailBanner').src = anime.cover;
        document.getElementById('detailPoster').src = anime.cover;
        document.getElementById('detailTitle').innerText = anime.judul;
        document.getElementById('detailMeta').innerText = `${anime.status} • ${anime.rating}`;
        document.getElementById('detailSynops').innerText = anime.sinopsis;

        const epContainer = document.getElementById('episodeGrid');
        if(anime.chapter && anime.chapter.length > 0) {
            anime.chapter.forEach(ep => {
                const btn = document.createElement('div');
                btn.className = 'ep-item';
                btn.innerText = `Ep ${ep.ch}`;
                btn.onclick = () => app.navigate('watch', {
                    id: ep.url,
                    ch: ep.ch,
                    title: anime.judul,
                    cover: anime.cover
                });
                epContainer.appendChild(btn);
            });
        }
    },

    // 6. WATCH
    loadWatch: async (params) => {
        const { id, ch, title, cover } = Object.fromEntries(params);
        if(!id) return;

        document.getElementById('watchTitle').innerText = title || "Anime";
        document.getElementById('watchEp').innerText = `Episode ${ch}`;
        
        // Simpan History
        if(title && cover) {
            app.saveHistory({ id, ch, title, cover, date: new Date().toLocaleDateString() });
        }

        const container = document.getElementById('videoFrame');
        const btnContainer = document.getElementById('resoButtons');
        container.innerHTML = '<div class="loading">Memuat Stream...</div>';
        btnContainer.innerHTML = "";

        const json = await app.fetchData(`/anime/getvideo?chapterUrlId=${id}&reso=720p`);
        
        if(json && json.data && json.data[0] && json.data[0].stream) {
            const streams = json.data[0].stream;
            
            // Render Buttons
            streams.forEach((s, idx) => {
                const btn = document.createElement('button');
                btn.className = 'reso-btn';
                btn.innerText = s.reso;
                btn.onclick = () => {
                    // Update active class
                    document.querySelectorAll('.reso-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // Ganti Source
                    if(s.link.includes('.mp4')) {
                        container.innerHTML = `<video controls autoplay width="100%" height="100%" src="${s.link}"></video>`;
                    } else {
                        container.innerHTML = `<iframe src="${s.link}" allowfullscreen></iframe>`;
                    }
                };
                btnContainer.appendChild(btn);
                
                // Auto play first source
                if(idx === 0) btn.click();
            });
        } else {
            container.innerHTML = '<p class="loading">Video Error :(</p>';
        }
    },

    toggleSearch: () => {
        const el = document.getElementById('searchOverlay');
        const isVisible = el.style.display === 'block';
        el.style.display = isVisible ? 'none' : 'block';
        if(!isVisible) document.getElementById('searchInput').focus();
    },

    saveHistory: (item) => {
        let history = JSON.parse(localStorage.getItem('icinime_history')) || [];
        history = history.filter(h => h.id !== item.id);
        history.unshift(item);
        localStorage.setItem('icinime_history', JSON.stringify(history));
    }
};

// Jalankan App
document.addEventListener('DOMContentLoaded', app.init);
