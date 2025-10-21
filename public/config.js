// ============================================
// ФАЙЛ КОНФИГУРАЦИИ - ЗДЕСЬ МОЖНО МЕНЯТЬ ТЕКСТ
// ============================================

const APP_CONFIG = {
  // Основные тексты приложения
  texts: {
    // Заголовок приложения
    appTitle: 'АНОН-ЧАТ',

    // Подзаголовок
    appSubtitle: 'Анонимный голосовой чат',

    // Подсказка по свайпу
    swipeHint: 'Свайп влево/вправо для смены собеседника',

    // Кнопки
    buttons: {
      find: '→ НАЙТИ СОБЕСЕДНИКА',
      next: '⏭ СЛЕДУЮЩИЙ',
      mute: '🔊 МИК ВЫКЛ',
      muteOn: '🔇 МИК ВКЛ',
      leave: '× ЗАВЕРШИТЬ',
      settings: '⚙ Настройки',
      saveSettings: '→ СОХРАНИТЬ НАСТРОЙКИ'
    },

    // Статусы
    status: {
      initial: '>> PRESS BUTTON TO START',
      connecting: '>> CONNECTING...',
      searching: '>> ПОИСК СОБЕСЕДНИКА...',
      waiting: '>> ОЖИДАНИЕ СОБЕСЕДНИКА...',
      connected: '>> CONNECTION ESTABLISHED',
      active: '>> VOICE CHAT ACTIVE',
      disconnected: '>> СОБЕСЕДНИК ОТКЛЮЧИЛСЯ',
      connectionLost: '>> CONNECTION LOST',
      connectionClosed: '>> CONNECTION CLOSED',
      reconnecting: '>> RECONNECTING...',
      connectionTimeout: '>> ERROR: CONNECTION TIMEOUT',
      errorConnection: '>> ERROR: CONNECTION FAILED',
      errorMicrophone: '>> ERROR: MICROPHONE ACCESS DENIED',
      readyToSearch: '>> READY TO SEARCH',
      searchingNext: '>> ПОИСК СЛЕДУЮЩЕГО СОБЕСЕДНИКА...'
    },

    // Настройки
    settings: {
      title: '⚙ НАСТРОЙКИ',
      basicSettings: '// Основные настройки',
      filterSettings: '// Фильтры поиска',
      premiumBadge: 'Premium',

      // Лейблы настроек
      labels: {
        nickname: 'Ваш никнейм',
        avatar: 'Аватар',
        soundNotif: 'Звук уведомлений',
        autoSearch: 'Автоматический поиск',
        genderFilter: 'Фильтр по полу',
        ageFrom: 'Возраст от',
        ageTo: 'Возраст до',
        interests: 'Фильтр по интересам'
      },

      // Плейсхолдеры
      placeholders: {
        nickname: 'Введите ник',
        interests: 'Спорт, музыка...'
      }
    },

    // Уведомления
    alerts: {
      microphoneAccess: '⚠️ Пожалуйста, разрешите доступ к микрофону для использования чата',
      settingsSaved: '✅ Настройки сохранены!'
    }
  },

  // Цветовая схема (можно менять цвета)
  colors: {
    primary: '#00f2fe',      // Голубой неон
    secondary: '#ff00ff',    // Розовый неон
    accent: '#a0a8ff',       // Фиолетовый
    background: '#0a0e27',   // Темно-синий фон
    text: '#ffffff'          // Белый текст
  }
};

// Не удаляйте эту строку!
if (typeof module !== 'undefined' && module.exports) {
  module.exports = APP_CONFIG;
}
