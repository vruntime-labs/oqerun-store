import type { Application } from '../models/App';

export const catalogData: Application[] = [
  {
    id: 'com.vruntime.oqerun.office',
    name: 'Oqerun Office',
    version: '0.3.0',
    description: 'Open-source productivity suite with Writer, Sheets, and Slides for the Oqerun ecosystem.',
    category: 'Productivity',
    icon: '▣',
    featured: true,
    publisher: { name: 'VRuntime Labs', verified: true },
    source: { type: 'github', repository: 'vruntime-labs/oqerun-office' },
    license: 'MIT',
    type: 'web',
    compatibility: { minimumOqerunVersion: '0.1.0' },
    installation: {
      method: 'web',
      url: 'https://vruntime-labs.github.io/oqerun-office/'
    },
    permissions: ['filesystem.read', 'filesystem.write', 'network'],
    fileAssociations: ['.oqdoc', '.oqsheet', '.oqslide', '.docx', '.xlsx', '.pptx']
  },
  {
    id: 'org.example.sample-pwa',
    name: 'Sample PWA',
    version: '1.0.0',
    description: 'Example application demonstrating the PWA provider.',
    category: 'Internet',
    icon: '◎',
    publisher: { name: 'Example Developer', verified: false },
    source: { type: 'url', url: 'https://example.com/' },
    license: 'MIT',
    type: 'pwa',
    compatibility: { minimumOqerunVersion: '0.1.0' },
    installation: { method: 'pwa', url: 'https://example.com/' },
    permissions: ['network']
  }
];
