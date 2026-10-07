import { createApp } from 'vue'
import App from '../pages/Category.vue'
import '../styles/main.css'
import { startVersionWatch } from '../lib/version.js'
createApp(App).mount('#app')

startVersionWatch()
