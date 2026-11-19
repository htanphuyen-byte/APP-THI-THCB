const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'questions_db.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'user_progress.json');

// Ensure user_progress.json exists
if (!fs.existsSync(PROGRESS_FILE)) {
  fs.writeFileSync(
    PROGRESS_FILE,
    JSON.stringify({ setStats: {}, wrongQuestionIds: [], history: [] }, null, 2),
    'utf-8'
  );
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // API: Get database (10 fixed sets + 120 questions + explanations)
  if (req.method === 'GET' && pathname === '/api/db') {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache'
      });
      return res.end(raw);
    } catch (err) {
      return sendJson(res, 500, { error: 'Không thể đọc dữ liệu câu hỏi', details: err.message });
    }
  }

  // API: Get user progress
  if (req.method === 'GET' && pathname === '/api/progress') {
    try {
      const raw = fs.readFileSync(PROGRESS_FILE, 'utf-8');
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      return res.end(raw);
    } catch (err) {
      return sendJson(res, 200, { setStats: {}, wrongQuestionIds: [], history: [] });
    }
  }

  // API: Save user progress
  if (req.method === 'POST' && pathname === '/api/progress') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 5 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
        return sendJson(res, 200, { ok: true });
      } catch (err) {
        return sendJson(res, 400, { error: 'Dữ liệu không hợp lệ' });
      }
    });
    return;
  }

  // Serve original PDFs if user clicks to view source PDF
  if (req.method === 'GET' && ['/2512.Ca1.pdf', '/2512.Ca2.pdf', '/2512.Ca3.pdf'].includes(pathname)) {
    const pdfPath = path.join(__dirname, pathname.slice(1));
    if (fs.existsSync(pdfPath)) {
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      return fs.createReadStream(pdfPath).pipe(res);
    }
  }

  // Serve static files from /public
  let safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html
      const indexFile = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexFile, (err2, content) => {
        if (err2) {
          res.writeHead(404);
          return res.end('Not found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('==========================================================');
  console.log(`🚀 Server Ôn Thi Trắc Nghiệm Tin Học đã khởi chạy!`);
  console.log(`👉 Mở trình duyệt tại: http://localhost:${PORT}`);
  console.log('==========================================================');
});
