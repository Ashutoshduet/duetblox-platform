import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('./client.js',import.meta.url),'utf8')).replace(/^import .*;\n/,'').replaceAll('export ','').replace('import.meta.env?.DEV','false');
function harness(controller){
 const calls=[],owned={scriptURL:'https://example.test/duetblox/sw.js'};
 const context={URL,location:{origin:'https://example.test'},navigator:{serviceWorker:{controller,register:async(...args)=>{calls.push(args);return {active:owned};}}},window:{isSecureContext:true},appPath:p=>'/duetblox/'+p,setTimeout,clearTimeout};
 vm.runInNewContext(source,context);return {context,calls,owned};
}
test('mounted offline commands select their own worker and never the main website controller',async()=>{
 const main={scriptURL:'https://example.test/sw.js'};const h=harness(main);
 assert.equal(h.context.isAppWorker(main),false);
 assert.equal(await h.context.offlineWorker(),h.owned);
 assert.equal(h.calls[0][0],'/duetblox/sw.js');assert.equal(h.calls[0][1].scope,'/duetblox/');
});
test('an already owned controller is reused while an update is registered only inside app scope',async()=>{
 const worker={scriptURL:'https://example.test/duetblox/sw.js'};const h=harness(worker);
 assert.equal(await h.context.offlineWorker(),worker);
 assert.equal(h.calls[0][0],'/duetblox/sw.js');assert.equal(h.calls[0][1].scope,'/duetblox/');
 for(const scriptURL of ['https://other.test/duetblox/sw.js','https://example.test/duetblox-other/sw.js','https://example.test/sw.js'])assert.equal(h.context.isAppWorker({scriptURL}),false);
});
