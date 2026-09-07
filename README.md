# Personal Academic Dashboard

Dashboard akademik pribadi berbasis Node.js, Express, EJS, dan SQLite untuk jadwal, tugas, dan shortcut catatan.

## Menjalankan lokal

```bash
npm install
npm start
```

Buka `http://localhost:3000`. Port memakai `process.env.PORT || 3000`.

## Struktur folder

- `server.js`: entry point Express dan error handling
- `routes/`: route dashboard, jadwal, tugas, dan catatan
- `views/`: template EJS dan partial layout
- `public/`: CSS dan JavaScript browser
- `config/schedule.js`: data jadwal dummy
- `config/notes.js`: data link Google Docs
- `database/db.js`: inisialisasi SQLite dan helper query
- `database/academic.db`: dibuat otomatis saat pertama kali start

## Mengubah data

Edit array `schedule` di `config/schedule.js` untuk mengganti jadwal. Edit array `notes` di `config/notes.js` untuk mengganti judul, deskripsi, dan URL Google Docs. Gunakan URL HTTPS milik Anda sendiri.

Tugas dikelola dari halaman **Tugas** dengan tambah, edit, hapus, filter, dan toggle selesai. Database persisten disimpan di folder `database`, di luar `public`.

## Deploy ke Hostinger Node.js

1. Upload project beserta `package.json` dan `package-lock.json`.
2. Di Node.js App, pilih application root project dan startup file `server.js`.
3. Jalankan install dependencies melalui panel atau `npm install`.
4. Start/restart aplikasi. Hostinger menyediakan `PORT` secara otomatis.
5. Pastikan folder `database` dapat ditulis agar SQLite tetap persisten.

Salin `.env.example` bila ingin mendokumentasikan environment lokal. Tidak ada API key atau secret yang dibutuhkan. `DB_PATH` opsional jika ingin memindahkan lokasi database; `PORT` disediakan Hostinger.

## Catatan keamanan

Input tugas divalidasi di server, query SQLite menggunakan parameter, output EJS di-escape secara default, Helmet aktif, dan file database tidak disajikan sebagai static file.
