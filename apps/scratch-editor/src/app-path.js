// Replaced by the editor build; no host-origin root assumptions inside an iframe.
const base = typeof __DUETBLOX_BASE_PATH__ === 'string' ? __DUETBLOX_BASE_PATH__ : '/';
export const editorAppPath = resource => base + resource.replace(/^\/+/, '');
