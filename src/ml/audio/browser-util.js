/** Minimal callback-to-Promise adapter required by the official speech-commands
 * browser bundle's optional Node file-metadata branch. Browser model imports
 * use HTTPS or in-memory artifacts; no Node filesystem access is provided. */
export function promisify(fn){return function(...args){if(typeof fn!=='function')return Promise.reject(new Error('Local filesystem metadata URLs are unavailable in a browser.'));return new Promise((resolve,reject)=>fn.call(this,...args,(error,value)=>error?reject(error):resolve(value)));};}
