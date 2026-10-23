const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function within(promise,timeoutMs,message='Serial cleanup timed out. Unplug and reconnect the board before retrying.'){
  let timer;
  return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),timeoutMs);})]).finally(()=>clearTimeout(timer));
}

// esptool-js 0.7.0 does not release a writer when write() rejects and its
// disconnect waits indefinitely for locks. Keep its protocol/SLIP machinery,
// but own stream cleanup and cancellation for this one upload.
export function safeESPTransport(Base,{checkCancelled=()=>{},cleanupTimeoutMs=2000}={}){
  return class SafeESPTransport extends Base{
    constructor(...args){super(...args);this.uploadOpened=false;this.opening=null;this.closing=null;this.disposal=null;this.disposed=false;this.activeWriter=null;this.stopped=new Promise((_,reject)=>{this.rejectStopped=reject;});this.stopped.catch(()=>{});}
    checkActive(){checkCancelled();if(this.disposed)throw new Error('Firmware upload cancelled.');}
    async connect(...args){
      this.checkActive();if(this.closing)await this.closing;this.checkActive();
      if(this.opening)throw new Error('Serial port is already opening.');
      const opening=(async()=>{await super.connect(...args);this.uploadOpened=true;this.checkActive();})();
      this.opening=opening;
      const clear=()=>{if(this.opening===opening)this.opening=null;};opening.then(clear,clear);
      // Cancellation releases the caller immediately, while opening remains
      // tracked until the native operation settles and disposal can close it.
      await Promise.race([opening,this.stopped]);
    }
    async write(data){
      this.checkActive();
      if(!this.device.writable)throw new Error('Serial connection is closed.');
      const writer=this.device.writable.getWriter();this.activeWriter=writer;
      try{await Promise.race([writer.write(this.slipWriter(data)),this.stopped]);this.checkActive();}
      finally{writer.releaseLock();if(this.activeWriter===writer)this.activeWriter=null;}
    }
    async read(...args){this.checkActive();return Promise.race([super.read(...args),this.stopped]);}
    async closeOwnedPort(){
      // A pending open cannot be canceled by Web Serial. Wait for it and then
      // close it, even if the outer bounded disposal has already timed out.
      if(this.opening)await this.opening.catch(()=>{});
      if(!this.uploadOpened)return;
      const deadline=Date.now()+cleanupTimeoutMs;
      this.reader?.cancel().catch(()=>{});
      this.activeWriter?.abort(new Error('Firmware upload cancelled.')).catch(()=>{});
      while(this.device.readable?.locked||this.device.writable?.locked){
        if(Date.now()>=deadline)throw new Error('Serial cleanup timed out. Unplug and reconnect the board before retrying.');
        await delay(10);
      }
      await within(this.device.close(),Math.max(1,deadline-Date.now()));
      this.uploadOpened=false;this.reader=undefined;
    }
    async disconnect(){
      if(this.closing)return this.closing;
      const closing=this.closeOwnedPort();this.closing=closing;
      try{await closing;}finally{if(this.closing===closing)this.closing=null;}
    }
    dispose(){
      if(!this.disposal){this.disposed=true;this.rejectStopped(new Error('Firmware upload cancelled.'));this.disposal=within(this.disconnect(),cleanupTimeoutMs);}
      return this.disposal;
    }
  };
}
