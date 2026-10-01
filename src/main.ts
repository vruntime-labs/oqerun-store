import './ui/styles.css';
import { Store } from './core/Store';
const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Oqerun Store root element was not found.');
new Store(root).render();
