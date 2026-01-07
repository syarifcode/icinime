const API_BASE = "https://api.sansekai.my.id/api"; 

const app = {
    state: {
        page: 1,
        sliderData: [] // Store data for slider
    },

    init: () => {
        app.handleRouting();
        window.addEventListener('popstate', app.handleRouting);
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                app.navigate('search', { q: e.target.value });
                app.toggleSearch();
            }
        });
    },

    navigate: (view, params = {}) => {
        const url = new URL(window.location);
        url.searchParams.set('page', view);
        Object.keys(params).forEach(key => url.searchParams.set(key, params[key]));
        
        // Cleanup params
        if(view !== 'detail' && view !== 'watch') url.searchParams.delete('id');
        if(view !== 'watch') { 
            url.searchParams.delete('ch'); 
            url.searchParams.delete('title'); 
            url.searchParams.delete('cover'); 
        }

        window.history.pushState({}, '', url);
        app.handleRouting();
    },

    handleRouting: () => {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('page') || 'home';
        
        // --- BUG FIX 2: Stop Video playing in background ---
        // Jika pindah dari halaman 'watch', hapus isi iframe/video
        if (view !== 'watch') {
            document.getElementById('videoFrame').innerHTML = '';
        }

        document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

        const targetView = document.getElementById(`view-${view}`);
        if(targetView) targetView.classList.add('active');

        if(['home','movie','history'].includes(view)) {
            document.getElementById(`nav-${view}`).classList.add('active');
        }

        if (view === 'home') app.loadHome();
        else if (view === 'movie') app.loadMovies();
        else if (view === 'history') app.loadHistory();
        else if (view === 'search') app.loadSearch(params.get('q'));
        else if (view === 'detail') app.loadDetail(params.get('id'));
        else if (view === 'watch') app.loadWatch(params);
        
        window.scrollTo(0, 0);
    },

    fetchData: async (endpoint) => {
        try {
            const res = await fetch(`${API_BASE}${endpoint}`);
            return await res.json();
        } catch (err) {
            console.error(err);
            return null;
        }
    },

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

    // --- FEATURE 1: SLIDER ---
    renderSlider: (data) => {
        const slider = document.getElementById('heroSlider');
        // Hanya render slider jika kosong (biar gak double saat navigasi balik)
        if(slider.childElementCount > 0) return;

        // Ambil 5 data pertama untuk slider
        const sliderItems = data.slice(0, 5); 
        
        sliderItems.forEach(item => {
            let slug = item.url ? item.url.replace(/\/$/, "") : "";
            const slide = document.createElement('div');
            slide.className = 'slide-item';
            slide.onclick = () => app.navigate('detail', { id: slug });
            slide.innerHTML = `
                <img src="${item.cover}" alt="${item.judul}">
                <div class="slide-caption">
                    <div class="slide-title">${item.judul}</div>
                </div>
            `;
            slider.appendChild(slide);
        });
    },

    loadHome: async () => {
        const container = document.getElementById('homeList');
        if(container.childElementCount > 0 && app.state.page === parseInt(document.getElementById('currPage').innerText)) return; 

        container.innerHTML = '<div class="loading">Memuat Anime...</div>';
        const data = await app.fetchData(`/anime/latest?page=${app.state.page}`);
        
        // Init slider hanya dengan data halaman 1
        if(app.state.page === 1 && data) {
            app.renderSlider(data);
        }

        app.renderCards(data, 'homeList');
        document.getElementById('currPage').innerText = app.state.page;
    },

    loadMovies: async () => {
        const container = document.getElementById('movieList');
        if(container.childElementCount > 0) return; 
        container.innerHTML = '<div class="loading">Memuat Movies...</div>';
        const data = await app.fetchData('/anime/movie');
        app.renderCards(data, 'movieList');
    },

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
                    <div style="font-size:12px; font-weight:bold; color:white;">${item.title}</div>
                    <span style="font-size:11px; color:var(--primary);">Episode ${item.ch}</span> <br>
                    <span style="font-size:10px; color:#555;">${item.date}</span>
                </div>
            `;
            container.appendChild(div);
        });
    },

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

    loadDetail: async (id) => {
        if(!id) return;
        
        // --- BUG FIX 3: Reset Gambar Loading ---
        // Sebelum fetch, kosongkan dulu src gambar agar tidak menampilkan anime sebelumnya
        document.getElementById('detailBanner').src = "";
        document.getElementById('detailPoster').src = "";
        document.getElementById('detailTitle').innerText = "Loading...";
        document.getElementById('episodeGrid').innerHTML = "";
        
        const dataRes = await app.fetchData(`/anime/detail?urlId=${id}`);
        if (!dataRes || !dataRes.data || dataRes.data.length === 0) return;
        
        const anime = dataRes.data[0];
        // Set data baru
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

    loadWatch: async (params) => {
        const { id, ch, title, cover } = Object.fromEntries(params);
        if(!id) return;

        document.getElementById('watchTitle').innerText = title || "Anime";
        document.getElementById('watchEp').innerText = `Episode ${ch}`;
        
        if(title && cover) {
            app.saveHistory({ id, ch, title, cover, date: new Date().toLocaleDateString() });
        }

        const container = document.getElementById('videoFrame');
        const btnContainer = document.getElementById('resoButtons');
        
        container.innerHTML = '<div class="loading">Memuat Stream...</div>';
        btnContainer.innerHTML = "";

        // Fetch default reso
        const json = await app.fetchData(`/anime/getvideo?chapterUrlId=${id}&reso=720p`);
        
        if(json && json.data && json.data[0] && json.data[0].stream) {
            const streams = json.data[0].stream;
            
            // --- BUG FIX 1: Tampilkan SEMUA Resolusi ---
            streams.forEach((s, idx) => {
                const btn = document.createElement('button');
                btn.className = 'reso-btn';
                // Tampilkan label resolusi (misal: 360p, 480p, 720p)
                btn.innerText = s.reso; 
                
                btn.onclick = () => {
                    document.querySelectorAll('.reso-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    if(s.link.includes('.mp4')) {
                        container.innerHTML = `<video controls autoplay width="100%" height="100%" src="${s.link}"></video>`;
                    } else {
                        container.innerHTML = `<iframe src="${s.link}" allowfullscreen></iframe>`;
                    }
                };
                btnContainer.appendChild(btn);
                
                // Auto play tombol pertama (biasanya kualitas paling tinggi atau urutan API)
                if(idx === 0) btn.click();
            });
        } else {
            container.innerHTML = '<p class="loading">Video Error :(</p>';
        }
    },

    changePage: (dir) => {
        const newPage = app.state.page + dir;
        if(newPage > 0) {
            app.state.page = newPage;
            // Clear slider saat ganti page agar refresh (opsional, disini saya biarkan slider tetap ada)
            // document.getElementById('heroSlider').innerHTML = ""; 
            app.loadHome();
        }
    },

    toggleSearch: () => {
        const el = document.getElementById('searchOverlay');
        const isVisible = el.style.display === 'block';
        el.style.display = isVisible ? 'none' : 'block';
        if(!isVisible) document.getElementById('searchInput').focus();
    },

    // --- FEATURE 2: INFO MODAL ---
    toggleInfo: () => {
        const el = document.getElementById('infoModal');
        el.style.display = (el.style.display === 'flex') ? 'none' : 'flex';
    },

    saveHistory: (item) => {
        let history = JSON.parse(localStorage.getItem('icinime_history')) || [];
        history = history.filter(h => h.id !== item.id);
        history.unshift(item);
        localStorage.setItem('icinime_history', JSON.stringify(history));
    }
};

document.addEventListener('DOMContentLoaded', app.init);
