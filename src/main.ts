import './ui/styles.css';
import './ui/publish.css';
import './ui/density.css';
import './ui/identity.css';
import { Store } from './core/Store';
import { PublishApp } from './ui/PublishApp';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Oqerun Store root element was not found.');

new Store(root).render();
new PublishApp(root).mount();
