// Buffered Web Serial transport for the pinned STK500 programmers.
// Their API names DTR/RTS differently from the browser specification.
export class BufferedSerialTransport{
  constructor(port){this.port=port;this.listeners=new Set();this.queue=[];this.queuedBytes=0;this.closed=true;this.failure=null;}
  async open(baudRate){await this.port.open({baudRate,bufferSize:4096});this.reader=this.port.readable.getReader();this.writer=this.port.writable.getWriter();this.closed=false;this.readTask=this.readLoop();}
  async readLoop(){try{while(!this.closed){const {value,done}=await this.reader.read();if(done)break;if(value?.length){if(this.listeners.size){for(const fn of [...this.listeners])fn(value);}else{this.queue.push(value);this.queuedBytes+=value.length;if(this.queuedBytes>8192)throw new Error('Unexpected serial data overflow.');}}}}catch(error){if(!this.closed)this.failure=error;}finally{if(!this.closed)this.failure??=new Error('Serial device disconnected.');}}
  on(event,handler){this.listeners.add(handler);queueMicrotask(()=>{while(this.queue.length&&this.listeners.has(handler)){const bytes=this.queue.shift();this.queuedBytes-=bytes.length;handler(bytes);}});}
  off(event,handler){this.listeners.delete(handler);}
  async write(data){if(this.failure)throw this.failure;if(this.closed)throw new Error('Serial connection is closed.');await this.writer.write(data);}
  async setSignals(signals){const mapped={};if('dtr' in signals)mapped.dataTerminalReady=signals.dtr;if('rts' in signals)mapped.requestToSend=signals.rts;await this.port.setSignals(mapped);}
  async close(){this.closed=true;this.listeners.clear();this.queue=[];try{await this.reader?.cancel();await this.readTask;}catch{}try{this.reader?.releaseLock();}catch{}try{await this.writer?.close();}catch{}try{this.writer?.releaseLock();}catch{}try{await this.port.close();}catch{}}
}
