const API_BASE = "https://api.sansekai.my.id/api"; 

const app = {
    state: {
        page: 1,
    },

    // --- DATA HARDCODED UNTUK SLIDER FAVORIT ---
    featuredAnime: [
        {
            title: "Kimetsu no Yaiba: Infinity Castle",
            cover: "https://cdn.myanimelist.net/images/anime/1681/148216.jpg",
            id: "kimetsu-no-yaiba-movie-1-mugenjou-hen-akaza-sairai", // ID dari endpoint movie
            type: "detail"
        },
        {
            title: "Kimi no Na wa",
            cover: "https://animekita.org/cover/Kimi-no-Na-wa..jpg",
            id: "kimi-no-na-wa-fix-2-2", // ID dari endpoint movie
            type: "detail"
        },
        {
            title: "Tenki no Ko",
            cover: "https://animekita.org/cover/101146.jpg",
            id: "tenki-no-ko", // ID dari endpoint movie
            type: "detail"
        },
        {
            title: "Boruto: Naruto Next Generations",
            cover: "https://cdn.myanimelist.net/images/anime/9/84460.jpg", // Gambar placeholder
            id: "boruto", 
            type: "search" // Karena tidak punya ID pasti, kita arahkan ke search
        }
    ],

    init: () => {
        app.handleRouting();
        window.addEventListener('popstate', app.handleRouting);
        
        // Setup Search Listener
        const searchInput = document.getElementById('searchInput');
        if(searchInput){
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    app.navigate('search', { q: e.target.value });
                    app.toggleSearch();
                }
            });
        }

        // Setup Info Modal
        window.onclick = (event) => {
            const modal = document.getElementById('infoModal');
            if (event.target == modal) modal.style.display = "none";
        }
    },

    navigate: (view, params = {}) => {
        const url = new URL(window.location);
        url.searchParams.set('page', view);
        
        // Reset params lama
        url.searchParams.delete('id');
        url.searchParams.delete('q');
        url.searchParams.delete('ch');
        url.searchParams.delete('title');
        url.searchParams.delete('cover');

        // Set params baru
        Object.keys(params).forEach(key => url.searchParams.set(key, params[key]));

        window.history.pushState({}, '', url);
        app.handleRouting();
    },

    handleRouting: () => {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('page') || 'home';
        
        // Hapus player jika pindah halaman agar suara mati
        if (view !== 'watch') {
            document.getElementById('videoFrame').innerHTML = '';
        }

        // UI Management
        document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

        const targetView = document.getElementById(`view-${view}`);
        if(targetView) targetView.classList.add('active');

        // Nav Active State
        if(['home','movie','history'].includes(view)) {
            document.getElementById(`nav-${view}`).classList.add('active');
        }

        // Controller
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

    // --- RENDER SLIDER FAVORIT ---
    renderSlider: () => {
        const slider = document.getElementById('heroSlider');
        if(slider.childElementCount > 0) return; // Prevent duplicate

        app.featuredAnime.forEach(item => {
            const slide = document.createElement('div');
            slide.className = 'slide-item';
            
            // Logika klik: jika tipe search, cari judulnya. Jika detail, buka detail.
            slide.onclick = () => {
                if(item.type === 'search') app.navigate('search', { q: item.title });
                else app.navigate('detail', { id: item.id });
            };

            slide.innerHTML = `
                <img src="${item.cover}" alt="${item.title}">
                <div class="slide-caption">
                    <div class="slide-title">${item.title}</div>
                </div>
            `;
            slider.appendChild(slide);
        });
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

    // --- HOME ---
    loadHome: async () => {
        // Render slider dulu (statis)
        app.renderSlider();

        const container = document.getElementById('homeList');
        // Simple cache check
        if(container.childElementCount > 0 && app.state.page === parseInt(document.getElementById('currPage').innerText)) return; 

        container.innerHTML = '<div class="loading">Memuat Anime...</div>';
        const data = await app.fetchData(`/anime/latest?page=${app.state.page}`);
        app.renderCards(data, 'homeList');
        document.getElementById('currPage').innerText = app.state.page;
    },

    // --- MOVIES ---
    loadMovies: async () => {
        const container = document.getElementById('movieList');
        if(container.childElementCount > 0) return; 
        container.innerHTML = '<div class="loading">Memuat Movies...</div>';
        const data = await app.fetchData('/anime/movie');
        app.renderCards(data, 'movieList');
    },

    // --- SEARCH ---
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

    // --- DETAIL ---
    loadDetail: async (id) => {
        if(!id) return;
        
        // Reset View biar gak nampilin anime sebelumnya
        document.getElementById('detailBanner').src = "";
        document.getElementById('detailPoster').src = "";
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

    // --- WATCH (UPDATED LOGIC) ---
    loadWatch: async (params) => {
        const { id, ch, title, cover } = Object.fromEntries(params);
        if(!id) return;

        document.getElementById('watchTitle').innerText = title || "Anime";
        document.getElementById('watchEp').innerText = `Episode ${ch}`;
        
        // Save History
        if(title && cover) {
            let history = JSON.parse(localStorage.getItem('icinime_history')) || [];
            history = history.filter(h => h.id !== id); // Remove dupes
            history.unshift({ id, ch, title, cover, date: new Date().toLocaleDateString() });
            localStorage.setItem('icinime_history', JSON.stringify(history));
        }

        const btnContainer = document.getElementById('resoButtons');
        btnContainer.innerHTML = "";

        // 1. Buat Tombol Resolusi secara Manual (360p, 480p, 720p)
        const resolutions = ['360p', '480p', '720p'];
        
        resolutions.forEach(reso => {
            const btn = document.createElement('button');
            btn.className = 'reso-btn';
            btn.innerText = reso;
            btn.onclick = () => {
                // Hapus active class dari semua tombol
                document.querySelectorAll('.reso-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Panggil fungsi play
                app.playVideo(id, reso);
            };
            btnContainer.appendChild(btn);
        });

        // 2. Auto play 720p saat pertama buka (trigger klik tombol terakhir)
        if(btnContainer.lastChild) {
            btnContainer.lastChild.click();
        }
    },

    // Fungsi Player Baru: Request API per resolusi -> Ambil Link Stream (Index 0)
    playVideo: async (id, reso) => {
        const container = document.getElementById('videoFrame');
        container.innerHTML = `<div class="loading">Memuat Stream ${reso}...</div>`;

        // Request ke API dengan resolusi spesifik
        const json = await app.fetchData(`/anime/getvideo?chapterUrlId=${id}&reso=${reso}`);

        // Parsing: Ambil stream array, pilih index 0 (Streaming Link)
        if(json && json.data && json.data[0] && json.data[0].stream && json.data[0].stream.length > 0) {
            
            // INDEX 0 = STREAMING LINK (Sesuai instruksi)
            const videoData = json.data[0].stream[0]; 
            const link = videoData.link;

            if(link) {
                const isMp4 = link.includes('.mp4');
                if(isMp4) {
                    container.innerHTML = `
                        <video controls autoplay width="100%" height="100%" style="background:black;">
                            <source src="${link}" type="video/mp4">
                        </video>`;
                } else {
                    container.innerHTML = `<iframe src="${link}" allowfullscreen></iframe>`;
                }
            } else {
                container.innerHTML = `<p class="loading">Link ${reso} kosong.</p>`;
            }
        } else {
            container.innerHTML = `<p class="loading">Server ${reso} tidak tersedia.</p>`;
        }
    },

    // --- HISTORY PAGE ---
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

    changePage: (dir) => {
        const newPage = app.state.page + dir;
        if(newPage > 0) {
            app.state.page = newPage;
            app.loadHome();
        }
    },

    toggleSearch: () => {
        const el = document.getElementById('searchOverlay');
        const isVisible = el.style.display === 'block';
        el.style.display = isVisible ? 'none' : 'block';
        if(!isVisible) document.getElementById('searchInput').focus();
    },

    toggleInfo: () => {
        const el = document.getElementById('infoModal');
        el.style.display = (el.style.display === 'flex') ? 'none' : 'flex';
    }
};

document.addEventListener('DOMContentLoaded', app.init);
