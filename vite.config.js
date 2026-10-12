export default {
  server: { port: 5173, strictPort: true },
  build: {
    target: 'esnext',
    // 多頁：index.html（沙盒）＋ puzzle.html（解謎遊戲，主產品）都打包
    rollupOptions: { input: { main: 'index.html', puzzle: 'puzzle.html' } },
  },
};
