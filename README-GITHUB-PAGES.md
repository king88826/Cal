# GitHub Pages

Project nay da duoc chuan bi de deploy len GitHub Pages bang GitHub Actions.

## Cach dung

1. Tao repository moi tren GitHub.
2. Day toan bo thu muc nay len nhanh `main`.
3. Vao `Settings` -> `Pages`.
4. Trong `Build and deployment`, chon `Source: GitHub Actions`.
5. Push moi len `main` se tu dong deploy.

## Timestamp deploy

Workflow se tao `build-meta.js` ngay trong luc deploy voi format:

`vxx.xx hh:mm ddmmyy by Tiến Đức`

Moc gio dang dung:

- mui gio `Asia/Ho_Chi_Minh`
- lay theo luc GitHub Actions build/deploy

## URL

Sau khi publish, URL thuong co dang:

`https://<github-username>.github.io/<repo-name>/`
