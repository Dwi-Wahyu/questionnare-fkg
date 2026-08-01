# Nginx: redirect ke KATEGORI, bukan ke slug survey

Ganti baris `return 302 ...` di tiap file berikut. Struktur SSL/listen/certbot
biarkan sama persis seperti sekarang — cukup ganti target redirect-nya.

## `/etc/nginx/sites-enabled/kepuasan-mahasiswa-fkg`
```nginx
server {
    server_name kepuasan-mahasiswa.minmat2026.my.id;
    location / {
        return 302 https://survey.minmat2026.my.id/s/survey-kepuasan;
    }
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/kepuasan-mahasiswa.minmat2026.my.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kepuasan-mahasiswa.minmat2026.my.id/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
server {
    if ($host = kepuasan-mahasiswa.minmat2026.my.id) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name kepuasan-mahasiswa.minmat2026.my.id;
    return 404;
}
```

## `/etc/nginx/sites-enabled/tracerstudy-fkg`
```nginx
    location / {
        return 302 https://survey.minmat2026.my.id/s/tracer-study;
    }
```

## `/etc/nginx/sites-enabled/pengaduan-fkg`
```nginx
    location / {
        return 302 https://survey.minmat2026.my.id/s/layanan-pengaduan;
    }
```

## `/etc/nginx/sites-enabled/survey-pengguna-fkg`
```nginx
    location / {
        return 302 https://survey.minmat2026.my.id/s/survey-pengguna;
    }
```

(`survey-fkg` — domain utama `survey.minmat2026.my.id` — tidak diubah, itu
memang app-nya langsung, bukan redirect kategori.)

**Slug kategori di atas HARUS persis sama dengan kolom `slug` di tabel
`survey_categories`** (lihat `seedCategories.ts`):
`survey-kepuasan`, `tracer-study`, `survey-pengguna`, `layanan-pengaduan`.

Setelah edit semua file:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Kenapa ini menyelesaikan masalahnya

- Sebelumnya: nginx redirect ke `/survey/kepuasan-mahasiswa` (slug survey
  spesifik) → tiap ganti periode = harus bikin survey baru dengan slug baru
  = harus edit nginx lagi.
- Sekarang: nginx redirect ke `/s/survey-kepuasan` (slug KATEGORI, permanen)
  → route baru di app (`s.$categorySlug.tsx`) yang mencari survey
  **published** terbaru di kategori itu, lalu redirect ke slug aktualnya.
- Alur ganti periode jadi murni operasi admin di dashboard:
  1. Buat survey baru untuk periode berikutnya (kategori sama, slug baru,
     status "published").
  2. Set survey periode lama jadi "archived".
  3. Selesai — subdomain otomatis mengarah ke survey baru, nginx tidak
     disentuh sama sekali.

## Catatan
- Kalau lupa meng-archive survey lama sehingga ada 2 survey "published"
  sekaligus di satu kategori, route ini akan memilih yang **paling baru
  dibuat** (bukan error) — tapi tetap sebaiknya di-archive supaya tidak
  membingungkan di halaman admin/listing publik juga.
- Kalau belum ada survey published sama sekali di kategori itu, pengunjung
  akan melihat halaman "Belum Ada Survei Aktif" alih-alih error mentah.
- Setelah menambah file route baru (`s.$categorySlug.tsx`), jalankan build/dev
  seperti biasa — TanStack Router plugin akan meng-generate ulang
  `routeTree.gen.ts` secara otomatis (tidak perlu diedit manual).
