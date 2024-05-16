import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import Header from '/src/components/Header.vue'
import DetailModal from '/src/components/DetailModal.vue'
import SelectArea from '/src/components/SelectArea.vue'


const app = createApp(App);
const pinia = createPinia()

app.component('Header', Header);
app.component('DetailModal', DetailModal);
app.component('SelectArea', SelectArea);


app.use(pinia);
app.use(ElementPlus);
app.mount('#app')

