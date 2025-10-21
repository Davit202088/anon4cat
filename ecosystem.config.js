module.exports = {
  apps: [{
    name: 'drugru',
    script: './server.js',

    // ВАЖНО: Запускаем только ОДИН инстанс!
    // Если запустить несколько, они не смогут найти друг друга
    instances: 1,
    exec_mode: 'fork', // НЕ 'cluster'!

    // Автоперезапуск при падении
    autorestart: true,
    watch: false,

    // Переменные окружения
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      // Добавьте сюда свой Telegram ID через запятую (например: "123456789,987654321")
      ADMIN_IDS: "123456789",
      BOT_TOKEN: ""
    },

    // Логи
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Максимальная память (512MB)
    max_memory_restart: '512M',

    // Минимальное время работы перед считается стабильным
    min_uptime: '10s',

    // Максимум перезапусков за время
    max_restarts: 10,
    restart_delay: 4000
  }]
};
